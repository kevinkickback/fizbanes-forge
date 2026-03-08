// Info panel controller for class choice hover interactions

import { CharacterManager } from '../../../app/CharacterManager.js';
import { attAbvToFull, escapeHtml, getSchoolName } from '../../../lib/5eToolsParser.js';
import { textProcessor } from '../../../lib/TextProcessor.js';
import { optionalFeatureService } from '../../../services/OptionalFeatureService.js';
import { spellService } from '../../../services/SpellService.js';

export class ClassChoiceInfoPanel {
	constructor(infoPanel, cleanup, classService) {
		this._infoPanel = infoPanel;
		this._cleanup = cleanup;
		this._classService = classService;
	}

	setupHoverListeners(choicesPanel) {
		if (!choicesPanel || !this._infoPanel) return;

		this._cleanup.on(
			choicesPanel,
			'mouseenter',
			async (e) => {
				const item = e.target.closest('.choice-item[data-hover-type]');
				if (!item) return;

				const hoverType = item.dataset.hoverType;

				if (this._infoPanel) {
					this._infoPanel.classList.remove('collapsed');
				}

				switch (hoverType) {
					case 'subclass':
						await this._showSubclassInfo(item);
						break;
					case 'spell':
						await this._showSpellSelectionInfo(item);
						break;
					case 'feature':
						await this._showFeatureInfo(item);
						break;
					case 'asi':
						await this._showASIInfo(item);
						break;
					case 'passive-feature':
						await this._showPassiveFeatureInfo(item);
						break;
				}
			},
			true,
		);
	}

	async _showSubclassInfo(item) {
		const className = item.dataset.hoverClass;
		const classSource = item.dataset.hoverSource || 'PHB';
		const subclassName = item.dataset.hoverSubclass;

		if (!subclassName) {
			const subclasses = this._classService.getSubclasses(
				className,
				classSource,
			);
			const classData = this._classService.getClass(className, classSource);
			const subclassLevel = this._classService.getSubclassLevel(classData) || 3;

			const html = `
				<div class="info-section">
					<h5><i class="fas fa-star me-2"></i>Choose Your ${classData?.subclassTitle || 'Subclass'}</h5>
					<p class="text-muted">At level ${subclassLevel}, ${className}s choose a ${classData?.subclassTitle || 'subclass'} that grants additional features.</p>
					<div class="mt-3">
						<strong>Available Options:</strong>
						<ul class="mt-2">
							${subclasses
					.slice(0, 8)
					.map(
						(sc) =>
							`<li><strong>${sc.name}</strong> (${sc.subclassSource || sc.source})</li>`,
					)
					.join('')}
							${subclasses.length > 8 ? `<li class="text-muted">...and ${subclasses.length - 8} more</li>` : ''}
						</ul>
					</div>
				</div>
			`;
			this._infoPanel.innerHTML = html;
			await textProcessor.processElement(this._infoPanel);
			return;
		}

		const subclass = this._classService.getSubclass(
			className,
			subclassName,
			classSource,
		);
		if (!subclass) {
			this._infoPanel.innerHTML = `<div class="info-section"><p class="text-muted">Subclass information not available.</p></div>`;
			await textProcessor.processElement(this._infoPanel);
			return;
		}

		const features = this._classService.getSubclassFeatures(
			className,
			subclass.shortName || subclassName,
			20,
			subclass.subclassSource || subclass.source || classSource,
		);

		let entriesHtml = '';
		for (const feature of features) {
			if (feature.entries) {
				entriesHtml += `<div class="feature-entry mb-3">
					<strong>Level ${feature.level}: ${escapeHtml(feature.name)}</strong>
					<div class="mt-1">${this._renderFeatureEntries(feature.entries)}</div>
				</div>`;
			}
		}

		const html = `
			<div class="info-section">
				<h5><i class="fas fa-star me-2"></i>${escapeHtml(subclass.name)}</h5>
				<p class="text-muted small">Source: ${escapeHtml(subclass.subclassSource || subclass.source || classSource)}</p>
				<div class="mt-3">
					${entriesHtml || '<p class="text-muted">No feature details available.</p>'}
				</div>
			</div>
		`;

		this._infoPanel.innerHTML = html;
		await textProcessor.processElement(this._infoPanel);
	}

