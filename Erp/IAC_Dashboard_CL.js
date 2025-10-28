/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 */
define(['N/currentRecord', 'N/url', 'N/https'], (currentRecord, url, https) => {
    let myChart = null;

    const byId = (id) => document.getElementById(id);
    const setText = (id, v) => { const e = byId(id); if (e) e.textContent = String(v); };
    const fmt = (x) => (x === null || x === undefined || isNaN(x)) ? '—' : (Math.round(x * 100) / 100);
    const riskClass = (r) => { if (r === 'Critical') return 'pill crit'; if (r === 'Warning') return 'pill warn'; return 'pill ok'; };
    const catIcon = (k) => {
        if (k === 'med') return `<svg width="64" height="64" viewBox="0 0 64 64"><circle cx="32" cy="32" r="28" fill="#DBEAFE"/><path d="M32 20v24M20 32h24" stroke="#1D4ED8" stroke-width="4" stroke-linecap="round"/></svg>`;
        if (k === 'com') return `<svg width="64" height="64" viewBox="0 0 64 64"><circle cx="32" cy="32" r="28" fill="#FEF3C7"/><path d="M26 22v15c0 4-2 6-6 6s-6-2-6-6V22m12 0h-3m-6 0h-3" stroke="#92400E" stroke-width="3" stroke-linecap="round"/><path d="M48 31c0-6-4-10-10-10s-10 4-10 10c0 3.314 2.686 8 10 8s10-4.686 10-8z" stroke="#92400E" stroke-width="3" fill="none"/></svg>`;
        if (k === 'rep') return `<svg width="64" height="64" viewBox="0 0 64 64"><circle cx="32" cy="32" r="28" fill="#EDE9FE"/><path d="M22.2 24.3a6 6 0 018.5 0l8.5 8.5M26.5 42a6 6 0 01-8.5 0l-1.7-1.7a6 6 0 010-8.5l8.5-8.5" stroke="#6D28D9" stroke-width="3" stroke-linecap="round"/><path d="M44.6 20L31.1 33.5m4.2 4.3L48.8 24.2M20 44l4-4" stroke="#6D28D9" stroke-width="3" stroke-linecap="round"/></svg>`;
        return `<svg width="64" height="64" viewBox="0 0 64 64"><circle cx="32" cy="32" r="28" fill="#E5E7EB"/></svg>`;
    };
    function renderTable(id, headers, rows) {
        const el = byId(id); if (!el) return;
        let html = `<thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody>`;
        el.innerHTML = html;
    }

    function pageInit() {
        window.showSummary = showSummary;
        window.closeHistoryModal = closeHistoryModal;
        window.registrarUso = registrarUso;
        window.crearNuevoInsumo = crearNuevoInsumo;
    }

    function showSummary(itemId) {
        const modal = document.getElementById('historyModal');
        if (modal) modal.style.display = 'block';
        setText('modalTitle', 'Loading…');
        const api = url.resolveScript({ scriptId: 'customscript_iac_dashboard_stlt', deploymentId: 'customdeploy_iac_dashboard_stlt', params: { action: 'getHistory', itemId } });
        https.get.promise({ url: api }).then(res => {
            const d = JSON.parse(res.body || '{}');
            if (d.error) throw new Error(d.error);
            const catIconEl = byId('catIcon'); if(catIconEl) catIconEl.innerHTML = catIcon(d.category);
            setText('modalTitle', `Summary: ${d.name || ''}`);
            setText('sumName', d.name || ''); setText('sumCategory', d.catText || '');
            setText('pStock', d.stockActual); setText('pAvg', fmt(d.avgDailyUse));
            setText('pDays', d.daysLeft === null ? '—' : d.daysLeft);
            const pr = byId('pRisk'); if(pr){ pr.textContent = d.risk; pr.className = riskClass(d.risk); }
            renderTable('riskTable', ['Parameter', 'Value'], [['Target Coverage', `${d.thresholdDays} days`], ['Depletion Date', d.depletionDate || '—'], ['Risk', d.risk]]);
            const rows = (d.recent || []).map(x => [x.date, `-${x.quantity}`]);
            renderTable('logsTable', ['Date', 'Consumption'], rows.length ? rows : [['—', '—']]);
            if (typeof Chart === 'undefined') {
                const chartEl = byId('historyChart'); if(chartEl) chartEl.style.display = 'none';
            } else {
                if (myChart) myChart.destroy();
                const ctx = byId('historyChart').getContext('2d');
                const criticalStockValue = d.criticalStockLevel || 5;
                const thresholdLine = {
                    id: 'thresholdLine',
                    afterDraw(chart) {
                        const { ctx, chartArea: { left, right }, scales: { y } } = chart;
                        ctx.save(); ctx.beginPath(); ctx.strokeStyle = 'rgba(239, 68, 68, 0.7)'; ctx.lineWidth = 2;
                        ctx.setLineDash([6, 6]); ctx.moveTo(left, y.getPixelForValue(criticalStockValue));
                        ctx.lineTo(right, y.getPixelForValue(criticalStockValue)); ctx.stroke();
                        ctx.font = '600 12px sans-serif'; ctx.fillStyle = 'rgba(239, 68, 68, 0.7)';
                        ctx.textAlign = 'right'; ctx.fillText('Critical Level', right - 10, y.getPixelForValue(criticalStockValue) - 8);
                        ctx.restore();
                    }
                };
                myChart = new Chart(ctx, {
                    type: 'line', data: { labels: d.labels || [], datasets: [{ label: 'Stock Level', data: d.data || [], borderColor: '#3B82F6', backgroundColor: 'rgba(59, 130, 246, 0.1)', fill: true, tension: 0.3, pointRadius: 2, pointBackgroundColor: '#3B82F6' }] },
                    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: (context) => `Stock: ${context.parsed.y}` } } }, scales: { y: { beginAtZero: true, grid: { color: '#E5E7EB' } }, x: { grid: { display: false } } } },
                    plugins: [thresholdLine]
                });
            }
        }).catch(err => { console.error(err); setText('modalTitle', 'Could not load summary.'); });
    }

    function closeHistoryModal() {
        const modal = document.getElementById('historyModal');
        if (modal) modal.style.display = 'none';
        if (myChart) { myChart.destroy(); myChart = null; }
    }

    function registrarUso(itemId, itemName) {
        const qtyStr = prompt(`Log usage for: ${itemName}\n\nQuantity consumed:`);
        if (!qtyStr) return;
        const qty = parseInt(qtyStr, 10);
        if (isNaN(qty) || qty <= 0) { alert('Please enter a valid positive number.'); return; }
        const payload = { action: 'logusageajax', itemId, quantity: qty };
        const endpoint = url.resolveScript({ scriptId: 'customscript_iac_saveitem_stlt', deploymentId: 'customdeploy_iac_saveitem_stlt' });
        https.post.promise({ url: endpoint, body: JSON.stringify(payload), headers: { 'Content-Type': 'application/json' } })
            .then(response => {
                const data = JSON.parse(response.body);
                if (!data.ok) { throw new Error(data.message); }
                alert('Stock updated. The page will now reload.');
                location.reload();
            })
            .catch(err => { alert('Could not log usage: ' + err.message); });
    }

    function crearNuevoInsumo() {
        const nombre = document.getElementById('custpage_new_name').value;
        const categoria = document.getElementById('custpage_new_category').value;
        const stock = document.getElementById('custpage_new_stock').value;
        if (!nombre || !categoria || !stock) { alert('Please complete all fields.'); return; }
        const u = url.resolveScript({ scriptId: 'customscript_iac_saveitem_stlt', deploymentId: 'customdeploy_iac_saveitem_stlt', params: { action: 'create', nombre, categoria, stock } });
        window.location.href = u;
    }

    return { pageInit: pageInit };
});