import * as XLSX from 'https://cdn.jsdelivr.net/npm/xlsx/+esm';

/**
 * Сервис для технической работы с Excel-файлами.
 * Не содержит бизнес-логики, только формирование документа.
 */
class ExcelService {

    static async generateRatingReport(data) {

        const worksheet = XLSX.utils.json_to_sheet(data);

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Rating Report");

        XLSX.writeFile(workbook, "rating_report.xlsx");
    }
}

export default ExcelService;