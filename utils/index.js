export const uuid = () => `_${Math.random().toString(36).substr(2, 9)}`;
export const formatDate = (date) => new Date(date).toLocaleDateString();
export const parsePositiveInt = (value) => {
    const parsed = parseInt(value, 10);
    return isNaN(parsed) || parsed < 0 ? 0 : parsed;
};
export const debounce = (func, delay) => {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), delay);
    };
};
export const qs = (selector, scope = document) => scope.querySelector(selector);
export const on = (element, event, handler) => element.addEventListener(event, handler);
export const el = (tag, attributes, children) => {
    const element = document.createElement(tag);
    for (const key in attributes) {
        element.setAttribute(key, attributes[key]);
    }
    if (Array.isArray(children)) {
        children.forEach(child => element.appendChild(child));
    } else if (typeof children === 'string') {
        element.textContent = children;
    }
    return element;
};