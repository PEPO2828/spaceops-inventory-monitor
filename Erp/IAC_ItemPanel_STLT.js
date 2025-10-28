/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 */
define(['N/ui/serverWidget', 'N/record', 'N/search', 'N/url'], (ui, record, search, nUrl) => {
    const onRequest = (ctx) => {
        const form = ui.createForm({ title: 'Historial del Insumo' });
        try {
            const insumoId = ctx.request.parameters.id;
            const rec = record.load({ type: 'customrecord_iac_critical_supply', id: insumoId });
            const nombre = rec.getValue('name');
            const stockActual = rec.getValue('custrecord_iac_stock_actual');

            form.addField({ id: 'hdr', label: ' ', type: ui.FieldType.INLINEHTML })
                .defaultValue = `<h2>${nombre}</h2><p>Stock Actual: <strong>${stockActual}</strong></p><hr>`;

            const usageHistory = [];
            search.create({
                type: 'customrecord_iac_usage_log',
                filters: [['custrecord_iac_log_item', 'anyof', insumoId]],
                columns: [{ name: 'custrecord_iac_log_date', sort: search.Sort.ASC }, 'custrecord_iac_log_quantity']
            }).run().each(result => {
                usageHistory.push({
                    date: result.getValue('custrecord_iac_log_date'),
                    quantity: parseInt(result.getValue('custrecord_iac_log_quantity'), 10)
                });
                return true;
            });
            
            const labels = ['Inicio'];
            const totalUsed = usageHistory.reduce((total, log) => total + log.quantity, 0);
            const initialStock = stockActual + totalUsed;
            const serieStock = [initialStock];
            let stockTracker = initialStock;

            usageHistory.forEach(log => {
                labels.push(log.date);
                stockTracker -= log.quantity;
                serieStock.push(stockTracker);
            });

            form.addField({ id: 'chart', label: ' ', type: ui.FieldType.INLINEHTML }).defaultValue = `
                <h4>Gráfico de Historial de Stock</h4>
                <div style="border: 1px solid #e8e8e8; padding: 20px;"><canvas id="historyChart"></canvas></div>
                <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
                <script>
                    if (typeof Chart !== 'undefined') {
                        const ctx = document.getElementById('historyChart').getContext('2d');
                        new Chart(ctx, {
                          type: 'line',
                          data: {
                            labels: ${JSON.stringify(labels)},
                            datasets: [{
                                label: 'Nivel de Stock',
                                data: ${JSON.stringify(serieStock)},
                                borderColor: '#1890ff',
                                backgroundColor: 'rgba(24, 144, 255, 0.1)',
                                fill: true,
                                stepline: true // Muestra los cambios como escalones
                            }]
                          },
                          options: { responsive: true, scales: { y: { beginAtZero: false } } }
                        });
                    }
                </script>`;
        
            const backUrl = nUrl.resolveScript({ scriptId: 'customscript_iac_dashboard_stlt', deploymentId: 'customdeploy_iac_dashboard_stlt' });
            form.addButton({ id: 'back_btn', label: '← Volver al Dashboard', functionName: `function(){ window.location.href = '${backUrl}'; }` });
        } catch (e) {
            form.addField({ id: 'err', label: 'Error', type: ui.FieldType.TEXT }).defaultValue = e.message;
        }
        ctx.response.writePage(form);
    };
    return { onRequest };
});