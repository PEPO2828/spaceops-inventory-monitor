console.log('app.js started');
const CATEGORIES = ["Medicines", "Food", "Spare Parts"];
const CATEGORY_PARAMETERS = {
    "Medicines": {
        dailyConsumption: 2
    },
    "Food": {
        dailyConsumption: 5
    },
    "Spare Parts": {
        dailyConsumption: 0.2
    }
};

// Unified thresholds for all categories
const COVERAGE_THRESHOLDS = {
    warning: 29, // days < 30
    critical: 7  // days < 7
};
/*
- Equivale a: IAC_Dashboard_STLT.js → Dashboard (vista principal)
- Equivale a: IAC_Dashboard_CL.js → Comportamiento de UI (modales, validaciones, eventos)
- Equivale a: IAC_ItemPanel_STLT.js → Panel de ítem con gráfico y logs
- Equivale a: IAC_UpdateStock_UE.js → Reglas de actualización de stock (sumar/restar, sin negativos)
- Equivale a: IAC_AlertasCriticas_SCH.js → Alertas de bajo stock (scheduler simulado)
*/

// --- utils ---
const utils = {
    uuid: () => `_${Math.random().toString(36).substr(2, 9)}`,
    formatDate: (date) => new Date(date).toLocaleDateString(),
    parsePositiveInt: (value) => {
        const parsed = parseInt(value, 10);
        return isNaN(parsed) || parsed < 0 ? 0 : parsed;
    },
    debounce: (func, wait) => {
        let timeout;
        return (...args) => {
            const context = this;
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(context, args), wait);
        };
    },
    qs: (selector, scope = document) => scope.querySelector(selector),
    qsAll: (selector, scope = document) => scope.querySelectorAll(selector),
    on: (element, event, handler) => element.addEventListener(event, handler),
    el: (tag, attributes, children) => {
        const element = document.createElement(tag);
        for (const key in attributes) {
            element.setAttribute(key, attributes[key]);
        }
        if (children) {
            if (typeof children === 'string') {
                element.textContent = children;
            } else {
                children.forEach(child => element.appendChild(child));
            }
        }
        return element;
    }
};

// --- domain ---
const domain = {
    Supply: (name, category, currentStock, minThreshold = 15) => ({
        id: utils.uuid(),
        name,
        category,
        currentStock: utils.parsePositiveInt(currentStock),
        minThreshold: utils.parsePositiveInt(minThreshold),
        createdAt: new Date().toISOString(),
    }),
    UsageLog: (supplyId, quantity, type) => ({
        id: utils.uuid(),
        supplyId,
        quantity: utils.parsePositiveInt(quantity),
        type, // 'usage' or 'add'
        date: new Date().toISOString(),
    }),
    InventoryPolicy: {
        addStock: (supply, quantity) => ({
            ...supply,
            currentStock: supply.currentStock + utils.parsePositiveInt(quantity),
        }),
        useStock: (supply, quantity) => ({
            ...supply,
            currentStock: Math.max(0, supply.currentStock - utils.parsePositiveInt(quantity)),
        }),
    },
};

