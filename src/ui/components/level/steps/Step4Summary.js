/**
 * Step 4: Summary
 * 
 * Review all staged changes before applying.
 * Users can go back to edit any previous step.
 */

import { DOMCleanup } from '../../../../lib/DOMCleanup.js';
import { textProcessor } from '../../../../lib/TextProcessor.js';
import { levelUpService } from '../../../../services/LevelUpService.js';

export class Step4Summary {
    constructor(session, modal) {
        this.session = session;
        this.modal = modal;
        this._cleanup = DOMCleanup.create();
    }

    /**
     * Render the step HTML.
     */
    async render() {
        const summary = this.session.getChangeSummary();

        // Get all new features from the staged changes
        const allNewFeatures = await this._gatherAllClassFeatures();

        let html = `
            <div class="step-4-summary">
                <!-- Level Changes -->
                <div class="card mb-3">
                    <div class="card-header">
                        <h6 class="mb-0"><i class="fas fa-level-up-alt"></i> Level Changes</h6>
                    </div>
                    <div class="card-body">
                        <p class="mb-2">
                            <strong>Total Level:</strong> 
                            <span class="text-muted">${this.session.originalCharacter.level || 1}</span>
                            <i class="fas fa-arrow-right text-success mx-2"></i>
                            <span class="text-success">${this.session.stagedChanges.level}</span>
                        </p>
        `;

        if (summary.leveledClasses.length > 0) {
            html += '<div class="ms-3"><small class="text-muted">Classes leveled:</small><ul class="small mb-0">';
            summary.leveledClasses.forEach(change => {
                html += `
                    <li>
                        <strong>${change.name}:</strong> ${change.from} 
                        <i class="fas fa-arrow-right text-success"></i> 
                        ${change.to}
                    </li>
                `;
            });
            html += '</ul></div>';
        }

        html += `
                    </div>
                </div>
        `;

        // Ability Score Changes
        if (Object.keys(summary.changedAbilities).length > 0) {
            html += `
                <div class="card mb-3">
                    <div class="card-header">
                        <h6 class="mb-0"><i class="fas fa-dumbbell"></i> Ability Score Changes</h6>
                    </div>
                    <div class="card-body">
            `;

            Object.entries(summary.changedAbilities).forEach(([ability, change]) => {
                const sign = change.change > 0 ? '+' : '';
                html += `
                    <p class="mb-2">
                        <strong>${ability}:</strong> 
                        <span class="text-muted">${change.from}</span>
                        <i class="fas fa-arrow-right mx-2"></i>
                        <span class="text-success">${change.to} (${sign}${change.change})</span>
                    </p>
                `;
            });

            html += `
                    </div>
                </div>
            `;
        }

        // Class Features Section
        if (allNewFeatures.length > 0) {
            // Group features by class
            const featuresByClass = new Map();
            allNewFeatures.forEach(feature => {
                if (!featuresByClass.has(feature.class)) {
                    featuresByClass.set(feature.class, []);
                }
                featuresByClass.get(feature.class).push(feature);
            });

            const isMulticlass = featuresByClass.size > 1;

            html += `
                <div class="card mb-3">
                    <div class="card-header">
                        <h6 class="mb-0"><i class="fas fa-star"></i> New Class Features</h6>
                    </div>
                    <div class="card-body">
            `;

            // Render each class group
            featuresByClass.forEach((features, className) => {
                if (isMulticlass) {
                    html += `
                        <div class="mb-4">
                            <h6 class="mb-3 pb-2 border-bottom" style="font-weight: 600; color: var(--accent-color); border-color: var(--accent-color);">
                                <i class="fas fa-crown me-2" style="color: var(--accent-color);"></i>${this._escapeHtml(className)}
                            </h6>
                            <div class="feature-list traits-grid ms-2" id="featuresList_${this._escapeHtml(className)}">
                    `;
                } else {
                    html += `<div class="feature-list traits-grid" id="featuresList_${this._escapeHtml(className)}">`;
                }

                features.forEach((feature) => {
                    const escapedName = this._escapeHtml(feature.name);
                    // Build description from feature data
                    let description = '';
                    if (feature.entries && Array.isArray(feature.entries)) {
                        description = feature.entries
                            .filter(e => typeof e === 'string')
                            .map(e => `<p>${this._escapeHtml(e)}</p>`)
                            .join('');
                    } else if (feature.entry) {
                        description = `<p>${this._escapeHtml(feature.entry)}</p>`;
                    } else if (feature.description) {
                        description = `<p>${this._escapeHtml(feature.description)}</p>`;
                    }

                    // Add source info if available
                    if (feature.source) {
                        description += `<div class="tooltip-source">${this._escapeHtml(feature.source)}</div>`;
                    }

                    html += `
                        <a class="trait-tag rd__hover-link" 
                            data-hover-type="feature" 
                            data-hover-name="${escapedName}"
                            data-hover-content="${description.replace(/"/g, '&quot;')}">
                            ${escapedName}
                        </a>
                    `;
                });

                html += `</div>`;
                if (isMulticlass) {
                    html += `</div>`;
                }
            });

            html += `
                    </div>
                </div>
            `;
        }

        // ASI/Feat Summary
        if (summary.newASIs.length > 0) {
            html += `
                <div class="card mb-3">
                    <div class="card-header">
                        <h6 class="mb-0"><i class="fas fa-trophy"></i> Ability Score Improvements</h6>
                    </div>
                    <div class="card-body small">
            `;

            summary.newASIs.forEach((asi, index) => {
                if (asi.type === 'asi') {
                    const abilities = Object.entries(asi.abilities)
                        .map(([ab, val]) => `+${val} ${ab}`)
                        .join(', ');
                    html += `<p class="mb-1"><strong>Improvement ${index + 1}:</strong> ${abilities}</p>`;
                } else if (asi.type === 'feat') {
                    html += `<p class="mb-1"><strong>Feat ${index + 1}:</strong> ${asi.featName}</p>`;
                }
            });

            html += `
                    </div>
                </div>
            `;
        }

        // Spells Summary
        if (Object.keys(summary.newSpells).length > 0) {
            // Group spells by class (strip level from key)
            const spellsByClass = new Map();
            Object.entries(summary.newSpells).forEach(([classKey, spells]) => {
                // Extract class name (e.g., "Wizard_1" -> "Wizard")
                const className = classKey.split('_')[0];
                if (!spellsByClass.has(className)) {
                    spellsByClass.set(className, []);
                }
                spellsByClass.get(className).push(...spells);
            });

            const isMulticlass = spellsByClass.size > 1;

            html += `
                <div class="card mb-3">
                    <div class="card-header">
                        <h6 class="mb-0"><i class="fas fa-magic"></i> New Spells</h6>
                    </div>
                    <div class="card-body">
            `;

            spellsByClass.forEach((spells, className) => {
                if (spells.length > 0) {
                    const safeClassName = this._escapeHtml(className);

                    if (isMulticlass) {
                        html += `
                            <div class="mb-4">
                                <h6 class="mb-3 pb-2 border-bottom" style="font-weight: 600; color: var(--accent-color); border-color: var(--accent-color);">
                                    <i class="fas fa-magic me-2" style="color: var(--accent-color);"></i>${safeClassName}
                                </h6>
                                <div class="feature-list traits-grid ms-2" id="spellsList_${safeClassName}">
                        `;
                    } else {
                        html += `<div class="feature-list traits-grid" id="spellsList_${safeClassName}">`;
                    }

                    spells.forEach(spell => {
                        const spellName = typeof spell === 'string' ? spell : spell.name;
                        const escapedName = this._escapeHtml(spellName);
                        html += `
                            <a class="trait-tag rd__hover-link" 
                                data-hover-type="spell" 
                                data-hover-name="${escapedName}">
                                ${escapedName}
                            </a>
                        `;
                    });

                    html += `</div>`;
                    if (isMulticlass) {
                        html += `</div>`;
                    }
                }
            });

            html += `
                    </div>
                </div>
            `;
        }

        html += `
                <!-- Info Message -->   
            </div>
        `;

        return html;
    }

