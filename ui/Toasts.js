import { el } from '../utils/index.js';

export const Toasts = {
    show: (message, type = 'info') => {
        const toast = el('div', { class: `toast toast-${type}` }, message);
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 5000);
    }
};