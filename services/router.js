/**
 * Сервис навигации (Router).
 * Отвечает за переключение между страницами (View).
 */
 class Router {
    constructor() {
        this.routes = {
            //Примеры маршрутов, которые можно использовать для навигации:
           // 'main': 'views/main.html',
           // 'sales': 'views/sales.html',
           // 'reports': 'views/reports.html'
        };
    }

    /**
     * TODO: Реализовать загрузку контента страницы в основной контейнер.
     * @param {string} pageKey - Ключ страницы (main, sales или reports).
     */
    async navigate(pageKey) {
        const path = this.routes[pageKey];
        console.log(`Переход на страницу: ${path}`);
        
        // Необходимо реализовать:
        // 1. Fetch запрос к файлу страницы.
        // 2. Вставку полученного HTML в <main id="app"></main>.
        // 3. Уведомление соответствующей ViewModel о смене страницы.
    }
}

export default new Router(); // Экспортируем как синглтон