    /**
     * Attach event listeners.
     */
    async attachListeners(contentArea) {
        console.debug('[Step4]', 'Attaching listeners');

        // Process all feature lists with textProcessor for hover links
        const featureLists = contentArea.querySelectorAll('[id^="featuresList_"]');
        for (const list of featureLists) {
            await textProcessor.processElement(list);
        }

        // Process all spell lists with textProcessor for hover links
        const spellLists = contentArea.querySelectorAll('[id^="spellsList_"]');
        for (const list of spellLists) {
            await textProcessor.processElement(list);
        }
    }

    /**
     * Gather all new class features for the leveled classes.
     * Only includes features gained at the newly acquired levels.
     * Also includes subclass features if a subclass was selected.
     * @private
     */
    async _gatherAllClassFeatures() {
        const features = [];
        const summary = this.session.getChangeSummary();
        const seenFeatures = new Set(); // Track by class+name to avoid duplicates

        // For each class that was leveled up
        if (!summary.leveledClasses || summary.leveledClasses.length === 0) {
            return [];
        }

        for (const classChange of summary.leveledClasses) {
            const { name: className, from: fromLevel, to: toLevel } = classChange;
            const startLevel = fromLevel || 0;

            // Get class features for each newly gained level only
            for (let level = startLevel + 1; level <= toLevel; level++) {
                const allLevelFeatures = levelUpService.getClassFeaturesForLevel(className, level);

                if (Array.isArray(allLevelFeatures)) {
                    // Filter to only features that are exactly at this level (not from lower levels)
                    const newLevelFeatures = allLevelFeatures.filter(f => f?.level === level);

                    newLevelFeatures.forEach(feature => {
                        if (feature?.name) {
                            const key = `${className}_${feature.name}`;

                            // Deduplicate by class+name
                            if (!seenFeatures.has(key)) {
                                seenFeatures.add(key);
                                features.push({
                                    name: feature.name,
                                    class: className,
                                    level,
                                    entries: feature.entries || feature.description,
                                    description: feature.description,
                                    source: feature.source,
                                    entry: feature.entry,
                                    type: 'class'
                                });
                            }
                        }
                    });
                }
            }

            // Get subclass features if applicable
            let selectedSubclass = this.session.stepData?.selectedSubclasses?.[className];

            // If no newly selected subclass, check if character already has one for this class
            if (!selectedSubclass) {
                const classProgression = this.session.stagedChanges?.progression?.classes?.find(c => c.name === className);
                selectedSubclass = classProgression?.subclass;
            }

            if (selectedSubclass) {
                for (let level = startLevel + 1; level <= toLevel; level++) {
                    // Get subclass features using LevelUpService
                    const subclassFeatures = await levelUpService.getSubclassFeaturesForLevel?.(className, selectedSubclass, level);

                    if (Array.isArray(subclassFeatures)) {
                        // Filter to only features at this exact level
                        const newLevelFeatures = subclassFeatures.filter(f => f?.level === level);

                        newLevelFeatures.forEach(feature => {
                            if (feature?.name) {
                                const key = `${className}_${selectedSubclass}_${feature.name}`;

                                // Deduplicate
                                if (!seenFeatures.has(key)) {
                                    seenFeatures.add(key);
                                    features.push({
                                        name: feature.name,
                                        class: className,
                                        level,
                                        entries: feature.entries || feature.description,
                                        description: feature.description,
                                        source: feature.source,
                                        entry: feature.entry,
                                        type: 'subclass'
                                    });
                                }
                            }
                        });
                    }
                }
            }
        }

        return features;
    }

    /**
     * Escape HTML special characters for safe display in tooltips.
     * @private
     */
    _escapeHtml(text) {
        if (!text) return '';
        const str = String(text); // Convert to string if not already
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return str.replace(/[&<>"']/g, m => map[m]);
    }
}
