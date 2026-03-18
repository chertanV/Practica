/**
 * productsPage.js — страница товаров (список, фильтры, CRUD, импорт из Excel)
 * Отвечает за: загрузку товаров и поставщиков, таблицу с поиском и фильтрами, добавление/редактирование/удаление,
 * проверку «цена продажи > цены закупки» и остатка при продаже, импорт товаров из Excel (на этой же странице)
 */

import { db, auth } from "../services/firebaseConfig.js";
import { getCollection } from "../services/firestoreService.js";
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
let suppliersList = [];  // Список поставщиков из Firestore для проверки

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

/** Нормализация названия поставщика для сравнения (без регистра и пробелов по краям) */
function normalizeSupplier(s) {
  return (s || "").trim().toLowerCase();
}

/** Нормализация отображаемого текста (название товара/поставщика):
 * - "тЕсТ" -> "Тест"
 * - "ооо"/"ип" -> "ООО"/"ИП" (сохранить как тип организации)
 * - убираем лишние пробелы
 */
function formatHumanText(s) {
  const cleaned = (s == null ? "" : s.toString()).replace(/\s+/g, " ").trim();
  if (!cleaned) return null;

  const formatWord = (w) => {
    if (!w) return w;
    // Для слов с дефисом делаем форматирование по частям
    if (w.includes("-")) {
      return w
        .split("-")
        .map((part) => formatWord(part))
        .join("-");
    }
    const lower = w.toLowerCase();
    if (lower === "ооо") return "ООО";
    if (lower === "ип") return "ИП";
    // Только буквы (кириллица/латиница) — делаем Title Case
    if (/^[A-Za-zА-Яа-яЁё]+$/.test(w)) {
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    }
    return w;
  };

  return cleaned
    .split(" ")
    .map((w) => formatWord(w))
    .join(" ");
}

/** Применение фильтров (поставщик, категория, поиск) и перерисовка таблицы */
function applyFilters() {
  const supplier = document.getElementById("supplierFilter")?.value || "";
  const category = document.getElementById("categoryFilter")?.value || "";
  const search = (document.getElementById("searchInput")?.value || "").toLowerCase();

  const searchTrim = search.trim();
  const supplierNorm = normalizeSupplier(supplier);
  const filtered = productsCache.filter((p) => {
    if (supplierNorm && normalizeSupplier(p.supplier) !== supplierNorm) return false;
    if (category && p.category !== category) return false;
    if (searchTrim) {
      const match = (p.name || "").toLowerCase().includes(searchTrim) ||
        (p.description || "").toLowerCase().includes(searchTrim) ||
        (String(p.barcode || "").toLowerCase().includes(searchTrim));
      if (!match) return false;
    }
    return true;
  });

  renderProducts(filtered);
}

