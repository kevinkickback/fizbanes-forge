// Renders the class choices accordion and dispatches to sub-renderers.

import { CharacterManager } from '../../../app/CharacterManager.js';
import { escapeHtml } from '../../../lib/5eToolsParser.js';
import { textProcessor } from '../../../lib/TextProcessor.js';
import { progressionHistoryService } from '../../../services/ProgressionHistoryService.js';
import { getFeatureIcon } from './ClassChoiceInfoPanel.js';

export class ClassChoiceRenderer {
	constructor(cleanup, delegates) {
		this._cleanup = cleanup;
		this._delegates = delegates;
		this._renderingChoices = false;
		this._pendingChoicesRender = null;
	}

	async renderChoices(className, choices, passiveFeatures = []) {
		if (this._renderingChoices) {
			this._pendingChoicesRender = { className, choices, passiveFeatures };
			return;
		}
		this._renderingChoices = true;

		const container = document.getElementById('classChoicesContent');
		if (!container) {
			this._renderingChoices = false;
			return;
		}

		// Preserve accordion state before re-rendering
		const expandedLevels = new Set();
		const existingAccordion = document.getElementById('classChoicesAccordion');
		if (existingAccordion) {
			const collapses = existingAccordion.querySelectorAll(
				'.accordion-collapse.show',
			);
			collapses.forEach((collapse) => {
				const match = collapse.id.match(/classChoicesLevel(\d+)/);
				if (match) {
					expandedLevels.add(Number(match[1]));
				}
			});
		}

		// Group choices by level
		const choicesByLevel = {};
		for (const choice of choices) {
			const level = choice.level || 1;
			if (!choicesByLevel[level]) {
				choicesByLevel[level] = [];
			}
			choicesByLevel[level].push(choice);
		}

		// Group passive features by level
		const passiveByLevel = {};
		for (const feature of passiveFeatures) {
			const level = feature.level || 1;
			if (!passiveByLevel[level]) {
				passiveByLevel[level] = [];
			}
			passiveByLevel[level].push(feature);
		}

		// Merge all levels that have either choices or passive features
		const allLevels = new Set([
			...Object.keys(choicesByLevel).map(Number),
			...Object.keys(passiveByLevel).map(Number),
		]);
		const levels = [...allLevels].sort((a, b) => a - b);

		// Build accordion HTML
		let html =
			'<div class="accordion accordion-flush" id="classChoicesAccordion">';

		for (const level of levels) {
			const levelChoices = choicesByLevel[level] || [];
			const levelPassive = passiveByLevel[level] || [];
			const hasChoices = levelChoices.length > 0;

			const isExpanded =
				expandedLevels.size > 0 ? expandedLevels.has(level) : false;
			const collapseId = `classChoicesLevel${level}`;

			html += `
				<div class="accordion-item">
					<h2 class="accordion-header" id="heading${collapseId}">
						<button class="accordion-button ${isExpanded ? '' : 'collapsed'}" type="button" 
							data-bs-toggle="collapse" data-bs-target="#${collapseId}" 
							aria-expanded="${isExpanded}" aria-controls="${collapseId}">
							<strong>Level ${level} Features</strong>
							${hasChoices ? `<span class="badge bg-secondary ms-2">${levelChoices.length}</span>` : ''}
						</button>
					</h2>
					<div id="${collapseId}" class="accordion-collapse collapse ${isExpanded ? 'show' : ''}" 
						aria-labelledby="heading${collapseId}">
						<div class="accordion-body p-2">
							${levelChoices.map((choice) => this._renderFeatureChoice(choice, className)).join('')}
							${levelPassive.map((feature) => this._renderNoChoiceFeature(feature)).join('')}
						</div>
					</div>
				</div>
			`;
		}

		html += '</div>';
		try {
			container.innerHTML = html;

			await textProcessor.processElement(container);

			this._attachListeners(container, className);
		} finally {
			this._renderingChoices = false;

			if (this._pendingChoicesRender) {
				const pending = this._pendingChoicesRender;
				this._pendingChoicesRender = null;
				await this.renderChoices(
					pending.className,
					pending.choices,
					pending.passiveFeatures,
				);
			}
		}
	}

