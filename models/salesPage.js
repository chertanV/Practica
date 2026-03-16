/**
 * salesPage.js — страница продаж по чекам
 * Отвечает за: журнал чеков (таблица с фильтрами по периоду и поиску), модалку «Новый чек» (список позиций,
 * дата, продавец, способ оплаты), сохранение одного документа в sales с полем items[], списание остатков
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
/** Текущий чек: массив позиций { productId, productName, supplier, quantity, fullPrice, discount, discountedPrice, purchasePrice, salePrice, stock } */
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

/** Фильтрация чеков по датам и поиску */
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

/** Отрисовка таблицы чеков (одна строка = один чек) */
function renderSales(list) {
  const tbody = document.getElementById("salesTable");
  const countEl = document.getElementById("salesCount");
  if (!tbody) return;

  tbody.innerHTML = "";
  list.forEach((r) => {
    const tr = document.createElement("tr");
    const itemCount = r.items ? r.items.length : 1;
    const total = r.totalAmount != null ? r.totalAmount : (r.items || []).reduce((s, it) => {
      const qty = it.quantity ?? 1;
      const price = it.discountedPrice ?? it.fullPrice ?? it.price ?? 0;
      return s + qty * price;
    }, 0);
    tr.innerHTML = `
      <td class="mono">${r.receiptNumber ?? r.logNumber ?? "—"}</td>
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

  if (numEl) numEl.textContent = receipt.receiptNumber ?? receipt.logNumber ?? "—";
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
  // Вернуть остатки по товарам
  for (const it of items) {
    if (!it.productId) continue;
    const product = productsCache.find((p) => p.id === it.productId);
    const qty = Number(it.quantity ?? 1);
    if (!product) {
      // Если товара нет в кэше (удалён), просто пропускаем восстановление
      continue;
    }
    const currentStock = Number(product.stock ?? 0);
    const newStock = currentStock + qty;
    await updateDoc(doc(db, "products", it.productId), { stock: newStock });
    product.stock = newStock;
  }

  // Удаляем сам чек
  await deleteDoc(doc(db, "sales", id));

  // Обновляем журнал
  await loadSales();
}

async function loadProducts() {
  const snap = await getDocs(collection(db, "products"));
  productsCache = snap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
    name: d.data().name || "",
    supplier: d.data().supplier || d.data().counterparty || "",
    salePrice: d.data().salePrice ?? d.data().price ?? 0,
    stock: d.data().stock ?? null,
  }));
}

/** Загрузка продаж. Поддержка формата чека (items[]) и старого формата (одна позиция в документе) */
async function loadSales() {
  const snap = await getDocs(collection(db, "sales"));
  salesCache = snap.docs.map((docSnap, idx) => {
    const d = docSnap.data();
    let saleDate = d.saleDate;
    if (saleDate instanceof Timestamp) saleDate = saleDate.toDate();
    else if (typeof saleDate === "string") saleDate = new Date(saleDate);

    if (d.items && Array.isArray(d.items) && d.items.length > 0) {
      const totalAmount = d.items.reduce((s, it) => {
        const qty = it.quantity ?? 1;
        const p = it.discountedPrice ?? it.fullPrice ?? it.price ?? 0;
        return s + qty * p;
      }, 0);
      return {
        id: docSnap.id,
        saleDate,
        sellerName: d.sellerName || "",
        paymentMethod: d.paymentMethod || "cash",
        items: d.items,
        totalAmount,
        receiptNumber: d.receiptNumber ?? idx + 1,
      };
    }
    const qty = d.quantity ?? d.rating ?? 1;
    const price = d.discountedPrice ?? d.fullPrice ?? d.price ?? 0;
    return {
      id: docSnap.id,
      saleDate,
      sellerName: d.sellerName || "",
      paymentMethod: d.paymentMethod || "cash",
      items: [{
        productId: d.productId,
        productName: d.productName || d.name,
        quantity: qty,
        fullPrice: d.fullPrice ?? d.price,
        discountedPrice: price,
        discount: d.discount ?? 0,
      }],
      totalAmount: qty * price,
      receiptNumber: d.logNumber ?? d.receiptNumber ?? idx + 1,
    };
  });
  salesCache.sort((a, b) => new Date(b.saleDate) - new Date(a.saleDate));
  applyFilters();
}

function openReceiptModal() {
  currentReceiptItems = [];
  (document.getElementById("receiptDate") || {}).value = new Date().toISOString().slice(0, 10);
  (document.getElementById("receiptSellerName") || {}).value = auth.currentUser?.displayName || auth.currentUser?.email?.split("@")[0] || "";
  (document.getElementById("receiptPaymentMethod") || {}).value = "cash";
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
    const sum = (it.quantity || 1) * (it.discountedPrice ?? it.fullPrice ?? 0);
    total += sum;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${it.productName || "—"}</td>
      <td>${it.quantity ?? 1}</td>
      <td class="price">${formatPrice(it.fullPrice)}</td>
      <td>${it.discount ?? 0}%</td>
      <td class="price">${formatPrice(sum)}</td>
      <td><button type="button" class="btn-icon del" data-idx="${idx}">Удалить</button></td>
    `;
    tbody.appendChild(tr);
  });
  if (totalEl) totalEl.textContent = formatPrice(total);
  if (emptyEl) emptyEl.classList.toggle("hidden", currentReceiptItems.length > 0);
}

