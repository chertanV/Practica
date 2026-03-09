/**
 * firestoreService.js — CRUD-операции с Firestore
 * Универсальные функции для работы с коллекциями (products, sales, suppliers и т.д.)
 */

import { db } from "./firebaseConfig.js";
import {
    collection,
    getDocs,
    getDoc,
    addDoc,
    doc,
    updateDoc,
    deleteDoc
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";

/** Получить все документы коллекции (products, sales, suppliers...) */
export async function getCollection(collectionName) {
    const querySnapshot = await getDocs(collection(db, collectionName));

    return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    }));
}

/** Получить один документ по ID. Возвращает null, если не найден */
export async function getDocument(collectionName, id) {
    const document = await getDoc(doc(db, collectionName, id));

    if (!document.exists()) {
        return null;
    }

    return {
        id: document.id,
        ...document.data()
    };
}

/** Добавить новый документ в коллекцию */
export async function addDocument(collectionName, data) {
    return await addDoc(collection(db, collectionName), data);
}

/** Обновить существующий документ (частичное обновление полей) */
export async function updateDocument(collectionName, id, data) {
    const ref = doc(db, collectionName, id);
    return await updateDoc(ref, data);
}

/** Удалить документ по ID */
export async function deleteDocument(collectionName, id) {
    const ref = doc(db, collectionName, id);
    return await deleteDoc(ref);
}