	_renderFeatureChoice(choice, className) {
		// Delegate to type-specific renderers
		if (choice.type === 'spell') {
			return this._delegates.spellController.renderChoice(choice, className);
		}

		if (choice.type === 'subclass') {
			return this._renderSubclassChoice(choice, className);
		}

		if (choice.type === 'subclass-feature-choice') {
			return this._renderSubclassFeatureChoice(choice, className);
		}

		if (choice.type === 'asi') {
			return this._delegates.asiController.renderChoice(choice, className);
		}

		const character = CharacterManager.getCurrentCharacter();

		// Get current selections from progression history
		const currentSelections =
			progressionHistoryService.getChoices(
				character,
				className,
				choice.level,
			)?.[choice.type]?.selected || [];

		const isMultiSelect = (choice.count || 1) > 1;
		const isComplete = currentSelections.length >= (choice.count || 1);
		let selectedDisplay = 'None selected';

		if (currentSelections.length > 0) {
			const selectedNames = currentSelections.map((selId) => {
				const opt = choice.options.find(
					(o) => o.id === selId || o.name === selId,
				);
				return opt ? opt.name : selId;
			});
			selectedDisplay = selectedNames.join(', ');
		}

		const selectionsAttr =
			currentSelections.length > 0
				? `data-hover-selections="${encodeURIComponent(JSON.stringify(currentSelections))}"`
				: '';

		return `
			<div class="choice-item border-bottom pb-2 mb-2" data-choice-card="${choice.id}"
				data-hover-type="feature" data-hover-feature-type="${choice.type}" data-hover-class="${className}" ${selectionsAttr}>
				<div class="d-flex justify-content-between align-items-start">
					<div class="flex-grow-1">
						<div class="d-flex align-items-center mb-1">
							<strong>${getFeatureIcon(choice.type)} ${escapeHtml(choice.name)}</strong>
							${isComplete ? '<i class="fas fa-check-circle text-success ms-2"></i>' : ''}
						</div>
						<div class="text-muted small" data-selected-display="${choice.id}">
							${escapeHtml(selectedDisplay)}
						</div>
					</div>
					<button 
						class="btn btn-sm btn-outline-primary" 
						data-feature-select-btn="${choice.id}"
						data-feature-type="${choice.type}"
						data-feature-level="${choice.level}"
						data-is-multi="${isMultiSelect}"
						data-max-count="${choice.count || 1}">
						<i class="fas fa-list"></i> ${isComplete ? 'Change' : 'Choose'}
					</button>
				</div>
			</div>
		`;
	}

	_renderSubclassChoice(choice, className) {
		const character = CharacterManager.getCurrentCharacter();
		const progressionClass = character.progression?.classes?.find(
			(c) => c.name === className,
		);
		const currentSubclass = progressionClass?.subclass;
		const classData = this._delegates.classService.getClass(className);
		const classSource = classData?.source || 'PHB';

		const selectedDisplay = currentSubclass || 'None selected';
		const isComplete = !!currentSubclass;

		return `
			<div class="choice-item border-bottom pb-2 mb-2" data-choice-card="${choice.id}"
				data-hover-type="subclass" data-hover-class="${escapeHtml(className)}" data-hover-source="${escapeHtml(classSource)}"
				${currentSubclass ? `data-hover-subclass="${escapeHtml(currentSubclass)}"` : ''}>
				<div class="d-flex justify-content-between align-items-start">
					<div class="flex-grow-1">
						<div class="d-flex align-items-center mb-1">
							<strong><i class="fas fa-star"></i> ${escapeHtml(choice.name)}</strong>
							${isComplete ? '<i class="fas fa-check-circle text-success ms-2"></i>' : ''}
						</div>
						<div class="text-muted small" data-selected-display="${choice.id}">
							${escapeHtml(selectedDisplay)}
						</div>
					</div>
					<button 
						class="btn btn-sm btn-outline-primary" 
						data-feature-select-btn="${choice.id}"
						data-feature-type="${choice.type}"
						data-feature-level="${choice.level}"
						data-is-multi="false"
						data-max-count="1">
						<i class="fas fa-list"></i> ${isComplete ? 'Change' : 'Choose'}
					</button>
				</div>
			</div>
		`;
	}

	_renderSubclassFeatureChoice(choice, className) {
		const currentValue = choice.currentValue;
		const isComplete = !!currentValue;

		let selectedDisplay = 'None selected';
		if (currentValue) {
			const selectedOpt = choice.options.find((o) => o.value === currentValue);
			if (selectedOpt) {
				selectedDisplay = this._delegates.queryService.formatChoiceOptionLabel(
					selectedOpt,
					choice,
				);
			}
		}

		return `
			<div class="choice-item border-bottom pb-2 mb-2" data-choice-card="${choice.id}">
				<div class="d-flex justify-content-between align-items-start">
					<div class="flex-grow-1">
						<div class="d-flex align-items-center mb-1">
							<strong><i class="${choice.icon}"></i> ${escapeHtml(choice.name)}</strong>
							${isComplete ? '<i class="fas fa-check-circle text-success ms-2"></i>' : ''}
						</div>
						<div class="text-muted small">${escapeHtml(selectedDisplay)}</div>
					</div>
					<button class="btn btn-sm btn-outline-primary"
						data-subclass-choice-btn="${choice.choiceKey}"
						data-subclass-choice-class="${className}"
						data-subclass-choice-level="${choice.level}">
						<i class="fas fa-list"></i> ${isComplete ? 'Change' : 'Choose'}
					</button>
				</div>
			</div>
		`;
	}

