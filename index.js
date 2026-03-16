/**
 * index.js — точка входа SPA «Система учёта продаж»
 * Отвечает за: подписку на auth и загрузку роли, обновление шапки (меню по роли), редиректы при отсутствии прав,
 * обработку кликов по навигации и выходу, вызов инициализаторов страниц при событии pageChanged
 */

import router from './services/router.js';
import { auth } from './services/firebaseConfig.js';
import { signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js";
import { initLoginPage, initRegisterPage } from "./models/auth.js";
import { getUserRole, ROLES } from "./services/usersService.js";

import initMainPage from "./models/mainPage.js";
import initProductsPage from "./models/productsPage.js";
import initSuppliersPage from "./models/suppliersPage.js";
import initSalesPage from "./models/salesPage.js";
import { initReportsPage } from "./models/reportPage.js";

/** Страницы, доступные только авторизованным пользователям */
const PROTECTED_ROUTES = ['main', 'reports', 'products', 'sales', 'suppliers'];

/** Маршруты только для админа (продавец перенаправляется на главную) */
const ADMIN_ONLY_ROUTES = ['reports', 'suppliers'];

/** Текущая роль пользователя (admin | seller | null) */
let currentUserRole = null;

/** Обновляет шапку: показывает/скрывает меню и имя пользователя; скрывает ссылки admin-only для продавца */
function updateHeaderAuthState(user, role) {
  const isAuthed = !!user;
  const authedEls = document.querySelectorAll('[data-auth="authed"]');
  const guestEls = document.querySelectorAll('[data-auth="guest"]');
  authedEls.forEach(el => el.classList.toggle('hidden', !isAuthed));
  guestEls.forEach(el => el.classList.toggle('hidden', isAuthed));

  const isAdmin = role === ROLES.ADMIN;
  document.querySelectorAll('.nav-link[data-role="admin"]').forEach((el) => {
    el.classList.toggle('hidden', !isAdmin);
  });

  const nameEl = document.getElementById('userName');
  if (nameEl) {
    if (isAuthed) {
      const email = user.email || '';
      const nickname = user.displayName || email.split('@')[0] || 'Пользователь';
      const roleLabel = role === ROLES.ADMIN ? ' (Админ)' : '';
      nameEl.textContent = nickname + roleLabel;
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

/** Проверка: если маршрут защищён — авторизация; если только для админа — роль admin */
function requireAuth(route) {
  if (!PROTECTED_ROUTES.includes(route)) return true;
  if (!auth.currentUser) {
    router.navigate("login");
    return false;
  }
  if (ADMIN_ONLY_ROUTES.includes(route) && currentUserRole !== ROLES.ADMIN) {
    router.navigate("main");
    return false;
  }
  return true;
}

/** Слушатель auth: при смене пользователя загружаем роль, обновляем шапку и редиректим при необходимости */
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    currentUserRole = null;
    updateHeaderAuthState(null, null);
    if (router.currentPage && PROTECTED_ROUTES.includes(router.currentPage)) {
      router.navigate("login");
    } else if (!router.currentPage) {
      router.navigate("login");
    }
    return;
  }
  try {
    currentUserRole = await getUserRole(user.uid);
    if (currentUserRole !== ROLES.ADMIN && currentUserRole !== ROLES.SELLER) {
      currentUserRole = ROLES.SELLER;
    }
  } catch (_) {
    currentUserRole = ROLES.SELLER;
  }
  updateHeaderAuthState(user, currentUserRole);
  if (router.currentPage === "login" || !router.currentPage) {
    router.navigate("main");
  } else if (ADMIN_ONLY_ROUTES.includes(router.currentPage) && currentUserRole !== ROLES.ADMIN) {
    router.navigate("main");
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
    document.getElementById("goImports")?.addEventListener("click", () => router.navigate("products"));
    document.getElementById("goProducts")?.addEventListener("click", () => router.navigate("products"));
    document.getElementById("goSales")?.addEventListener("click", () => router.navigate("sales"));
    document.getElementById("goSuppliers")?.addEventListener("click", () => router.navigate("suppliers"));
    initMainPage?.();
    // Скрыть пункты «Быстрых действий», недоступные продавцу (Отчёты, Поставщики)
    const app = document.getElementById("app");
    if (app) {
      app.querySelectorAll("[data-role=\"admin\"]").forEach((el) => {
        el.classList.toggle("hidden", currentUserRole !== ROLES.ADMIN);
      });
    }
  }

  if (page === "reports") {
    document.getElementById("backMain")?.addEventListener("click", () => router.navigate("main"));
    initReportsPage?.();
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
