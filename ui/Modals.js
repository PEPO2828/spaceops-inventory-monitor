import { el, on, qs, parsePositiveInt } from '../utils/index.js';
import { Router } from './Router.js';

const createModal = (title, content) => {
    const modal = el('div', { class: 'modal' });
    modal.innerHTML = `
        <div class="modal-content">
            <span class="close">&times;</span>
            <h2>${title}</h2>
            ${content}
        </div>
    `;
    on(qs('.close', modal), 'click', () => modal.remove());
    on(modal, 'click', (e) => e.target === modal && modal.remove());
    document.body.appendChild(modal);
    modal.style.display = 'block';
    return modal;
};

export const Modals = (inventoryService) => ({
    newSupply: () => {
        const modal = createModal('New Supply', `
            <form id="new-supply-form">
                <div class="form-grid">
                    <div class="form-group">
                        <label for="name">Supply Name</label>
                        <input type="text" id="name" name="name" class="styled-input" placeholder="e.g., Band-Aids" required>
                    </div>
                    <div class="form-group">
                        <label for="category">Category</label>
                        <div class="select-wrapper">
                            <select id="category" name="category" class="styled-select" required>
                                <option value="">Select Category</option>
                                ${["Medicines", "Food", "Spare Parts"].map(c => `<option value="${c}">${c}</option>`).join('')}
                            </select>
                            <svg class="select-arrow" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" /></svg>
                        </div>
                    </div>
                    <div class="form-group">
                        <label for="currentStock">Current Stock</label>
                        <input type="number" id="currentStock" name="currentStock" class="styled-input" placeholder="e.g., 100" required>
                    </div>
                    <div class="form-group">
                        <label for="minThreshold">Minimum Threshold</label>
                        <input type="number" id="minThreshold" name="minThreshold" class="styled-input" placeholder="e.g., 15" required>
                    </div>
                </div>
                <button type="submit" class="button button-primary button-full-width">Create</button>
            </form>
        `);

        on(qs('#new-supply-form'), 'submit', (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            inventoryService.createSupply(
                formData.get('name'),
                formData.get('category'),
                parsePositiveInt(formData.get('currentStock')),
                parsePositiveInt(formData.get('minThreshold'))
            );
            modal.remove();
            Router(qs('#app-root'), inventoryService);
        });
    },
    logUsage: (supplyId) => {
        const supply = inventoryService.getSupplyById(supplyId);
        const modal = createModal('Log Usage', `
            <form id="log-usage-form">
                <p>Supply: ${supply.name}</p>
                <input type="number" name="quantity" placeholder="Quantity" required>
                <button type="submit" class="button">Log</button>
            </form>
        `);

        on(qs('#log-usage-form'), 'submit', (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            inventoryService.logUsage(supplyId, parsePositiveInt(formData.get('quantity')));
            modal.remove();
            Router(qs('#app-root'), inventoryService);
        });
    },
    addStock: (supplyId) => {
        const supply = inventoryService.getSupplyById(supplyId);
        const modal = createModal('Add Stock', `
            <form id="add-stock-form">
                <p>Supply: ${supply.name}</p>
                <input type="number" name="quantity" placeholder="Quantity" required>
                <button type="submit" class="button">Add</button>
            </form>
        `);

        on(qs('#add-stock-form'), 'submit', (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            inventoryService.addStock(supplyId, parsePositiveInt(formData.get('quantity')));
            modal.remove();
            Router(qs('#app-root'), inventoryService);
        });
    }
});