	async _showSpellSelectionInfo(item) {
		const className = item.dataset.hoverClass;
		const level = parseInt(item.dataset.hoverLevel, 10);
		const spellsJson = item.dataset.hoverSpells;

		let selectedSpells = [];
		if (spellsJson) {
			try {
				selectedSpells = JSON.parse(decodeURIComponent(spellsJson));
			} catch {
				console.warn(
					'[ClassChoiceInfoPanel]',
					'Failed to parse spell selection data',
				);
			}
		}

		if (selectedSpells.length === 0) {
			const classData = this._classService.getClass(className);
			const spellAbility = classData?.spellcastingAbility || '';

			const html = `
				<div class="info-section">
					<h5><i class="fas fa-hat-wizard me-2"></i>Spell Selection</h5>
					<p class="text-muted">Select your ${className} spells for level ${level}.</p>
					${spellAbility ? `<p><strong>Spellcasting Ability:</strong> ${attAbvToFull(spellAbility)}</p>` : ''}
				</div>
			`;
			this._infoPanel.innerHTML = html;
			await textProcessor.processElement(this._infoPanel);
			return;
		}

		let spellsHtml = '';
		for (const spellName of selectedSpells) {
			const spell = spellService.getSpell(spellName);
			if (spell) {
				const levelText =
					spell.level === 0 ? 'Cantrip' : `Level ${spell.level}`;
				const schoolText = getSchoolName(spell.school) || '';

				let descriptionText = '';
				if (spell.entries && spell.entries.length > 0) {
					const firstEntry = spell.entries.find((e) => typeof e === 'string');
					if (firstEntry) {
						descriptionText = firstEntry;
					}
				}

				spellsHtml += `
					<div class="spell-info-item mb-3 pb-2 border-bottom">
						<div class="d-flex justify-content-between align-items-start">
							<strong>${escapeHtml(spell.name)}</strong>
							<span class="badge bg-secondary">${levelText}</span>
						</div>
						<div class="text-muted small">${escapeHtml(schoolText)}</div>
						${descriptionText ? `<p class="small mt-1 mb-0">${descriptionText}</p>` : ''}
					</div>
				`;
			} else {
				spellsHtml += `<div class="spell-info-item mb-2"><strong>${escapeHtml(spellName)}</strong></div>`;
			}
		}

		const html = `
			<div class="info-section">
				<h5><i class="fas fa-hat-wizard me-2"></i>Selected Spells (Level ${level})</h5>
				<div class="mt-3">
					${spellsHtml}
				</div>
			</div>
		`;

		this._infoPanel.innerHTML = html;
		await textProcessor.processElement(this._infoPanel);
	}

