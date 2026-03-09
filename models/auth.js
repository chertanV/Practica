/**
 * auth.js — авторизация и регистрация
 * Вход по email/паролю, регистрация без подтверждения, русские сообщения об ошибках
 */

import { auth } from "../services/firebaseConfig.js";

/** Перевод кодов ошибок Firebase Auth на русский */
function translateAuthError(code) {
  const map = {
    "auth/invalid-email": "Неверный формат email",
    "auth/user-disabled": "Аккаунт отключён",
    "auth/user-not-found": "Пользователь не найден",
    "auth/wrong-password": "Неверный пароль",
    "auth/invalid-credential": "Неверный email или пароль",
    "auth/email-already-in-use": "Этот email уже зарегистрирован",
    "auth/weak-password": "Пароль должен быть не менее 6 символов",
    "auth/operation-not-allowed": "Операция недоступна",
    "auth/too-many-requests": "Слишком много попыток. Попробуйте позже",
  };
  return map[code] || null;
}
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js";

export { onAuthStateChanged, signOut };

/**
 * Инициализация страницы входа (для SPA).
 * Вызывается при загрузке view/login.html
 */
export function initLoginPage(onSuccess) {
  const form = document.getElementById("loginForm");
  const errorEl = document.getElementById("errorMessage");

  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    if (errorEl) {
      errorEl.textContent = "";
      errorEl.classList.add("hidden");
    }

    try {
      await signInWithEmailAndPassword(auth, email, password);
      if (typeof onSuccess === "function") onSuccess();
    } catch (error) {
      console.error("Ошибка входа:", error);
      if (errorEl) {
        errorEl.textContent = translateAuthError(error.code) || error.message || "Ошибка входа";
        errorEl.classList.remove("hidden");
      }
    }
  });
}

/**
 * Инициализация страницы регистрации.
 * После успешной регистрации пользователь автоматически авторизуется.
 */
export function initRegisterPage(onSuccess) {
  const form = document.getElementById("registerForm");
  const errorEl = document.getElementById("registerError");

  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("regEmail").value.trim();
    const password = document.getElementById("regPassword").value;
    const repeat = document.getElementById("regPasswordRepeat").value;

    if (errorEl) {
      errorEl.textContent = "";
      errorEl.classList.add("hidden");
    }

    if (password !== repeat) {
      if (errorEl) {
        errorEl.textContent = "Пароли не совпадают";
        errorEl.classList.remove("hidden");
      }
      return;
    }

    try {
      await createUserWithEmailAndPassword(auth, email, password);
      if (typeof onSuccess === "function") onSuccess();
    } catch (error) {
      console.error("Ошибка регистрации:", error);
      if (errorEl) {
        errorEl.textContent = translateAuthError(error.code) || error.message || "Ошибка регистрации";
        errorEl.classList.remove("hidden");
      }
    }
  });
}
