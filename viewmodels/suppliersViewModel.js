/**
 * suppliersViewModel.js — слой между страницей поставщиков и сервисом
 * Отвечает за загрузку списка поставщиков и добавление нового (используется в suppliersPage при необходимости)
 */
import {
    getSuppliers,
    createSupplier
} from "../services/suppliersService.js";

export async function loadSuppliers() {
    try {
        const suppliers = await getSuppliers();
        return suppliers;
    } catch (error) {
        console.error("Ошибка загрузки поставщиков: ", error);
        return [];
    }
}

export async function addSupplier(supplierData) {
    try {
        await createSupplier(supplierData);
    } catch (error) {
        console.error("Ошибка добавления поставщика: ", error);
    }
}