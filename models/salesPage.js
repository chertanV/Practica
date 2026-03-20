/**
 * salesPage.js — страница продаж по чекам
 */
import { db } from "../services/firebaseConfig.js";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  Timestamp
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";
import { auth } from "../services/firebaseConfig.js";

let salesCache = [];
let productsCache = [];
let currentReceiptItems = [];

function formatPrice(val) {
  if (val == null || val === "") return "—";
  return Number(val).toLocaleString("ru-RU");
}

function formatDateOnly(val) {
  if (!val) return "—";
  const d = val instanceof Date ? val : (val?.toDate ? val.toDate() : new Date(val));
  return d.toLocaleDateString("ru-RU");
}

function formatPaymentMethod(m) {
  const map = { cash: "Наличные", card: "Карта" };
  return map[m] || m || "—";
}

function applyFilters() {
  const startStr = document.getElementById("salesStartDate")?.value;
  const endStr = document.getElementById("salesEndDate")?.value;
  const search = (document.getElementById("salesSearch")?.value || "").toLowerCase();
  const startDate = startStr ? new Date(startStr) : null;
  const endDate = endStr ? new Date(endStr + "T23:59:59") : null;

  const filtered = salesCache.filter((r) => {
    const d = r.saleDate instanceof Date ? r.saleDate : (r.saleDate?.toDate ? r.saleDate.toDate() : new Date(r.saleDate));
    if (startDate && d < startDate) return false;
    if (endDate && d > endDate) return false;
    if (search) {
      const matchSeller = (r.sellerName || "").toLowerCase().includes(search);
      const matchProduct = (r.items || []).some((it) => (it.productName || "").toLowerCase().includes(search));
      if (!matchSeller && !matchProduct) return false;
    }
    return true;
  });
  renderSales(filtered);
}

function renderSales(list) {
  const tbody = document.getElementById("salesTable");
  const countEl = document.getElementById("salesCount");
  if (!tbody) return;

  tbody.innerHTML = "";
  list.forEach((r) => {
    const tr = document.createElement("tr");
    const itemCount = r.items ? r.items.length : 1;
    const total = r.totalAmount;
    tr.innerHTML = `
      <td class="mono">${r.receiptNumber ?? "—"}</td>
      <td class="mono">${formatDateOnly(r.saleDate)}</td>
      <td>${r.sellerName || "—"}</td>
      <td>${formatPaymentMethod(r.paymentMethod)}</td>
      <td>${itemCount}</td>
      <td class="price">${formatPrice(total)}</td>
      <td>
        <div class="row-actions">
          <button type="button" class="btn-icon" data-action="view" data-id="${r.id}">Открыть</button>
          <button type="button" class="btn-icon del" data-action="delete" data-id="${r.id}">Удалить</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
  if (countEl) countEl.textContent = String(list.length);
}

function openReceiptViewModal(receipt) {
  const overlay = document.getElementById("receiptViewModalOverlay");
  if (!overlay || !receipt) return;
  const itemsTbody = document.getElementById("receiptViewItemsTable");
  const numEl = document.getElementById("viewReceiptNumber");
  const dateEl = document.getElementById("viewReceiptDate");
  const sellerEl = document.getElementById("viewReceiptSeller");
  const payEl = document.getElementById("viewReceiptPayment");
  const totalEl = document.getElementById("viewReceiptTotal");
  if (itemsTbody) itemsTbody.innerHTML = "";

  const items = receipt.items || [];
  let total = 0;
  items.forEach((it) => {
    const qty = it.quantity ?? 1;
    const price = it.discountedPrice ?? it.fullPrice ?? it.price ?? 0;
    const sum = qty * price;
    total += sum;
    if (!itemsTbody) return;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${it.productName || "—"}</td>
      <td>${qty}</td>
      <td class="price">${formatPrice(it.fullPrice ?? price)}</td>
      <td>${it.discount ?? 0}%</td>
      <td class="price">${formatPrice(sum)}</td>
    `;
    itemsTbody.appendChild(tr);
  });

  if (numEl) numEl.textContent = receipt.receiptNumber ?? "—";
  if (dateEl) dateEl.textContent = formatDateOnly(receipt.saleDate);
  if (sellerEl) sellerEl.textContent = receipt.sellerName || "—";
  if (payEl) payEl.textContent = formatPaymentMethod(receipt.paymentMethod);
  if (totalEl) totalEl.textContent = formatPrice(total);

  overlay.classList.add("open");
}

