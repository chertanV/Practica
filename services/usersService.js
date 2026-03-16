/**
 * usersService.js — работа с профилями пользователей (коллекция users в Firestore)
 * Отвечает за: получение роли (getUserRole), создание профиля при регистрации (createUserProfile),
 * смену роли (setUserRole). Поля профиля: email, role (admin | seller)
 */
import {
    getCollection,
    getDocument,
    setDocument,
    updateDocument
} from "./firestoreService.js";

const COLLECTION = "users";

/** Роли: admin — полный доступ; seller — главная, товары, продажи (без отчётов, поставщиков, импорта) */
export const ROLES = { ADMIN: "admin", SELLER: "seller" };

/** Получить всех пользователей */
export async function getUsers() {
    return await getCollection(COLLECTION);
}

/** Получить пользователя по ID */
export async function getUserById(id) {
    return await getDocument(COLLECTION, id);
}

/** Получить роль пользователя по uid. Если профиля нет — возвращает null */
export async function getUserRole(uid) {
    const user = await getUserById(uid);
    return user?.role ?? null;
}

/** Создать профиль пользователя при регистрации (роль по умолчанию — seller) */
export async function createUserProfile(uid, email, role = ROLES.SELLER) {
    return await setDocument(COLLECTION, uid, {
        email: email || "",
        role,
        createdAt: new Date().toISOString(),
    });
}

/** Обновить роль пользователя (только для админа) */
export async function setUserRole(uid, role) {
    return await updateDocument(COLLECTION, uid, { role });
}