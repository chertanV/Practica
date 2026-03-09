/**
 * SoldGood — модель проданного товара (используется в отчётах)
 * Поля: name, counterparty (поставщик), rating (кол-во), saleDate, price
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