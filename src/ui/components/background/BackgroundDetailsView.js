// BackgroundDetailsView.js
// Proficiencies, equipment, features display for background info panel

import {
    toSentenceCase,
    toTitleCase,
    unpackUid,
} from '../../../lib/5eToolsParser.js';

export class BackgroundDetailsView {
    async generateDetailsHTML(background) {
        if (!background) return '';

        let html = '';

        // Skills section - only show if background has skills
        const skillsHtml = this._formatSkillProficiencies(background);
        if (skillsHtml && skillsHtml !== 'None') {
            html += `
				<div class="detail-section mb-2">
					<h6 class="small mb-1"><strong>Skills</strong></h6>
					<div class="small text-muted">${skillsHtml}</div>
				</div>
			`;
        }

        // Tools section - only show if background has tools
        const toolsHtml = this._formatToolProficiencies(background);
        if (toolsHtml && toolsHtml !== 'None') {
            html += `
				<div class="detail-section mb-2">
					<h6 class="small mb-1"><strong>Tools</strong></h6>
					<div class="small text-muted">${toolsHtml}</div>
				</div>
			`;
        }

        // Languages section - only show if background has languages
        const languagesHtml = this._formatLanguages(background);
        if (languagesHtml && languagesHtml !== 'None') {
            html += `
				<div class="detail-section mb-2">
					<h6 class="small mb-1"><strong>Languages</strong></h6>
					<div class="small text-muted">${languagesHtml}</div>
				</div>
			`;
        }

        // Equipment section - only show if background has equipment
        const equipmentHtml = this._formatEquipment(background);
        if (equipmentHtml && equipmentHtml !== 'None') {
            html += `
				<div class="detail-section mb-2">
					<h6 class="small mb-1"><strong>Equipment</strong></h6>
					<div class="small text-muted">${equipmentHtml}</div>
				</div>
			`;
        }

        // Feature section - only show if background has a feature
        const feature = this._extractFeature(background);
        if (feature) {
            html += `
				<div class="detail-section mb-2">
					<h6 class="small mb-1"><strong>Feature</strong></h6>
					<div class="small text-muted"><strong>${feature.name}:</strong> ${feature.description}</div>
				</div>
			`;
        }

        return html;
    }

    _formatSkillProficiencies(background) {
        if (!background?.proficiencies?.skills) return 'None';

        // 5etools uses normalized structure: proficiencies.skills = [{skill: "...", optional: bool}]
        const skills = background.proficiencies.skills
            .map((prof) => {
                if (prof.choose) {
                    return `Choose ${prof.choose.count || 1} from: ${prof.choose.from?.map(toTitleCase).join(', ') || 'any'}`;
                }
                return toTitleCase(prof.skill || prof);
            })
            .filter(Boolean);

        return skills.join(', ') || 'None';
    }

    _formatToolProficiencies(background) {
        if (!background?.proficiencies?.tools) return 'None';

        // 5etools uses normalized structure: proficiencies.tools = [{tool: "...", optional: bool}]
        const tools = background.proficiencies.tools
            .map((prof) => {
                if (prof.choose) {
                    return `Choose ${prof.choose.count || 1} tool${prof.choose.count > 1 ? 's' : ''}`;
                }
                return toSentenceCase(prof.tool || prof);
            })
            .filter(Boolean);

        return tools.join(', ') || 'None';
    }

    _formatLanguages(background) {
        if (!background?.proficiencies?.languages) return 'None';

        // 5etools uses normalized structure: proficiencies.languages = [{language: "...", optional: bool}]
        const languages = background.proficiencies.languages
            .map((prof) => {
                if (prof.choose) {
                    const count = prof.choose.count || 1;
                    const suffix =
                        prof.choose.type === 'anystandard'
                            ? ' (standard)'
                            : prof.choose.type === 'any'
                                ? ' (any)'
                                : '';
                    return `Choose ${count} language${count > 1 ? 's' : ''}${suffix}`;
                }
                return prof.language || prof;
            })
            .filter(Boolean);

        return languages.join(', ') || 'None';
    }

    _formatEquipment(background) {
        if (!background?.equipment) return 'None';

        const equipment = [];

        for (const eq of background.equipment) {
            // Detect choice entries: keys other than '_' (fixed equipment)
            const choiceKeys = Object.keys(eq).filter(k => k !== '_').sort();

            // Render fixed items under the '_' key
            if (eq._ && Array.isArray(eq._)) {
                equipment.push(this._formatEquipmentList(eq._));
            }

            // Render choice items
            if (choiceKeys.length > 1) {
                const parts = choiceKeys.map(k =>
                    `(${k}) ${this._formatEquipmentList(eq[k])}`,
                );
                equipment.push(parts.join(' or '));
            } else if (choiceKeys.length === 0 && !eq._) {
                // Plain item or array with no choice keys and no fixed key
                if (Array.isArray(eq)) {
                    equipment.push(this._formatEquipmentList(eq));
                } else {
                    equipment.push(this._formatSingleEquipment(eq));
                }
            }
        }

        return equipment.join('; ') || 'None';
    }

    _formatEquipmentList(items) {
        return items.map((item) => this._formatSingleEquipment(item)).join(', ');
    }

    _formatSingleEquipment(item) {
        if (typeof item === 'string') {
            const parsed = unpackUid(item);
            return parsed?.name || item;
        }

        // Standalone currency value (e.g. { value: 5000 } → "50 GP")
        if (item.value != null && !item.item && !item.special) {
            return this._formatCurrencyValue(item.value);
        }

        // Equipment type placeholder (e.g. { equipmentType: "toolArtisan" })
        if (item.equipmentType) {
            const typeLabels = {
                toolArtisan: "Artisan's Tools (any)",
                instrumentMusical: 'Musical Instrument (any)',
                setGaming: 'Gaming Set (any)',
            };
            return typeLabels[item.equipmentType] || toSentenceCase(item.equipmentType);
        }

        const qty = item.quantity ? `${item.quantity}x ` : '';
        const itemRef = item.item || '';
        let name =
            item.displayName ||
            (itemRef ? unpackUid(itemRef).name : '') ||
            item.name ||
            item.special ||
            '';

        // Append contained gold (e.g. pouch containing 15 GP)
        if (item.containsValue) {
            const gp = Math.floor(item.containsValue / 100);
            name += ` (containing ${gp} GP)`;
        }

        return `${qty}${name}`.trim();
    }

    _formatCurrencyValue(copperValue) {
        if (copperValue >= 100 && copperValue % 100 === 0) return `${copperValue / 100} GP`;
        if (copperValue >= 10 && copperValue % 10 === 0) return `${copperValue / 10} SP`;
        return `${copperValue} CP`;
    }

    _extractFeature(background) {
        if (!background?.entries) return null;

        // 5etools typically marks features in entries array
        const featureEntry = background.entries.find(
            (entry) =>
                entry.name?.toLowerCase().includes('feature') || entry.data?.isFeature,
        );

        if (!featureEntry) return null;

        const description = Array.isArray(featureEntry.entries)
            ? featureEntry.entries
                .map((e) => (typeof e === 'string' ? e : ''))
                .filter(Boolean)
                .join(' ')
            : featureEntry.entry || '';

        // Truncate description for compact display
        const truncated = description.substring(0, 150);

        return {
            name: featureEntry.name || 'Feature',
            description: truncated + (description.length > 150 ? '...' : ''),
        };
    }
}
