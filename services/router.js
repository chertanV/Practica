/**
 * Сервис навигации (Router).
 * Отвечает за переключение между страницами (View).
 */
class Router {
    constructor() {
        this.routes = {
            //Примеры маршрутов, которые можно использовать для навигации:
            // 'sales': 'views/sales.html',
            'main': './view/main.html',
            'reports': './view/reports.html',
            'imports': './view/import.html',
            'products': './view/products.html'
        };
    }

    async navigate(pageKey) {
        const path = this.routes[pageKey];
        console.log(`Переход на страницу: ${path}`);
        
        if (!path) {
            console.error("Страница не найдена:", pageKey);
            return;
        }

        const response = await fetch(path);
        const html = await response.text();

        document.getElementById("app").innerHTML = html;
        
        // Уведомляем, что страница загружена
        document.dispatchEvent(new CustomEvent("pageChanged", { detail: pageKey}));
    }
}

export default new Router(); // Экспортируем как синглтон