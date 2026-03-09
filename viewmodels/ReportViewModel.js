import ExcelService from "../services/ExcelService.js";

class ReportViewModel {
    constructor(goodsData) {
        this.goods = goodsData;
    }

    getFilteredData(minSales, startDate, endDate) {

        return this.goods.filter(good => {

            const saleDate = new Date(good.saleDate);

            return (
                good.sales >= minSales &&
                saleDate >= startDate &&
                saleDate <= endDate
            );
        });
    }

    async exportReport(config) {
        const filteredData = this.getFilteredData(
            config.minSales,
            config.startDate,
            config.endDate
        );

        const sorted = filteredData.sort((a, b) => b.sales - a.sales);

        const dataForExcel = sorted.map((item, index) => ({
            "Позиция": index + 1,
            "Название": item.name,
            "Поставщик": item.supplier,
            "Продажи": item.sales,
            "Дата продажи": item.saleDate,
            "Цена": item.price
        }));

        await ExcelService.generateRatingReport(dataForExcel);
    }
}

export default ReportViewModel;