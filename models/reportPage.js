import { getProducts } from "../viewmodels/productsViewModel.js";
import ReportViewModel from "../viewmodels/ReportViewModel.js";

let reportVM;

export async function initReportsPage() {
    const goods = await getProducts();
    reportVM = new ReportViewModel(goods);
    setupEvents();
}

function setupEvents() {
    document.getElementById("generateReport").addEventListener("click", generateReport);
    document.getElementById("exportExcel").addEventListener("click", exportExcel);
}

function generateReport() {
    const config = {
        minSales: Number(document.getElementById("minSales").value),
        startDate: new Date(document.getElementById("startDate").value), 
        endDate: new Date(document.getElementById("endDate").value)
    };

    const data = reportVM.getFilteredData(
        config.minSales,
        config.startDate,
        config.endDate
    );

    renderReport(data);
}

function renderReport(data) {
    const table = document.getElementById("reportTable");

    table.innerHTML = "";

    data.forEach((item, index) => {

        table.innerHTML += `
        <tr>
            <td>${index + 1}</td>
            <td>${item.name}</td>
            <td>${item.supplier}</td>
            <td>${item.sales}</td>
            <td>${item.price}</td>
        </tr>
        `;

    });
}

async function exportExcel() {
    const config = {
        minSales: Number(document.getElementById("minSales").value),
        startDate: new Date(document.getElementById("startDate").value),
        endDate: new Date(document.getElementById("endDate").value)
    };
    await reportVM.exportReport(config);
}