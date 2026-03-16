/**
 * soldGood.js — модель одной позиции проданного товара
 * Используется при подготовке данных для отчётов. Поля: name, counterparty, rating (кол-во), saleDate, price
 */
class SoldGood {
    constructor(name, counterparty, rating, saleDate, price) {
        this.name = name;
        this.counterparty = counterparty;
        this.rating = rating;
        this.saleDate = new Date(saleDate);
        this.price = price;
    }
}

export default SoldGood;