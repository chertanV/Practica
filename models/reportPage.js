import { db } from "../services/firebaseConfig.js";
import {
  collection,
  getDocs,
  Timestamp
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";
import SoldGood from "./soldGood.js";
import ReportViewModel from "../viewmodels/ReportViewModel.js";

let viewModel = null;

function parseDateInput(id) {
  const value = document.getElementById(id)?.value;
  if (!value) return null;
  return new Date(value + "T00:00:00");
}

function renderReport(rows) {
  const tbody = document.getElementById("reportTable");
  const countEl = document.getElementById("reportCount");
  const emptyEl = document.getElementById("reportEmpty");
  if (!tbody) return;
  tbody.innerHTML = "";
  rows.forEach((g, idx) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="mono">${idx + 1}</td>
      <td>${g.name}</td>
      <td>${g.counterparty}</td>
      <td>${g.rating}</td>
      <td class="price">${g.price}</td>
    `;
    tbody.appendChild(tr);
  });
  if (countEl) countEl.textContent = String(rows.length);
  if (emptyEl) {
    emptyEl.classList.toggle("hidden", rows.length > 0);
  }
}

async function loadSoldGoods() {
  try {
    const snap = await getDocs(collection(db, "sales"));
    const goods = snap.docs.map((doc) => {
      const d = doc.data();
      let saleDate = d.saleDate;
      if (saleDate instanceof Timestamp) {
        saleDate = saleDate.toDate();
      } else if (typeof saleDate === "string") {
        saleDate = new Date(saleDate);
      } else {
        saleDate = new Date();
      }
      return new SoldGood(
        d.name || "",
        d.counterparty || "",
        Number(d.rating ?? d.sales ?? 0),
        saleDate,
        Number(d.price ?? 0)
      );
    });
    viewModel = new ReportViewModel(goods);
  } catch (e) {
    console.error("Ошибка загрузки продаж:", e);
    viewModel = new ReportViewModel([]);
  }
}

function handleGenerate() {
  if (!viewModel) return;
  const minSales = Number(document.getElementById("minSales")?.value || 1);
  let startDate = parseDateInput("startDate");
  let endDate = parseDateInput("endDate");

  if (!startDate) startDate = new Date("1970-01-01");
  if (!endDate) endDate = new Date("2999-12-31");

  const rows = viewModel.getFilteredData(minSales, startDate, endDate);
  renderReport(rows);
}

async function handleExport() {
  if (!viewModel) return;
  const minSales = Number(document.getElementById("minSales")?.value || 1);
  let startDate = parseDateInput("startDate");
  let endDate = parseDateInput("endDate");

  if (!startDate) startDate = new Date("1970-01-01");
  if (!endDate) endDate = new Date("2999-12-31");

  await viewModel.exportReport({ minRating: minSales, startDate, endDate });
}

export async function initReportsPage() {
  await loadSoldGoods();

  const btnGenerate = document.getElementById("generateReport");
  const btnExport = document.getElementById("exportExcel");
  if (btnGenerate) btnGenerate.addEventListener("click", () => handleGenerate());
  if (btnExport) btnExport.addEventListener("click", () => handleExport().catch((e) => console.error("Ошибка экспорта:", e)));

  handleGenerate();
}