function closeReceiptViewModal() {
  document.getElementById("receiptViewModalOverlay")?.classList.remove("open");
}

async function deleteReceiptById(id) {
  const receipt = salesCache.find((r) => r.id === id);
  if (!receipt) return;
  if (!confirm("Удалить чек и вернуть товары на склад?")) return;

  const items = receipt.items || [];
  for (const it of items) {
    if (!it.productId) continue;
    const product = productsCache.find((p) => p.id === it.productId);
    const qty = Number(it.quantity ?? 1);
    if (!product) continue;
    const currentStock = Number(product.stock ?? 0);
    const newStock = currentStock + qty;
    await updateDoc(doc(db, "products", it.productId), { stock: newStock });
    product.stock = newStock;
  }
  await deleteDoc(doc(db, "sales", id));
  await loadSales();
}

async function loadProducts() {
  const snap = await getDocs(collection(db, "products"));
  productsCache = snap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
    name: d.data().name || "",
    supplier: d.data().supplier || d.data().counterparty || "",
    purchasePrice: d.data().purchasePrice ?? d.data().price ?? 0,
    salePrice: d.data().salePrice ?? d.data().price ?? 0,
    stock: d.data().stock ?? 0,
  }));
}

async function loadSales() {
  const snap = await getDocs(collection(db, "sales"));
  salesCache = snap.docs.map((docSnap, idx) => {
    const d = docSnap.data();
    let saleDate = d.saleDate;
    if (saleDate instanceof Timestamp) saleDate = saleDate.toDate();
    else if (typeof saleDate === "string") saleDate = new Date(saleDate);

    let items = [];
    let totalAmount = 0;

    if (d.items && Array.isArray(d.items)) {
      items = d.items;
      totalAmount = items.reduce((s, it) => s + (it.quantity ?? 1) * (it.discountedPrice ?? it.fullPrice ?? 0), 0);
    } else {
      const qty = d.quantity ?? d.rating ?? 1;
      const price = d.discountedPrice ?? d.fullPrice ?? d.price ?? 0;
      items = [{
        productId: d.productId,
        productName: d.productName || d.name,
        quantity: qty,
        fullPrice: d.fullPrice ?? d.price,
        discountedPrice: price,
        discount: d.discount ?? 0,
      }];
      totalAmount = qty * price;
    }

    return {
      id: docSnap.id,
      saleDate,
      sellerName: d.sellerName || "",
      paymentMethod: d.paymentMethod || "cash",
      items,
      totalAmount,
      receiptNumber: d.receiptNumber ?? idx + 1,
    };
  });
  salesCache.sort((a, b) => new Date(b.saleDate) - new Date(a.saleDate));
  applyFilters();
}

function openReceiptModal() {
  currentReceiptItems = [];
  const dateInput = document.getElementById("receiptDate");
  if (dateInput) dateInput.value = new Date().toISOString().slice(0, 10);
  
  const sellerInput = document.getElementById("receiptSellerName");
  if (sellerInput) sellerInput.value = auth.currentUser?.displayName || auth.currentUser?.email?.split("@")[0] || "";
  
  const payInput = document.getElementById("receiptPaymentMethod");
  if (payInput) payInput.value = "cash";

  renderReceiptProducts();
  renderReceiptItems();
  document.getElementById("receiptModalOverlay")?.classList.add("open");
}

function closeReceiptModal() {
  document.getElementById("receiptModalOverlay")?.classList.remove("open");
  currentReceiptItems = [];
}

