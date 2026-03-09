/**
 * productsViewModel.js — получение товаров из Firestore
 * Используется при необходимости загрузки товаров через ViewModel (основная логика в productsPage)
 */
import { db } from "../services/firebaseConfig.js";
import {
    collection,
    getDocs
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";

/** Получить все товары из коллекции products */
export async function getProducts() {
    const snapshot = await getDocs(collection(db, "products"));
    const products = [];

    snapshot.forEach(doc => {
        products.push({
            id: doc.id,
            ...doc.data()
        });
    });
    return products;
}