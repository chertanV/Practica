/**
 * salesPage.js — страница продаж
 * Журнал продаж с фильтрами по периоду и поиску. Оформление новых продаж (модалка).
 */
import { db } from "../services/firebaseConfig.js";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  Timestamp
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";
import { auth } from "../services/firebaseConfig.js";

let salesCache = [];      // Кэш продаж из Firestore
let productsCache = [];   // Товары для выбора в модалке новой продажи

function formatPrice(val) {
  if (val == null || val === "") return "—";
  return Number(val).toLocaleString("ru-RU");
}

function formatDateTime(val) {
  if (!val) return "—";
  const d = val instanceof Date ? val : (val?.toDate ? val.toDate() : new Date(val));
  return d.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Фильтрация по датам и поиску (товар/продавец) */
function applyFilters() {
  const startStr = document.getElementById("salesStartDate")?.value;
  const endStr = document.getElementById("salesEndDate")?.value;
  const search = (document.getElementById("salesSearch")?.value || "").toLowerCase();

  const startDate = startStr ? new Date(startStr) : null;
  const endDate = endStr ? new Date(endStr) : null;

  const filtered = salesCache.filter((s) => {
    const saleDate = s.saleDate instanceof Date ? s.saleDate : (s.saleDate?.toDate ? s.saleDate.toDate() : new Date(s.saleDate));
    if (startDate && saleDate < startDate) return false;
    if (endDate && saleDate > endDate) return false;
    if (search) {
      const match =
        (s.productName || s.name || "").toLowerCase().includes(search) ||
        (s.sellerName || "").toLowerCase().includes(search);
      if (!match) return false;
    }
    return true;
  });

  renderSales(filtered);
}

/** Отрисовка таблицы продаж в #salesTable */
function renderSales(list) {
  const tbody = document.getElementById("salesTable");
  const countEl = document.getElementById("salesCount");
  if (!tbody) return;

  tbody.innerHTML = "";
  list.forEach((s, idx) => {
    const tr = document.createElement("tr");
    const fullPrice = s.fullPrice ?? s.price ?? 0;
    const discount = s.discount ?? 0;
    const discountedPrice = s.discountedPrice ?? fullPrice * (1 - discount / 100);
    const totalFull = fullPrice * (s.quantity ?? s.rating ?? 1);
    const totalDisc = discountedPrice * (s.quantity ?? s.rating ?? 1);

    tr.innerHTML = `
      <td class="mono">${s.logNumber ?? idx + 1}</td>
      <td>${s.productName || s.name || "—"}</td>
      <td>${s.quantity ?? s.rating ?? "—"}</td>
      <td class="price">${formatPrice(totalFull)}</td>
      <td>${discount}%</td>
      <td class="price">${formatPrice(totalDisc)}</td>
      <td>${formatPaymentMethod(s.paymentMethod)}</td>
      <td>${s.sellerName || "—"}</td>
      <td class="mono">${formatDateTime(s.saleDate)}</td>
    `;
    tbody.appendChild(tr);
  });
  if (countEl) countEl.textContent = String(list.length);
}

/** Название способа оплаты на русском */
function formatPaymentMethod(m) {
  const map = { cash: "Наличные", card: "Карта", transfer: "Перевод", other: "Другое" };
  return map[m] || m || "—";
}

/** Загрузка товаров для выпадающего списка в модалке новой продажи */
async function loadProducts() {
  const snap = await getDocs(collection(db, "products"));
  productsCache = snap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
    name: d.data().name || "",
    salePrice: d.data().salePrice ?? d.data().price ?? 0,
  }));
}

/** Загрузка продаж из Firestore, сортировка по дате */
async function loadSales() {
  const snap = await getDocs(collection(db, "sales"));
  salesCache = snap.docs.map((docSnap, idx) => {
    const d = docSnap.data();
    let saleDate = d.saleDate;
    if (saleDate instanceof Timestamp) saleDate = saleDate.toDate();
    else if (typeof saleDate === "string") saleDate = new Date(saleDate);
    return {
      id: docSnap.id,
      productName: d.productName || d.name || "",
      name: d.productName || d.name || "",
      quantity: d.quantity ?? d.rating ?? 1,
      rating: d.quantity ?? d.rating ?? 1,
      fullPrice: d.fullPrice ?? d.price ?? 0,
      price: d.fullPrice ?? d.price ?? 0,
      discount: d.discount ?? 0,
      discountedPrice: d.discountedPrice ?? (d.fullPrice ?? d.price ?? 0) * (1 - (d.discount ?? 0) / 100),
      paymentMethod: d.paymentMethod || "cash",
      sellerName: d.sellerName || "",
      saleDate,
      logNumber: d.logNumber ?? idx + 1,
    };
  });
  salesCache.sort((a, b) => new Date(b.saleDate) - new Date(a.saleDate));
  applyFilters();
}