/** Загрузка товаров и поставщиков из Firestore, заполнение фильтров и выпадающего списка поставщиков */
async function loadProducts() {
  const [productsSnap, suppliersDocs] = await Promise.all([
    getDocs(collection(db, "products")),
    getCollection("suppliers").catch(() => []),
  ]);
  suppliersList = Array.isArray(suppliersDocs) ? suppliersDocs : [];
  const supplierOpts = document.getElementById("productSupplier");
  if (supplierOpts && supplierOpts.tagName === "SELECT") {
    supplierOpts.innerHTML = '<option value="">— Выберите поставщика —</option>';
    suppliersList.forEach((s) => {
      const name = s.fullName || s.name || "";
      if (name) {
        const opt = document.createElement("option");
        opt.value = name;
        opt.textContent = name;
        supplierOpts.appendChild(opt);
      }
    });
  }

  const snap = productsSnap;
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
    supplierSel.innerHTML = `<option value="">Все поставщики</option>`;
    // Только из коллекции suppliers — один источник правды; товары с supplier не из справочника по-прежнему видны при «Все поставщики»
    suppliersList.forEach((s) => {
      const name = s.fullName || s.name || "";
      if (name) {
        const opt = document.createElement("option");
        opt.value = name;
        opt.textContent = name;
        supplierSel.appendChild(opt);
      }
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
  const supplierSel = document.getElementById("productSupplier");
  (document.getElementById("productName") || {}).value = product?.name || "";
  (document.getElementById("productDescription") || {}).value = product?.description || "";
  (document.getElementById("productBarcode") || {}).value = product?.barcode || "";
  (document.getElementById("productCategory") || {}).value = product?.category || "";
  (document.getElementById("productPurchasePrice") || {}).value = product?.purchasePrice ?? product?.price ?? "";
  (document.getElementById("productSalePrice") || {}).value = product?.salePrice ?? product?.price ?? "";
  (document.getElementById("productStock") || {}).value = product?.stock ?? "";
  if (supplierSel && supplierSel.tagName === "SELECT") {
    const productSupplierNorm = product?.supplier ? normalizeSupplier(product.supplier) : "";
    const match = productSupplierNorm && suppliersList.find(
      (s) => normalizeSupplier(s.fullName || s.name) === productSupplierNorm
    );
    if (product?.supplier && !match) {
      const opt = document.createElement("option");
      opt.value = product.supplier.trim();
      opt.textContent = product.supplier.trim() + " (нет в списке)";
      supplierSel.appendChild(opt);
    }
    supplierSel.value = match ? (match.fullName || match.name) : (product?.supplier?.trim() || "");
  }
  if (titleEl) titleEl.textContent = product ? "Редактирование товара" : "Новый товар";
  if (overlay) overlay.classList.add("open");
}

/** Закрытие модалки товара */
function closeModal() {
  const overlay = document.getElementById("productModalOverlay");
  if (overlay) overlay.classList.remove("open");
  editingId = null;
}

/** Сохранение товара. Поставщик — только из списка. Цена продажи > цены закупки */
async function saveProduct() {
  const nameRaw = document.getElementById("productName")?.value || "";
  const supplierRaw = document.getElementById("productSupplier")?.value || "";
  const name = formatHumanText(nameRaw);
  const supplier = formatHumanText(supplierRaw);
  const description = document.getElementById("productDescription")?.value.trim() || "";
  const barcode = document.getElementById("productBarcode")?.value.trim() || "";
  const category = document.getElementById("productCategory")?.value.trim() || "";
  const purchasePrice = Number(document.getElementById("productPurchasePrice")?.value || 0);
  const salePrice = Number(document.getElementById("productSalePrice")?.value || 0);
  const stock = Number(document.getElementById("productStock")?.value || 0);

  if (!name) return;
  const supplierNorm = normalizeSupplier(supplier);
  if (!supplierNorm) {
    alert("Выберите поставщика из списка. Добавить нового можно на странице «Поставщики».");
    return;
  }
  const validSuppliers = suppliersList.map((s) => s.fullName || s.name).filter(Boolean);
  const isAllowedSupplier = validSuppliers.some((s) => normalizeSupplier(s) === supplierNorm);
  const existingProduct = editingId ? productsCache.find((p) => p.id === editingId) : null;
  const wasAlreadySupplier = existingProduct && normalizeSupplier(existingProduct.supplier) === supplierNorm;
  if (validSuppliers.length && !isAllowedSupplier && !wasAlreadySupplier) {
    alert("Выберите поставщика из списка. Нельзя указать произвольного поставщика.");
    return;
  }
  // Сохраняем каноническое имя из справочника при совпадении (без лишних пробелов/регистра)
  const canonicalSupplier = validSuppliers.find((s) => normalizeSupplier(s) === supplierNorm) || supplier;

  if (salePrice <= purchasePrice && (purchasePrice > 0 || salePrice > 0)) {
    alert("Цена продажи должна быть выше цены закупки, иначе работа в ноль.");
    return;
  }

  // Базовые данные товара
  const baseData = {
    name,
    supplier: canonicalSupplier,
    description,
    barcode,
    category,
    purchasePrice,
    salePrice,
  };

  if (editingId) {
    // Обычное редактирование конкретного товара
    await updateDoc(doc(db, "products", editingId), { ...baseData, stock });
  } else {
    // Создание: товар считается «тем же», только если совпадают:
    // 1) поставщик
    // 2) цена закупки
    // 3) цена продажи
    // 4) и идентификатор: штрих-код (если он заполнен) или название (если штрих-кода нет)
    const roundMoney = (v) => Math.round(Number(v) * 100) / 100;
    const barcodeKey = (barcode || "").trim().toLowerCase();
    const nameKey = name.trim().toLowerCase();
    const purchaseKey = roundMoney(purchasePrice);
    const saleKey = roundMoney(salePrice);

    const candidates = productsCache.filter((p) => {
      if (normalizeSupplier(p.supplier) !== supplierNorm) return false;
      if (p.purchasePrice == null || p.salePrice == null) return false;
      if (roundMoney(p.purchasePrice) !== purchaseKey) return false;
      if (roundMoney(p.salePrice) !== saleKey) return false;

      if (barcodeKey) {
        return (p.barcode || "").trim().toLowerCase() === barcodeKey;
      }
      return (p.name || "").trim().toLowerCase() === nameKey;
    });

    if (candidates.length === 1) {
      const existing = candidates[0];
      const currentStock = Number(existing.stock ?? 0);
      const newStock = currentStock + stock;
      await updateDoc(doc(db, "products", existing.id), { ...baseData, stock: newStock });
    } else if (candidates.length === 0) {
      await addDoc(collection(db, "products"), { ...baseData, stock });
    } else {
      alert(
        "Найдено несколько товаров, совпадающих по поставщику и ценам. Уточните данные или удалите дубликаты в базе."
      );
      return;
    }
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
  (dateEl || {}).value = new Date().toISOString().slice(0, 10);
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

/** Оформление продажи: запись в sales (один документ на позицию при продаже с товаров), уменьшение остатка */
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

  const currentStock = product.stock ?? 0;
  if (currentStock < qty) {
    alert(`Недостаточно товара в наличии. Остаток: ${currentStock}`);
    return;
  }
  const newStock = currentStock - qty;
  await updateDoc(doc(db, "products", productId), { stock: newStock });
  const updated = productsCache.find((p) => p.id === productId);
  if (updated) updated.stock = newStock;

  closeSellModal();
  applyFilters();
}

/** Импорт товаров из Excel: обновление по штрих-коду/названию, иначе добавление. Цена продажи при нарушении > закупки — +10% */
function initImportOnProductsPage() {
  const uploadBtn = document.getElementById("uploadExcel");
  const fileInput = document.getElementById("excelFile");
  const statusEl = document.getElementById("importStatus");

  if (!uploadBtn || !fileInput) return;

  uploadBtn.addEventListener("click", async () => {
    if (!fileInput.files.length) {
      if (statusEl) statusEl.textContent = "Выберите файл .xlsx или .xls";
      return;
    }
    const file = fileInput.files[0];
    if (typeof window.XLSX === "undefined") {
      if (statusEl) statusEl.textContent = "Библиотека XLSX не загружена.";
      return;
    }
    if (statusEl) statusEl.textContent = "Чтение файла...";

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const productsSnap = await getDocs(collection(db, "products"));
        // Поставщики нужны для проверки/создания справочника при импорте.
        const suppliersDocs = await getCollection("suppliers").catch(() => []);
        const suppliersByNorm = new Map(); // supplierNorm -> canonical fullName из БД
        if (Array.isArray(suppliersDocs)) {
          suppliersDocs.forEach((s) => {
            const full = s.fullName || s.name || "";
            const norm = normalizeSupplier(full);
            if (full && norm) suppliersByNorm.set(norm, full);
          });
        }

        const byBarcode = {}; // barcodeKey -> [{id, doc, supplierNorm, purchaseNorm, saleNorm}]
        const byName = {}; // nameKey -> same shape

        const roundMoney = (v) => Math.round(Number(v) * 100) / 100;

        const normalizeOptionalString = (v) => {
          if (v == null) return null;
          const s = v.toString().trim();
          return s ? s : null;
        };

        const parseOptionalNumber = (v) => {
          if (v == null || v === "") return null;
          const n = Number(v);
          return Number.isNaN(n) ? null : n;
        };

        const ensureSupplierExists = async (supplierTrimmed) => {
          const formatted = formatHumanText(supplierTrimmed);
          const norm = normalizeSupplier(formatted);
          if (!norm) return supplierTrimmed;
          if (suppliersByNorm.has(norm)) return suppliersByNorm.get(norm);
          // Создаём новый поставщик с пустыми прочими полями
          await addDoc(collection(db, "suppliers"), {
            fullName: formatted,
            contactPerson: "",
            contractNumber: "",
            address: "",
          });
          suppliersByNorm.set(norm, formatted);
          return formatted;
        };

        productsSnap.docs.forEach((d) => {
          const data = d.data();
          const barcode = normalizeOptionalString(data.barcode);
          const name = normalizeOptionalString(data.name);
          const supplierStr = data.supplier || data.counterparty || "";
          const supplierNorm = normalizeSupplier(supplierStr);
          const purchasePrice = data.purchasePrice ?? data.price ?? null;
          const salePrice = data.salePrice ?? data.price ?? null;

          const entry = {
            id: d.id,
            doc: {
              name: data.name || "",
              supplier: supplierStr,
              description: data.description || "",
              barcode: data.barcode || "",
              category: data.category || "",
              purchasePrice,
              salePrice,
              stock: Number(data.stock ?? 0),
            },
            supplierNorm,
            purchaseNorm: purchasePrice == null ? null : roundMoney(purchasePrice),
            saleNorm: salePrice == null ? null : roundMoney(salePrice),
          };

          if (barcode) {
            const key = barcode.toLowerCase();
            if (!byBarcode[key]) byBarcode[key] = [];
            byBarcode[key].push(entry);
          }
          if (name) {
            const key = name.toLowerCase();
            if (!byName[key]) byName[key] = [];
            byName[key].push(entry);
          }
        });

        const data = new Uint8Array(e.target.result);
        const workbook = window.XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = window.XLSX.utils.sheet_to_json(sheet);

        let added = 0;
        let updated = 0;
        let skipped = 0;
        let firstErrorMsg = null;

        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          const excelRowNumber = i + 2; // условно: строка 1 — заголовок

          // Цена: если не заполнено — строку пропускаем (нельзя понять, какой товар обновлять)
          const purchaseRaw = row.purchasePrice ?? row["Цена закупки"] ?? row.price ?? row.Цена ?? null;
          const saleRaw = row.salePrice ?? row["Цена продажи"] ?? row.price ?? row.Цена ?? null;
          let purchasePrice = parseOptionalNumber(purchaseRaw);
          let salePrice = parseOptionalNumber(saleRaw);

          // Строковые поля
          const barcode = normalizeOptionalString(row.barcode ?? row.Barcode ?? row["Штрих-код"] ?? null);
          const name = formatHumanText(normalizeOptionalString(row.name ?? row.Название ?? null));
          const supplier = formatHumanText(normalizeOptionalString(row.supplier ?? row.Поставщик ?? null));
          const description = normalizeOptionalString(row.description ?? row.Описание ?? null);
          const category = normalizeOptionalString(row.category ?? row.Категория ?? null);
          const importStock = parseOptionalNumber(row.stock ?? row.Остаток ?? null);

          const supplierNorm = supplier ? normalizeSupplier(supplier) : "";
          const barcodeKey = barcode ? barcode.toLowerCase() : null;
          const nameKey = name ? name.toLowerCase() : null;

          // Проверки «мало информации»
          if (!supplierNorm || purchasePrice == null || salePrice == null || (!barcodeKey && !nameKey)) {
            skipped++;
            const msg =
              `Строка ${excelRowNumber}: недостаточно данных для импорта. ` +
              `Нужно заполнить: поставщик, цены закупки и продажи, а также штрих-код или название.`;
            if (!firstErrorMsg) firstErrorMsg = msg;
            console.warn(msg, row);
            continue;
          }

          // Проверка цены продажи > закупки (если Excel заполнен корректно — это не изменит identity)
          if (salePrice <= purchasePrice && (purchasePrice > 0 || salePrice > 0)) {
            salePrice = purchasePrice > 0 ? Math.ceil(purchasePrice * 1.1) : salePrice || 0;
          }

          const purchaseKey = roundMoney(purchasePrice);
          const saleKey = roundMoney(salePrice);

          const candidates = barcodeKey
            ? (byBarcode[barcodeKey] || [])
            : (byName[nameKey] || []);

          const filtered = candidates.filter((c) =>
            c.supplierNorm === supplierNorm &&
            c.purchaseNorm === purchaseKey &&
            c.saleNorm === saleKey
          );

          // Много кандидатов => неоднозначно, ничего не делаем
          if (filtered.length > 1) {
            skipped++;
            const msg =
              `Строка ${excelRowNumber}: неоднозначность импорта. ` +
              `Найдено несколько товаров с одинаковыми поставщиком и ценами. ` +
              `Уточните данные или удалите дубликаты в коллекции "products".`;
            if (!firstErrorMsg) firstErrorMsg = msg;
            console.warn(msg, row);
            continue;
          }

          if (filtered.length === 1) {
            const existing = filtered[0];
            const updatePayload = {};

            const supplierCanonical = await ensureSupplierExists(supplier);

            if (name != null) updatePayload.name = name;
            if (supplierCanonical != null) updatePayload.supplier = supplierCanonical;
            if (description != null) updatePayload.description = description;
            if (barcode != null) updatePayload.barcode = barcode;
            if (category != null) updatePayload.category = category;

            // Цены есть и используются для идентификации, поэтому обновляем их
            updatePayload.purchasePrice = purchasePrice;
            updatePayload.salePrice = salePrice;

            // Остаток: увеличиваем только если Excel значение заполнено
            if (importStock != null) {
              updatePayload.stock = Number(existing.doc?.stock ?? 0) + importStock;
            }

            await updateDoc(doc(db, "products", existing.id), updatePayload);
            updated++;
          } else {
            // filtered.length === 0 => это «другой товар» (поставщик/цены/штрих-код отличаются)
            const supplierCanonical = await ensureSupplierExists(supplier);
            await addDoc(collection(db, "products"), {
              name: name ?? "",
              supplier: supplierCanonical ?? "",
              description: description ?? "",
              barcode: barcode ?? "",
              category: category ?? "",
              purchasePrice: purchasePrice ?? 0,
              salePrice: salePrice ?? 0,
              stock: importStock ?? 0,
            });
            added++;
          }
        }

        if (statusEl) {
          const tail = firstErrorMsg ? ` Пропущено строк: ${skipped}.` : ` Пропущено строк: ${skipped}.`;
          statusEl.textContent = `Импорт завершён. Обновлено: ${updated}, добавлено: ${added}.${tail}`;
        }
        if (firstErrorMsg && skipped > 0) {
          alert(firstErrorMsg);
        }
        fileInput.value = "";
        await loadProducts();
        applyFilters();
      } catch (err) {
        console.error("Ошибка импорта:", err);
        if (statusEl) statusEl.textContent = "Ошибка импорта файла.";
      }
    };
    reader.readAsArrayBuffer(file);
  });
}

export default function initProductsPage() {
  document.getElementById("searchInput")?.addEventListener("input", applyFilters);
  document.getElementById("supplierFilter")?.addEventListener("change", applyFilters);
  document.getElementById("categoryFilter")?.addEventListener("change", applyFilters);

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

  initImportOnProductsPage();
  loadProducts().catch((e) => console.error("Ошибка загрузки товаров:", e));
}
