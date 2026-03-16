/**
 * ReportViewModel.js — логика отчётов (фильтрация, агрегация, экспорт)
 * Отвечает за: фильтрацию по периоду/поставщику/мин. продажам, агрегацию по товарам или контрагентам,
 * формирование данных для таблицы и вызов ExcelService для экспорта
 */
import ExcelService from "../services/ExcelService.js";

class ReportViewModel {
    /** goodsData — массив объектов продаж { name, counterparty, rating, saleDate, price, purchasePrice, salePrice } */
    constructor(goodsData) {
        this.goods = goodsData;
    }

    /** Фильтрация по мин. продажам, периоду и поставщику */
    getFilteredData(minSales, startDate, endDate, supplier = "") {
        return this.goods.filter(good => {
            const saleDate = new Date(good.saleDate);
            const dateOk = saleDate >= startDate && saleDate <= endDate;
            const salesOk = good.rating >= minSales;
            const supplierOk = !supplier || good.counterparty === supplier;
            return dateOk && salesOk && supplierOk;
        });
    }

    /** Экспорт в Excel. minSales применяется к агрегированным строкам. Период выносится отдельно. */
    async exportReport(config) {
        const minSales = config.minSales ?? 0;
        const supplier = config.supplier ?? "";
        const filteredData = this.getFilteredData(0, config.startDate, config.endDate, supplier);

        const periodStr = config.startDate && config.endDate
            ? `Период: ${config.startDate.toLocaleDateString("ru-RU")} — ${config.endDate.toLocaleDateString("ru-RU")}`
            : "";

        if (config.reportType === "counterparty") {
            const byCounterparty = {};
            filteredData.forEach((item) => {
                const key = item.counterparty || "Без поставщика";
                if (!byCounterparty[key]) {
                    byCounterparty[key] = { counterparty: key, quantity: 0, total: 0 };
                }
                byCounterparty[key].quantity += item.rating;
                byCounterparty[key].total += item.rating * (item.price || 0);
            });
            let aggRows = Object.values(byCounterparty).sort((a, b) => b.quantity - a.quantity);
            if (minSales > 0) aggRows = aggRows.filter((r) => r.quantity >= minSales);
            const totalQty = aggRows.reduce((s, r) => s + r.quantity, 0);
            const totalSum = aggRows.reduce((s, r) => s + (r.total || 0), 0);
            const dataForExcel = [
                { "": periodStr },
                {},
                ...aggRows.map((item, index) => ({
                    "Позиция": index + 1,
                    "Контрагент": item.counterparty,
                    "Кол-во проданных": item.quantity,
                    "Сумма": item.total
                })),
                {},
                { "Позиция": "", "Контрагент": "Итого", "Кол-во проданных": totalQty, "Сумма": totalSum }
            ];
            await ExcelService.generateCounterpartyReport(dataForExcel, periodStr);
        } else {
            const byProduct = {};
            filteredData.forEach((item) => {
                const key = item.name || "Без названия";
                if (!byProduct[key]) {
                    byProduct[key] = {
                        name: key,
                        counterparty: item.counterparty,
                        quantity: 0,
                        revenue: 0,
                        purchasePrice: item.purchasePrice ?? 0,
                        salePrice: item.salePrice ?? 0,
                    };
                }
                byProduct[key].quantity += item.rating;
                byProduct[key].revenue += item.rating * (item.price || 0);
            });
            let aggRows = Object.values(byProduct).sort((a, b) => b.quantity - a.quantity);
            if (minSales > 0) aggRows = aggRows.filter((r) => r.quantity >= minSales);
            const totalRev = aggRows.reduce((s, r) => s + (r.revenue || 0), 0);
            const dataForExcel = [
                { "Позиция": "", "Название": periodStr, "Поставщик": "", "Продажи": "", "Цена закупки": "", "Цена продажи": "", "Выручка": "" },
                {},
                ...aggRows.map((item, index) => ({
                    "Позиция": index + 1,
                    "Название": item.name,
                    "Поставщик": item.counterparty,
                    "Продажи": item.quantity,
                    "Цена закупки": item.purchasePrice,
                    "Цена продажи": item.salePrice,
                    "Выручка": item.revenue
                })),
                {},
                { "Позиция": "", "Название": "Итого", "Поставщик": "", "Продажи": "", "Цена закупки": "", "Цена продажи": "", "Выручка": totalRev }
            ];
            await ExcelService.generateDetailReport(dataForExcel, periodStr);
        }
    }
}

export default ReportViewModel;