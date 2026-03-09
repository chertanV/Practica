/**
 * Сервис навигации (Router).
 * Отвечает за переключение между страницами (View).
 */
class Router {
    constructor() {
        this.routes = {
            'main': './view/main.html',
            'reports': './view/reports.html',
            'imports': './view/import.html',
            'products': './view/products.html',
            'login': './view/login.html',
            'register': './view/register.html'
        };
        this.currentPage = null;
    }

    async navigate(pageKey) {
        const path = this.routes[pageKey];
        
        if (!path) {
            console.error("Страница не найдена:", pageKey);
            return;
        }

        try {
            const response = await fetch(path);
            if (!response.ok) throw new Error(`Ошибка загрузки: ${response.status}`);
            const html = await response.text();

            const app = document.getElementById("app");
            if (!app) return;
            app.innerHTML = html;
            this.currentPage = pageKey;
            this._updateNavActive(pageKey);
            
            document.dispatchEvent(new CustomEvent("pageChanged", { detail: pageKey }));
        } catch (err) {
            console.error("Router:", err);
            const app = document.getElementById("app");
            if (app) {
                app.innerHTML = `<div class="card" style="color: var(--red);">Не удалось загрузить страницу. Запустите проект через локальный сервер (npx serve .)</div>`;
            }
        }
    }

    _updateNavActive(pageKey) {
        document.querySelectorAll(".nav-link").forEach((link) => {
            link.classList.toggle("active", link.dataset.route === pageKey);
        });
    }
}

export default new Router();
