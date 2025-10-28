import { qs, on, debounce } from '../utils/index.js';
import { Modals } from './Modals.js';

export const DashboardView = (appRoot, inventoryService) => {
    const supplies = inventoryService.getSupplies();
    const criticalSupplies = inventoryService.getCriticalSupplies();

    appRoot.innerHTML = `
        <div class="card kpi-grid">
            <div class="kpi-card">
                <h2>Total Supplies</h2>
                <p id="total-supplies">${supplies.length}</p>
            </div>
            <div class="kpi-card">
                <h2>Low Stock</h2>
                <p id="low-stock" class="warning">${criticalSupplies.filter(s => s.currentStock > 5).length}</p>
            </div>
            <div class="kpi-card">
                <h2>Critical Stock</h2>
                <p id="critical-stock" class="critical">${criticalSupplies.filter(s => s.currentStock <= 5).length}</p>
            </div>
        </div>
        <div class="card">
            <div class="filters-container">
                <div class="filter-item search-filter">
                    <svg class="search-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clip-rule="evenodd" /></svg>
                    <input type="text" id="search" class="styled-input" placeholder="Search by name...">
                </div>
                <div class="filter-item">
                    <div class="select-wrapper">
                        <select id="category-filter" class="styled-select">
                            <option value="">All Categories</option>
                            ${["Medicines", "Food", "Spare Parts"].map(c => `<option value="${c}">${c}</option>`).join('')}
                        </select>
                        <svg class="select-arrow" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" /></svg>
                    </div>
                </div>
                <div class="filter-item">
                    <label class="checkbox-label">
                        <input type="checkbox" id="low-stock-filter">
                        <span class="checkbox-custom"></span>
                        Only low stock
                    </label>
                </div>
                <div class="filter-item">
                    <button id="new-supply-btn" class="button button-primary">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clip-rule="evenodd" /></svg>
                        <span>New Supply</span>
                    </button>
                </div>
            </div>
            <div class="table-container">
            <div class="grid-table main-table">
                <div class="grid-header">Name</div>
                <div class="grid-header">Category</div>
                <div class="grid-header">Current Stock</div>
                <div class="grid-header">Threshold</div>
                <div class="grid-header">Status</div>
                <div class="grid-header">Actions</div>
                <div id="supplies-table-body" class="grid-body"></div>
            </div>
            </div>
        </div>
    `;

    const renderTable = () => {
        const searchTerm = qs('#search').value.toLowerCase();
        const category = qs('#category-filter').value;
        const lowStockOnly = qs('#low-stock-filter').checked;

        const filteredSupplies = supplies.filter(s => {
            const isLowStock = s.currentStock <= s.minThreshold;
            return (
                (s.name.toLowerCase().includes(searchTerm)) &&
                (category === '' || s.category === category) &&
                (!lowStockOnly || isLowStock)
            );
        });

                    const tableBody = qs('#supplies-table-body');
                    tableBody.innerHTML = filteredSupplies.map(s => `
                        <div class="grid-row">
                            <div class="grid-cell">${s.name}</div>
                            <div class="grid-cell">${s.category}</div>
                                                <div class="grid-cell grid-cell-center">${s.currentStock}</div>
                                                <div class="grid-cell grid-cell-center">${s.minThreshold}</div>                            <div class="grid-cell"><span class="status-pill status-${s.currentStock <= 5 ? 'critical' : s.currentStock <= s.minThreshold ? 'warning' : 'ok'}">${s.currentStock <= 5 ? 'Critical' : s.currentStock <= s.minThreshold ? 'Warning' : 'OK'}</span></div>
                            <div class="grid-cell grid-cell-actions">
                                <a href="#item/${s.id}" class="button">View</a>
                                <button class="button" onclick="logUsage('${s.id}')">Log Usage</button>
                                <button class="button" onclick="addStock('${s.id}')">Add Stock</button>
                            </div>
                        </div>
                    `).join('');    };

    on(qs('#search'), 'input', debounce(renderTable, 300));
    on(qs('#category-filter'), 'change', renderTable);
    on(qs('#low-stock-filter'), 'change', renderTable);

    on(qs('#new-supply-btn'), 'click', () => {
        Modals(inventoryService).newSupply();
    });

    window.logUsage = (supplyId) => {
        Modals(inventoryService).logUsage(supplyId);
    };

    window.addStock = (supplyId) => {
        Modals(inventoryService).addStock(supplyId);
    };

    renderTable();
};