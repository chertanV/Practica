/**
 * ViewModel для управления логикой формирования отчетов.
 * Связывает модель данных и сервис генерации Excel.
*/
import ExcelService from "../services/ExcelService.js";

class ReportViewModel {
    constructor(goodsData) {
        this.goods = goodsData;
    }

    getFilteredData(minRating, startDate, endDate) {
        return this.goods.filter(good => {
            return (
                good.rating >= minRating &&
                good.saleDate >= startDate &&   
                good.saleDate <= endDate
            );
        });
    }

    async exportReport(config) {
        console.log('Вызов экспорта с параметрами:', config);
        const filteredData = this.getFilteredData(
            config.minRating,
            config.startDate,
            config.endDate
        );

        // Добавляем позицию в рейтинге
        const sorted = filteredData.sort((a, b) => b.rating - a.rating);

        const dataForExcel = sorted.map((item, index) => ({
            "Позиция": index + 1,
            "Название": item.name,
            "Поставщик": item.counterparty,
            "Рейтинг": item.rating,
            "Дата продажи": item.saleDate.toISOString().split('T')[0],
            "Цена": item.price
        }));

        await ExcelService.generateRatingReport(dataForExcel);
    }
}

export default ReportViewModel;