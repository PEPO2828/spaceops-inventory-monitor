import { uuid } from '../utils/index.js';

export const Supply = (name, category, currentStock, minThreshold = 15) => ({
    id: uuid(),
    name,
    category,
    currentStock,
    minThreshold,
    createdAt: new Date().toISOString(),
});