/**
 * @NApiVersion 2.1
 * @NScriptType ScheduledScript
 */
define(['N/search', 'N/log', 'N/https'],
(search, log, https) => {

  function escapeSlackText(text) {
    if (!text) return '';
    return text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  // helper para dividir arrays en grupos de N
  function chunk(arr, size){
    const out = [];
    for (let i=0; i<arr.length; i+=size) {
      out.push(arr.slice(i, i+size));
    }
    return out;
  }

  // helper para construir fields
  function fieldsFrom(items){
    return items.map(i => ({
      type: "mrkdwn",
      text: `*${escapeSlackText(i.nombre)}*\nStock Remaining: *${i.stock}*`
    }));
  }

  const execute = () => {
    log.debug('--- INVENTORY ALERT SCRIPT (FINAL) ---', 'Searching for low stock items...');

    //  pega aquí tu webhook NUEVO de Slack (#todo-iac)
    const SLACK_WEBHOOK_URL = '';

    const lowStockSearch = search.create({
      type: 'customrecord_iac_critical_supply',
      filters: [['custrecord_iac_stock_actual','lessthanorequalto','15']],
      columns: ['name','custrecord_iac_stock_actual']
    });

    const criticalItems = [];
    const warningItems  = [];

    lowStockSearch.run().each(result => {
      const item = {
        nombre: result.getValue('name'),
        stock: Number(result.getValue('custrecord_iac_stock_actual')) || 0
      };
      if (item.stock <= 5) criticalItems.push(item);
      else warningItems.push(item);
      return true;
    });

    log.debug('Results', `Critical: ${criticalItems.length}, Warning: ${warningItems.length}`);

    // armar payload de Slack
    const blocks = [
      { type:'header', text:{ type:'plain_text', text:'⚠️ Inventory Alert - Autonomous ERP' } }
    ];

    if (criticalItems.length) {
      blocks.push({ type:'divider' });
      blocks.push({ type:'section', text:{ type:'mrkdwn', text:'🔴 *CRITICAL ITEMS (IMMEDIATE ACTION REQUIRED)*' }});
      const fieldChunks = chunk(fieldsFrom(criticalItems), 10);
      fieldChunks.forEach(fc => blocks.push({ type:'section', fields: fc }));
    }

    if (warningItems.length) {
      blocks.push({ type:'divider' });
      blocks.push({ type:'section', text:{ type:'mrkdwn', text:'🟡 *WARNING ITEMS (APPROACHING CRITICAL LEVEL)*' }});
      const fieldChunks = chunk(fieldsFrom(warningItems), 10);
      fieldChunks.forEach(fc => blocks.push({ type:'section', fields: fc }));
    }

    if (!criticalItems.length && !warningItems.length) {
      blocks.push({ type:'section', text:{ type:'mrkdwn', text:'✅ No critical or warning items.' }});
    }

    const finalPayload = { blocks };

    // enviar a Slack
    try {
      const resp = https.post({
        url: SLACK_WEBHOOK_URL,
        body: JSON.stringify(finalPayload),
        headers: { 'Content-Type': 'application/json' }
      });
      log.audit('Slack POST response', `code=${resp.code} body=${resp.body}`);
      if (String(resp.code)[0] !== '2') {
        log.error('Slack POST failed', `HTTP ${resp.code} - ${resp.body}`);
      } else {
        log.audit('Alert Notification Sent to Slack', `Critical: ${criticalItems.length}, Warning: ${warningItems.length}`);
      }
    } catch (e) {
      log.error('Error Sending to Slack', e.message || e);
    }
  };

  return { execute };
});