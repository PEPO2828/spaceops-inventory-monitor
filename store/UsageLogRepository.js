export const UsageLogRepository = (storage) => ({
    save: (log) => storage.set(`log-${log.id}`, log),
    findBySupplyId: (supplyId) => storage.list('log').filter(item => item && item.supplyId === supplyId),
});