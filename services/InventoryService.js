import { Supply } from '../domain/Supply.js';
import { UsageLog } from '../domain/UsageLog.js';
import { InventoryPolicy } from '../domain/InventoryPolicy.js';

export const InventoryService = (supplyRepo, logRepo) => ({
    createSupply: (name, category, currentStock, minThreshold) => {
        const newSupply = Supply(name, category, currentStock, minThreshold);
        supplyRepo.save(newSupply);
        return newSupply;
    },
    addStock: (supplyId, quantity) => {
        const supply = supplyRepo.findById(supplyId);
        if (!supply) throw new Error("Supply not found");
        const updatedSupply = InventoryPolicy.addStock(supply, quantity);
        supplyRepo.save(updatedSupply);
        const log = UsageLog(supplyId, quantity, 'add');
        logRepo.save(log);
        return updatedSupply;
    },
    logUsage: (supplyId, quantity) => {
        const supply = supplyRepo.findById(supplyId);
        if (!supply) throw new Error("Supply not found");
        const updatedSupply = InventoryPolicy.removeStock(supply, quantity);
        supplyRepo.save(updatedSupply);
        const log = UsageLog(supplyId, quantity, 'usage');
        logRepo.save(log);
        return updatedSupply;
    },
    getCriticalSupplies: () => supplyRepo.findAll().filter(s => s.currentStock <= s.minThreshold),
    getSupplies: () => supplyRepo.findAll(),
    getSupplyById: (id) => supplyRepo.findById(id),
    getUsageLogsBySupplyId: (supplyId) => logRepo.findBySupplyId(supplyId),
    projectDepletion: (supplyId) => {
        const logs = logRepo.findBySupplyId(supplyId)
            .filter(log => log.type === 'usage')
            .sort((a, b) => new Date(b.date) - new Date(a.date));

        if (logs.length < 2) return null;

        const recentLogs = logs.slice(0, 14);
        const totalUsage = recentLogs.reduce((sum, log) => sum + log.quantity, 0);
        const avgDailyUsage = totalUsage / recentLogs.length;

        if (avgDailyUsage <= 0) return null;

        const supply = supplyRepo.findById(supplyId);
        const daysLeft = supply.currentStock / avgDailyUsage;
        const depletionDate = new Date();
        depletionDate.setDate(depletionDate.getDate() + daysLeft);

        return depletionDate.toISOString();
    }
});