	_renderNoChoiceFeature(feature) {
		const firstString =
			feature.entries?.find((e) => typeof e === 'string') || '';
		return `
			<div class="passive-feature-item choice-item" data-hover-type="passive-feature"
				data-hover-feature-name="${escapeHtml(feature.name)}" data-hover-feature-level="${feature.level}"
				data-hover-feature-source="${escapeHtml(feature.source || 'PHB')}">
				<div class="d-flex align-items-center mb-1">
					<i class="fas fa-bookmark me-2 u-text-accent"></i>
					<strong>${escapeHtml(feature.name)}</strong>
				</div>
				<div class="small text-muted">${firstString ? `<p>${firstString}</p>` : ''}</div>
			</div>
		`;
	}

	_attachListeners(container, className) {
		// Spell selection buttons
		const spellButtons = container.querySelectorAll(
			'[data-spell-select-level]',
		);
		spellButtons.forEach((button) => {
			this._cleanup.on(button, 'click', () => {
				const level = parseInt(button.dataset.spellSelectLevel, 10);
				const cls = button.dataset.spellSelectClass;
				this._delegates.spellController.handleSelection(cls, level);
			});
		});

		// Feature selection buttons
		const featureButtons = container.querySelectorAll(
			'[data-feature-select-btn]',
		);
		featureButtons.forEach((button) => {
			this._cleanup.on(button, 'click', async () => {
				const featureId = button.dataset.featureSelectBtn;
				const featureType = button.dataset.featureType;
				const featureLevel = parseInt(button.dataset.featureLevel, 10);
				const isMulti = button.dataset.isMulti === 'true';
				const maxCount = parseInt(button.dataset.maxCount, 10) || 1;

				await this._delegates.onFeatureSelect(
					className,
					featureType,
					featureLevel,
					featureId,
					isMulti,
					maxCount,
				);
			});
		});

		// ASI selection - radio buttons and action button
		const asiActionButtons = container.querySelectorAll(
			'[data-asi-action-btn]',
		);
		asiActionButtons.forEach((button) => {
			const level = parseInt(button.dataset.asiActionBtn, 10);
			const asiUsed = button.dataset.asiUsed === 'true';

			if (!asiUsed) {
				const asiRadio = container.querySelector(`[data-asi-radio="${level}"]`);
				const featRadio = container.querySelector(
					`[data-feat-radio="${level}"]`,
				);
				const buttonTextEl = button.querySelector(
					`[data-asi-btn-text="${level}"]`,
				);
				const buttonIconEl = button.querySelector(`[data-asi-icon="${level}"]`);

				const updateButtonState = () => {
					if (featRadio?.checked) {
						buttonTextEl.textContent = 'Choose';
						buttonIconEl.className = 'fas fa-scroll';
						buttonIconEl.className = 'fas fa-arrow-up';
					}
				};

				if (asiRadio) {
					this._cleanup.on(asiRadio, 'change', updateButtonState);
				}
				if (featRadio) {
					this._cleanup.on(featRadio, 'change', updateButtonState);
				}
			}

			this._cleanup.on(button, 'click', () => {
				if (asiUsed) {
					this._delegates.asiController.handleChange(
						level,
						this._delegates.syncCallback,
					);
				} else {
					const featRadio = container.querySelector(
						`[data-feat-radio="${level}"]`,
					);
					const isSelectingFeat = featRadio?.checked;
					this._delegates.asiController.handleSelection(
						level,
						isSelectingFeat,
						this._delegates.syncCallback,
					);
				}
			});
		});

		// Subclass feature choice buttons
		const subclassChoiceButtons = container.querySelectorAll(
			'[data-subclass-choice-btn]',
		);
		subclassChoiceButtons.forEach((button) => {
			this._cleanup.on(button, 'click', () => {
				const choiceKey = button.dataset.subclassChoiceBtn;
				const choiceClass = button.dataset.subclassChoiceClass;
				const level = parseInt(button.dataset.subclassChoiceLevel, 10);
				this._delegates.onSubclassFeatureChoiceSelect(
					choiceClass,
					choiceKey,
					level,
				);
			});
		});
	}
}
