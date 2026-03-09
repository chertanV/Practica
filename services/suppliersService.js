import {
    getCollection,
    addDocument
} from "./firestoreService.js";

const COLLECTION = "suppliers";

export async function getSuppliers() {
    return await getCollection(COLLECTION);
}

export async function createSupplier(data) {
    return await addDocument(COLLECTION, data);
}