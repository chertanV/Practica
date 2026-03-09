/**
 * importViewModel.js — пакетная запись импортированных данных в Firestore
 * Использует writeBatch для атомарной записи нескольких документов (сейчас импорт идёт через importPage напрямую)
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