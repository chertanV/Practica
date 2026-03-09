/**
 * usersService.js — работа с коллекцией users в Firestore
 * Используется для получения списка пользователей и данных по ID (если нужны роли/профили)
 */
import {
    getCollection,
    getDocument
} from "./firestoreService.js";

const COLLECTION = "users";

/** Получить всех пользователей */
export async function getUsers() {
    return await getCollection(COLLECTION);
}

/** Получить пользователя по ID */
export async function getUserById(id) {
    return await getDocument(COLLECTION, id);
}