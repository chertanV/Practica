/**
 * ExcelService.js — экспорт отчётов в Excel (.xlsx)
 * Отвечает за: формирование детального отчёта (товары, цены, выручка) и отчёта по контрагентам,
 * настройку ширины колонок и скачивание файла (библиотека XLSX)
 */
import * as XLSX from 'https://cdn.jsdelivr.net/npm/xlsx/+esm';

class ExcelService {

    /** Детальный отчёт. data — массив объектов (первая строка — период). Автоширина колонок */
    static async generateDetailReport(data, periodStr = "") {
        const worksheet = XLSX.utils.json_to_sheet(data);
        const colWidths = [{ wch: 8 }, { wch: 25 }, { wch: 18 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 14 }];
        worksheet["!cols"] = colWidths;
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Детальный отчёт");
        XLSX.writeFile(workbook, "detail_report.xlsx");
    }

    /** Отчёт по контрагентам. Период в первой строке, итоги в конце, автоширина колонок */
    static async generateCounterpartyReport(data, periodStr = "") {
        const worksheet = XLSX.utils.json_to_sheet(data);
        const colWidths = [{ wch: 8 }, { wch: 28 }, { wch: 14 }, { wch: 16 }];
        worksheet["!cols"] = colWidths;
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "По контрагентам");
        XLSX.writeFile(workbook, "counterparty_report.xlsx");
    }
}

export default ExcelService;