	async _showFeatureInfo(item) {
		const featureType = item.dataset.hoverFeatureType;
		const selectionsJson = item.dataset.hoverSelections;

		let selections = [];
		if (selectionsJson) {
			try {
				selections = JSON.parse(decodeURIComponent(selectionsJson));
			} catch {
				console.warn(
					'[ClassChoiceInfoPanel]',
					'Failed to parse feature selection data',
				);
			}
		}

		const featureTypeName = this._getFeatureTypeName(featureType);

		if (selections.length === 0) {
			const html = `
				<div class="info-section">
					<h5>${getFeatureIcon(featureType)} ${featureTypeName}</h5>
					<p class="text-muted">Choose your ${featureTypeName.toLowerCase()} options.</p>
				</div>
			`;
			this._infoPanel.innerHTML = html;
			await textProcessor.processElement(this._infoPanel);
			return;
		}

		let featuresHtml = '';
		for (const selectionId of selections) {
			const featureName = selectionId.split('_')[0];
			const feature = optionalFeatureService.getFeatureByName(featureName);

			if (feature) {
				let descriptionText = '';
				if (feature.entries && feature.entries.length > 0) {
					descriptionText = this._renderFeatureEntries(feature.entries);
				}

				featuresHtml += `
					<div class="feature-info-item mb-3 pb-2 border-bottom">
						<strong>${escapeHtml(feature.name)}</strong>
						<div class="text-muted small">Source: ${escapeHtml(feature.source)}</div>
						${descriptionText ? `<div class="mt-1">${descriptionText}</div>` : ''}
					</div>
				`;
			} else {
				featuresHtml += `<div class="feature-info-item mb-2"><strong>${escapeHtml(featureName)}</strong></div>`;
			}
		}

		const html = `
			<div class="info-section">
				<h5>${getFeatureIcon(featureType)} ${featureTypeName}</h5>
				<div class="mt-3">
					${featuresHtml}
				</div>
			</div>
		`;

		this._infoPanel.innerHTML = html;
		await textProcessor.processElement(this._infoPanel);
	}

	async _showASIInfo(item) {
		const level = parseInt(item.dataset.hoverLevel, 10);
		const featName = item.dataset.hoverFeat;

		if (featName) {
			const { featService } = await import('../../../services/FeatService.js');
			const feat = featService.getFeat(decodeURIComponent(featName));

			if (feat) {
				let prerequisiteText = '';
				if (feat.prerequisite) {
					const prereqs = Array.isArray(feat.prerequisite)
						? feat.prerequisite
						: [feat.prerequisite];
					prerequisiteText = prereqs
						.map((p) => {
							if (p.ability) {
								const abilities = Array.isArray(p.ability)
									? p.ability
									: [p.ability];
								return abilities
									.map((a) => {
										const entries = Object.entries(a);
										return entries
											.map(([k, v]) => `${attAbvToFull(k)} ${v}+`)
											.join(' or ');
									})
									.join(', ');
							}
							if (p.race)
								return `Race: ${p.race.map((r) => r.name).join(' or ')}`;
							if (p.spellcasting) return 'Spellcasting ability';
							return JSON.stringify(p);
						})
						.join('; ');
				}

				let entriesHtml = '';
				if (feat.entries) {
					entriesHtml = this._renderFeatureEntries(feat.entries);
				}

				const html = `
					<div class="info-section">
						<h5><i class="fas fa-scroll me-2"></i>${escapeHtml(feat.name)}</h5>
						<p class="text-muted small">Source: ${escapeHtml(feat.source)}</p>
						${prerequisiteText ? `<p><strong>Prerequisite:</strong> ${prerequisiteText}</p>` : ''}
						<div class="mt-3">
							${entriesHtml || '<p class="text-muted">No description available.</p>'}
						</div>
					</div>
				`;

				this._infoPanel.innerHTML = html;
				await textProcessor.processElement(this._infoPanel);
				return;
			}
		}

		const html = `
			<div class="info-section">
				<h5><i class="fas fa-arrow-up me-2"></i>Ability Score Improvement</h5>
				<p>At level ${level}, you can choose one of the following:</p>
				<ul class="mt-2">
					<li><strong>Ability Score Increase:</strong> Increase one ability score by 2, or two ability scores by 1 each (maximum 20).</li>
					<li><strong>Feat:</strong> Select a feat you qualify for instead of the ability score increase.</li>
				</ul>
			</div>
		`;

		this._infoPanel.innerHTML = html;
		await textProcessor.processElement(this._infoPanel);
	}

