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
import initWaitingPage from "./models/waitingPage.js";

/** Страницы, доступные только авторизованным пользователям */
const PROTECTED_ROUTES = ['main', 'waiting', 'reports', 'products', 'sales', 'suppliers'];

/** Маршруты только для админа (продавец перенаправляется на главную) */
const ADMIN_ONLY_ROUTES = ['reports', 'suppliers'];

/** Текущая роль пользователя (admin | seller | null) */
let currentUserRole = null;
/** Роль ещё не считали с Firestore */
let roleLoaded = false;
/** Promise загрузки роли (чтобы в pageChanged дождаться результата) */
let roleLoadingPromise = null;

function showPreloader() {
  document.getElementById("preloader")?.classList.remove("hidden");
}

function hidePreloader() {
  document.getElementById("preloader")?.classList.add("hidden");
}

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

/** Скрывает/показывает UI-элементы по роли прямо на текущей странице */
function refreshRoleUi() {
  // Если роль ещё не назначена — скрываем меню целиком (пункты не должны быть видны)
  const navEl = document.querySelector('.nav-links[data-auth="authed"]');
  if (navEl) {
    navEl.classList.toggle('hidden', !currentUserRole);
  }

  const isAdmin = currentUserRole === ROLES.ADMIN;
  document.querySelectorAll('[data-role="admin"]').forEach((el) => {
    el.classList.toggle('hidden', !isAdmin);
  });
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
  // Пока роль грузится — не редиректим, чтобы пользователь не увидел waiting/ошибки
  if (!roleLoaded) return true;

  // Если роль есть и пользователь попал на waiting — сразу уводим на main
  if (route === "waiting" && currentUserRole) {
    router.navigate("main");
    return false;
  }

  // Если роль уже загрузилась и её нет — редиректим на waiting
  if (route !== "waiting" && !currentUserRole) {
    router.navigate("waiting");
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
    roleLoaded = false;
    roleLoadingPromise = null;
    updateHeaderAuthState(null, null);
    refreshRoleUi();
    if (router.currentPage && PROTECTED_ROUTES.includes(router.currentPage)) {
      router.navigate("login");
    } else if (!router.currentPage) {
      router.navigate("login");
    }
    return;
  }

  // На время загрузки роли показываем, что прав ещё нет
  roleLoaded = false;
  roleLoadingPromise = (async () => {
    try {
      currentUserRole = await getUserRole(user.uid);
      // Если роли нет/неверная — считаем, что доступ ещё не выдан
      if (currentUserRole !== ROLES.ADMIN && currentUserRole !== ROLES.SELLER) currentUserRole = null;
    } catch (_) {
      currentUserRole = null;
    } finally {
      roleLoaded = true;
    }
  })();
  // Ждём только чтобы обновить UI корректно; навигацию сделаем ниже
  await roleLoadingPromise;
  updateHeaderAuthState(user, currentUserRole);
  refreshRoleUi();

  // При отсутствии роли отправляем на страницу ожидания
  if (!currentUserRole) {
    if (router.currentPage !== "waiting") router.navigate("waiting");
    return;
  }

  // Если роль есть и пользователь случайно попал на waiting — сразу на main
  if (router.currentPage === "waiting") {
    router.navigate("main");
    return;
  }

  if (router.currentPage === "login" || !router.currentPage) {
    router.navigate("main");
  } else if (ADMIN_ONLY_ROUTES.includes(router.currentPage) && currentUserRole !== ROLES.ADMIN) {
    router.navigate("main");
  }
});

/** При смене страницы (pageChanged от router) — инициализируем соответствующую страницу */
document.addEventListener("pageChanged", async (event) => {
  const page = event.detail;
  const pageAtStart = page;
  showPreloader();

  try {
    // Если страница защищена, а роль ещё не загружена — ждём роль, не редиректим и не инициализируем
    if (PROTECTED_ROUTES.includes(page) && auth.currentUser && !roleLoaded && roleLoadingPromise) {
      await roleLoadingPromise;
    }

    if (page === "login") {
      initLoginPage(() => router.navigate("main"));
      return;
    }

    if (page === "register") {
      initRegisterPage(() => router.navigate("main"));
      return;
    }

    if (page === "waiting") {
      initWaitingPage?.();
      return;
    }

    if (!requireAuth(page)) return;

    // Если init-функция возвращает Promise — ждём.
    // Иначе прячем прелоадер через небольшую паузу (для страниц, которые стартуют async внутри).
    const maybe = (() => {
      if (page === "main") {
        document.getElementById("goReports")?.addEventListener("click", () => router.navigate("reports"));
        document.getElementById("goImports")?.addEventListener("click", () => router.navigate("products"));
        document.getElementById("goSales")?.addEventListener("click", () => router.navigate("sales"));
        document.getElementById("goSuppliers")?.addEventListener("click", () => router.navigate("suppliers"));
        refreshRoleUi();
        return initMainPage?.();
      }

      if (page === "reports") {
        document.getElementById("backMain")?.addEventListener("click", () => router.navigate("main"));
        return initReportsPage?.();
      }

      if (page === "products") {
        document.getElementById("backMain")?.addEventListener("click", () => router.navigate("main"));
        initProductsPage?.();
        return null;
      }

      if (page === "sales") {
        document.getElementById("backMain")?.addEventListener("click", () => router.navigate("main"));
        initSalesPage?.();
        return null;
      }

      if (page === "suppliers") {
        document.getElementById("backMain")?.addEventListener("click", () => router.navigate("main"));
        initSuppliersPage?.();
        return null;
      }

      return null;
    })();

    if (maybe && typeof maybe.then === "function") {
      await maybe;
    } else {
      await new Promise((r) => setTimeout(r, 700));
    }
  } finally {
    // Если во время инициализации был редирект — не прячем прелоадер,
    // чтобы пользователь не видел "пустую" верстку между страницами.
    if (router.currentPage === pageAtStart) hidePreloader();
  }
});
