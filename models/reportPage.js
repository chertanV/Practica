/**
 * reportPage.js — страница отчётов
 * Отвечает за: загрузку продаж из Firestore (формат чека items[] и старый формат), подготовку данных
 * с учётом скидки (discountedPrice), заполнение фильтра поставщиков, отрисовку таблицы и вызов экспорта Excel
 */
import { db } from "../services/firebaseConfig.js";
import {
  collection,
  getDocs,
  Timestamp
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";
import ReportViewModel from "../viewmodels/ReportViewModel.js";

let viewModel = null;  // ReportViewModel с данными продаж

/** Возвращает первый и последний день текущего месяца для периода по умолчанию */
function getDefaultPeriod() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { start, end };
}

/** Парсинг даты из input[type=date]. endOfDay=true — конец дня для корректного фильтра */
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
function renderReport(rows, reportType, startDate, endDate, minSales = 0) {
  const tbody = document.getElementById("reportTable");
  const countEl = document.getElementById("reportCount");
  const emptyEl = document.getElementById("reportEmpty");
  const table = document.getElementById("reportTable")?.closest("table");
  const thead = table?.querySelector("thead tr");
  
  if (!tbody) return;

  if (reportType === "counterparty") {
    const byCounterparty = {};
    rows.forEach((item) => {
      const key = item.counterparty || "Без поставщика";
      if (!byCounterparty[key]) {
        byCounterparty[key] = { counterparty: key, quantity: 0, total: 0 };
      }
      byCounterparty[key].quantity += item.rating;
      byCounterparty[key].total += item.rating * (item.price || 0); // Используем цену со скидкой
    });
    let aggRows = Object.values(byCounterparty).sort((a, b) => b.quantity - a.quantity);
    if (minSales > 0) aggRows = aggRows.filter((r) => r.quantity >= minSales);
    
    if (thead) thead.innerHTML = "<th>#</th><th>Контрагент</th><th>Кол-во</th><th>Сумма</th>";
    tbody.innerHTML = "";
    
    let totalQty = 0;
    let totalSum = 0;
    aggRows.forEach((r, idx) => {
      totalQty += r.quantity;
      totalSum += r.total || 0;
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td class="mono">${idx + 1}</td>
        <td>${r.counterparty}</td>
        <td>${r.quantity}</td>
        <td class="price">${formatPrice(r.total)}</td>
      `;
      tbody.appendChild(tr);
    });
    
    const totalTr = document.createElement("tr");
    totalTr.className = "report-total";
    totalTr.innerHTML = `<td colspan="2"><strong>Итого</strong></td><td>${totalQty}</td><td class="price">${formatPrice(totalSum)}</td>`;
    tbody.appendChild(totalTr);
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
          priceWithDiscount: item.price ?? 0, // Фактическая цена из чека
        };
      }
      byProduct[key].quantity += item.rating;
      byProduct[key].revenue += item.rating * (item.price || 0);
    });

    let aggRows = Object.values(byProduct).sort((a, b) => b.quantity - a.quantity);
    if (minSales > 0) aggRows = aggRows.filter((r) => r.quantity >= minSales);
    
    if (thead) thead.innerHTML = "<th>#</th><th>Название</th><th>Поставщик</th><th>Продажи</th><th>Цена закупки</th><th>Цена (со скидкой)</th><th>Выручка</th>";
    tbody.innerHTML = "";
    
    let totalQty = 0;
    let totalRev = 0;
    aggRows.forEach((r, idx) => {
      totalQty += r.quantity;
      totalRev += r.revenue || 0;
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td class="mono">${idx + 1}</td>
        <td>${r.name}</td>
        <td>${r.counterparty}</td>
        <td>${r.quantity}</td>
        <td class="price">${formatPrice(r.purchasePrice)}</td>
        <td class="price">${formatPrice(r.priceWithDiscount)}</td>
        <td class="price">${formatPrice(r.revenue)}</td>
      `;
      tbody.appendChild(tr);
    });

    const totalTr = document.createElement("tr");
    totalTr.className = "report-total";
    totalTr.innerHTML = `<td colspan="3"><strong>Итого</strong></td><td>${totalQty}</td><td colspan="2"></td><td class="price"><strong>${formatPrice(totalRev)}</strong></td>`;
    tbody.appendChild(totalTr);
    if (countEl) countEl.textContent = String(aggRows.length);
  }

  if (emptyEl) {
    emptyEl.classList.toggle("hidden", tbody.querySelectorAll("tr").length > 0);
  }
}

