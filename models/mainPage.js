import { db } from "../services/firebaseConfig.js";
import {
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";

export default async function initMainPage() {
  try {
    const productsSnap = await getDocs(collection(db, "products"));
    const productsCount = productsSnap.size;

    const salesSnap = await getDocs(collection(db, "sales"));
    let salesTotal = 0;
    let ordersTotal = 0;
    salesSnap.docs.forEach((docSnap) => {
      const d = docSnap.data();
      ordersTotal++;
      const price = Number(d.price ?? 0);
      const qty = Number(d.rating ?? d.sales ?? 1);
      salesTotal += price * qty;
    });

    const elSales = document.getElementById("statSalesToday");
    const elOrders = document.getElementById("statOrdersToday");
    const elProducts = document.getElementById("statProductsCount");
    if (elSales) elSales.textContent = salesTotal.toLocaleString("ru-RU") + " ₽";
    if (elOrders) elOrders.textContent = String(ordersTotal);
    if (elProducts) elProducts.textContent = String(productsCount);
  } catch (e) {
    console.error("Ошибка загрузки сводки:", e);
  }
}
