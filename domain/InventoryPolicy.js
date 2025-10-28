export const InventoryPolicy = {
    addStock: (supply, quantity) => ({ ...supply, currentStock: supply.currentStock + quantity }),
    removeStock: (supply, quantity) => ({ ...supply, currentStock: Math.max(0, supply.currentStock - quantity) }),
};