import SoldGood from './models/soldGood.js';
import ReportViewModel from './viewmodels/ReportViewModel.js';
import router from './services/router.js';
import { auth } from './services/firebaseConfig.js';
import { signOut } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js";

const goods = [
    new SoldGood("Ноутбук", "ООО Альфа", 4.5, "2026-01-10", 50000),
    new SoldGood("Мышь", "ООО Альфа", 4, "2026-02-15", 1500),
    new SoldGood("Клавиатура", "ООО Бета", 3, "2026-03-01", 3000),
    new SoldGood("Ноутбук", "ООО Бета", 5, "2026-03-20", 55000),
];

const reportVM = new ReportViewModel(goods);

// Загружаем главную страницу при старте
router.navigate('main');

// Слушаем смену страницы
document.addEventListener("pageChanged", (event) => {

    if (event.detail === 'main') {

        document.getElementById("goReports").addEventListener("click", () => router.navigate("reports"));
    
        document.getElementById("logoutBtn").addEventListener("click", async () => {
            await signOut(auth);
            window.location.href = "./view/login.html";
        })
    }

    if (event.detail === 'reports') {
        document.getElementById("backMain").addEventListener("click", () => router.navigate("main"));
    
        document.getElementById("generateReport").addEventListener("click", async () => {
            
            const minRating = Number(document.getElementById("minRating").value);
            const startDate = new Date(document.getElementById("startDate").value);
            const endDate = new Date(document.getElementById("endDate").value);

            await reportVM.exportReport({
                minRating,
                startDate,
                endDate
            });
        });
    }
});