import { DOMCleanup } from '../../../../lib/DOMCleanup.js';
import { classService } from '../../../../services/ClassService.js';
import { levelUpService } from '../../../../services/LevelUpService.js';
import { sourceService } from '../../../../services/SourceService.js';

/**
 * Step 1: Class Features
 * 
 * Review and select class features gained at this level.
 * Handles interactive selection for features like Metamagic, Maneuvers,
 * Fighting Styles, Invocations, and other class-specific choices.
 */

export class Step1ClassFeatures {
    constructor(session, modal) {
        this.session = session;
        this.modal = modal;
        this._cleanup = DOMCleanup.create();

        // Initialize step data if not present
        if (!this.session.stepData.selectedFeatures) {
            this.session.stepData.selectedFeatures = {};
        }
        if (!this.session.stepData.selectedSubclasses) {
            this.session.stepData.selectedSubclasses = {};
        }
    }

    async render() {
        // Get leveled classes from change summary
        const summary = this.session.getChangeSummary();

        // Get original character's subclass info
        const original = this.session.originalCharacter;
        const originalSubclassesByClass = new Map();
        if (original?.progression?.classes) {
            original.progression.classes.forEach(cls => {
                originalSubclassesByClass.set(cls.name, cls.subclass);
            });
        }

        // Map leveled classes with subclass info
        const leveledClasses = summary.leveledClasses.map(lc => ({
            name: lc.name,
            newLevel: lc.to,
            oldLevel: lc.from,
            subclass: originalSubclassesByClass.get(lc.name) // Get current subclass
        }));

        // Check if any class needs subclass selection at new levels
        const subclassPrompts = await this._gatherSubclassPrompts(leveledClasses);

        // Render subclass selection UI if needed
        let html = `
            <div class="step-1-class-features">
                <h5 class="mb-3"><i class="fas fa-tasks"></i> Class Features</h5>
        `;

        if (subclassPrompts.length > 0) {
            html += `
                <div class="card mb-3">
                    <div class="card-header">
                        <h6 class="mb-0"><i class="fas fa-wand-magic"></i> Subclass Selection</h6>
                    </div>
                    <div class="card-body">
            `;

            for (const prompt of subclassPrompts) {
                html += this._renderSubclassSelection(prompt);
            }

            html += `
                    </div>
                </div>
            `;
        }

        // Collect all features for newly gained levels
        const allFeatures = await this._gatherFeaturesForLevel(leveledClasses);

        // Filter to only choice features (those with options)
        const features = allFeatures.filter(f => f.options && Array.isArray(f.options));

        if (features.length === 0 && subclassPrompts.length === 0) {
            return `${html}
                <div class="alert alert-info mb-0">
                    <i class="fas fa-info-circle"></i>
                    No feature choices available at this level for your selected classes.
                </div>
            </div>`;
        }

        if (features.length > 0) {
            html += `
                <div class="alert alert-info small mb-3">
                    <i class="fas fa-info-circle"></i>
                    Review and make any required feature selections for your new level(s).
                </div>
            `;

            // Render each feature choice
            for (const feature of features) {
                html += this._renderFeatureChoice(feature);
            }
        }

        html += `
            </div>
        `;

        return html;
    }

    /**
     * Gather classes that need subclass selection at their new levels
     */
    async _gatherSubclassPrompts(leveledClasses) {
        const prompts = [];

        for (const classInfo of leveledClasses) {
            const classData = classService.getClass(classInfo.name);
            if (!classData) continue;

            // Check each newly gained level for subclass unlock
            const startLevel = classInfo.oldLevel || 0;
            for (let level = startLevel + 1; level <= classInfo.newLevel; level++) {
                // Most classes unlock subclass at level 3, but check the data
                const subclassLevel = classData.subclassTitle?.substring(0, 2) || '3';
                const unlockLevel = parseInt(subclassLevel, 10) || 3;

                if (level === unlockLevel && !classInfo.subclass) {
                    // This is when the character should select a subclass
                    const allSubclasses = classService.getSubclasses(classInfo.name);

                    // Filter subclasses by allowed sources
                    const availableSubclasses = allSubclasses.filter((sc) => {
                        // Prefer explicit subclass source, then generic source, and only then classSource
                        const subclassSource = sc.subclassSource || sc.source || sc.classSource;
                        return sourceService.isSourceAllowed(subclassSource);
                    });

                    if (availableSubclasses.length > 0) {
                        prompts.push({
                            className: classInfo.name,
                            level,
                            availableSubclasses,
                            selected: this.session.stepData.selectedSubclasses[classInfo.name] || null
                        });
                    }
                }
            }
        }

        return prompts;
    }