function renderReceiptItems() {
  const tbody = document.getElementById("receiptItemsTable");
  const totalEl = document.getElementById("receiptTotal");
  const emptyEl = document.getElementById("receiptEmpty");
  if (!tbody) return;

  tbody.innerHTML = "";
  let total = 0;
  currentReceiptItems.forEach((it, idx) => {
    const qty = Number(it.quantity ?? 1);
    const sum = qty * Number(it.discountedPrice);
    total += sum;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${it.productName || "—"}</td>
      <td><input class="receipt-item-qty" type="number" min="1" data-idx="${idx}" value="${qty}"></td>
      <td class="price">${formatPrice(it.fullPrice)}</td>
      <td><input class="receipt-item-discount" type="number" min="0" max="100" data-idx="${idx}" value="${it.discount}"></td>
      <td class="price">${formatPrice(sum)}</td>
      <td><button type="button" class="btn-icon del" data-idx="${idx}">Удалить</button></td>
    `;
    tbody.appendChild(tr);
  });
  if (totalEl) totalEl.textContent = formatPrice(total);
  if (emptyEl) emptyEl.classList.toggle("hidden", currentReceiptItems.length > 0);
}

function recalcReceiptItem(it) {
  const fp = Number(it.fullPrice ?? 0);
  const disc = Number(it.discount ?? 0);
  it.discountedPrice = fp * (1 - disc / 100);
}

function renderReceiptProducts() {
  const tbody = document.getElementById("receiptProductsTable");
  const search = (document.getElementById("receiptProductsSearch")?.value || "").toLowerCase().trim();
  if (!tbody) return;

  const filtered = productsCache.filter((p) => {
    const haystack = `${p.name} ${p.barcode || ""} ${p.supplier}`.toLowerCase();
    return haystack.includes(search);
  });

  tbody.innerHTML = "";
  filtered.forEach((p) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${p.name}</td>
      <td>${p.supplier}</td>
      <td class="mono">${p.barcode || "—"}</td>
      <td class="mono">${p.stock}</td>
      <td class="price">${formatPrice(p.salePrice)}</td>
      <td><button type="button" class="btn-icon success" data-action="add" data-product-id="${p.id}" ${p.stock > 0 ? "" : "disabled"}>+</button></td>
    `;
    tbody.appendChild(tr);
  });
}

function addProductToReceipt(product) {
  const existing = currentReceiptItems.find((it) => it.productId === product.id);
  if (existing) {
    if (existing.quantity + 1 > product.stock) return alert("Нет в наличии");
    existing.quantity++;
    recalcReceiptItem(existing);
  } else {
    currentReceiptItems.push({
      productId: product.id,
      productName: product.name,
      supplier: product.supplier,
      quantity: 1,
      fullPrice: product.salePrice,
      discount: 0,
      discountedPrice: product.salePrice,
      purchasePrice: product.purchasePrice,
      stock: product.stock
    });
  }
  renderReceiptItems();
}

async function saveReceipt() {
  if (currentReceiptItems.length === 0) return alert("Чек пуст");
  
  const dateStr = document.getElementById("receiptDate")?.value;
  const saleDate = dateStr ? new Date(dateStr + "T12:00:00") : new Date();

  const items = currentReceiptItems.map(it => ({
    productId: it.productId,
    productName: it.productName,
    counterparty: it.supplier,
    quantity: it.quantity,
    fullPrice: it.fullPrice,
    discount: it.discount,
    discountedPrice: it.discountedPrice,
    purchasePrice: it.purchasePrice
  }));

  await addDoc(collection(db, "sales"), {
    receiptNumber: salesCache.length + 1,
    saleDate: Timestamp.fromDate(saleDate),
    sellerName: document.getElementById("receiptSellerName")?.value || "Система",
    paymentMethod: document.getElementById("receiptPaymentMethod")?.value || "cash",
    items
  });

  for (const it of currentReceiptItems) {
    await updateDoc(doc(db, "products", it.productId), { stock: it.stock - it.quantity });
  }

  closeReceiptModal();
  await loadProducts();
  await loadSales();
}

export default function initSalesPage() {
  document.getElementById("newReceiptBtn")?.addEventListener("click", openReceiptModal);
  document.getElementById("receiptModalSave")?.addEventListener("click", () => saveReceipt().catch(console.error));
  document.getElementById("receiptProductsSearch")?.addEventListener("input", renderReceiptProducts);
  
  document.getElementById("receiptProductsTable")?.addEventListener("click", (e) => {
    const btn = e.target.closest('button[data-action="add"]');
    if (btn) addProductToReceipt(productsCache.find(p => p.id === btn.dataset.productId));
  });

  document.getElementById("receiptItemsTable")?.addEventListener("input", (e) => {
    const idx = e.target.dataset.idx;
    if (idx === undefined) return;
    const it = currentReceiptItems[idx];
    if (e.target.classList.contains("receipt-item-qty")) it.quantity = Math.min(it.stock, Number(e.target.value));
    if (e.target.classList.contains("receipt-item-discount")) it.discount = Number(e.target.value);
    recalcReceiptItem(it);
    renderReceiptItems();
  });

  document.getElementById("salesTable")?.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-id]");
    if (!btn) return;
    const action = btn.dataset.action;
    const receipt = salesCache.find(r => r.id === btn.dataset.id);
    if (action === "view") openReceiptViewModal(receipt);
    if (action === "delete") deleteReceiptById(btn.dataset.id);
  });

  (async () => { await loadProducts(); await loadSales(); })();
}