export const SupplyRepository = (storage) => ({
    save: (supply) => storage.set(`supply-${supply.id}`, supply),
    findById: (id) => storage.get(`supply-${id}`),
    findAll: () => storage.list('supply')
});