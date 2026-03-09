import { db } from "../services/firebaseConfig.js";
import {
  collection,
  addDoc,
  Timestamp
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";

function parseDate(val) {
  if (val == null) return null;
  if (val instanceof Date) return val;
  if (typeof val === "number") {
    // Excel serial date
    const d = new Date((val - 25569) * 86400 * 1000);
    return isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

export default function initImportPage() {
  const uploadBtn = document.getElementById("uploadExcel");
  const fileInput = document.getElementById("excelFile");
  const status = document.getElementById("status");
  const modeSelect = document.getElementById("importMode");

  if (!uploadBtn || !fileInput) return;

  uploadBtn.addEventListener("click", async () => {
    if (!fileInput.files.length) {
      if (status) status.textContent = "Выберите файл для загрузки.";
      return;
    }
    const file = fileInput.files[0];
    if (!window.XLSX) {
      if (status) status.textContent = "Библиотека XLSX не загружена.";
      return;
    }

    const isSales = modeSelect?.value === "sales";
    if (status) status.textContent = "Чтение файла...";

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = window.XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = window.XLSX.utils.sheet_to_json(sheet);

        let added = 0;
        for (const row of rows) {
          if (isSales) {
            const saleDate = parseDate(row.saleDate ?? row["Дата продажи"] ?? row.date) || new Date();
            const docData = {
              name: row.name || row.Название || "",
              counterparty: row.counterparty || row.Поставщик || row.supplier || "",
              rating: Number(row.rating ?? row.Продажи ?? row.sales ?? 0),
              saleDate: Timestamp.fromDate(saleDate instanceof Date ? saleDate : new Date(saleDate)),
              price: Number(row.price ?? row.Цена ?? 0),
            };
            await addDoc(collection(db, "sales"), docData);
          } else {
            const docData = {
              name: row.name || row.Название || "",
              supplier: row.supplier || row.Поставщик || "",
              category: row.category || row.Категория || "",
              price: Number(row.price ?? row.Цена ?? 0),
              stock: Number(row.stock ?? row.Остаток ?? 0),
            };
            await addDoc(collection(db, "products"), docData);
          }
          added++;
        }

        const target = isSales ? "продаж" : "товаров";
        if (status) status.textContent = `Импорт завершён. Добавлено ${target}: ${added}.`;
      } catch (err) {
        console.error("Ошибка импорта:", err);
        if (status) status.textContent = "Ошибка импорта файла.";
      }
    };
    reader.readAsArrayBuffer(file);
  });
}

