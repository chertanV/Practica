/**
 * TODO: Реализовать класс модели проданного товара.
 * Обязательные поля: название, контрагент, рейтинг, дата продажи, цена.
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