import { getProducts } from "../viewmodels/productsViewModel.js";

let products = [];

export default async function initProductsPage() {
    products = await getProducts();
    renderProducts(products);
    document.getElementById("applyFilter").addEventListener("click", applyFilter);
}

function renderProducts(list) {
    const table = document.getElementById("productsTable");
    
    table.innerHTML = "";

    list.forEach(product => {
        const row = '<tr><td>${product.name}</td><td>${product.supplier}</td><td>${product.category}</td><td>${product.price}</td><td>${product.stock}</td></tr>';
        table.innerHTML += row;
    });
}

function applyFilter() {
    const search = document.getElementById("searchInput").ariaValueMax.toLowerCase();
    const filtered = products.filter(p => p.name.toLowerCase().includes(search));
    renderProducts(filtered);
}