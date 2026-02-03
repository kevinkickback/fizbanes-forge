// Reusable class switcher for modals with multiclass support.

import { DOMCleanup } from '../../../lib/DOMCleanup.js';

export class ClassSwitcher {
    /**
     * @param {Object} options
     * @param {HTMLElement} options.container - Footer or container to inject the switcher into
     * @param {string[]} options.classes - Array of class names to show in the dropdown
     * @param {string} options.selectedClass - Initially selected class
     * @param {Function} options.onChange - Callback when class changes: (newClassName) => void
     * @param {string} options.selectorId - ID for the select element (must be unique per modal)
     * @param {string} [options.label='Class:'] - Label text to display before the dropdown
     * @param {DOMCleanup} [options.cleanup] - Optional DOMCleanup instance for listener management
     */
    constructor({ container, classes, selectedClass, onChange, selectorId, label = 'Class:', cleanup }) {
        this.container = container;
        this.classes = classes || [];
        this.selectedClass = selectedClass;
        this.onChange = onChange;
        this.selectorId = selectorId;
        this.label = label;
        this.cleanup = cleanup || DOMCleanup.create();
        this.element = null;
    }

    render() {
        if (!this.container || this.classes.length <= 1) return;

        // Remove existing switcher if present
        this._remove();

        const optionsHtml = this.classes.map(className =>
            `<option value="${className}" ${className === this.selectedClass ? 'selected' : ''}>${className}</option>`
        ).join('');

        const html = `
			<div class="d-flex align-items-center gap-2 me-auto">
				<label class="mb-0 text-nowrap"><strong>${this.label}</strong></label>
				<select class="form-select form-select-sm" id="${this.selectorId}" style="width: auto; flex-shrink: 0;">
					${optionsHtml}
				</select>
			</div>
		`;

        const wrapper = document.createElement('div');
        wrapper.innerHTML = html;
        this.element = wrapper.firstElementChild;

        // Insert at the beginning of the container (before buttons)
        this.container.insertBefore(this.element, this.container.firstChild);

        // Wire up change handler
        const select = this.element.querySelector('select');
        if (select) {
            this.cleanup.on(select, 'change', (e) => {
                const newClass = e.target.value;
                if (newClass !== this.selectedClass) {
                    this.selectedClass = newClass;
                    this.onChange?.(newClass);
                }
            });
        }
    }

    _remove() {
        const existing = document.getElementById(this.selectorId)?.parentElement;
        if (existing) {
            existing.remove();
        }
    }

    destroy() {
        this._remove();
        this.cleanup.cleanup();
    }
}