    /**
     * Render subclass selection dropdown
     */
    _renderSubclassSelection(prompt) {
        const selectId = `subclass_${prompt.className}_${prompt.level}`;
        const selected = prompt.selected || '';

        let html = `
            <div class="mb-3">
                <label for="${selectId}" class="form-label">
                    <strong>${prompt.className}</strong> Subclass Selection (Level ${prompt.level})
                </label>
                <select class="form-select" id="${selectId}" data-class-name="${prompt.className}">
                    <option value="">-- Select a ${prompt.className} Subclass --</option>
        `;

        prompt.availableSubclasses.forEach(subclass => {
            const isSelected = selected === (subclass.shortName || subclass.name) ? 'selected' : '';
            html += `
                    <option value="${subclass.shortName || subclass.name}" ${isSelected}>
                        ${subclass.name}
                    </option>
            `;
        });

        html += `
                </select>
            </div>
        `;

        return html;
    }

    attachListeners(contentArea) {
        // Attach listeners for subclass selection
        const subclassSelects = contentArea.querySelectorAll('select[data-class-name]');
        subclassSelects.forEach(select => {
            this._cleanup.on(select, 'change', (e) => {
                const className = e.target.dataset.className;
                const selectedValue = e.target.value;
                this.session.stepData.selectedSubclasses[className] = selectedValue;
            });
        });

        // Clear and recreate listeners for radio buttons and option buttons
        const radioButtons = contentArea.querySelectorAll('input[type="radio"][data-feature-choice]');

        radioButtons.forEach(radio => {
            this._cleanup.on(radio, 'change', (e) => {
                const featureId = radio.dataset.featureId;
                const selectedValue = radio.value;

                // Store selection in session
                this.session.stepData.selectedFeatures[featureId] = selectedValue;

                // Visual feedback - highlight chosen option
                const choiceGroup = contentArea.querySelector(`[data-feature-group="${featureId}"]`);
                if (choiceGroup) {
                    const cards = choiceGroup.querySelectorAll('.feature-option-card');
                    cards.forEach((card) => {
                        card.classList.remove('selected');
                    });
                    e.target.closest('.feature-option-card')?.classList.add('selected');
                }
            });
        });

        // Restore previous selections
        Object.entries(this.session.stepData.selectedFeatures).forEach(([featureId, value]) => {
            const radio = contentArea.querySelector(
                `input[type="radio"][data-feature-id="${featureId}"][value="${value}"]`
            );
            if (radio) {
                radio.checked = true;
                radio.closest('.feature-option-card')?.classList.add('selected');
            }
        });
    }

    /**
     * Gather features that should be displayed at this level
     */
    async _gatherFeaturesForLevel(leveledClasses) {
        const features = [];

        for (const classInfo of leveledClasses) {
            const classData = classService.getClass(classInfo.name);
            if (!classData) continue;

            // Get subclass from session if user selected one, otherwise use current
            let subclass = classInfo.subclass;
            if (this.session.stepData.selectedSubclasses[classInfo.name]) {
                const selectedSubclassName = this.session.stepData.selectedSubclasses[classInfo.name];
                subclass = classService.getSubclass(classInfo.name, selectedSubclassName);
            }

            // Get features for each newly gained level
            const startLevel = classInfo.oldLevel || 0;
            for (let level = startLevel + 1; level <= classInfo.newLevel; level++) {
                // Get custom interactive features (primary source for UI)
                const levelFeatures = await this._getClassFeaturesAtLevel(
                    classData,
                    subclass,
                    level
                );

                // Optionally fetch additional service features (informational only)
                try {
                    const serviceFeatures = levelUpService.getClassFeaturesForLevel(classInfo.name, level);
                    if (serviceFeatures && Array.isArray(serviceFeatures)) {
                        serviceFeatures.forEach(f => {
                            if (f && typeof f === 'object') {
                                levelFeatures.push({
                                    ...f,
                                    class: classInfo.name,
                                    gainLevel: level,
                                    fromService: true
                                });
                            }
                        });
                    }
                } catch (err) {
                    console.warn('[Step1]', 'Failed to fetch service features, continuing with custom features', err);
                }

                levelFeatures.forEach(feat => {
                    feat.class = classInfo.name;
                    feat.gainLevel = level;
                });

                features.push(...levelFeatures);
            }
        }

        return features;
    }

