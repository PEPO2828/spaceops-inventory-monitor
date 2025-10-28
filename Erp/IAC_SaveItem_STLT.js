/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 */
define(['N/record','N/redirect','N/log'], (record, redirect, log) => {
  const RT_SUPPLY = 'customrecord_iac_critical_supply';
  const F_STOCK   = 'custrecord_iac_stock_actual';
  const RT_LOG    = 'customrecord_iac_usage_log';
  const FL_ITEM   = 'custrecord_iac_log_item';
  const FL_QTY    = 'custrecord_iac_log_quantity';
  const FL_DATE   = 'custrecord_iac_log_date';

  function statusFor(s){ return (s<=5)?'Critical':(s<=15)?'Warning':'OK'; }

  const onRequest = (ctx) => {
    const req = ctx.request, resp = ctx.response;
    const p   = req.parameters || {};
    const b   = (req.body) ? JSON.parse(req.body) : {};
    const action = String((p.action || b.action || '')).toLowerCase();

    try {
      if (action === 'create') {
        const { nombre, categoria, stock } = p;
        if (!nombre || !categoria || !stock) throw new Error('Incomplete parameters');
        const rec = record.create({ type: RT_SUPPLY });
        rec.setValue({ fieldId: 'name', value: nombre.trim() });
        rec.setValue({ fieldId: 'custrecord_iac_categoria', value: categoria });
        rec.setValue({ fieldId: F_STOCK, value: parseInt(stock, 10) || 0 });
        rec.save();
        redirect.toSuitelet({ scriptId: 'customscript_iac_dashboard_stlt', deploymentId: 'customdeploy_iac_dashboard_stlt' });
      } else if (action === 'logusageajax') {
        const { itemId, quantity } = b;
        if (!itemId || !quantity || quantity <= 0) {
            resp.write(JSON.stringify({ ok:false, message:'Invalid parameters (itemId/quantity).' }));
            return;
        }
        const sup = record.load({ type: RT_SUPPLY, id: itemId });
        const stockNow = sup.getValue(F_STOCK) || 0;
        if (quantity > stockNow) {
            resp.write(JSON.stringify({ ok:false, message:`Quantity (${quantity}) exceeds available stock (${stockNow}).` }));
            return;
        }
        const newStock = stockNow - quantity;
        record.submitFields({ type: RT_SUPPLY, id: itemId, values: { [F_STOCK]: newStock } });
        try {
          const logrec = record.create({ type: RT_LOG });
          logrec.setValue({ fieldId: FL_ITEM, value: itemId });
          logrec.setValue({ fieldId: FL_QTY,  value: quantity });
          logrec.setValue({ fieldId: FL_DATE, value: new Date() });
          logrec.save();
        } catch (elog) {
          log.error('Could not create usage log (ignoring)', elog);
        }
        resp.write(JSON.stringify({ ok:true, newStock, newStatus: statusFor(newStock) }));
      } else {
        redirect.toSuitelet({ scriptId: 'customscript_iac_dashboard_stlt', deploymentId: 'customdeploy_iac_dashboard_stlt' });
      }
    } catch (e) {
      log.error('IAC_SaveItem_STLT error', e);
      if (action === 'logusageajax') {
        resp.write(JSON.stringify({ ok:false, message: String(e.message || e) }));
      } else {
        redirect.toSuitelet({ scriptId: 'customscript_iac_dashboard_stlt', deploymentId: 'customdeploy_iac_dashboard_stlt' });
      }
    }
  };
  return { onRequest };
});