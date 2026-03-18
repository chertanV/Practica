/**
 * suppliersService.js — работа с коллекцией suppliers в Firestore
 * Отвечает за: получение списка поставщиков (getSuppliers), создание нового (createSupplier).
 * Остальной CRUD (обновление, удаление) выполняется в suppliersPage через firestoreService
 */
import {
    getCollection,
    addDocument
} from "./firestoreService.js";

const COLLECTION = "suppliers";

/** Получить всех поставщиков */
export async function getSuppliers() {
    return await getCollection(COLLECTION);
}

/** Создать поставщика. data: { fullName, contactPerson, contractNumber, address } */
export async function createSupplier(data) {
    return await addDocument(COLLECTION, data);
}