    /**
     * Get feature choices for a specific class and level
     */
    async _getClassFeaturesAtLevel(classData, subclass, level) {
        const features = [];

        // Check class table for features at this level
        if (classData.classTableGroups) {
            for (const group of classData.classTableGroups) {
                const row = group.rows?.[level - 1];
                if (!row) continue;

                // Look for feature entries in this row
                if (row.feature) {
                    const featureEntry = typeof row.feature === 'string'
                        ? { name: row.feature, entry: row.feature }
                        : row.feature;

                    // Check if this is a choice feature (Metamagic, Maneuvers, etc.)
                    if (this._isChoiceFeature(featureEntry)) {
                        features.push({
                            id: `${group.title}_${level}`,
                            name: featureEntry.name || group.title,
                            type: this._getFeatureType(featureEntry),
                            options: await this._getFeatureOptions(featureEntry, subclass),
                            required: !featureEntry.optional,
                            description: featureEntry.entry
                        });
                    }
                }
            }
        }

        return features;
    }

    /**
     * Determine if a feature requires user selection
     */
    _isChoiceFeature(feature) {
        if (!feature) return false;

        const name = (feature.name || '').toLowerCase();
        const keywords = ['choose', 'select', 'option', 'metamagic', 'maneuver',
            'invocation', 'fighting style', 'patron', 'circle'];

        return keywords.some(kw => name.includes(kw));
    }

    /**
     * Get the feature type for categorization
     */
    _getFeatureType(feature) {
        const name = (feature.name || '').toLowerCase();

        if (name.includes('metamagic')) return 'metamagic';
        if (name.includes('maneuver')) return 'maneuver';
        if (name.includes('invocation')) return 'invocation';
        if (name.includes('fighting style')) return 'fighting-style';
        if (name.includes('patron')) return 'patron';
        if (name.includes('circle')) return 'circle';
        if (name.includes('expertise')) return 'expertise';
        if (name.includes('eldritch')) return 'eldritch';

        return 'other';
    }

    /**
     * Get available options for a feature choice
     */
    async _getFeatureOptions(feature) {
        // This would typically load from feature data files
        // For now, return a simple mock structure
        // In production, this would query 5etools data
        // eslint-disable-next-line no-unused-vars
        void feature; // Silence unused parameter warning for now

        return [
            { id: 'opt1', name: 'Option 1', description: 'First choice' },
            { id: 'opt2', name: 'Option 2', description: 'Second choice' },
            { id: 'opt3', name: 'Option 3', description: 'Third choice' }
        ];
    }

    /**
     * Render a single feature choice UI
     */
    _renderFeatureChoice(feature) {
        const featureId = feature.id;
        const requiredBadge = feature.required
            ? '<span class="badge bg-danger ms-2">Required</span>'
            : '<span class="badge bg-secondary ms-2">Optional</span>';

        let html = `
            <div class="card mb-3 feature-choice-card">
                <div class="card-header bg-light border-bottom">
                    <h6 class="mb-0">
                        ${this._getFeatureIcon(feature.type)}
                        ${feature.name}
                        ${requiredBadge}
                    </h6>
                    <small class="text-muted">
                        ${feature.class} • Level ${feature.gainLevel}
                    </small>
                </div>
                <div class="card-body">
                    <div class="feature-options" data-feature-group="${featureId}">
        `;

        // Render each option (safely handle if options is undefined)
        const options = feature.options || [];
        options.forEach((option) => {
            const isSelected = this.session.stepData.selectedFeatures[featureId] === option.id;
            const selectedClass = isSelected ? 'selected' : '';

            html += `
                <div class="feature-option-card p-3 mb-2 border rounded cursor-pointer ${selectedClass}">
                    <div class="form-check">
                        <input 
                            class="form-check-input" 
                            type="radio" 
                            name="feature_${featureId}"
                            id="feat_${featureId}_${option.id}"
                            value="${option.id}"
                            data-feature-id="${featureId}"
                            data-feature-choice="true"
                            ${isSelected ? 'checked' : ''}
                        >
                        <label class="form-check-label w-100" for="feat_${featureId}_${option.id}">
                            <strong>${option.name}</strong>
                            ${option.description ? `<div class="small text-muted mt-1">${option.description}</div>` : ''}
                        </label>
                    </div>
                </div>
            `;
        });

        html += `
                    </div>
                </div>
            </div>
        `;

        return html;
    }

    /**
     * Get icon for feature type
     */
    _getFeatureIcon(type) {
        const icons = {
            'metamagic': '<i class="fas fa-sparkles"></i>',
            'maneuver': '<i class="fas fa-fist-raised"></i>',
            'invocation': '<i class="fas fa-scroll"></i>',
            'fighting-style': '<i class="fas fa-shield-alt"></i>',
            'patron': '<i class="fas fa-book-open"></i>',
            'circle': '<i class="fas fa-circle"></i>',
            'expertise': '<i class="fas fa-star"></i>',
            'other': '<i class="fas fa-tasks"></i>'
        };

        return icons[type] || icons.other;
    }

    /**
     * Cleanup on modal close
     */
    dispose() {
        this._cleanup.cleanup();
    }
}
