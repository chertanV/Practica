/**
 * suppliersService.js — работа с коллекцией suppliers
 * Загрузка списка и создание поставщиков (CRUD в suppliersPage через firestoreService)
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

/** Создать поставщика (fullName, contactPerson, contractNumber, address) */
/** Создать поставщика. data: { fullName, contactPerson, contractNumber, address } */
export async function createSupplier(data) {
    return await addDocument(COLLECTION, data);
}