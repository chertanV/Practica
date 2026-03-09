/**
 * reportPage.js — страница отчётов
 * Детальный отчёт (период, товар, цены, выручка) и по контрагентам. Фильтры, таблица, экспорт Excel.
 */
import { db } from "../services/firebaseConfig.js";
import {
  collection,
  getDocs,
  Timestamp
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";
import ReportViewModel from "../viewmodels/ReportViewModel.js";

let viewModel = null;  // ReportViewModel с данными продаж

/** Парсинг даты из input[type=date]. endOfDay=true — конец дня (23:59:59) для корректного фильтра */
function parseDateInput(id, endOfDay = false) {
  const value = document.getElementById(id)?.value;
  if (!value) return null;
  return new Date(value + (endOfDay ? "T23:59:59" : "T00:00:00"));
}

function formatDate(d) {
  return d ? d.toLocaleDateString("ru-RU") : "—";
}

function formatPrice(val) {
  if (val == null || val === "") return "—";
  return Number(val).toLocaleString("ru-RU");
}

/** Отрисовка отчёта в таблице: detail (по товарам) или counterparty (по поставщикам) */
function renderReport(rows, reportType, startDate, endDate) {
  const tbody = document.getElementById("reportTable");
  const countEl = document.getElementById("reportCount");
  const emptyEl = document.getElementById("reportEmpty");
  const table = document.getElementById("reportTable")?.closest("table");
  const thead = table?.querySelector("thead tr");
  const periodStr = startDate && endDate ? `${formatDate(startDate)} — ${formatDate(endDate)}` : "";
  if (!tbody) return;

  if (reportType === "counterparty") {
    const byCounterparty = {};
    rows.forEach((item) => {
      const key = item.counterparty || "Без поставщика";
      if (!byCounterparty[key]) {
        byCounterparty[key] = { counterparty: key, quantity: 0, total: 0 };
      }
      byCounterparty[key].quantity += item.rating;
      byCounterparty[key].total += item.rating * (item.price || 0);
    });
    const aggRows = Object.values(byCounterparty).sort((a, b) => b.quantity - a.quantity);
    if (thead) thead.innerHTML = "<th>#</th><th>Контрагент</th><th>Кол-во</th><th>Сумма</th>";
    tbody.innerHTML = "";
    aggRows.forEach((r, idx) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td class="mono">${idx + 1}</td>
        <td>${r.counterparty}</td>
        <td>${r.quantity}</td>
        <td class="price">${r.total?.toLocaleString("ru-RU") ?? "—"}</td>
      `;
      tbody.appendChild(tr);
    });
    if (countEl) countEl.textContent = String(aggRows.length);
  } else {
    const byProduct = {};
    rows.forEach((item) => {
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
    if (thead) thead.innerHTML = "<th>#</th><th>Период</th><th>Название</th><th>Поставщик</th><th>Продажи</th><th>Цена закупки</th><th>Цена продажи</th><th>Выручка</th>";
    tbody.innerHTML = "";
    aggRows.forEach((r, idx) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td class="mono">${idx + 1}</td>
        <td class="mono">${periodStr}</td>
        <td>${r.name}</td>
        <td>${r.counterparty}</td>
        <td>${r.quantity}</td>
        <td class="price">${formatPrice(r.purchasePrice)}</td>
        <td class="price">${formatPrice(r.salePrice)}</td>
        <td class="price">${formatPrice(r.revenue)}</td>
      `;
      tbody.appendChild(tr);
    });
    if (countEl) countEl.textContent = String(aggRows.length);
  }
  if (emptyEl) {
    emptyEl.classList.toggle("hidden", tbody.querySelectorAll("tr").length > 0);
  }
}

/** Загрузка продаж и товаров из Firestore, создание ReportViewModel, заполнение фильтра поставщиков */
async function loadSoldGoods() {
  try {
    const [salesSnap, productsSnap] = await Promise.all([
      getDocs(collection(db, "sales")),
      getDocs(collection(db, "products")),
    ]);
    const productsById = {};
    const productsByName = {};
    productsSnap.docs.forEach((d) => {
      const data = d.data();
      productsById[d.id] = data;
      if (data.name) productsByName[data.name] = data;
    });

    const goods = salesSnap.docs.map((docSnap) => {
      const d = docSnap.data();
      let saleDate = d.saleDate;
      if (saleDate instanceof Timestamp) saleDate = saleDate.toDate();
      else if (typeof saleDate === "string") saleDate = new Date(saleDate);
      else saleDate = new Date();

      const product = productsById[d.productId] || productsByName[d.productName || d.name];
      const purchasePrice = d.purchasePrice ?? product?.purchasePrice ?? product?.price ?? 0;
      const salePrice = d.salePrice ?? product?.salePrice ?? product?.price ?? 0;
      const price = Number(d.discountedPrice ?? d.fullPrice ?? d.price ?? salePrice ?? 0);

      return {
        name: d.productName || d.name || "",
        counterparty: d.counterparty || "",
        rating: Number(d.quantity ?? d.rating ?? d.sales ?? 0),
        saleDate,
        price,
        purchasePrice,
        salePrice,
      };
    });
    viewModel = new ReportViewModel(goods);
    fillSupplierFilter(goods);
  } catch (e) {
    console.error("Ошибка загрузки продаж:", e);
    viewModel = new ReportViewModel([]);
  }
}

/** Заполнение выпадающего списка поставщиков для фильтра */
function fillSupplierFilter(goods) {
  const sel = document.getElementById("supplierFilter");
  if (!sel) return;
  const suppliers = Array.from(new Set(goods.map((g) => g.counterparty).filter(Boolean))).sort();
  sel.innerHTML = '<option value="">Все поставщики</option>';
  suppliers.forEach((s) => {
    const opt = document.createElement("option");
    opt.value = s;
    opt.textContent = s;
    sel.appendChild(opt);
  });
}

/** Генерация отчёта по текущим фильтрам и отрисовка в таблице */
function handleGenerate() {
  if (!viewModel) return;
  const minSales = Number(document.getElementById("minSales")?.value || 0);
  const supplier = document.getElementById("supplierFilter")?.value || "";
  const reportType = document.getElementById("reportType")?.value || "detail";
  let startDate = parseDateInput("startDate");
  let endDate = parseDateInput("endDate", true);

  if (!startDate) startDate = new Date("1970-01-01");
  if (!endDate) endDate = new Date("2999-12-31");

  const rows = viewModel.getFilteredData(minSales, startDate, endDate, supplier);
  renderReport(rows, reportType, startDate, endDate);
}

/** Экспорт отчёта в Excel (detail_report.xlsx или counterparty_report.xlsx) */
async function handleExport() {
  if (!viewModel) return;
  const minSales = Number(document.getElementById("minSales")?.value || 0);
  const supplier = document.getElementById("supplierFilter")?.value || "";
  const reportType = document.getElementById("reportType")?.value || "detail";
  let startDate = parseDateInput("startDate");
  let endDate = parseDateInput("endDate", true);

  if (!startDate) startDate = new Date("1970-01-01");
  if (!endDate) endDate = new Date("2999-12-31");

  await viewModel.exportReport({ minSales, startDate, endDate, reportType, supplier });
}

export async function initReportsPage() {
  await loadSoldGoods();

  const btnGenerate = document.getElementById("generateReport");
  const btnExport = document.getElementById("exportExcel");
  if (btnGenerate) btnGenerate.addEventListener("click", () => handleGenerate());
  if (btnExport) btnExport.addEventListener("click", () => handleExport().catch((e) => console.error("Ошибка экспорта:", e)));

  handleGenerate();
}
