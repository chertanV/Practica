/**
 * ExcelService.js — генерация Excel-файлов
 * Использует библиотеку XLSX. Формирует листы из JSON-данных, скачивает .xlsx
 */
import * as XLSX from 'https://cdn.jsdelivr.net/npm/xlsx/+esm';

class ExcelService {

    /** Детальный отчёт: период, название, поставщик, продажи, цены закупки/продажи, выручка */
    static async generateDetailReport(data) {
        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Детальный отчёт");
        XLSX.writeFile(workbook, "detail_report.xlsx");
    }

    /** Отчёт по контрагентам: контрагент, кол-во проданных, сумма */
    static async generateCounterpartyReport(data) {
        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "По контрагентам");
        XLSX.writeFile(workbook, "counterparty_report.xlsx");
    }
}

export default ExcelService;