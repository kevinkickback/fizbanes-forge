// SubclassPickerView.js
// Subclass dropdown selection view

import { eventBus, EVENTS } from '../../../lib/EventBus.js';

export class SubclassPickerView {
    constructor() {
        this._subclassSelect = document.getElementById('subclassSelect');

        // Set up event listeners
        this._setupEventListeners();
    }

    //-------------------------------------------------------------------------
    // Event Setup
    //-------------------------------------------------------------------------

    _setupEventListeners() {
        if (this._subclassSelect) {
            this._subclassSelect.addEventListener('change', (event) => {
                const selectedValue = event.target.value;
                if (selectedValue) {
                    eventBus.emit(EVENTS.SUBCLASS_SELECTED, {
                        name: selectedValue,
                        value: selectedValue,
                    });
                }
            });
        }
    }

    //-------------------------------------------------------------------------
    // Public API
    //-------------------------------------------------------------------------

    getSubclassSelect() {
        return this._subclassSelect;
    }

    getSelectedSubclassValue() {
        return this._subclassSelect.value;
    }

    setSelectedSubclassValue(value) {
        this._subclassSelect.value = value;
    }

    populateSubclassSelect(subclasses) {
        this._subclassSelect.innerHTML =
            '<option value="">Select a Subclass</option>';
        this._subclassSelect.disabled = true;

        if (!subclasses || subclasses.length === 0) {
            return;
        }

        // Sort subclasses by name
        const sortedSubclasses = [...subclasses].sort((a, b) =>
            a.name.localeCompare(b.name),
        );

        // Add options to select
        for (const subclass of sortedSubclasses) {
            const option = document.createElement('option');
            option.value = subclass.name;
            const src =
                subclass.subclassSource ||
                subclass.source ||
                subclass.classSource ||
                '';
            option.textContent = src ? `${subclass.name} (${src})` : subclass.name;
            this._subclassSelect.appendChild(option);
        }

        this._subclassSelect.disabled = false;
    }

    reset() {
        this._subclassSelect.innerHTML =
            '<option value="">Select a Subclass</option>';
        this._subclassSelect.disabled = true;
    }

    resetWithMessage(message) {
        this._subclassSelect.innerHTML = `<option value="">${message}</option>`;
        this._subclassSelect.disabled = true;
    }

    hasSubclassOption(subclassName) {
        return Array.from(this._subclassSelect.options).some(
            (option) => option.value === subclassName,
        );
    }

    triggerSubclassSelectChange() {
        this._subclassSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }
}
