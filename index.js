import router from './services/router.js';
import { auth } from './services/firebaseConfig.js';
import { signOut } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js";

import initImportPage from "./models/importPage.js";
import initProductsPage from "./models/productsPage.js";
import { initReportsPage } from "./models/reportPage.js";


// Загружаем главную страницу при старте
router.navigate('main');

// Слушаем смену страницы
document.addEventListener("pageChanged", (event) => {

    if (event.detail === 'main') {

        document.getElementById("goReports").addEventListener("click", () => router.navigate("reports"));
    
        document.getElementById("goImports").addEventListener("click", () => router.navigate("imports"));

        document.getElementById("goProducts").addEventListener("click", () => router.navigate("products"));

        document.getElementById("logoutBtn").addEventListener("click", async () => {
            await signOut(auth);
            window.location.href = "./view/login.html";
        });
    }

    if (event.detail === 'reports') {
        document.getElementById("backMain").addEventListener("click", () => router.navigate("main"));
        initReportsPage();
    }

    if (event.detail === 'imports') {
        document.getElementById("backMain").addEventListener("click", () => router.navigate("main"));
        initImportPage();
    }

    if (event.detail === 'products') {
        document.getElementById("backMain").addEventListener("click", () => router.navigate("main"));
        initProductsPage();
    }
});