// --- store ---
const store = {
    StoragePort: () => ({
        get: (key) => { throw new Error("Not implemented"); },
        set: (key, value) => { throw new Error("Not implemented"); },
        remove: (key) => { throw new Error("Not implemented"); },
        list: () => { throw new Error("Not implemented"); },
    }),
    LocalStorageAdapter: () => ({
        get: (key) => {
            const value = JSON.parse(localStorage.getItem(key) || 'null');
            console.log(`LocalStorageAdapter.get called for key: ${key}, returned:`, value);
            return value;
        },
        set: (key, value) => {
            console.log(`LocalStorageAdapter.set called for key: ${key}, value:`, value);
            localStorage.setItem(key, JSON.stringify(value));
        },
        remove: (key) => localStorage.removeItem(key),
        list: () => Object.keys(localStorage)
            .filter(key => key.startsWith('supply_') || key.startsWith('log_'))
            .map(key => {
                try {
                    return JSON.parse(localStorage.getItem(key));
                } catch (e) {
                    console.error(`Error al analizar el elemento de localStorage para la clave "${key}":`, e);
                    return null;
                }
            })
            .filter(item => item !== null)
    }),
    SupplyRepository: (storage) => ({
        get: (id) => {
            const supply = storage.get(`supply_${id}`);
            console.log(`supplyRepository.get called for id: ${id}, returned:`, supply);
            return supply;
        },
        save: (supply) => storage.set(`supply_${supply.id}`, supply),
        delete: (id) => storage.remove(`supply_${id}`),
        list: () => {
            const supplies = storage.list().filter(item => item && item.id && item.createdAt && item.hasOwnProperty('currentStock'));
            console.log('supplyRepository.list called, returned:', supplies);
            return supplies;
        },
    }),
    UsageLogRepository: (storage) => ({
        get: (id) => storage.get(`log_${id}`),
        save: (log) => storage.set(`log_${log.id}`, log),
        list: (supplyId) => storage.list().filter(item => item && item.supplyId === supplyId),
    }),
};

// --- services ---
const services = {
    InventoryService: (supplyRepository, usageLogRepository) => {
        const self = {
            supplyRepository,
            usageLogRepository,
        createSupply: (name, category, currentStock, minThreshold) => {
            const existing = supplyRepository.list().find(s => s.name.toLowerCase() === name.toLowerCase());
            if (existing) {
                throw new Error("Supply with this name already exists.");
            }
            const supply = domain.Supply(name, category, currentStock, minThreshold);
            supplyRepository.save(supply);
            return supply;
        },
        addStock: (supplyId, quantity) => {
            const supply = supplyRepository.get(supplyId);
            if (!supply) {
                throw new Error("Supply not found.");
            }
            const updatedSupply = domain.InventoryPolicy.addStock(supply, quantity);
            supplyRepository.save(updatedSupply);
            const log = domain.UsageLog(supplyId, quantity, 'add');
            usageLogRepository.save(log);
            return { updatedSupply, log };
        },
        logUsage: (supplyId, quantity) => {
            const supply = supplyRepository.get(supplyId);
            if (!supply) {
                throw new Error("Supply not found.");
            }
            const updatedSupply = domain.InventoryPolicy.useStock(supply, quantity);
            supplyRepository.save(updatedSupply);
            const log = domain.UsageLog(supplyId, quantity, 'usage');
            usageLogRepository.save(log);
            return { updatedSupply, log };
        },
        getCriticalSupplies: (category = null) => {
            let supplies = supplyRepository.list();
            if (category) {
                supplies = supplies.filter(s => s.category === category);
            }
            return supplies.filter(s => {
                const { status } = self.getSupplyStatus(s);
                return status === 'Warning' || status === 'Critical';
            });
        },
        getStatsLast30d: (category = null) => {
            let suppliesToConsider = self.supplyRepository.list();
            if (category) {
                suppliesToConsider = suppliesToConsider.filter(s => s.category === category);
            }

            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            let totalConsumption = 0;
            suppliesToConsider.forEach(supply => {
                const logs = self.usageLogRepository.list(supply.id)
                    .filter(log => new Date(log.date) > thirtyDaysAgo && log.type === 'usage');
                totalConsumption += logs.reduce((total, log) => total + log.quantity, 0);
            });
            return totalConsumption;
        },
        getMostConsumedItemLast30d: () => {
            const supplies = self.supplyRepository.list();
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            let mostConsumed = { name: 'N/A', quantity: 0 };
            if (supplies.length === 0) {
                return mostConsumed;
            }

            supplies.forEach(supply => {
                const logs = self.usageLogRepository.list(supply.id)
                    .filter(log => new Date(log.date) > thirtyDaysAgo && log.type === 'usage');
                const totalConsumed = logs.reduce((total, log) => total + log.quantity, 0);

                if (totalConsumed > mostConsumed.quantity) {
                    mostConsumed = { name: supply.name, quantity: totalConsumed };
                }
            });

            return mostConsumed;
        },
        projectDepletion: (supplyId) => {
            const supply = self.supplyRepository.get(supplyId);
            if (!supply) {
                return null;
            }
            const { coverageDays } = self.getSupplyStatus(supply);
            return coverageDays;
        },
        getSupplyStatus: (supply) => {
            const params = CATEGORY_PARAMETERS[supply.category];
            if (!params) {
                return { status: 'OK', coverageDays: Infinity, avgDailyConsumption: 0 }; // Default for unknown categories
            }

            // Calculate units used in last 30 days
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            const logs = self.usageLogRepository.list(supply.id)
                .filter(log => new Date(log.date) > thirtyDaysAgo && log.type === 'usage');
            const unitsUsedLast30Days = logs.reduce((total, log) => total + log.quantity, 0);

            let avgDailyConsumption = 0;
            if (unitsUsedLast30Days > 0) {
                avgDailyConsumption = unitsUsedLast30Days / 30;
            } else {
                // If no recent consumption, use default from CATEGORY_PARAMETERS
                avgDailyConsumption = params.dailyConsumption;
            }

            let coverageDays = Infinity;
            if (avgDailyConsumption > 0) {
                coverageDays = supply.currentStock / avgDailyConsumption;
            }

            let status = 'OK';
            if (coverageDays < COVERAGE_THRESHOLDS.critical) {
                status = 'Critical';
            } else if (coverageDays < COVERAGE_THRESHOLDS.warning) {
                status = 'Warning';
            }

            return { status, coverageDays, avgDailyConsumption };
        }
        };
        return self;
    },
};