/** Открытие модалки «Новая продажа» */
function openNewSaleModal() {
  const overlay = document.getElementById("newSaleModalOverlay");
  const sel = document.getElementById("saleProductSelect");
  if (!sel) return;

  sel.innerHTML = '<option value="">— Выберите товар —</option>';
  productsCache.forEach((p) => {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = `${p.name || p.id} (остаток: ${p.stock ?? 0})`;
    sel.appendChild(opt);
  });

  (document.getElementById("saleQuantity") || {}).value = 1;
  (document.getElementById("saleDiscount") || {}).value = 0;
  (document.getElementById("salePaymentMethod") || {}).value = "cash";
  (document.getElementById("saleSellerName") || {}).value = auth.currentUser?.displayName || auth.currentUser?.email?.split("@")[0] || "";
  (document.getElementById("saleDateTime") || {}).value = new Date().toISOString().slice(0, 16);

  overlay?.classList.add("open");
}

/** Закрытие модалки новой продажи */
function closeNewSaleModal() {
  document.getElementById("newSaleModalOverlay")?.classList.remove("open");
}

/** При выборе товара подставляется цена продажи */
function onProductSelect() {
  const sel = document.getElementById("saleProductSelect");
  const productId = sel?.value;
  const product = productsCache.find((p) => p.id === productId);
  const priceEl = document.getElementById("saleFullPrice");
  if (product && priceEl) {
    priceEl.value = product.salePrice ?? product.price ?? "";
  }
}

/** Сохранение новой продажи в sales и salesLog, уменьшение остатка товара */
async function saveNewSale() {
  const productId = document.getElementById("saleProductSelect")?.value;
  const product = productsCache.find((p) => p.id === productId);
  if (!product) {
    alert("Выберите товар");
    return;
  }

  const quantity = Number(document.getElementById("saleQuantity")?.value || 1);
  const fullPrice = Number(document.getElementById("saleFullPrice")?.value || 0);
  const discount = Number(document.getElementById("saleDiscount")?.value || 0);
  const paymentMethod = document.getElementById("salePaymentMethod")?.value || "cash";
  const sellerName = document.getElementById("saleSellerName")?.value.trim() || "";
  const dateTimeStr = document.getElementById("saleDateTime")?.value;

  const saleDate = dateTimeStr ? new Date(dateTimeStr) : new Date();
  const discountedPrice = fullPrice * (1 - discount / 100);

  const logNumber = salesCache.length + 1;

  await addDoc(collection(db, "sales"), {
    productId: product.id,
    purchasePrice: product.purchasePrice ?? product.price ?? 0,
    salePrice: product.salePrice ?? product.price ?? fullPrice,
    productName: product.name,
    counterparty: product.supplier || "",
    quantity,
    fullPrice,
    discount,
    discountedPrice,
    paymentMethod,
    sellerName,
    saleDate: Timestamp.fromDate(saleDate),
    logNumber,
  });

  await addDoc(collection(db, "salesLog"), {
    sellerName: sellerName || auth.currentUser?.email || "—",
    saleDate: Timestamp.fromDate(saleDate),
    productName: product.name,
    quantity,
    logNumber,
  });

  const newStock = (product.stock ?? 0) - quantity;
  if (product.stock != null && newStock >= 0) {
    await updateDoc(doc(db, "products", productId), { stock: newStock });
  }

  closeNewSaleModal();
  await loadSales();
}

export default function initSalesPage() {
  document.getElementById("newSaleBtn")?.addEventListener("click", openNewSaleModal);
  document.getElementById("newSaleModalClose")?.addEventListener("click", closeNewSaleModal);
  document.getElementById("newSaleModalCancel")?.addEventListener("click", closeNewSaleModal);
  document.getElementById("newSaleModalSave")?.addEventListener("click", () => {
    saveNewSale().catch((e) => console.error("Ошибка оформления продажи:", e));
  });
  document.getElementById("saleProductSelect")?.addEventListener("change", onProductSelect);
  document.getElementById("applySalesFilter")?.addEventListener("click", applyFilters);

  (async () => {
    await loadProducts();
    await loadSales();
  })().catch((e) => console.error("Ошибка загрузки:", e));
}
