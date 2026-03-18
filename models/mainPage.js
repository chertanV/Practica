/**
 * mainPage.js — инициализация главной страницы
 * Отвечает за: загрузку products и sales из Firestore, расчёт выручки и числа чеков (с учётом items),
 * отрисовку сводки и блока «Нет в наличии» (товары с нулевым остатком)
 */

import { db } from "../services/firebaseConfig.js";
import {
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";

/** Инициализация главной: загрузка данных из Firestore, отрисовка сводки и списка недостающих товаров */
export default async function initMainPage() {
  try {
    const productsSnap = await getDocs(collection(db, "products"));
    const products = productsSnap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
      name: d.data().name || "",
      stock: d.data().stock ?? null,
    }));

    const productsInStock = products.filter((p) => p.stock != null && p.stock > 0);
    const outOfStock = products.filter((p) => p.stock == null || p.stock === 0);

    const salesSnap = await getDocs(collection(db, "sales"));
    let salesTotal = 0;
    let ordersTotal = 0;
    salesSnap.docs.forEach((docSnap) => {
      const d = docSnap.data();
      ordersTotal++; // один чек = один заказ
      if (d.items && Array.isArray(d.items) && d.items.length > 0) {
        d.items.forEach((it) => {
          const qty = Number(it.quantity ?? 1);
          const price = Number(it.discountedPrice ?? it.fullPrice ?? it.price ?? 0);
          salesTotal += qty * price;
        });
      } else {
        const pricePerUnit = Number(d.discountedPrice ?? d.fullPrice ?? d.price ?? 0);
        const qty = Number(d.quantity ?? d.rating ?? d.sales ?? 1);
        salesTotal += pricePerUnit * qty;
      }
    });

    const elSales = document.getElementById("statSalesToday");
    const elOrders = document.getElementById("statOrdersToday");
    const elProducts = document.getElementById("statProductsCount");
    if (elSales) elSales.textContent = salesTotal.toLocaleString("ru-RU") + " ₽";
    if (elOrders) elOrders.textContent = String(ordersTotal);
    if (elProducts) elProducts.textContent = String(productsInStock.length);

    const outEl = document.getElementById("outOfStockList");
    const cardEl = document.getElementById("outOfStockCard");
    if (outEl) {
      if (outOfStock.length === 0) {
        outEl.innerHTML = '<p class="text-muted text-sm">Все товары в наличии</p>';
      } else {
        outEl.innerHTML = `
          <ul class="out-of-stock-items">
            ${outOfStock.slice(0, 10).map((p) => `<li>${p.name || "—"}</li>`).join("")}
          </ul>
          ${outOfStock.length > 10 ? `<p class="text-muted text-sm mt-8">И ещё ${outOfStock.length - 10}...</p>` : ""}
        `;
      }
    }
    if (cardEl) cardEl.style.display = products.length > 0 ? "block" : "none";
  } catch (e) {
    console.error("Ошибка загрузки сводки:", e);
    const outEl = document.getElementById("outOfStockList");
    if (outEl) outEl.innerHTML = '<p class="text-muted text-sm">Не удалось загрузить данные</p>';
  }
}