// --- ui ---
const ui = {
    Toasts: () => {
        const container = utils.el('div', { class: 'toast-container' });
        document.body.appendChild(container);

        const show = (message, summary) => {
            const toast = utils.el('div', { class: 'toast' });
            toast.innerHTML = `
                <p>${message}</p>
                <button class="copy-summary-btn">Copy Summary</button>
            `;
            utils.on(utils.qs('.copy-summary-btn', toast), 'click', () => {
                navigator.clipboard.writeText(summary);
            });
            container.appendChild(toast);
            setTimeout(() => toast.remove(), 5000);
        };

        return { show };
    },
    Modals: (inventoryService, renderDashboard) => {
        const createModal = (title, content, onSubmit) => {
            const modal = utils.el('div', { class: 'modal' });
            modal.innerHTML = `
                <div class="modal-content">
                    <span class="close">&times;</span>
                    <h2>${title}</h2>
                    ${content}
                </div>
            `;

            const close = () => modal.remove();
            utils.on(utils.qs('.close', modal), 'click', close);
            utils.on(modal, 'click', (e) => {
                if (e.target === modal) {
                    close();
                }
            });

            utils.on(utils.qs('form', modal), 'submit', (e) => {
                e.preventDefault();
                const formData = new FormData(e.target);
                const data = Object.fromEntries(formData.entries());
                onSubmit(data);
                close();
                renderDashboard();
            });

            document.body.appendChild(modal);
            modal.style.display = 'block';
        };

        return {
            newSupply: () => {
                createModal('New Supply', `
                    <form>
                        <label>Name: <input type="text" name="name" required></label>
                        <label>Category: 
                            <select name="category">
                                ${CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join('')}
                            </select>
                        </label>
                        <label>Current Stock: <input type="number" name="currentStock" value="0" min="0" required></label>
                        <label>Min Threshold: <input type="number" name="minThreshold" value="15" min="0" required></label>
                        <button type="submit">Create</button>
                    </form>
                `, (data) => {
                    inventoryService.createSupply(data.name, data.category, data.currentStock, data.minThreshold);
                });
            },
            logUsage: (supply) => {
                createModal('Log Usage', `
                    <form>
                        <p>Supply: ${supply.name}</p>
                        <label>Quantity: <input type="number" name="quantity" min="1" max="${supply.currentStock}" required></label>
                        <button type="submit">Log Usage</button>
                    </form>
                `, (data) => {
                    inventoryService.logUsage(supply.id, data.quantity);
                });
            },
            addStock: (supply) => {
                createModal('Add Stock', `
                    <form>
                        <p>Supply: ${supply.name}</p>
                        <label>Quantity: <input type="number" name="quantity" min="1" required></label>
                        <button type="submit">Add Stock</button>
                    </form>
                `, (data) => {
                    inventoryService.addStock(supply.id, data.quantity);
                });
            },
        };
    },
    AlertsCardView: (inventoryService, renderDashboard, onAlertClick) => {
        const element = utils.el('div', { class: 'alerts-card' });

        const renderAlerts = () => {
            const allSupplies = inventoryService.supplyRepository.list();
            const alerts = allSupplies.filter(s => {
                const { status } = inventoryService.getSupplyStatus(s);
                return status === 'Warning' || status === 'Critical';
            });

            if (alerts.length === 0) {
                element.innerHTML = `<p>No active alerts.</p>`;
                return;
            }

            element.innerHTML = `
                <h3>Active Alerts</h3>
                <ul>
                    ${alerts.map(s => {
                        const { status, coverageDays } = inventoryService.getSupplyStatus(s);
                        const action = status === 'Critical' ? 'Add stock urgently!' : 'Monitor closely.';
                        const thresholdBreached = status === 'Critical' ? `Critical (<${COVERAGE_THRESHOLDS.critical} days)` : `Warning (<${COVERAGE_THRESHOLDS.warning} days)`;
                        return `
                            <li class="alert-item status-${status.toLowerCase()}" data-id="${s.id}">
                                <strong>${s.name}</strong>: ${coverageDays !== Infinity ? coverageDays.toFixed(1) + ' days' : 'Infinite'} coverage.
                                <span class="threshold-breached">(${thresholdBreached})</span>
                                <span class="suggested-action">${action}</span>
                            </li>
                        `;
                    }).join('')}
                </ul>
            `;

            // Attach click listeners to alert items to focus on the item in the table
            utils.qsAll('.alert-item', element).forEach(alertItem => {
                utils.on(alertItem, 'click', (e) => {
                    const supplyId = e.currentTarget.dataset.id;
                    if (onAlertClick) {
                        onAlertClick(supplyId);
                    }
                });
            });
        };

        renderAlerts(); // Initial render
        return { element, renderAlerts };
    },
    ItemPanelView: (inventoryService, supplyId) => {
        const supply = inventoryService.supplyRepository.get(supplyId);
        const logs = inventoryService.usageLogRepository.list(supplyId).sort((a, b) => new Date(a.date) - new Date(b.date));
        const { status, coverageDays, avgDailyConsumption } = inventoryService.getSupplyStatus(supply);

        // Calculate historical stock data for the chart
        let stockHistory = [];
        let currentStock = supply.currentStock;
        // Reconstruct history by going backwards from current stock
        stockHistory.push({ date: new Date().toISOString(), stock: currentStock });
        for (let i = logs.length - 1; i >= 0; i--) {
            const log = logs[i];
            if (log.type === 'add') {
                currentStock -= log.quantity;
            } else {
                currentStock += log.quantity;
            }
            stockHistory.unshift({ date: log.date, stock: currentStock, log });
        }


        const element = utils.el('div', { class: 'item-panel-view' });
        const avgConsumptionText = avgDailyConsumption > 0 ? `${avgDailyConsumption.toFixed(2)} uds/día` : `—`;
        const consumptionNote = avgDailyConsumption === CATEGORY_PARAMETERS[supply.category]?.dailyConsumption
            ? `(Sin uso reciente; usando default de categoría: ${avgDailyConsumption} uds/día)`
            : '';

        element.innerHTML = `
            <div class="item-panel-header">
                <h2>${supply.name}</h2>
                <span class="item-category">Category: ${supply.category}</span>
            </div>
            <div class="item-panel-details">
                <div class="detail-card">
                    <h3>Current Stock</h3>
                    <p class="stock-value">${supply.currentStock}</p>
                </div>
                <div class="detail-card">
                    <h3>Status</h3>
                    <p class="status-badge status-${status.toLowerCase()}">${status}</p>
                </div>
                <div class="detail-card">
                    <h3>Projected Coverage</h3>
                    <p class="coverage-value">${coverageDays !== Infinity ? coverageDays.toFixed(1) + ' days' : 'Infinite'}</p>
                    <small class="coverage-note">Avg Daily: ${avgConsumptionText} ${consumptionNote}</small>
                </div>
            </div>

            <div class="item-panel-chart">
                <h3>Stock Level History</h3>
                <canvas id="stock-chart"></canvas>
                <p id="chart-note" class="chart-note"></p>
            </div>

            <div class="item-panel-logs">
                <h3>Usage Log</h3>
                <table>
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Quantity</th>
                            <th>Type</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${logs.map(log => `
                            <tr>
                                <td>${utils.formatDate(log.date)}</td>
                                <td>${log.quantity}</td>
                                <td><span class="log-type-${log.type}">${log.type}</span></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            <button id="back-to-dashboard" class="btn-secondary">Back to Dashboard</button>
        `;

        const chartCanvas = utils.qs('#stock-chart', element);
        const chartNote = utils.qs('#chart-note', element);

        const isStable = stockHistory.every(p => p.stock === stockHistory[0].stock);
        if (isStable && stockHistory.length > 1) {
            chartNote.textContent = 'Stock estable en el rango';
        }

        new Chart(chartCanvas, {
            type: 'line',
            data: {
                labels: stockHistory.map(p => utils.formatDate(p.date)),
                datasets: [{
                    label: 'Stock Level',
                    data: stockHistory.map(p => p.stock),
                    stepped: true,
                    borderColor: '#007bff',
                    backgroundColor: 'rgba(0, 123, 255, 0.1)',
                    fill: true,
                }]
            },
            options: {
                scales: {
                    x: {
                        title: { display: true, text: 'Fecha' }
                    },
                    y: {
                        title: { display: true, text: 'Unidades' },
                        beginAtZero: true
                    }
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            footer: function(tooltipItems) {
                                const point = stockHistory[tooltipItems[0].dataIndex];
                                if (point && point.log) {
                                    return `Event: ${point.log.type} (${point.log.quantity} units)`;
                                }
                                return 'Current Stock';
                            }
                        }
                    },
                    annotation: {
                        annotations: {
                            criticalLine: {
                                type: 'line',
                                yMin: supply.minThreshold,
                                yMax: supply.minThreshold,
                                borderColor: 'red',
                                borderWidth: 2,
                                borderDash: [5, 5],
                                label: {
                                    content: 'Nivel crítico',
                                    enabled: true,
                                    position: 'start'
                                }
                            }
                        }
                    }
                }
            }
        });

        return element;
    },
    DashboardView: (inventoryService) => {
        const element = utils.el('div', { class: 'dashboard-view' });
        const modals = ui.Modals(inventoryService, render);

        const handleAlertClick = (supplyId) => {
            const supply = inventoryService.supplyRepository.get(supplyId);
            if (supply) {
                utils.qs('#search', element).value = supply.name; // Set search term
                utils.qs('#category', element).value = ''; // Clear category filter
                utils.qs('#low-stock-only', element).checked = false; // Clear low stock filter
                render(); // Re-render the dashboard
            }
        };

        const alertsCard = ui.AlertsCardView(inventoryService, render, handleAlertClick);

        // Function to update the table content
        function updateTable(supplies) {
            const tableBody = utils.qs('tbody', element);
            if (supplies.length === 0 && utils.qs('#low-stock-only', element).checked) {
                tableBody.innerHTML = '<tr><td colspan="6">Sin resultados con bajo stock</td></tr>';
                return;
            }
            tableBody.innerHTML = supplies.map(s => {
                const { status, coverageDays, avgDailyConsumption } = inventoryService.getSupplyStatus(s);
                const coverageText = coverageDays !== Infinity ? `${coverageDays.toFixed(1)} días` : '—';
                const coverageTooltip = `Estimado según consumo promedio 30d: ${avgDailyConsumption.toFixed(2)} uds/día`;

                return `
                <tr>
                    <td>${s.name}</td>
                    <td>${s.category}</td>
                    <td>${s.currentStock}</td>
                    <td title="${coverageTooltip}">
                        <span class="badge">${coverageText}</span>
                    </td>
                    <td><span class="status-${status.toLowerCase()}">${status}</span></td>
                    <td>
                        <button class="view-btn" data-id="${s.id}">View</button>
                        <button class="usage-btn" data-id="${s.id}">Log Usage</button>
                        <button class="add-btn" data-id="${s.id}">Add Stock</button>
                    </td>
                </tr>
            `;
            }).join('');
        }

        function render() {
            const searchTerm = utils.qs('#search', element).value.toLowerCase();
            const category = utils.qs('#category', element).value;
            let lowStockOnly = utils.qs('#low-stock-only', element).checked;

            let supplies = inventoryService.supplyRepository.list();

            if (searchTerm) {
                supplies = supplies.filter(s => s.name.toLowerCase().includes(searchTerm));
            }
            if (category) {
                supplies = supplies.filter(s => s.category === category);
            }
            
            // Calculate KPIs
            const allSupplies = inventoryService.supplyRepository.list();
            const totalSuppliesCount = allSupplies.length;

            let criticalCount = 0;
            let warningCount = 0;
            allSupplies.forEach(s => {
                const { status } = inventoryService.getSupplyStatus(s);
                if (status === 'Critical') criticalCount++;
                else if (status === 'Warning') warningCount++;
            });

            const consumptionLast30Days = inventoryService.getStatsLast30d(category);

            // Apply filters to the table
            if (lowStockOnly) {
                supplies = supplies.filter(s => {
                    const { status } = inventoryService.getSupplyStatus(s);
                    return status !== 'OK';
                });
                supplies.sort((a, b) => {
                    const coverageA = inventoryService.getSupplyStatus(a).coverageDays;
                    const coverageB = inventoryService.getSupplyStatus(b).coverageDays;
                    return coverageA - coverageB;
                });
            }

            // Update KPIs
            utils.qs('#total-supplies-kpi p', element).textContent = totalSuppliesCount;
            utils.qs('#at-risk-kpi p', element).textContent = `Critical: ${criticalCount}, Warning: ${warningCount}`;
            
            const mostConsumedItem = inventoryService.getMostConsumedItemLast30d();
            const mostConsumedCard = utils.qs('#most-consumed-kpi', element);
            if (mostConsumedCard) {
                if (mostConsumedItem.quantity > 0) {
                    utils.qs('p', mostConsumedCard).textContent = `${mostConsumedItem.name} (${mostConsumedItem.quantity} units)`;
                    mostConsumedCard.title = `Most consumed item in the last 30 days.`;
                } else {
                    utils.qs('p', mostConsumedCard).textContent = 'N/A';
                    mostConsumedCard.title = `No consumption recorded in the last 30 days.`;
                }
            }


            updateTable(supplies);
            alertsCard.renderAlerts(); // Call renderAlerts to update the alerts card
        }

        // Initial HTML structure
        element.innerHTML = `
            <div class="alerts-container"></div> <!-- Container for alerts card -->
            <div class="kpi-panel">
                <div class="kpi-card" id="total-supplies-kpi"><h3>Total Supplies</h3><p>0</p></div>
                <div class="kpi-card" id="at-risk-kpi"><h3>En riesgo</h3><p>Critical: 0, Warning: 0</p></div>
                <div class="kpi-card" id="most-consumed-kpi"><h3>Most Consumed (30d)</h3><p>N/A</p></div>
            </div>
            <div class="filters">
                <input type="search" id="search" placeholder="Search by name...">
                <select id="category">
                    <option value="">All Categories</option>
                    ${CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join('')}
                </select>
                <label><input type="checkbox" id="low-stock-only"> Low stock only</label>
            </div>
            <div id="active-filters-summary" class="active-filters-summary"></div>
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Nombre</th>
                            <th>Categoría</th>
                            <th>Stock</th>
                            <th>Cobertura (días)</th>
                            <th>Estado</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody></tbody>
                </table>
            </div>
            <button id="new-supply-btn">New Supply</button>
            <button id="reset-btn">Reset Data</button>
        `;

        // Append alerts card to its container
        utils.qs('.alerts-container', element).appendChild(alertsCard.element);

        // Attach event listeners once
        utils.on(utils.qs('#search', element), 'input', utils.debounce(render, 300));
        utils.on(utils.qs('#category', element), 'change', render);
        utils.on(utils.qs('#low-stock-only', element), 'change', render);
        utils.on(utils.qs('#new-supply-btn', element), 'click', modals.newSupply);
        utils.on(utils.qs('#reset-btn', element), 'click', () => {
            localStorage.clear();
            window.location.reload();
        });

        utils.on(element, 'click', (e) => {
            if (e.target.matches('.view-btn')) {
                const supplyId = e.target.dataset.id;
                const itemView = ui.ItemPanelView(inventoryService, supplyId);
                element.replaceWith(itemView);
                utils.on(utils.qs('#back-to-dashboard', itemView), 'click', () => {
                    itemView.replaceWith(element);
                    render();
                });
            } else if (e.target.matches('.usage-btn')) {
                const supplyId = e.target.dataset.id;
                const supply = inventoryService.supplyRepository.get(supplyId);
                modals.logUsage(supply);
            } else if (e.target.matches('.add-btn')) {
                const supplyId = e.target.dataset.id;
                const supply = inventoryService.supplyRepository.get(supplyId);
                modals.addStock(supply);
            }
        });
        
        return { element, render };
    },
};

// --- app ---
function createApp() {
    console.log('createApp function called');
    const storage = store.LocalStorageAdapter();
    const supplyRepository = store.SupplyRepository(storage);
    const usageLogRepository = store.UsageLogRepository(storage);
    const inventoryService = services.InventoryService(supplyRepository, usageLogRepository);
    const toasts = ui.Toasts();

    const seedData = () => {
        console.log('seedData called');
        if (supplyRepository.list().length === 0) {
            inventoryService.createSupply("Water Bottle", "Food", 10, 20);
            inventoryService.createSupply("First Aid Kit", "Medicines", 5, 10);
            inventoryService.createSupply("Screwdriver", "Spare Parts", 25, 15);
            inventoryService.createSupply("Oxygen Tank", "Medicines", 2, 5);
            console.log('Supplies seeded:', supplyRepository.list());
        }
    };

    const appElement = utils.qs('#app');
    const dashboard = ui.DashboardView(inventoryService);

    appElement.appendChild(dashboard.element);

    seedData();
    dashboard.render(); // Initial render

    setInterval(() => {
        // Get all supplies, regardless of current dashboard filter
        const allSupplies = inventoryService.supplyRepository.list();
        const criticalAndWarningSupplies = allSupplies.filter(s => {
            const { status } = inventoryService.getSupplyStatus(s);
            return status === 'Warning' || status === 'Critical';
        });

        if (criticalAndWarningSupplies.length > 0) {
            const summary = criticalAndWarningSupplies.map(s => {
                const { status, coverageDays } = inventoryService.getSupplyStatus(s);
                return `${s.name} (${status}, ${coverageDays !== Infinity ? coverageDays.toFixed(1) + ' days' : 'Infinite'})`;
            }).join('\n');
            toasts.show(`${criticalAndWarningSupplies.length} supplies require attention!`, summary);
        }
    }, 30000);
}

createApp();