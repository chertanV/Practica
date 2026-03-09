/**
 * ReportViewModel — логика отчётов (MVVM)
 * Фильтрация продаж, агрегация по товарам/контрагентам, экспорт в Excel
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

    /** Экспорт в Excel: detail (по товарам) или counterparty (по поставщикам). config: { minSales, startDate, endDate, reportType, supplier } */
    async exportReport(config) {
        const minSales = config.minSales ?? 0;
        const supplier = config.supplier ?? "";
        const filteredData = this.getFilteredData(
            minSales,
            config.startDate,
            config.endDate,
            supplier
        );

        const periodStr = config.startDate && config.endDate
            ? `${config.startDate.toLocaleDateString("ru-RU")} — ${config.endDate.toLocaleDateString("ru-RU")}`
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
            const dataForExcel = Object.values(byCounterparty)
                .sort((a, b) => b.quantity - a.quantity)
                .map((item, index) => ({
                    "Позиция": index + 1,
                    "Контрагент": item.counterparty,
                    "Кол-во проданных": item.quantity,
                    "Сумма": item.total
                }));
            await ExcelService.generateCounterpartyReport(dataForExcel);
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
            const aggRows = Object.values(byProduct).sort((a, b) => b.quantity - a.quantity);
            const dataForExcel = aggRows.map((item, index) => ({
                "Позиция": index + 1,
                "Период": periodStr,
                "Название": item.name,
                "Поставщик": item.counterparty,
                "Продажи": item.quantity,
                "Цена закупки": item.purchasePrice,
                "Цена продажи": item.salePrice,
                "Выручка": item.revenue
            }));
            await ExcelService.generateDetailReport(dataForExcel);
        }
    }
}

export default ReportViewModel;