/** Загрузка продаж и товаров из Firestore */
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

    const goods = [];
    salesSnap.docs.forEach((docSnap) => {
      const d = docSnap.data();
      let saleDate = d.saleDate;
      if (saleDate instanceof Timestamp) saleDate = saleDate.toDate();
      else if (typeof saleDate === "string") saleDate = new Date(saleDate);
      else saleDate = new Date();

      if (d.items && Array.isArray(d.items) && d.items.length > 0) {
        d.items.forEach((it) => {
          const product = productsById[it.productId] || productsByName[it.productName || it.name];
          const purchasePrice = it.purchasePrice ?? product?.purchasePrice ?? product?.price ?? 0;
          // ПРИОРЕТЕТ: Берем discountedPrice из чека, если нет - fullPrice, если нет - salePrice
          const price = Number(it.discountedPrice ?? it.fullPrice ?? it.price ?? 0);
          
          goods.push({
            name: it.productName || it.name || "",
            counterparty: it.counterparty ?? "",
            rating: Number(it.quantity ?? 1),
            saleDate,
            price, // Это цена со скидкой
            purchasePrice,
          });
        });
      } else {
        const product = productsById[d.productId] || productsByName[d.productName || d.name];
        const purchasePrice = d.purchasePrice ?? product?.purchasePrice ?? product?.price ?? 0;
        const price = Number(d.discountedPrice ?? d.fullPrice ?? d.price ?? 0);
        
        goods.push({
          name: d.productName || d.name || "",
          counterparty: d.counterparty || "",
          rating: Number(d.quantity ?? d.rating ?? d.sales ?? 0),
          saleDate,
          price, // Это цена со скидкой
          purchasePrice,
        });
      }
    });
    viewModel = new ReportViewModel(goods);
    fillSupplierFilter(goods);
  } catch (e) {
    console.error("Ошибка загрузки продаж:", e);
    viewModel = new ReportViewModel([]);
  }
}

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

function handleGenerate() {
  if (!viewModel) return;
  const minSales = Math.max(1, Number(document.getElementById("minSales")?.value) || 1);
  const supplier = document.getElementById("supplierFilter")?.value || "";
  const reportType = document.getElementById("reportType")?.value || "detail";
  let startDate = parseDateInput("startDate");
  let endDate = parseDateInput("endDate", true);

  const def = getDefaultPeriod();
  if (!startDate) startDate = def.start;
  if (!endDate) endDate = def.end;

  const rows = viewModel.getFilteredData(0, startDate, endDate, supplier);
  renderReport(rows, reportType, startDate, endDate, minSales);
}

async function handleExport() {
  if (!viewModel) return;
  const minSales = Math.max(1, Number(document.getElementById("minSales")?.value) || 1);
  const supplier = document.getElementById("supplierFilter")?.value || "";
  const reportType = document.getElementById("reportType")?.value || "detail";
  let startDate = parseDateInput("startDate");
  let endDate = parseDateInput("endDate", true);

  const def = getDefaultPeriod();
  if (!startDate) startDate = def.start;
  if (!endDate) endDate = def.end;

  await viewModel.exportReport({ minSales, startDate, endDate, reportType, supplier });
}

export async function initReportsPage() {
  await loadSoldGoods();

  const startEl = document.getElementById("startDate");
  const endEl = document.getElementById("endDate");
  const def = getDefaultPeriod();
  if (startEl && !startEl.value) startEl.value = def.start.toISOString().slice(0, 10);
  if (endEl && !endEl.value) endEl.value = def.end.toISOString().slice(0, 10);

  document.getElementById("reportType")?.addEventListener("change", handleGenerate);
  document.getElementById("minSales")?.addEventListener("input", handleGenerate);
  document.getElementById("supplierFilter")?.addEventListener("change", handleGenerate);
  document.getElementById("startDate")?.addEventListener("change", handleGenerate);
  document.getElementById("endDate")?.addEventListener("change", handleGenerate);

  const btnExport = document.getElementById("exportExcel");
  if (btnExport) btnExport.addEventListener("click", () => handleExport().catch((e) => console.error("Ошибка экспорта:", e)));

  handleGenerate();
}