/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define(['N/record', 'N/log'], (record, log) => {

    /**
     * Se ejecuta después de que un registro se guarda en la base de datos.
     * @param {Object} context
     * @param {Record} context.newRecord - El registro que se acaba de guardar.
     * @param {String} context.type - El tipo de evento (create, edit, delete).
     */
    const afterSubmit = (context) => {
        // Solo queremos que se ejecute cuando se CREA un nuevo registro de consumo.
        // Evitamos que se ejecute al editar para no restar el stock dos veces por error.
        if (context.type !== context.UserEventType.CREATE) {
            log.debug('Evento Omitido', `El script no se ejecuta en modo ${context.type}. Saliendo.`);
            return;
        }

        try {
            const usageLogRecord = context.newRecord;

            // 1. Obtener los datos del registro de consumo que se acaba de crear.
            const itemId = usageLogRecord.getValue({
                fieldId: 'custrecord_iac_log_item'
            });
            const quantityUsed = usageLogRecord.getValue({
                fieldId: 'custrecord_iac_log_quantity'
            });

            // Validar que tenemos los datos necesarios.
            if (!itemId || !quantityUsed || quantityUsed <= 0) {
                log.audit('Datos Insuficientes', 'No se encontró el item o la cantidad en el log. No se actualiza el stock.');
                return;
            }

            log.debug('Iniciando Actualización de Stock', `Item ID: ${itemId}, Cantidad a restar: ${quantityUsed}`);

            // 2. Actualizar el campo de stock en el registro del Insumo Crítico.
            // Usamos record.submitFields para mayor eficiencia, ya que solo actualiza un campo
            // sin cargar y guardar el registro completo.
            record.submitFields({
                type: 'customrecord_iac_critical_supply', // El SCRIPT ID de tu registro de Insumos
                id: itemId,
                values: {
                    // La fórmula es: 'stock_actual = stock_actual - cantidad_usada'
                    // NetSuite no permite una resta directa, así que usamos un truco con una fórmula SQL.
                    // ¡IMPORTANTE! El ID 'custrecord_iac_stock_actual' debe ser el correcto.
                    'custrecord_iac_stock_actual': `GREATEST(0, NVL({custrecord_iac_stock_actual}, 0) - ${quantityUsed})`
                },
                options: {
                    enableSourcing: false,
                    ignoreMandatoryFields: true
                }
            });

            log.audit('Éxito', `Stock del item ${itemId} actualizado correctamente. Se restaron ${quantityUsed} unidades.`);

        } catch (e) {
            log.error({
                title: 'Error al actualizar stock desde User Event',
                details: e
            });
        }
    };

    return {
        afterSubmit
    };
});