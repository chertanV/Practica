/**
 * suppliersPage.js — страница поставщиков
 * CRUD: ID, ФИО, контактное лицо, номер договора, адрес
 */
import {
  getCollection,
  addDocument,
  updateDocument,
  deleteDocument
} from "../services/firestoreService.js";

const COLLECTION = "suppliers";
let suppliersCache = [];
let editingId = null;  // ID редактируемого поставщика

/** Отрисовка таблицы поставщиков */
function renderSuppliers(list) {
  const tbody = document.getElementById("suppliersTable");
  const countEl = document.getElementById("suppliersCount");
  if (!tbody) return;

  tbody.innerHTML = "";
  list.forEach((s) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="mono">${s.id || "—"}</td>
      <td>${s.fullName || s.name || "—"}</td>
      <td>${s.contactPerson || "—"}</td>
      <td class="mono">${s.contractNumber || "—"}</td>
      <td>${s.address || "—"}</td>
      <td>
        <div class="row-actions">
          <button class="btn-icon edit" data-id="${s.id}" data-action="edit">Изм.</button>
          <button class="btn-icon del" data-id="${s.id}" data-action="delete">Удалить</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
  if (countEl) countEl.textContent = String(list.length);
}

/** Загрузка поставщиков из Firestore */
async function loadSuppliers() {
  const docs = await getCollection(COLLECTION);
  suppliersCache = docs.map((d) => ({
    id: d.id,
    fullName: d.fullName || d.name || "",
    contactPerson: d.contactPerson || "",
    contractNumber: d.contractNumber || "",
    address: d.address || "",
  }));
  renderSuppliers(suppliersCache);
}

/** Открытие модалки добавления/редактирования поставщика */
function openModal(supplier) {
  const overlay = document.getElementById("supplierModalOverlay");
  const titleEl = document.getElementById("supplierModalTitle");
  (document.getElementById("supplierFullName") || {}).value = supplier?.fullName || supplier?.name || "";
  (document.getElementById("supplierContact") || {}).value = supplier?.contactPerson || "";
  (document.getElementById("supplierContract") || {}).value = supplier?.contractNumber || "";
  (document.getElementById("supplierAddress") || {}).value = supplier?.address || "";
  if (titleEl) titleEl.textContent = supplier ? "Редактирование поставщика" : "Новый поставщик";
  if (overlay) overlay.classList.add("open");
}

function closeModal() {
  const overlay = document.getElementById("supplierModalOverlay");
  if (overlay) overlay.classList.remove("open");
  editingId = null;
}

/** Сохранение поставщика (создание или обновление) */
async function saveSupplier() {
  const fullName = document.getElementById("supplierFullName")?.value.trim() || "";
  const contactPerson = document.getElementById("supplierContact")?.value.trim() || "";
  const contractNumber = document.getElementById("supplierContract")?.value.trim() || "";
  const address = document.getElementById("supplierAddress")?.value.trim() || "";

  if (!fullName) return;

  const data = { fullName, contactPerson, contractNumber, address };

  if (editingId) {
    await updateDocument(COLLECTION, editingId, data);
  } else {
    await addDocument(COLLECTION, data);
  }

  closeModal();
  await loadSuppliers();
}

async function deleteSupplier(id) {
  if (!confirm("Удалить поставщика?")) return;
  await deleteDocument(COLLECTION, id);
  await loadSuppliers();
}

export default function initSuppliersPage() {
  document.getElementById("addSupplierBtn")?.addEventListener("click", () => {
    editingId = null;
    openModal(null);
  });
  document.getElementById("supplierModalClose")?.addEventListener("click", closeModal);
  document.getElementById("supplierModalCancel")?.addEventListener("click", closeModal);
  document.getElementById("supplierModalSave")?.addEventListener("click", () => {
    saveSupplier().catch((e) => console.error("Ошибка сохранения поставщика:", e));
  });

  const tbody = document.getElementById("suppliersTable");
  if (tbody) {
    tbody.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-action]");
      if (!btn) return;
      const id = btn.dataset.id;
      const supplier = suppliersCache.find((s) => s.id === id);
      if (!supplier) return;
      if (btn.dataset.action === "edit") {
        editingId = id;
        openModal(supplier);
      } else if (btn.dataset.action === "delete") {
        deleteSupplier(id).catch((err) => console.error("Ошибка удаления:", err));
      }
    });
  }

  loadSuppliers().catch((e) => console.error("Ошибка загрузки поставщиков:", e));
}
