import router from './services/router.js';
import { auth } from './services/firebaseConfig.js';
import { signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js";
import { initLoginPage, initRegisterPage } from "./models/auth.js";

import initImportPage from "./models/importPage.js";
import initMainPage from "./models/mainPage.js";
import initProductsPage from "./models/productsPage.js";
import { initReportsPage } from "./models/reportPage.js";

const PROTECTED_ROUTES = ['main', 'reports', 'imports', 'products'];

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

// ─── Защищённые маршруты: редирект на логин если не авторизован ─
function requireAuth(route) {
  if (PROTECTED_ROUTES.includes(route) && !auth.currentUser) {
    router.navigate("login");
    return false;
  }
  return true;
}

// ─── Старт приложения после инициализации auth ─────────────────
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

// ─── Обработка загруженных страниц ─────────────────────────────
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
});
