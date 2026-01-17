/**
 * Step 3: Class
 * 
 * User selects character class and subclass.
 */

import { DOMCleanup } from '../../../../lib/DOMCleanup.js';
import { textProcessor } from '../../../../lib/TextProcessor.js';
import { classService } from '../../../../services/ClassService.js';
import { sourceService } from '../../../../services/SourceService.js';

export class Step3Class {
    constructor(session, modal) {
        this.session = session;
        this.modal = modal;
        this._cleanup = DOMCleanup.create();
        this._classService = classService;
    }

    /**
     * Render the step HTML.
     */
    async render() {
        return `
            <div class="step-3-class">
                <div class="card">
                    <div class="card-header">
                        <i class="fas fa-hat-wizard"></i> Class Selection
                    </div>
                    <div class="card-body">
                        <div class="row g-3 mb-3">
                            <div class="col-md-6">
                                <label for="modalClassSelect" class="form-label">Class</label>
                                <select class="form-select" id="modalClassSelect">
                                    <option value="">Select a Class</option>
                                </select>
                            </div>
                            <div class="col-md-6">
                                <label for="modalSubclassSelect" class="form-label">Subclass</label>
                                <select class="form-select" id="modalSubclassSelect" disabled>
                                    <option value="">No Subclasses</option>
                                </select>
                            </div>
                        </div>
                        
                        <div id="modalClassDetails">
                            <div class="row g-3">
                                <div class="col-md-6">
                                    <div class="detail-section">
                                        <h6>Hit Die</h6>
                                        <ul id="modalHitDie">
                                            <li class="placeholder-text">—</li>
                                        </ul>
                                    </div>
                                </div>
                                <div class="col-md-6">
                                    <div class="detail-section">
                                        <h6>Primary Ability</h6>
                                        <ul id="modalPrimaryAbility">
                                            <li class="placeholder-text">—</li>
                                        </ul>
                                    </div>
                                </div>
                                <div class="col-md-6">
                                    <div class="detail-section">
                                        <h6>Saving Throws</h6>
                                        <ul id="modalSavingThrows">
                                            <li class="placeholder-text">—</li>
                                        </ul>
                                    </div>
                                </div>
                                <div class="col-md-6">
                                    <div class="detail-section">
                                        <h6>Armor & Weapons</h6>
                                        <ul id="modalArmorWeapons">
                                            <li class="placeholder-text">—</li>
                                        </ul>
                                    </div>
                                </div>
                                <div class="col-md-12">
                                    <div class="traits-section">
                                        <h6>Class Features</h6>
                                        <div class="traits-grid" id="modalFeatures">
                                            <span class="trait-tag">No features available</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Attach event listeners to rendered content.
     */
    async attachListeners(contentArea) {
        console.debug('[Step3Class]', 'Attaching listeners');

        this._classSelect = contentArea.querySelector('#modalClassSelect');
        this._subclassSelect = contentArea.querySelector('#modalSubclassSelect');

        // Initialize class service first
        await this._classService.initialize();

        // Restore allowed sources from session if available
        const savedSources = this.session.get('allowedSources');
        if (savedSources && savedSources instanceof Set && savedSources.size > 0) {
            // Update sourceService with saved sources
            const currentSources = sourceService.getAllowedSources();
            for (const source of currentSources) {
                if (source !== 'PHB' && !savedSources.has(source)) {
                    sourceService.removeAllowedSource(source);
                }
            }
            for (const source of savedSources) {
                sourceService.addAllowedSource(source);
            }
        }

        // Populate class dropdown
        await this._populateClassSelect();

        // Restore saved selection if available
        const savedClass = this.session.get('class');
        if (savedClass?.name && savedClass?.source) {
            const classValue = `${savedClass.name}_${savedClass.source}`;
            this._classSelect.value = classValue;
            await this._handleClassChange({ target: { value: classValue } });

            // Restore subclass if available
            if (savedClass.subclass) {
                setTimeout(() => {
                    this._subclassSelect.value = savedClass.subclass;
                    this._handleSubclassChange({ target: { value: savedClass.subclass } });
                }, 100);
            }
        }

        // Attach event listeners
        this._cleanup.on(this._classSelect, 'change', (e) => this._handleClassChange(e));
        this._cleanup.on(this._subclassSelect, 'change', (e) => this._handleSubclassChange(e));

        // Store reference to features grid for tooltip processing
        this._featuresGrid = contentArea.querySelector('#modalFeatures');
    }

    /**
     * Get the level at which a class gains its subclass.
     * @private
     */
    _getSubclassLevel(classData) {
        if (!classData?.classFeatures) return null;

        // Find the first classFeature with gainSubclassFeature flag
        for (const feature of classData.classFeatures) {
            if (feature.gainSubclassFeature === true) {
                // Parse level from classFeature string format: "Feature Name|ClassName||Level"
                const parts = feature.classFeature.split('|');
                const level = parseInt(parts[parts.length - 1]);
                return Number.isNaN(level) ? null : level;
            }
        }

        return null;
    }

    async _populateClassSelect() {
        const classes = this._classService.getAllClasses();
        if (!classes || classes.length === 0) {
            console.error('[Step3Class]', 'No classes available');
            return;
        }

        // Filter by allowed sources
        const filteredClasses = classes.filter(cls =>
            sourceService.isSourceAllowed(cls.source)
        );

        // Sort by name
        const sortedClasses = [...filteredClasses].sort((a, b) =>
            a.name.localeCompare(b.name)
        );

        // Populate select
        for (const cls of sortedClasses) {
            const option = document.createElement('option');
            option.value = `${cls.name}_${cls.source}`;
            option.textContent = `${cls.name} (${cls.source})`;
            this._classSelect.appendChild(option);
        }
    }

    async _populateSubclassSelect(classData) {
        this._subclassSelect.innerHTML = '<option value="">No Subclasses</option>';
        this._subclassSelect.disabled = true;

        if (!classData) return;

        // Get the level at which this class gains its subclass
        const subclassLevel = this._getSubclassLevel(classData);

        // Only enable subclass selection for classes that get their subclass at level 1
        if (!subclassLevel || subclassLevel > 1) {
            this._subclassSelect.innerHTML = `<option value="">Available at level ${subclassLevel || '?'}</option>`;
            return;
        }

        const subclasses = this._classService.getSubclasses(classData.name, classData.source);
        if (!subclasses || subclasses.length === 0) return;

        // Filter and sort
        const filteredSubclasses = subclasses.filter(subclass => {
            const subclassSource = subclass.source || classData.source;
            return subclass.name && subclass.name.trim() !== '' &&
                sourceService.isSourceAllowed(subclassSource);
        });

        if (filteredSubclasses.length === 0) return;

        // Subclasses are required at level 1 for these classes
        this._subclassSelect.innerHTML = '<option value="">Select Subclass</option>';
        this._subclassSelect.disabled = false;

        const sortedSubclasses = [...filteredSubclasses].sort((a, b) =>
            a.name.localeCompare(b.name)
        );

        for (const subclass of sortedSubclasses) {
            const option = document.createElement('option');
            option.value = subclass.name;
            option.textContent = subclass.name;
            this._subclassSelect.appendChild(option);
        }
    }

    async _handleClassChange(event) {
        const [className, source] = event.target.value.split('_');

        if (!className || !source) {
            this._resetDetails();
            await this._populateSubclassSelect(null);
            return;
        }

        const classData = this._classService.getClass(className, source);
        if (!classData) {
            console.error('[Step3Class]', `Class not found: ${className} (${source})`);
            return;
        }

        // Update UI
        this._updateDetails(classData);
        await this._populateSubclassSelect(classData);
    }

    async _handleSubclassChange(_event) {
        const classValue = this._classSelect.value;
        const [className, source] = classValue.split('_');

        if (!className || !source) return;

        const classData = this._classService.getClass(className, source);
        if (!classData) return;

        // For now, just update features if a subclass is selected
        // Full subclass feature integration can be added later
        this._updateDetails(classData);
    }

    _updateDetails(classData) {
        this._updateHitDie(classData);
        this._updatePrimaryAbility(classData);
        this._updateSavingThrows(classData);
        this._updateArmorWeapons(classData);
        this._updateFeatures(classData);
    }

    _updateHitDie(classData) {
        const section = document.getElementById('modalHitDie');
        if (classData?.hd?.number && classData?.hd?.faces) {
            section.innerHTML = `<li>d${classData.hd.faces}</li>`;
        } else {
            section.innerHTML = '<li class="placeholder-text">—</li>';
        }
    }

    _updatePrimaryAbility(classData) {
        const section = document.getElementById('modalPrimaryAbility');
        const abilities = [];

        // Check for spellcasting ability (for casters)
        if (classData?.spellcastingAbility) {
            abilities.push(classData.spellcastingAbility.toUpperCase());
        }

        // Check multiclassing prerequisites which indicate primary abilities
        if (classData?.multiclassing?.requirements) {
            const reqs = classData.multiclassing.requirements;
            for (const [ability, value] of Object.entries(reqs)) {
                if (typeof value === 'number' && value >= 13) {
                    abilities.push(ability.toUpperCase());
                }
            }
        }

        if (abilities.length === 0) {
            section.innerHTML = '<li class="placeholder-text">—</li>';
        } else {
            const uniqueAbilities = [...new Set(abilities)];
            section.innerHTML = `<li>${uniqueAbilities.join(' or ')}</li>`;
        }
    }

    _updateSavingThrows(classData) {
        const section = document.getElementById('modalSavingThrows');
        const saves = classData?.proficiency || [];

        if (saves.length === 0) {
            section.innerHTML = '<li class="placeholder-text">—</li>';
        } else {
            section.innerHTML = `<li>${saves.join(', ')}</li>`;
        }
    }

    _updateArmorWeapons(classData) {
        const section = document.getElementById('modalArmorWeapons');
        const profs = [];

        if (classData?.startingProficiencies?.armor) {
            for (const armor of classData.startingProficiencies.armor) {
                if (typeof armor === 'string') {
                    profs.push(armor);
                } else if (armor.full) {
                    profs.push(armor.full);
                }
            }
        }

        if (classData?.startingProficiencies?.weapons) {
            for (const weapon of classData.startingProficiencies.weapons) {
                if (typeof weapon === 'string') {
                    profs.push(weapon);
                } else if (weapon.full) {
                    profs.push(weapon.full);
                }
            }
        }

        if (profs.length === 0) {
            section.innerHTML = '<li>None</li>';
        } else {
            section.innerHTML = `<li>${profs.join(', ')}</li>`;
        }
    }

    async _updateFeatures(classData) {
        if (!this._featuresGrid) return;

        // Get level 1 features from ClassService
        const features = this._classService.getClassFeatures(classData.name, 1, classData.source);

        if (!features || features.length === 0) {
            this._featuresGrid.innerHTML = '<span class="trait-tag">No features available</span>';
        } else {
            // Build feature tags with hover tooltips
            const featureTags = features.map(feature => {
                const escapedName = this._escapeHtml(feature.name || 'Unknown Feature');

                // Build description from entries
                let description = '';
                if (feature.entries && Array.isArray(feature.entries)) {
                    description = feature.entries
                        .filter(e => typeof e === 'string')
                        .map(e => `<p>${this._escapeHtml(e)}</p>`)
                        .join('');
                }

                return `
                    <a class="trait-tag rd__hover-link" 
                        data-hover-type="feature" 
                        data-hover-name="${escapedName}"
                        data-hover-content="${description.replace(/"/g, '&quot;')}">
                        ${escapedName}
                    </a>
                `;
            }).join('');

            this._featuresGrid.innerHTML = featureTags;

            // Process with textProcessor for tooltips
            await textProcessor.processElement(this._featuresGrid);
        }
    }

    _resetDetails() {
        document.getElementById('modalHitDie').innerHTML = '<li class="placeholder-text">—</li>';
        document.getElementById('modalPrimaryAbility').innerHTML = '<li class="placeholder-text">—</li>';
        document.getElementById('modalSavingThrows').innerHTML = '<li class="placeholder-text">—</li>';
        document.getElementById('modalArmorWeapons').innerHTML = '<li class="placeholder-text">—</li>';
        if (this._featuresGrid) {
            this._featuresGrid.innerHTML = '<span class="trait-tag">No features available</span>';
        }
    }

    /**
     * Validate step data.
     */
    async validate() {
        const classValue = this._classSelect?.value;
        if (!classValue) {
            console.warn('[Step3Class]', 'No class selected');
            return false;
        }

        // Check if subclass is required based on the class's subclass level
        const [className, source] = classValue.split('_');
        const classData = this._classService.getClass(className, source);

        if (classData) {
            const subclassLevel = this._getSubclassLevel(classData);

            // If the class gets its subclass at level 1, require selection
            if (subclassLevel === 1) {
                const subclassValue = this._subclassSelect?.value;
                if (!subclassValue) {
                    console.warn('[Step3Class]', 'Subclass required for', className, 'at level 1');
                    return false;
                }
            }
        }

        return true;
    }

    /**
     * Save step data to session.
     */
    async save() {
        const classValue = this._classSelect?.value;
        if (!classValue) {
            this.session.set('class', null);
            return;
        }

        const [className, source] = classValue.split('_');
        const subclassValue = this._subclassSelect?.value || '';

        this.session.set('class', {
            name: className,
            source,
            subclass: subclassValue
        });

        console.debug('[Step3Class]', 'Saved class data:', this.session.get('class'));
    }

    /**
     * Escape HTML special characters for safe display in tooltips.
     * @private
     */
    _escapeHtml(text) {
        if (!text) return '';
        const str = String(text);
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return str.replace(/[&<>"']/g, m => map[m]);
    }

    /**
     * Clean up resources.
     */
    cleanup() {
        this._cleanup.cleanup();
    }
}
