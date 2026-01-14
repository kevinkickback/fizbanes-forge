import { DOMCleanup } from '../../../../lib/DOMCleanup.js';
import { classService } from '../../../../services/ClassService.js';
import { levelUpService } from '../../../../services/LevelUpService.js';
import { optionalFeatureService } from '../../../../services/OptionalFeatureService.js';
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

        // Attach listeners for both radio and checkbox inputs
        const featureInputs = contentArea.querySelectorAll('input[data-feature-choice]');

        featureInputs.forEach(input => {
            this._cleanup.on(input, 'change', (e) => {
                const featureId = input.dataset.featureId;
                const selectedValue = input.value;
                const isMulti = input.dataset.isMulti === 'true';
                const choiceGroup = contentArea.querySelector(`[data-feature-group="${featureId}"]`);

                if (isMulti) {
                    // Multiple selection (checkbox)
                    const checkedInputs = choiceGroup.querySelectorAll('input[type="checkbox"]:checked');
                    this.session.stepData.selectedFeatures[featureId] = Array.from(checkedInputs).map(cb => cb.value);
                } else {
                    // Single selection (radio)
                    this.session.stepData.selectedFeatures[featureId] = selectedValue;
                }

                // Update visual feedback
                if (choiceGroup) {
                    const cards = choiceGroup.querySelectorAll('.feature-option-card');
                    cards.forEach((card) => {
                        const checkbox = card.querySelector('input[type="checkbox"][data-feature-choice]');
                        const radio = card.querySelector('input[type="radio"][data-feature-choice]');
                        const isChecked = (checkbox?.checked) || (radio?.checked);

                        if (isChecked) {
                            card.classList.add('selected');
                        } else {
                            card.classList.remove('selected');
                        }
                    });
                }

                // Update selection counter for multi-select
                if (isMulti) {
                    const counter = contentArea.querySelector(`[data-selection-count="${featureId}"]`);
                    if (counter) {
                        const count = Array.from(choiceGroup.querySelectorAll('input[type="checkbox"]:checked')).length;
                        const header = e.target.closest('.feature-choice-card').querySelector('.text-info');
                        const maxStr = header?.textContent.match(/Select (\d+)/)?.[1];
                        const max = maxStr || 'N';
                        counter.innerHTML = `<strong>${count}</strong>/${max}`;
                    }
                }
            });
        });

        // Restore previous selections
        Object.entries(this.session.stepData.selectedFeatures).forEach(([featureId, values]) => {
            const choiceGroup = contentArea.querySelector(`[data-feature-group="${featureId}"]`);
            if (!choiceGroup) return;

            const isMulti = Array.isArray(values);
            const valuesToSelect = isMulti ? values : [values];

            valuesToSelect.forEach(value => {
                const input = choiceGroup.querySelector(
                    `input[data-feature-id="${featureId}"][value="${value}"]`
                );
                if (input) {
                    input.checked = true;
                    input.closest('.feature-option-card')?.classList.add('selected');
                }
            });

            // Update counter for multi-select
            if (isMulti) {
                const counter = contentArea.querySelector(`[data-selection-count="${featureId}"]`);
                if (counter) {
                    const header = choiceGroup.closest('.feature-choice-card').querySelector('.text-info');
                    const maxStr = header?.textContent.match(/Select (\d+)/)?.[1];
                    const max = maxStr || values.length;
                    counter.innerHTML = `<strong>${values.length}</strong>/${max}`;
                }
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

                // Add known choice features for specific classes/levels
                levelFeatures.push(...this._getKnownChoiceFeatures(classInfo.name, level));

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
     * Get known choice features for specific class/level combinations
     * Uses optionalfeatureProgression from class JSON data
     */
    _getKnownChoiceFeatures(className, level) {
        const features = [];
        const classData = classService.getClass(className);
        if (!classData?.optionalfeatureProgression) return features;

        // Check each optional feature progression
        for (const progression of classData.optionalfeatureProgression) {
            const featureTypes = progression.featureType || [];
            const featureName = progression.name;

            // Determine if this level gains new features
            const prevLevel = level - 1;
            let countAtPrev = 0;
            let countAtCurrent = 0;

            // Handle array-based progression (indexed by level-1)
            if (Array.isArray(progression.progression)) {
                countAtPrev = progression.progression[prevLevel - 1] || 0;
                countAtCurrent = progression.progression[level - 1] || 0;
            }
            // Handle object-based progression (level as key)
            else if (typeof progression.progression === 'object') {
                countAtPrev = progression.progression[prevLevel.toString()] || 0;
                countAtCurrent = progression.progression[level.toString()] || 0;
            }

            // Only show feature if count increased (new feature gained)
            if (countAtCurrent > countAtPrev) {
                const newCount = countAtCurrent - countAtPrev;

                // Determine feature type for UI
                let featureType = 'other';
                if (featureTypes.includes('EI')) featureType = 'invocation';
                else if (featureTypes.includes('MM')) featureType = 'metamagic';
                else if (featureTypes.includes('MV:B')) featureType = 'maneuver';
                else if (featureTypes.includes('PB')) featureType = 'patron';

                // Get options from OptionalFeatureService
                const options = optionalFeatureService.getFeaturesByType(featureTypes)
                    .filter(opt => sourceService.isSourceAllowed(opt.source))
                    .map(opt => ({
                        id: `${opt.name}_${opt.source}`,
                        name: opt.name,
                        source: opt.source,
                        description: this._getFeatureDescription(opt),
                        prerequisite: opt.prerequisite,
                        entries: opt.entries
                    }));

                features.push({
                    id: `${className.toLowerCase()}_${featureType}_${level}`,
                    name: featureName,
                    type: featureType,
                    options,
                    required: true,
                    description: `Choose ${newCount} ${featureName}`,
                    count: newCount // How many to select
                });
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
        const type = this._getFeatureType(feature);

        let options = [];

        // Map feature types to service methods
        switch (type) {
            case 'metamagic':
                options = optionalFeatureService.getMetamagicOptions();
                break;
            case 'maneuver':
                options = optionalFeatureService.getManeuvers();
                break;
            case 'invocation':
                options = optionalFeatureService.getEldritchInvocations();
                break;
            case 'fighting-style': {
                // Determine class from feature context
                const className = feature.className || this._inferClassFromFeature(feature);
                options = optionalFeatureService.getFightingStyles(className);
                break;
            }
            case 'patron':
                options = optionalFeatureService.getPactBoons();
                break;
            default:
                // For other types, try to load by featureType if available
                if (feature.featureType) {
                    options = optionalFeatureService.getFeaturesByType(feature.featureType);
                }
                break;
        }

        // Filter by allowed sources
        options = options.filter(opt =>
            sourceService.isSourceAllowed(opt.source)
        );

        // Map to simplified structure for UI
        return options.map(opt => ({
            id: `${opt.name}_${opt.source}`,
            name: opt.name,
            source: opt.source,
            description: this._getFeatureDescription(opt),
            prerequisite: opt.prerequisite,
            entries: opt.entries
        }));
    }

    /**
     * Infer class name from feature context
     */
    _inferClassFromFeature(feature) {
        // eslint-disable-next-line no-unused-vars
        void feature; // May use feature.className in future

        // Try to get from session's leveled classes
        const summary = this.session.getChangeSummary();
        if (summary.leveledClasses?.length > 0) {
            // Return first class that could have this feature
            return summary.leveledClasses[0].name;
        }
        return 'Fighter'; // Default fallback
    }

    /**
     * Extract description from feature entries
     */
    _getFeatureDescription(feature) {
        if (!feature.entries) return '';

        // Get first text entry
        const firstEntry = feature.entries.find(e => typeof e === 'string');
        if (firstEntry) {
            // Strip 5etools tags and truncate
            return `${firstEntry.replace(/\{@[^}]+\}/g, '').substring(0, 150)}...`;
        }

        return '';
    }

    /**
     * Render a single feature choice UI
     */
    _renderFeatureChoice(feature) {
        const featureId = feature.id;
        const isMultiSelect = (feature.count || 1) > 1;
        const inputType = isMultiSelect ? 'checkbox' : 'radio';
        const requiredBadge = feature.required
            ? '<span class="badge bg-danger ms-2">Required</span>'
            : '<span class="badge bg-secondary ms-2">Optional</span>';

        // Get current selections for this feature
        const currentSelections = this.session.stepData.selectedFeatures[featureId]
            ? (Array.isArray(this.session.stepData.selectedFeatures[featureId])
                ? this.session.stepData.selectedFeatures[featureId]
                : [this.session.stepData.selectedFeatures[featureId]])
            : [];

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
                    ${isMultiSelect ? `
                    <div class="mt-2">
                        <small class="text-info">
                            <i class="fas fa-info-circle"></i>
                            Select ${feature.count}: <span data-selection-count="${featureId}"><strong>${currentSelections.length}</strong>/${feature.count}</span>
                        </small>
                    </div>
                    ` : ''}
                </div>
                <div class="card-body p-0">
                    <div class="feature-options feature-options-scroll" data-feature-group="${featureId}" style="max-height: 400px; overflow-y: auto;">
        `;

        // Render each option (safely handle if options is undefined)
        const options = feature.options || [];
        options.forEach((option) => {
            const isSelected = currentSelections.includes(option.id);
            const selectedClass = isSelected ? 'selected' : '';
            const safeId = `${featureId}_${option.id}`.replace(/[^a-zA-Z0-9_-]/g, '_');

            // Truncate description to ~120 chars with proper truncation
            let displayDesc = '';
            if (option.description) {
                displayDesc = option.description.length > 120
                    ? `${option.description.substring(0, 120).replace(/\s+\S*$/, '')}...`
                    : option.description;
            }

            html += `
                <div class="feature-option-card p-3 border-top rounded-0 cursor-pointer d-flex align-items-start gap-3 ${selectedClass}" style="background-color: ${isSelected ? 'var(--highlight-bg, #f0f0f0)' : 'transparent'};">
                    <div class="form-check flex-grow-1 mt-1">
                        <input 
                            class="form-check-input" 
                            type="${inputType}" 
                            name="feature_${featureId}"
                            id="feat_${safeId}"
                            value="${option.id}"
                            data-feature-id="${featureId}"
                            data-feature-choice="true"
                            data-is-multi="${isMultiSelect ? 'true' : 'false'}"
                            ${isSelected ? 'checked' : ''}
                        >
                        <label class="form-check-label w-100" for="feat_${safeId}">
                            <strong>${option.name}</strong>
                            ${displayDesc ? `<div class="small text-muted mt-1" title="${this._escapeHtml(option.description || '')}">${displayDesc}</div>` : ''}
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
     * Escape HTML to prevent XSS
     */
    _escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
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
