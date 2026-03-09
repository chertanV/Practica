/**
 * index.js — точка входа SPA «Система учёта продаж»
 * Инициализация приложения, маршрутизация, авторизация, подключение страниц
 */

import router from './services/router.js';
import { auth } from './services/firebaseConfig.js';
import { signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js";
import { initLoginPage, initRegisterPage } from "./models/auth.js";

import initImportPage from "./models/importPage.js";
import initMainPage from "./models/mainPage.js";
import initProductsPage from "./models/productsPage.js";
import initSuppliersPage from "./models/suppliersPage.js";
import initSalesPage from "./models/salesPage.js";
import { initReportsPage } from "./models/reportPage.js";

/** Страницы, доступные только авторизованным пользователям */
const PROTECTED_ROUTES = ['main', 'reports', 'imports', 'products', 'sales', 'suppliers'];

/** Обновляет шапку: показывает/скрывает меню и имя пользователя в зависимости от auth */
function updateHeaderAuthState(user) {
  const isAuthed = !!user;
  const authedEls = document.querySelectorAll('[data-auth="authed"]');
  const guestEls = document.querySelectorAll('[data-auth="guest"]');
  authedEls.forEach(el => el.classList.toggle('hidden', !isAuthed));
  guestEls.forEach(el => el.classList.toggle('hidden', isAuthed));

  const nameEl = document.getElementById('userName');
  if (nameEl) {
    if (isAuthed) {
      const email = user.email || '';
      const nickname = user.displayName || email.split('@')[0] || 'Пользователь';
      nameEl.textContent = nickname;
    } else {
      nameEl.textContent = '';
    }
  }
}

// ─── Навигация по клику на ссылки в шапке ─────────────────────
document.addEventListener("click", (e) => {
  const link = e.target.closest("a[data-route]");
  if (!link) return;
  e.preventDefault();
  const route = link.dataset.route;
  if (route === "login" || route === "register") {
    router.navigate(route);
    return;
  }
  if (PROTECTED_ROUTES.includes(route) && !auth.currentUser) {
    router.navigate("login");
    return;
  }
  router.navigate(route);
}, true);

// ─── Выход ────────────────────────────────────────────────────
document.getElementById("logoutBtn")?.addEventListener("click", async () => {
  await signOut(auth);
  router.navigate("login");
});

/** Проверка: если маршрут защищён и пользователь не авторизован — редирект на логин */
function requireAuth(route) {
  if (PROTECTED_ROUTES.includes(route) && !auth.currentUser) {
    router.navigate("login");
    return false;
  }
  return true;
}

/** Слушатель auth: при смене пользователя обновляем шапку и редиректим при необходимости */
onAuthStateChanged(auth, (user) => {
  updateHeaderAuthState(user);
  if (user) {
    if (router.currentPage === "login" || !router.currentPage) {
      router.navigate("main");
    }
  } else {
    if (router.currentPage && PROTECTED_ROUTES.includes(router.currentPage)) {
      router.navigate("login");
    } else if (!router.currentPage) {
      router.navigate("login");
    }
  }
});

/** При смене страницы (pageChanged от router) — инициализируем соответствующую страницу */
document.addEventListener("pageChanged", (event) => {
  const page = event.detail;

  if (page === "login") {
    initLoginPage(() => router.navigate("main"));
    return;
  }

  if (page === "register") {
    initRegisterPage(() => router.navigate("main"));
    return;
  }

  if (!requireAuth(page)) return;

  if (page === "main") {
    document.getElementById("goReports")?.addEventListener("click", () => router.navigate("reports"));
    document.getElementById("goImports")?.addEventListener("click", () => router.navigate("imports"));
    document.getElementById("goProducts")?.addEventListener("click", () => router.navigate("products"));
    document.getElementById("goSales")?.addEventListener("click", () => router.navigate("sales"));
    document.getElementById("goSuppliers")?.addEventListener("click", () => router.navigate("suppliers"));
    initMainPage?.();
  }

  if (page === "reports") {
    document.getElementById("backMain")?.addEventListener("click", () => router.navigate("main"));
    initReportsPage?.();
  }

  if (page === "imports") {
    document.getElementById("backMain")?.addEventListener("click", () => router.navigate("main"));
    initImportPage?.();
  }

  if (page === "products") {
    document.getElementById("backMain")?.addEventListener("click", () => router.navigate("main"));
    initProductsPage?.();
  }

  if (page === "sales") {
    document.getElementById("backMain")?.addEventListener("click", () => router.navigate("main"));
    initSalesPage?.();
  }

  if (page === "suppliers") {
    document.getElementById("backMain")?.addEventListener("click", () => router.navigate("main"));
    initSuppliersPage?.();
  }
});
