import {
    getCollection,
    getDocument
} from "./firestoreService.js";

const COLLECTION = "users";

export async function getUsers() {
    return await getCollection(COLLECTION);
}

export async function getUserById(id) {
    return await getDocument(COLLECTION, id);
}