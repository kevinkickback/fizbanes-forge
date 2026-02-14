// InstrumentChoicesView.js
// UI for selecting musical instrument proficiencies from available slots

import { MUSICAL_INSTRUMENTS } from '../../../lib/5eToolsParser.js';

export class InstrumentChoicesView {
    constructor() {
        this._container = null;
    }

    render(toolsContainer, slots, onChange) {
        if (!toolsContainer) return;

        const host = this._getOrCreateHost(toolsContainer);

        if (!slots || slots.length === 0) {
            host.remove();
            return;
        }

        host.innerHTML = this._buildContent(slots);
        this._wireEvents(host, onChange);
    }

    _buildContent(slots) {
        const selectedInstruments = new Set(
            slots.map((s) => s.selection).filter(Boolean),
        );

        return `
			<div class="instrument-choices-grid">
				${slots
                .map((slot, index) => {
                    return `
							<div class="instrument-choice-group">
								<label class="form-label">${slot.sourceLabel} instrument</label>
								<select class="form-select form-select-sm instrument-choice-select" data-slot-index="${index}" data-source-label="${slot.sourceLabel}" data-key="${slot.key}">
									<option value="">Choose...</option>
									${MUSICAL_INSTRUMENTS.map((inst) => {
                        const isSelected = slot.selection === inst;
                        const isUsedElsewhere =
                            selectedInstruments.has(inst) && !isSelected;
                        return `<option value="${inst}" ${isSelected ? 'selected' : ''} ${isUsedElsewhere ? 'disabled' : ''}>${inst}${isUsedElsewhere ? ' (used)' : ''}</option>`;
                    }).join('')}
								</select>
							</div>
						`;
                })
                .join('')}
			</div>
		`;
    }

    _wireEvents(host, onChange) {
        const selects = host.querySelectorAll('.instrument-choice-select');
        for (const select of selects) {
            select.addEventListener('change', onChange);
        }
    }

    _getOrCreateHost(toolsContainer) {
        let host = toolsContainer.querySelector('.instrument-choices-container');
        if (!host) {
            host = document.createElement('div');
            host.className = 'instrument-choices-container';
            toolsContainer.appendChild(host);
        }
        return host;
    }
}
