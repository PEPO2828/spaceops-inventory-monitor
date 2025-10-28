/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 */
define(['N/ui/serverWidget','N/search','N/url','N/runtime','N/record','N/format'],
(ui, search, nUrl, runtime, record, format) => {

    function getSummary(itemId){
        const rec = record.load({ type:'customrecord_iac_critical_supply', id:itemId });
        const name = rec.getValue('name') || '';
        const stock = parseFloat(rec.getValue('custrecord_iac_stock_actual') || 0);
        const catText = rec.getText('custrecord_iac_categoria') || 'Uncategorized';
        const catKey = (txt) => { const t=(txt||'').toLowerCase(); if(t.includes('medi')) return 'med'; if(t.includes('comi')) return 'com'; if(t.includes('repu')) return 'rep'; return 'oth'; };
        const category = catKey(catText);
        const defaultDailyByCat = { med: 2, com: 5, rep: 0.2, oth: 1 };
        const thresholdDaysByCat = { med: 30, com: 15, rep: 45, oth: 20 };
        const thresholdDays = thresholdDaysByCat[category] || 20;
        let used30 = 0;
        const thirtyDaysAgo = new Date(new Date().getTime() - 29*24*60*60*1000);
        search.create({
          type:'customrecord_iac_usage_log',
          filters:[['custrecord_iac_log_item','anyof', itemId],'and',['custrecord_iac_log_date','onorafter', format.format({ value:thirtyDaysAgo, type:format.Type.DATE })]],
          columns:['custrecord_iac_log_quantity']
        }).run().each(r => { used30 += parseFloat(r.getValue('custrecord_iac_log_quantity') || 0); return true; });
        let avgDailyUse = (used30 > 0) ? (used30 / 30) : (defaultDailyByCat[category] || 1);
        const daysLeft = avgDailyUse > 0 ? Math.ceil(stock / avgDailyUse) : null;
        let risk = (stock <= 5) ? 'Critical' : (stock <= 15) ? 'Warning' : 'OK';
        const depletionDate = (daysLeft && daysLeft > 0) ? new Date(new Date().getTime() + daysLeft*86400000).toISOString().slice(0,10) : null;
        const recent = [];
        search.create({ type:'customrecord_iac_usage_log', filters:[['custrecord_iac_log_item','anyof', itemId]], columns:[{name:'custrecord_iac_log_date', sort:search.Sort.DESC}, 'custrecord_iac_log_quantity'] }).run().getRange({start:0,end:5}).forEach(r => { recent.push({ date: r.getValue('custrecord_iac_log_date'), quantity: r.getValue('custrecord_iac_log_quantity') }); });
        const labels = [], data = []; let s = stock;
        const daysProj = Math.min(60, (daysLeft || 30) + 10);
        for (let d=0; d<=daysProj; d++){ labels.push(`Day ${d}`); data.push(Number(s.toFixed(2))); s = Math.max(0, s - avgDailyUse); }
        return { name, catText, category, stockActual: stock, avgDailyUse, daysLeft, risk, thresholdDays, depletionDate, labels, data, recent, criticalStockLevel: avgDailyUse * 5 };
    }

    const onRequest = (ctx) => {
        const p = ctx.request.parameters || {};
        if (p.action === 'getHistory'){ try{ ctx.response.write(JSON.stringify(getSummary(p.itemId))); }catch(e){ ctx.response.write(JSON.stringify({error:String(e.message||e)})); } return; }

        const form = ui.createForm({ title: ' ' });
        form.clientScriptModulePath = './IAC_Dashboard_CL.js';

        let categoryOptions = '';
        search.create({ type: 'customlist_iac_categorias', columns: ['name'] }).run().each(result => { categoryOptions += `<option value="${result.id}">${result.getValue('name')}</option>`; return true; });

        let tableRowsHtml = '';
        let i = 0, ok = 0, warn = 0, crit = 0;
        search.create({ type: 'customrecord_iac_critical_supply', columns: ['name', 'custrecord_iac_categoria', 'custrecord_iac_stock_actual'] }).run().each(r => {
            const id = r.id, name = r.getValue('name') || '', cat = r.getText('custrecord_iac_categoria') || '', st = parseFloat(r.getValue('custrecord_iac_stock_actual') || 0);
            let estado = 'OK', statusClass = 'ok';
            if (st <= 5) { estado = 'Critical'; crit++; statusClass = 'critical'; }
            else if (st <= 15) { estado = 'Warning'; warn++; statusClass = 'warning'; }
            else { ok++; }
            tableRowsHtml += `<tr><td><strong>${name}</strong></td><td>${cat}</td><td>${st}</td><td><span class="status-pill ${statusClass}">${estado}</span></td><td><a href="javascript:void(0)" onclick="showSummary('${id}')" class="button-link">View Summary</a></td><td><a href="javascript:void(0)" onclick="registrarUso('${id}','${name.replace(/"/g, '&quot;')}')" class="action-link">Log Usage</a></td></tr>`;
            i++; return true;
        });

        let htmlContent = `
          <style>
            body, #page_main_div { background-color: #F1F5F9 !important; } .uir-page-title-firstline, .uir-form-title { display: none; }
            .iac-container { padding: 20px; max-width: 1400px; margin: 0 auto; } .iac-header h1 { font-size: 32px; font-weight: 700; color: #1E293B; }
            .iac-header p { font-size: 16px; color: #64748B; margin-bottom: 24px;} .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-bottom: 24px; }
            .kpi-card { background-color: #FFFFFF; border-radius: 8px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
            .kpi-card-title { font-size: 14px; color: #64748B; margin-bottom: 8px; } .kpi-card-value { font-size: 32px; font-weight: 700; }
            .kpi-card-value.critical { color: #EF4444; } .kpi-card-value.warning { color: #F59E0B; } .kpi-card-value.ok { color: #10B981; }
            .form-card { background-color: #FFFFFF; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); margin-bottom: 24px; }
            .form-card-header h2 { font-size: 16px; font-weight: 600; margin: 0; padding: 16px 20px; border-bottom: 1px solid #E2E8F0;}
            .form-card-body { padding: 20px; display: grid; grid-template-columns: 2fr 1fr 1fr auto; gap: 20px; align-items: flex-end; }
            .form-group label { font-size: 13px; margin-bottom: 6px; color: #334155; display: block; }
            .form-group input, .form-group select { background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 6px; padding: 8px 12px; height: 38px; width: 100%; box-sizing: border-box; transition: all 0.2s; }
            .form-group input:focus, .form-group select:focus { border-color: #2563EB; box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2); outline: none; }
            .button-link { background-color: #FFEDD5; color: #9A3412; padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 600; text-decoration: none; transition: all 0.2s; }
            .button-link:hover { background-color: #FED7AA; color: #7C2D12; } .table-card { background-color: #FFFFFF; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
            .table-header h2 { margin: 0; font-size: 16px; font-weight: 600; padding: 16px 20px; border-bottom: 1px solid #E2E8F0;} .custom-table { width: 100%; border-collapse: collapse; }
            .custom-table th { background-color: #F8FAFC; padding: 12px 15px; text-align: left; font-size: 12px; color: #64748B; text-transform: uppercase; }
            .custom-table td { padding: 15px; font-size: 14px; border-top: 1px solid #F1F5F9; vertical-align: middle; } .status-pill { padding: 6px 14px; border-radius: 999px; font-size: 13px; font-weight: 600; text-align: center; min-width: 100px; display: inline-block; }
            .status-pill.critical { background-color: #FEF2F2; color: #B91C1C; } .status-pill.ok { background-color: #ECFDF5; color: #067647; } .status-pill.warning { background-color: #FFFBEB; color: #B45309; }
            .action-link { color: #2563EB; text-decoration: none; font-weight: 500; } .modal { display:none; position:fixed; inset:0; background:rgba(0,0,0,.6); z-index:1000; }
            .modal-card { background:#fff; margin:5% auto; width:72%; border-radius:10px; box-shadow:0 8px 24px rgba(0,0,0,.15); }
            .modal-head { padding:14px 24px; background:#F97316; color:#FFFFFF; border-radius:9px 9px 0 0; font-weight:600; font-size: 18px; }
            .modal-body { padding: 24px; } .close { float:right; cursor:pointer; font-family: sans-serif; opacity: 0.7; } .modal-hero { display: flex; align-items: center; gap: 16px; margin-bottom: 24px; }
            .modal-hero-icon { flex-shrink: 0; width: 64px; height: 64px; } .modal-hero-info h2 { margin: 0; font-size: 22px; } .modal-hero-info p { margin: 0; font-size: 14px; color: #64748B; }
            .modal-kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; } .modal-kpi { background-color: #F8FAFC; border: 1px solid #F1F5F9; padding: 16px; border-radius: 8px; }
            .modal-kpi .label { font-size: 14px; color: #64748B; margin: 0 0 4px 0; } .modal-kpi .value { font-size: 28px; font-weight: 700; }
            .modal-kpi .pill { margin-top: 4px; display: inline-block; border-radius: 999px; padding: 8px 16px; font-size: 15px; font-weight: 600;}
            .pill.ok { background-color: #ECFDF5; color: #067647; } .pill.warn { background-color: #FFFBEB; color: #B45309; } .pill.crit { background-color: #FEF2F2; color: #B91C1C; }
            .split { display:grid; grid-template-columns:1fr 1fr; gap:16px; } .card { background:#fff; border-radius:8px; border:1px solid #F1F5F9; padding:16px; }
            table.simple { width:100%; border-collapse:collapse; } table.simple th, table.simple td { border-bottom:1px solid #E2E8F0; padding:10px; font-size: 14px; text-align:left; }
          </style>

          <div class="iac-container">
            <div class="iac-header"><h1>Critical Supplies</h1><p>Welcome, ${runtime.getCurrentUser().name}. Overview of inventory status.</p></div>
            <div class="kpi-grid">
                <div class="kpi-card"><p class="kpi-card-title">Total Items</p><div class="kpi-card-value">${i}</div></div>
                <div class="kpi-card"><p class="kpi-card-title">Status OK</p><div class="kpi-card-value ok">${ok}</div></div>
                <div class="kpi-card"><p class="kpi-card-title">Warning</p><div class="kpi-card-value warning">${warn}</div></div>
                <div class="kpi-card"><p class="kpi-card-title">Critical Level</p><div class="kpi-card-value critical">${crit}</div></div>
            </div>
            <div class="form-card">
                <div class="form-card-header"> <h2>Register New Supply</h2> </div>
                <div class="form-card-body">
                    <div class="form-group"><label for="custpage_new_name">PRODUCT NAME</label><input type="text" id="custpage_new_name"></div>
                    <div class="form-group"><label for="custpage_new_category">CATEGORY</label><select id="custpage_new_category"><option value=""></option>${categoryOptions}</select></div>
                    <div class="form-group"><label for="custpage_new_stock">QUANTITY</label><input type="number" id="custpage_new_stock"></div>
                    <div class="form-group"><button type="button" onclick="crearNuevoInsumo()" class="uir-button uir-button-primary">Add Stock</button></div>
                </div>
            </div>
            <div class="table-card">
                <div class="table-header"><h2>General Inventory</h2></div>
                <table class="custom-table"><thead><tr><th>Product</th><th>Category</th><th>Stock</th><th>Status</th><th>Summary</th><th>Action</th></tr></thead><tbody>${tableRowsHtml}</tbody></table>
            </div>
          </div>
          <div id="historyModal" class="modal">
            <div class="modal-card">
              <div class="modal-head"><span class="close" onclick="closeHistoryModal()">✖</span><span id="modalTitle">Item Summary</span></div>
              <div class="modal-body">
                <div class="modal-hero"><div id="catIcon" class="modal-hero-icon"></div><div class="modal-hero-info"><h2 id="sumName">—</h2><p id="sumCategory">—</p></div></div>
                <div class="modal-kpi-grid">
                    <div class="modal-kpi"><p class="label">Current Stock</p><p class="value" id="pStock">—</p></div>
                    <div class="modal-kpi"><p class="label">Avg. Daily Use</p><p class="value" id="pAvg">—</p></div>
                    <div class="modal-kpi"><p class="label">Days Remaining</p><p class="value" id="pDays">—</p></div>
                    <div class="modal-kpi"><p class="label">Risk Level</p><div id="pRisk" class="pill">—</div></div>
                </div>
                <div class="split">
                    <div class="card"><div style="font-weight:700;margin-bottom:8px;">Risk Table</div><table class="simple" id="riskTable"></table></div>
                    <div class="card"><div style="font-weight:700;margin-bottom:8px;">Recent History</div><table class="simple" id="logsTable"></table></div>
                </div>
                <div class="card" style="margin-top:16px;"><div style="font-weight:700;margin-bottom:8px;">Stock Projection</div><div id="chartContainer"><canvas id="historyChart" height="120"></canvas></div></div>
              </div>
            </div>
          </div>
          <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"><\/script>
        `;
        
        form.addField({ id: 'custpage_all_html', label: ' ', type: ui.FieldType.INLINEHTML }).defaultValue = htmlContent;
        ctx.response.writePage(form);
    };
    return { onRequest };
});