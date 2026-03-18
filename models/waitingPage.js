/**
 * waitingPage.js — страница ожидания назначения роли
 * Отвечает за: отображение сообщения и периодическую проверку роли в Firestore.
 */
import router from "../services/router.js";
import { auth } from "../services/firebaseConfig.js";
import { getUserRole, ROLES } from "../services/usersService.js";
import { signOut } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js";

function isRoleValid(role) {
  return role === ROLES.ADMIN || role === ROLES.SELLER;
}

export default function initWaitingPage() {
  const emailEl = document.getElementById("waitingEmail");
  if (emailEl) {
    emailEl.textContent = auth.currentUser?.email || "—";
  }

  const checkBtn = document.getElementById("checkRoleBtn");
  const logoutBtn = document.getElementById("logoutFromWaitingBtn");

  async function checkRoleAndProceed() {
    if (!auth.currentUser) {
      router.navigate("login");
      return;
    }
    try {
      const role = await getUserRole(auth.currentUser.uid);
      if (isRoleValid(role)) {
        // Перезагружаем страницу, чтобы index.js заново загрузил роль и обновил UI/редиректы.
        window.location.reload();
      }
    } catch (e) {
      // Тишина: пользователь просто продолжает ждать
      console.warn("Проверка роли не удалась:", e);
    }
  }

  checkBtn?.addEventListener("click", () => checkRoleAndProceed());
  logoutBtn?.addEventListener("click", async () => {
    await signOut(auth);
    router.navigate("login");
  });

  // Автопроверка каждые 5 секунд
  const intervalId = setInterval(() => {
    checkRoleAndProceed().catch(() => {});
  }, 5000);

  // На уход со страницы очищаем интервал
  document.addEventListener(
    "pageChanged",
    (ev) => {
      if (ev.detail !== "waiting") clearInterval(intervalId);
    },
    { once: false }
  );
}

