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

let productsCache = [];
let editingId = null;

function renderProducts(list) {
  const tbody = document.getElementById("productsTable");
  const countEl = document.getElementById("productsCount");
  if (!tbody) return;

  tbody.innerHTML = "";
  list.forEach((p) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${p.name || ""}</td>
      <td>${p.supplier || ""}</td>
      <td>${p.category || ""}</td>
      <td class="price">${p.price != null ? p.price : ""}</td>
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

function applyFilters() {
  const supplier = document.getElementById("supplierFilter")?.value || "";
  const category = document.getElementById("categoryFilter")?.value || "";
  const search = (document.getElementById("searchImput")?.value || "").toLowerCase();

  const filtered = productsCache.filter((p) => {
    if (supplier && p.supplier !== supplier) return false;
    if (category && p.category !== category) return false;
    if (search && !(p.name || "").toLowerCase().includes(search)) return false;
    return true;
  });

  renderProducts(filtered);
}

async function loadProducts() {
  const snap = await getDocs(collection(db, "products"));
  productsCache = snap.docs.map((docSnap) => {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      name: data.name || "",
      supplier: data.supplier || data.counterparty || "",
      category: data.category || "",
      price: data.price ?? null,
      stock: data.stock ?? null
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

function openModal(product) {
  const overlay = document.getElementById("productModalOverlay");
  const titleEl = document.getElementById("productModalTitle");
  (document.getElementById("productName") || {}).value = product?.name || "";
  (document.getElementById("productSupplier") || {}).value = product?.supplier || "";
  (document.getElementById("productCategory") || {}).value = product?.category || "";
  (document.getElementById("productPrice") || {}).value = product?.price ?? "";
  (document.getElementById("productStock") || {}).value = product?.stock ?? "";
  if (titleEl) titleEl.textContent = product ? "Редактирование товара" : "Новый товар";
  if (overlay) overlay.classList.add("open");
}

function closeModal() {
  const overlay = document.getElementById("productModalOverlay");
  if (overlay) overlay.classList.remove("open");
  editingId = null;
}

async function saveProduct() {
  const name = document.getElementById("productName")?.value.trim() || "";
  const supplier = document.getElementById("productSupplier")?.value.trim() || "";
  const category = document.getElementById("productCategory")?.value.trim() || "";
  const price = Number(document.getElementById("productPrice")?.value || 0);
  const stock = Number(document.getElementById("productStock")?.value || 0);

  if (!name) return;

  const data = { name, supplier, category, price, stock };

  if (editingId) {
    await updateDoc(doc(db, "products", editingId), data);
  } else {
    await addDoc(collection(db, "products"), data);
  }

  closeModal();
  await loadProducts();
  applyFilters();
}

async function deleteProduct(id) {
  if (!confirm("Удалить товар?")) return;
  await deleteDoc(doc(db, "products", id));
  await loadProducts();
  applyFilters();
}

function openSellModal(product) {
  const overlay = document.getElementById("sellModalOverlay");
  const nameEl = document.getElementById("sellProductName");
  const qtyEl = document.getElementById("sellQuantity");
  const dateEl = document.getElementById("sellDate");
  const priceEl = document.getElementById("sellPrice");
  if (!overlay || !nameEl) return;
  nameEl.textContent = product.name || "—";
  (qtyEl || {}).value = 1;
  (dateEl || {}).value = new Date().toISOString().slice(0, 10);
  (priceEl || {}).value = product.price ?? "";
  overlay.dataset.sellProductId = product.id;
  overlay.classList.add("open");
}

function closeSellModal() {
  const overlay = document.getElementById("sellModalOverlay");
  if (overlay) {
    overlay.classList.remove("open");
    delete overlay.dataset.sellProductId;
  }
}

async function saveSale() {
  const overlay = document.getElementById("sellModalOverlay");
  const productId = overlay?.dataset.sellProductId;
  const product = productsCache.find((p) => p.id === productId);
  if (!product) return closeSellModal();

  const qty = Number(document.getElementById("sellQuantity")?.value || 1);
  const dateStr = document.getElementById("sellDate")?.value;
  const price = Number(document.getElementById("sellPrice")?.value || 0);

  const saleDate = dateStr ? new Date(dateStr + "T12:00:00") : new Date();

  await addDoc(collection(db, "sales"), {
    name: product.name,
    counterparty: product.supplier || "",
    rating: qty,
    saleDate: Timestamp.fromDate(saleDate),
    price: price,
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
  document.getElementById("searchImput")?.addEventListener("input", applyFilters);

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
