import { DashboardView } from './DashboardView.js';
import { ItemPanelView } from './ItemPanelView.js';
import { on } from '../utils/index.js';

export const Router = (appRoot, inventoryService) => {
    const routes = {
        '': () => DashboardView(appRoot, inventoryService),
        '#item': (id) => ItemPanelView(appRoot, inventoryService, id),
    };

    const render = () => {
        const [path, param] = window.location.hash.split('/');
        const route = routes[path] || routes[''];
        route(param);
    };

    on(window, 'hashchange', render);
    render();
};