function openAddItemModal() {
  const sel = document.getElementById("itemProductSelect");
  if (!sel) return;
  sel.innerHTML = '<option value="">— Выберите товар —</option>';
  productsCache.forEach((p) => {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = `${p.name || p.id} (остаток: ${p.stock ?? 0})`;
    sel.appendChild(opt);
  });
  (document.getElementById("itemQuantity") || {}).value = 1;
  (document.getElementById("itemDiscount") || {}).value = 0;
  document.getElementById("addItemModalOverlay")?.classList.add("open");
}

function closeAddItemModal() {
  document.getElementById("addItemModalOverlay")?.classList.remove("open");
}

function onItemProductSelect() {
  const sel = document.getElementById("itemProductSelect");
  const product = productsCache.find((p) => p.id === sel?.value);
  const priceEl = document.getElementById("itemFullPrice");
  if (product && priceEl) priceEl.value = product.salePrice ?? product.price ?? "";
}

function addItemToReceipt() {
  const productId = document.getElementById("itemProductSelect")?.value;
  const product = productsCache.find((p) => p.id === productId);
  if (!product) {
    alert("Выберите товар");
    return;
  }
  const quantity = Number(document.getElementById("itemQuantity")?.value || 1);
  const fullPrice = Number(document.getElementById("itemFullPrice")?.value || 0);
  const discount = Number(document.getElementById("itemDiscount")?.value || 0);
  const currentStock = product.stock ?? 0;
  if (currentStock < quantity) {
    alert(`Недостаточно товара «${product.name}». Остаток: ${currentStock}`);
    return;
  }
  const discountedPrice = fullPrice * (1 - discount / 100);
  currentReceiptItems.push({
    productId: product.id,
    productName: product.name,
    supplier: product.supplier || "",
    quantity,
    fullPrice,
    discount,
    discountedPrice,
    purchasePrice: product.purchasePrice ?? product.price ?? 0,
    salePrice: product.salePrice ?? product.price ?? fullPrice,
    stock: currentStock,
  });
  closeAddItemModal();
  renderReceiptItems();
}

async function saveReceipt() {
  if (currentReceiptItems.length === 0) {
    alert("Добавьте хотя бы одну позицию в чек");
    return;
  }
  const dateStr = document.getElementById("receiptDate")?.value;
  const sellerName = document.getElementById("receiptSellerName")?.value.trim() || "";
  const paymentMethod = document.getElementById("receiptPaymentMethod")?.value || "cash";
  const saleDate = dateStr ? new Date(dateStr + "T12:00:00") : new Date();
  const receiptNumber = salesCache.length + 1;

  const items = currentReceiptItems.map((it) => ({
    productId: it.productId,
    productName: it.productName,
    counterparty: it.supplier,
    quantity: it.quantity,
    fullPrice: it.fullPrice,
    discount: it.discount,
    discountedPrice: it.discountedPrice,
    purchasePrice: it.purchasePrice,
    salePrice: it.salePrice,
  }));

  await addDoc(collection(db, "sales"), {
    receiptNumber,
    saleDate: Timestamp.fromDate(saleDate),
    sellerName,
    paymentMethod,
    items,
  });

  for (const it of currentReceiptItems) {
    const newStock = (it.stock ?? 0) - it.quantity;
    await updateDoc(doc(db, "products", it.productId), { stock: newStock });
    const p = productsCache.find((x) => x.id === it.productId);
    if (p) p.stock = newStock;
  }

  closeReceiptModal();
  await loadSales();
}

export default function initSalesPage() {
  document.getElementById("newReceiptBtn")?.addEventListener("click", openReceiptModal);
  document.getElementById("receiptModalClose")?.addEventListener("click", closeReceiptModal);
  document.getElementById("receiptModalCancel")?.addEventListener("click", closeReceiptModal);
  document.getElementById("receiptModalSave")?.addEventListener("click", () => saveReceipt().catch((e) => console.error("Ошибка оформления чека:", e)));
  document.getElementById("addReceiptItemBtn")?.addEventListener("click", openAddItemModal);
  document.getElementById("addItemModalClose")?.addEventListener("click", closeAddItemModal);
  document.getElementById("addItemModalCancel")?.addEventListener("click", closeAddItemModal);
  document.getElementById("addItemModalAdd")?.addEventListener("click", addItemToReceipt);
  document.getElementById("itemProductSelect")?.addEventListener("change", onItemProductSelect);

  document.getElementById("receiptViewModalClose")?.addEventListener("click", closeReceiptViewModal);
  document.getElementById("receiptViewModalCloseBottom")?.addEventListener("click", closeReceiptViewModal);

  document.getElementById("receiptItemsTable")?.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-idx]");
    if (!btn) return;
    const idx = parseInt(btn.dataset.idx, 10);
    if (!isNaN(idx) && idx >= 0 && idx < currentReceiptItems.length) {
      currentReceiptItems.splice(idx, 1);
      renderReceiptItems();
    }
  });

  document.getElementById("salesTable")?.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;
    const id = btn.dataset.id;
    const action = btn.dataset.action;
    const receipt = salesCache.find((r) => r.id === id);
    if (action === "view") {
      openReceiptViewModal(receipt);
    } else if (action === "delete" && id) {
      deleteReceiptById(id).catch((err) => console.error("Ошибка удаления чека:", err));
    }
  });

  document.getElementById("salesStartDate")?.addEventListener("change", applyFilters);
  document.getElementById("salesEndDate")?.addEventListener("change", applyFilters);
  document.getElementById("salesSearch")?.addEventListener("input", applyFilters);

  (async () => {
    await loadProducts();
    await loadSales();
  })().catch((e) => console.error("Ошибка загрузки:", e));
}
