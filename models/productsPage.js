/**
 * productsPage.js — страница товаров
 * Список товаров, поиск, фильтры, CRUD, оформление продажи (модалка с оплатой, скидкой, продавцом)
 */

import { db, auth } from "../services/firebaseConfig.js";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  Timestamp
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";

let productsCache = [];  // Кэш товаров из Firestore
let editingId = null;    // ID редактируемого товара (null = новый)

/** Форматирование цены для отображения */
function formatPrice(val) {
  if (val == null || val === "") return "—";
  return Number(val).toLocaleString("ru-RU");
}

/** Отрисовка таблицы товаров в #productsTable */
function renderProducts(list) {
  const tbody = document.getElementById("productsTable");
  const countEl = document.getElementById("productsCount");
  if (!tbody) return;

  tbody.innerHTML = "";
  list.forEach((p) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="mono">${p.id || "—"}</td>
      <td>${p.name || ""}</td>
      <td>${p.supplier || ""}</td>
      <td class="desc-cell">${p.description || "—"}</td>
      <td class="mono">${p.barcode || "—"}</td>
      <td>${p.category || ""}</td>
      <td class="price">${formatPrice(p.purchasePrice)}</td>
      <td class="price">${formatPrice(p.salePrice)}</td>
      <td>${p.stock != null ? p.stock : ""}</td>
      <td>
        <div class="row-actions">
          <button class="btn-icon success" data-id="${p.id}" data-action="sell">Продать</button>
          <button class="btn-icon edit" data-id="${p.id}" data-action="edit">Изм.</button>
          <button class="btn-icon del" data-id="${p.id}" data-action="delete">Удалить</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
  if (countEl) countEl.textContent = String(list.length);
}

/** Применение фильтров (поставщик, категория, поиск) и перерисовка таблицы */
function applyFilters() {
  const supplier = document.getElementById("supplierFilter")?.value || "";
  const category = document.getElementById("categoryFilter")?.value || "";
  const search = (document.getElementById("searchInput")?.value || "").toLowerCase();

  const filtered = productsCache.filter((p) => {
    if (supplier && p.supplier !== supplier) return false;
    if (category && p.category !== category) return false;
    if (search) {
      const match = (p.name || "").toLowerCase().includes(search) ||
        (p.description || "").toLowerCase().includes(search) ||
        (p.barcode || "").toLowerCase().includes(search);
      if (!match) return false;
    }
    return true;
  });

  renderProducts(filtered);
}

/** Загрузка товаров из Firestore, заполнение фильтров, отрисовка */
async function loadProducts() {
  const snap = await getDocs(collection(db, "products"));
  productsCache = snap.docs.map((docSnap) => {
    const data = docSnap.data();
    const price = data.price ?? null;
    return {
      id: docSnap.id,
      name: data.name || "",
      supplier: data.supplier || data.counterparty || "",
      description: data.description || "",
      barcode: data.barcode || "",
      category: data.category || "",
      purchasePrice: data.purchasePrice ?? price ?? null,
      salePrice: data.salePrice ?? price ?? null,
      stock: data.stock ?? null,
    };
  });

  const supplierSel = document.getElementById("supplierFilter");
  const categorySel = document.getElementById("categoryFilter");
  if (supplierSel) {
    supplierSel.innerHTML = `<option value=\"\">Все поставщики</option>`;
    const suppliers = Array.from(new Set(productsCache.map(p => p.supplier).filter(Boolean)));
    suppliers.forEach((s) => {
      const opt = document.createElement("option");
      opt.value = s;
      opt.textContent = s;
      supplierSel.appendChild(opt);
    });
  }
  if (categorySel) {
    categorySel.innerHTML = `<option value=\"\">Все категории</option>`;
    const cats = Array.from(new Set(productsCache.map(p => p.category).filter(Boolean)));
    cats.forEach((c) => {
      const opt = document.createElement("option");
      opt.value = c;
      opt.textContent = c;
      categorySel.appendChild(opt);
    });
  }

  renderProducts(productsCache);
}

/** Открытие модалки добавления/редактирования товара */
function openModal(product) {
  const overlay = document.getElementById("productModalOverlay");
  const titleEl = document.getElementById("productModalTitle");
  (document.getElementById("productName") || {}).value = product?.name || "";
  (document.getElementById("productSupplier") || {}).value = product?.supplier || "";
  (document.getElementById("productDescription") || {}).value = product?.description || "";
  (document.getElementById("productBarcode") || {}).value = product?.barcode || "";
  (document.getElementById("productCategory") || {}).value = product?.category || "";
  (document.getElementById("productPurchasePrice") || {}).value = product?.purchasePrice ?? product?.price ?? "";
  (document.getElementById("productSalePrice") || {}).value = product?.salePrice ?? product?.price ?? "";
  (document.getElementById("productStock") || {}).value = product?.stock ?? "";
  if (titleEl) titleEl.textContent = product ? "Редактирование товара" : "Новый товар";
  if (overlay) overlay.classList.add("open");
}

/** Закрытие модалки товара */
function closeModal() {
  const overlay = document.getElementById("productModalOverlay");
  if (overlay) overlay.classList.remove("open");
  editingId = null;
}

/** Сохранение товара (создание или обновление), проверка: цена продажи > цены закупки */
async function saveProduct() {
  const name = document.getElementById("productName")?.value.trim() || "";
  const supplier = document.getElementById("productSupplier")?.value.trim() || "";
  const description = document.getElementById("productDescription")?.value.trim() || "";
  const barcode = document.getElementById("productBarcode")?.value.trim() || "";
  const category = document.getElementById("productCategory")?.value.trim() || "";
  const purchasePrice = Number(document.getElementById("productPurchasePrice")?.value || 0);
  const salePrice = Number(document.getElementById("productSalePrice")?.value || 0);
  const stock = Number(document.getElementById("productStock")?.value || 0);

  if (!name) return;

  if (salePrice <= purchasePrice && (purchasePrice > 0 || salePrice > 0)) {
    alert("Цена продажи должна быть выше цены закупки, иначе работа в ноль.");
    return;
  }

  const data = { name, supplier, description, barcode, category, purchasePrice, salePrice, stock };

  if (editingId) {
    await updateDoc(doc(db, "products", editingId), data);
  } else {
    await addDoc(collection(db, "products"), data);
  }

  closeModal();
  await loadProducts();
  applyFilters();
}

/** Удаление товара по ID */
async function deleteProduct(id) {
  if (!confirm("Удалить товар?")) return;
  await deleteDoc(doc(db, "products", id));
  await loadProducts();
  applyFilters();
}

/** Открытие модалки «Продать товар» (способ оплаты, скидка, ФИО продавца, дата) */
function openSellModal(product) {
  const overlay = document.getElementById("sellModalOverlay");
  const nameEl = document.getElementById("sellProductName");
  const qtyEl = document.getElementById("sellQuantity");
  const dateEl = document.getElementById("sellDateTime");
  const priceEl = document.getElementById("sellFullPrice");
  const discountEl = document.getElementById("sellDiscount");
  const paymentEl = document.getElementById("sellPaymentMethod");
  const sellerEl = document.getElementById("sellSellerName");
  if (!overlay || !nameEl) return;
  nameEl.textContent = product.name || "—";
  (qtyEl || {}).value = 1;
  (dateEl || {}).value = new Date().toISOString().slice(0, 16);
  (priceEl || {}).value = product.salePrice ?? product.price ?? "";
  (discountEl || {}).value = 0;
  (paymentEl || {}).value = "cash";
  (sellerEl || {}).value = auth.currentUser?.displayName || auth.currentUser?.email?.split("@")[0] || "";
  overlay.dataset.sellProductId = product.id;
  overlay.classList.add("open");
}

/** Закрытие модалки продажи */
function closeSellModal() {
  const overlay = document.getElementById("sellModalOverlay");
  if (overlay) {
    overlay.classList.remove("open");
    delete overlay.dataset.sellProductId;
  }
}

/** Оформление продажи: запись в sales и salesLog, уменьшение остатка товара */
async function saveSale() {
  const overlay = document.getElementById("sellModalOverlay");
  const productId = overlay?.dataset.sellProductId;
  const product = productsCache.find((p) => p.id === productId);
  if (!product) return closeSellModal();

  const qty = Number(document.getElementById("sellQuantity")?.value || 1);
  const dateTimeStr = document.getElementById("sellDateTime")?.value;
  const fullPrice = Number(document.getElementById("sellFullPrice")?.value || 0);
  const discount = Number(document.getElementById("sellDiscount")?.value || 0);
  const paymentMethod = document.getElementById("sellPaymentMethod")?.value || "cash";
  const sellerName = document.getElementById("sellSellerName")?.value.trim() || "";

  const saleDate = dateTimeStr ? new Date(dateTimeStr) : new Date();
  const discountedPrice = fullPrice * (1 - discount / 100);

  const salesSnap = await getDocs(collection(db, "sales"));
  const logNumber = salesSnap.size + 1;

  await addDoc(collection(db, "sales"), {
    productId,
    productName: product.name,
    counterparty: product.supplier || "",
    quantity: qty,
    fullPrice,
    discount,
    discountedPrice,
    purchasePrice: product.purchasePrice ?? product.price ?? 0,
    salePrice: product.salePrice ?? product.price ?? fullPrice,
    paymentMethod,
    sellerName,
    saleDate: Timestamp.fromDate(saleDate),
    logNumber,
  });

  await addDoc(collection(db, "salesLog"), {
    sellerName: sellerName || auth.currentUser?.email || "—",
    saleDate: Timestamp.fromDate(saleDate),
    productName: product.name,
    quantity: qty,
    logNumber,
  });

  const newStock = (product.stock ?? 0) - qty;
  if (product.stock != null && newStock >= 0) {
    await updateDoc(doc(db, "products", productId), { stock: newStock });
  }

  closeSellModal();
  await loadProducts();
  applyFilters();
}

export default function initProductsPage() {
  document.getElementById("applyFilter")?.addEventListener("click", applyFilters);
  document.getElementById("searchInput")?.addEventListener("input", applyFilters);

  document.getElementById("addProductBtn")?.addEventListener("click", () => {
    editingId = null;
    openModal(null);
  });
  document.getElementById("productModalClose")?.addEventListener("click", closeModal);
  document.getElementById("productModalCancel")?.addEventListener("click", closeModal);
  document.getElementById("productModalSave")?.addEventListener("click", () => {
    saveProduct().catch((e) => console.error("Ошибка сохранения товара:", e));
  });

  document.getElementById("sellModalClose")?.addEventListener("click", closeSellModal);
  document.getElementById("sellModalCancel")?.addEventListener("click", closeSellModal);
  document.getElementById("sellModalSave")?.addEventListener("click", () => {
    saveSale().catch((e) => console.error("Ошибка регистрации продажи:", e));
  });

  const tbody = document.getElementById("productsTable");
  if (tbody) {
    tbody.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-action]");
      if (!btn) return;
      const id = btn.dataset.id;
      const product = productsCache.find((p) => p.id === id);
      if (!product) return;
      if (btn.dataset.action === "sell") {
        openSellModal(product);
      } else if (btn.dataset.action === "edit") {
        editingId = id;
        openModal(product);
      } else if (btn.dataset.action === "delete") {
        deleteProduct(id).catch((err) => console.error("Ошибка удаления товара:", err));
      }
    });
  }

  loadProducts().catch((e) => console.error("Ошибка загрузки товаров:", e));
}
