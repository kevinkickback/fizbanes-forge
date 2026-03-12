import { escapeHtml } from '../../../lib/5eToolsParser.js';
import { eventBus, EVENTS } from '../../../lib/EventBus.js';
import { textProcessor } from '../../../lib/TextProcessor.js';

export class ClassCardView {
    constructor() {
        this._classSelect = document.getElementById('classSelect');

        this._classQuickDesc = document.getElementById('classQuickDesc');

        this._setupEventListeners();
    }

    _setupEventListeners() {
        if (this._classSelect) {
            this._classSelect.addEventListener('change', (event) => {
                const selectedValue = event.target.value;
                if (selectedValue) {
                    const [className, source] = selectedValue.split('_');
                    eventBus.emit(EVENTS.CLASS_SELECTED, {
                        name: className,
                        source,
                        value: selectedValue,
                    });
                }
            });
        }
    }

    getClassSelect() {
        return this._classSelect;
    }

    getSelectedClassValue() {
        return this._classSelect.value;
    }

    setSelectedClassValue(value) {
        this._classSelect.value = value;
    }

    populateClassSelect(classes) {
        this._classSelect.innerHTML = '<option value="">Select a Class</option>';

        if (!classes || classes.length === 0) {
            console.error(
                'ClassCardView',
                'No classes provided to populate dropdown',
            );
            return;
        }

        const sortedClasses = [...classes].sort((a, b) =>
            a.name.localeCompare(b.name),
        );

        for (const classData of sortedClasses) {
            const option = document.createElement('option');
            option.value = `${classData.name}_${classData.source}`;
            option.textContent = `${classData.name} (${classData.source})`;
            this._classSelect.appendChild(option);
        }
    }

    async updateQuickDescription(classData, fluffData = null) {
        if (!classData || !this._classQuickDesc) {
            return;
        }

        let description = '';

        if (fluffData?.entries) {
            for (const entry of fluffData.entries) {
                if (entry.entries && Array.isArray(entry.entries)) {
                    let foundDescription = false;
                    for (let i = 0; i < entry.entries.length; i++) {
                        const subEntry = entry.entries[i];
                        if (typeof subEntry === 'string') {
                            if (i >= 3) {
                                description = subEntry;
                                foundDescription = true;
                                break;
                            }
                        }
                    }
                    if (foundDescription) break;
                }
            }
        }

        if (!description) {
            description =
                classData.description ||
                `${classData.name} class features and characteristics.`;
        }

        this._classQuickDesc.innerHTML = `
            <h5>${escapeHtml(classData.name)}</h5>
            <p>${description}</p>
        `;

        await textProcessor.processElement(this._classQuickDesc);
    }

    resetQuickDescription() {
        this._classQuickDesc.innerHTML = `
            <div class="placeholder-content">
                <h5>Select a Class</h5>
                <p>Choose a class to see details about their abilities, proficiencies, and other characteristics.</p>
            </div>
        `;
    }

    hasClassOption(classValue) {
        return Array.from(this._classSelect.options).some(
            (option) => option.value === classValue,
        );
    }

    triggerClassSelectChange() {
        this._classSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }
}
