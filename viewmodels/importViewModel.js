/**
 * importViewModel.js — пакетная запись данных в Firestore (writeBatch)
 * Отвечает за атомарную вставку массива документов в заданную коллекцию.
 * Импорт товаров выполняется на странице «Товары» (productsPage.js) с обновлением по штрих-коду/названию
 */
import { db } from "../services/firebaseConfig.js";
import {
    collection,
    writeBatch,
    doc
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";

/** Пакетная запись массива документов в коллекцию */
export async function saveImportedData(collectionName, data) {
    const batch = writeBatch(db);
    const collectionRef = collection(db, collectionName);

    data.forEach((item) => {
        const newDoc = doc(collectionRef);
        batch.set(newDoc, item);
    });

    await batch.commit();
}