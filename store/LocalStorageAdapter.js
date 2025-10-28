export const LocalStorageAdapter = (prefix = 'iac-') => ({
    get: (key) => JSON.parse(localStorage.getItem(`${prefix}${key}`)),
    set: (key, value) => localStorage.setItem(`${prefix}${key}`, JSON.stringify(value)),
    remove: (key) => localStorage.removeItem(`${prefix}${key}`),
    list: (type) => Object.keys(localStorage)
        .filter(key => key.startsWith(`${prefix}${type}`))
        .map(key => JSON.parse(localStorage.getItem(key)))
});