import { qs, formatDate } from '../utils/index.js';

export const ItemPanelView = (appRoot, inventoryService, id) => {
    const supply = inventoryService.getSupplyById(id);
    if (!supply) {
        window.location.hash = '';
        return;
    }

    const logs = inventoryService.getUsageLogsBySupplyId(id).sort((a, b) => new Date(b.date) - new Date(a.date));
    const depletionDate = inventoryService.projectDepletion(id);

    appRoot.innerHTML = `
        <div class="card">
            <a href="#" class="button">Back to Dashboard</a>
            <h2>${supply.name}</h2>
            <p>Category: ${supply.category}</p>
            <p>Current Stock: ${supply.currentStock}</p>
            <p>Min Threshold: ${supply.minThreshold}</p>
            <p>${depletionDate ? `Projected depletion: ${formatDate(depletionDate)}` : 'Not enough data for projection.'}</p>
            <canvas id="history-chart"></canvas>
            <h3>Usage Logs</h3>
            <div class="grid-table">
                <div class="grid-header">Date</div>
                <div class="grid-header">Type</div>
                <div class="grid-header">Quantity</div>
                ${logs.map(log => `
                    <div class="grid-cell">${formatDate(log.date)}</div>
                    <div class="grid-cell">${log.type}</div>
                    <div class="grid-cell">${log.quantity}</div>
                `).join('')}
            </div>
        </div>
    `;

    const calculateStockHistory = () => {
        const sortedLogs = logs.sort((a, b) => new Date(a.date) - new Date(b.date));
        let lastStock = supply.currentStock;
        const history = [{ date: new Date().toISOString(), stock: lastStock, type: 'current', quantity: 0 }];

        for (let i = sortedLogs.length - 1; i >= 0; i--) {
            const log = sortedLogs[i];
            if (log.type === 'add') {
                lastStock -= log.quantity;
            } else {
                lastStock += log.quantity;
            }
            history.unshift({ date: log.date, stock: lastStock, type: log.type, quantity: log.quantity });
        }
        return history;
    };

    const stockHistory = calculateStockHistory();

    if (stockHistory.length > 1) {
        const chartCtx = qs('#history-chart').getContext('2d');
        new Chart(chartCtx, {
            type: 'line',
            data: {
                labels: stockHistory.map(h => formatDate(h.date)),
                datasets: [{
                    label: 'Stock Level',
                    data: stockHistory.map(h => h.stock),
                    stepped: true,
                    borderColor: '#3B82F6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    fill: true,
                    tension: 0.3,
                    pointBackgroundColor: stockHistory.map(h => {
                        if (h.type === 'usage') return '#EF4444'; // red
                        if (h.type === 'add') return '#10B981'; // green
                        return '#3B82F6'; // blue for current
                    }),
                    pointRadius: 5,
                    pointHoverRadius: 7,
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    title: {
                        display: true,
                        text: 'Stock Evolution'
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                const point = stockHistory[context.dataIndex];
                                let label = `Stock: ${point.stock}`;
                                if (point.type === 'usage') {
                                    label += ` (-${point.quantity} used)`;
                                } else if (point.type === 'add') {
                                    label += ` (+${point.quantity} added)`;
                                }
                                return label;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: '#e5e7eb'
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        }
                    }
                }
            }
        });
    } else {
        qs('#history-chart').outerHTML = '<p>Not enough data to display chart.</p>';
    }
};