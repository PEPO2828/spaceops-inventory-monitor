import { uuid } from '../utils/index.js';

export const UsageLog = (supplyId, quantity, type) => ({
    id: uuid(),
    supplyId,
    quantity,
    type, // 'usage' or 'add'
    date: new Date().toISOString(),
});