	async _showPassiveFeatureInfo(item) {
		const featureName = item.dataset.hoverFeatureName;
		const featureLevel = item.dataset.hoverFeatureLevel;
		const featureSource = item.dataset.hoverFeatureSource || 'PHB';

		const character = CharacterManager.getCurrentCharacter();
		const primaryClass = character?.getPrimaryClass();
		const className = primaryClass?.name;

		if (!className) return;

		const classFeatures = this._classService.getClassFeatures(
			className,
			parseInt(featureLevel, 10),
			featureSource,
		);
		const feature = classFeatures.find(
			(f) => f.name === featureName && f.level === parseInt(featureLevel, 10),
		);

		if (!feature) {
			this._infoPanel.innerHTML = `
				<div class="info-section">
					<h5><i class="fas fa-bookmark me-2"></i>${escapeHtml(featureName)}</h5>
					<p class="text-muted">Feature details not available.</p>
				</div>
			`;
			await textProcessor.processElement(this._infoPanel);
			return;
		}

		const entriesHtml = this._renderFeatureEntries(feature.entries);

		let sourceLine = `Source: ${feature.source || 'PHB'}`;
		if (feature.page) {
			sourceLine += `, p. ${feature.page}`;
		}

		const html = `
			<div class="info-section">
				<h5><i class="fas fa-bookmark me-2"></i>${escapeHtml(feature.name)}</h5>
				<p class="text-muted small">Level ${feature.level} Feature</p>
				<div class="mt-2">
					${entriesHtml || '<p class="text-muted">No description available.</p>'}
				</div>
				<p class="text-muted small mt-3">${escapeHtml(sourceLine)}</p>
			</div>
		`;

		this._infoPanel.innerHTML = html;
		await textProcessor.processElement(this._infoPanel);
	}

	_renderFeatureEntries(entries) {
		if (!entries) return '';
		if (!Array.isArray(entries)) entries = [entries];

		return entries
			.map((entry) => {
				if (typeof entry === 'string') {
					return `<p>${entry}</p>`;
				}
				if (entry.type === 'list' && entry.items) {
					return `<ul>${entry.items.map((i) => `<li>${typeof i === 'string' ? i : i.entry || ''}</li>`).join('')}</ul>`;
				}
				if (entry.type === 'entries' && entry.entries) {
					return `<div><strong>${entry.name || ''}</strong>${this._renderFeatureEntries(entry.entries)}</div>`;
				}
				if (entry.type === 'table') {
					return '';
				}
				if (entry.entries) {
					return this._renderFeatureEntries(entry.entries);
				}
				return '';
			})
			.join('');
	}

	_renderNoChoiceFeature(feature) {
		const firstString =
			feature.entries?.find((e) => typeof e === 'string') || '';
		return `
			<div class="passive-feature-item choice-item" data-hover-type="passive-feature"
				data-hover-feature-name="${feature.name}" data-hover-feature-level="${feature.level}"
				data-hover-feature-source="${feature.source || 'PHB'}">
				<div class="d-flex align-items-center mb-1">
					<i class="fas fa-bookmark me-2 u-text-accent"></i>
					<strong>${feature.name}</strong>
				</div>
				<div class="small text-muted">${firstString ? `<p>${firstString}</p>` : ''}</div>
			</div>
		`;
	}

	_getFeatureTypeName(type) {
		const names = {
			invocation: 'Eldritch Invocations',
			metamagic: 'Metamagic Options',
			maneuver: 'Battle Maneuvers',
			'fighting-style': 'Fighting Style',
			patron: 'Otherworldly Patron',
			other: 'Class Feature',
		};
		return names[type] || 'Class Feature';
	}
}

export function getFeatureIcon(type) {
	const icons = {
		invocation: '<i class="fas fa-fire"></i>',
		metamagic: '<i class="fas fa-hat-wizard"></i>',
		maneuver: '<i class="fas fa-fist-raised"></i>',
		'fighting-style': '<i class="fas fa-shield-alt"></i>',
		patron: '<i class="fas fa-handshake"></i>',
		spell: '<i class="fas fa-hat-wizard"></i>',
		subclass: '<i class="fas fa-star"></i>',
		asi: '<i class="fas fa-arrow-up"></i>',
		other: '<i class="fas fa-star"></i>',
	};
	return icons[type] || icons.other;
}
