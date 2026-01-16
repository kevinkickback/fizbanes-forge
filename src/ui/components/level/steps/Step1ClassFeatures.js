import { DOMCleanup } from '../../../../lib/DOMCleanup.js';
import { classService } from '../../../../services/ClassService.js';
import { levelUpService } from '../../../../services/LevelUpService.js';
import { optionalFeatureService } from '../../../../services/OptionalFeatureService.js';
import { sourceService } from '../../../../services/SourceService.js';
import { LevelUpFeatureSelector } from '../LevelUpFeatureSelector.js';

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

        // Create a map for easy subclass lookup by class name
        const subclassPromptMap = {};
        for (const prompt of subclassPrompts) {
            subclassPromptMap[prompt.className] = prompt;
        }

        // Collect all features for newly gained levels
        const allFeatures = await this._gatherFeaturesForLevel(leveledClasses);

        // Filter to only choice features (those with options)
        const features = allFeatures.filter(f => f.options && Array.isArray(f.options));

        // Render subclass selection UI if needed
        let html = `
            <div class="step-1-class-features">
        `;

        // Group features by class
        const featuresByClass = {};
        for (const feature of features) {
            if (!featuresByClass[feature.class]) {
                featuresByClass[feature.class] = {
                    className: feature.class,
                    minLevel: feature.gainLevel,
                    maxLevel: feature.gainLevel,
                    features: [],
                    subclassPrompt: subclassPromptMap[feature.class] || null
                };
            }
            featuresByClass[feature.class].features.push(feature);
            featuresByClass[feature.class].minLevel = Math.min(featuresByClass[feature.class].minLevel, feature.gainLevel);
            featuresByClass[feature.class].maxLevel = Math.max(featuresByClass[feature.class].maxLevel, feature.gainLevel);
        }

        // Also include classes that only have subclass selection but no features
        for (const prompt of subclassPrompts) {
            if (!featuresByClass[prompt.className]) {
                featuresByClass[prompt.className] = {
                    className: prompt.className,
                    minLevel: prompt.level,
                    maxLevel: prompt.level,
                    features: [],
                    subclassPrompt: prompt
                };
            }
        }

        if (Object.keys(featuresByClass).length === 0) {
            return `${html}
                <div class="alert alert-info mb-0">
                    <i class="fas fa-info-circle"></i>
                    No feature choices available at this level for your selected classes.
                </div>
            </div>`;
        }

        const classGroups = Object.values(featuresByClass);

        // If only one class, render features individually without grouping
        if (classGroups.length === 1) {
            const singleClassGroup = classGroups[0];

            // Render subclass selection if needed
            if (singleClassGroup.subclassPrompt) {
                const prompt = singleClassGroup.subclassPrompt;
                const selectId = `subclass_${prompt.className}_${prompt.level}`;
                const selected = prompt.selected || '';

                html += `
                    <div class="card mb-3">
                        <div class="card-header d-flex justify-content-between align-items-center">
                            <h6 class="mb-0"><i class="fas fa-wand-magic"></i> Subclass Selection</h6>
                            <small class="text-muted">${prompt.className} • Level ${prompt.level}</small>
                        </div>
                        <div class="card-body">
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
                    </div>
                `;
            }

            // Render each feature as its own card
            for (const feature of singleClassGroup.features) {
                html += this._renderFeatureChoice(feature);
            }
        } else {
            // Multiple classes: render one card per class
            for (const classGroup of classGroups) {
                html += this._renderClassFeatureGroup(classGroup);
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
        const validationReport = this.session.getFilteredValidationReport();

        // First, check for MISSING subclass selections from ALL character classes
        if (validationReport?.missing?.subclasses) {
            for (const missing of validationReport.missing.subclasses) {
                const classData = classService.getClass(missing.class);
                if (!classData) continue;

                const allSubclasses = classService.getSubclasses(missing.class);
                const availableSubclasses = allSubclasses.filter((sc) => {
                    const subclassSource = sc.subclassSource || sc.source || sc.classSource;
                    return sourceService.isSourceAllowed(subclassSource);
                });

                if (availableSubclasses.length > 0) {
                    prompts.push({
                        className: missing.class,
                        level: missing.requiredAt || missing.level,
                        availableSubclasses,
                        selected: this.session.stepData.selectedSubclasses[missing.class] || null,
                        isMissing: true // Flag to indicate this is a historical gap
                    });
                }
            }
        }

        // Then, check for NEW subclass unlocks in newly gained levels
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
                    // Check if we already added this as a missing prompt
                    const alreadyAdded = prompts.some(p =>
                        p.className === classInfo.name && p.level === level
                    );

                    if (!alreadyAdded) {
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
        }

        return prompts;
    }

    /**
     * Render subclass selection dropdown inline within class card (matching feature style)
     */
    _renderSubclassSelectionInline(prompt) {
        const selectId = `subclass_${prompt.className}_${prompt.level}`;
        const selected = prompt.selected || '';

        let html = `
            <div class="d-flex justify-content-between align-items-center mb-2 p-2 border rounded" 
                 style="border-color: color-mix(in srgb, var(--accent-color) 18%, var(--secondary-color)) !important;"
                 data-subclass-card="${prompt.className}">
                <div>
                    <strong><i class="fas fa-wand-magic"></i> Choose Subclass</strong>
                    <span class="text-muted small ms-2">— Level ${prompt.level}</span>
                </div>
                <select class="form-select form-select-sm ms-2" style="width: auto; min-width: 200px;" id="${selectId}" data-class-name="${prompt.className}">
                    <option value="">-- Select --</option>
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
            this._cleanup.on(select, 'change', async (e) => {
                const className = e.target.dataset.className;
                const selectedValue = e.target.value;
                this.session.stepData.selectedSubclasses[className] = selectedValue;

                // Dynamically add features granted by the newly selected subclass
                await this._handleSubclassSelectionChange(className, selectedValue, contentArea);
            });
        });

        // Attach listeners for feature selection buttons
        const featureButtons = contentArea.querySelectorAll('[data-feature-select-btn]');
        featureButtons.forEach(button => {
            this._attachFeatureSelectListener(button); // Feature data will be fetched inside
        });
    }

    /**
     * Callback from LevelUpFeatureSelector when user confirms selection
     */
    updateFeatureSelection(className, featureType, level, selectedNames) {
        // Find the feature ID from the rendered features
        const summary = this.session.getChangeSummary();
        const leveledClasses = summary.leveledClasses.map(lc => ({
            name: lc.name,
            newLevel: lc.to,
            oldLevel: lc.from
        }));

        // Get all features and find matching one
        this._gatherFeaturesForLevel(leveledClasses).then(allFeatures => {
            const feature = allFeatures.find(f =>
                f.class === className &&
                f.type === featureType &&
                f.gainLevel === level
            );

            if (!feature) {
                console.error('[Step1]', 'Could not find feature to update');
                return;
            }

            const featureId = feature.id;

            // Map selected names back to IDs
            const selectedIds = selectedNames.map(name => {
                const opt = feature.options.find(o => o.name === name);
                return opt ? opt.id : name;
            });

            // Store selections
            if (feature.count > 1) {
                this.session.stepData.selectedFeatures[featureId] = selectedIds;
            } else {
                this.session.stepData.selectedFeatures[featureId] = selectedIds[0] || '';

                // Record feature selection in progression history
                const featureChoice = {};
                featureChoice[featureType] = {
                    selected: selectedIds.length > 0 ? selectedIds : [],
                    count: feature.count || 1
                };
                this.session.recordChoices(className, level, featureChoice);
            }

            // Update UI
            this._updateFeatureDisplay(featureId, selectedNames, feature.count || 1);
        });
    }

    /**
     * Update the display after selection
     */
    _updateFeatureDisplay(featureId, selectedNames, maxCount) {
        const displayArea = document.querySelector(`[data-selected-display="${featureId}"]`);
        if (displayArea) {
            const displayText = selectedNames.length > 0 ? selectedNames.join(', ') : 'None selected';
            displayArea.innerHTML = `<strong>Selected:</strong> ${displayText}`;
        }

        const counter = document.querySelector(`[data-selection-count="${featureId}"]`);
        if (counter) {
            counter.textContent = `${selectedNames.length}/${maxCount}`;
        }
    }

    /**
     * Gather features that should be displayed at this level
     * Includes both NEW features from level-up AND missing historical features
     */
    async _gatherFeaturesForLevel(leveledClasses) {
        const features = [];
        const validationReport = this.session.getFilteredValidationReport();

        // First, gather missing features from ALL character classes (not just leveled ones)
        if (validationReport && !validationReport.isValid) {
            const allClasses = this.session.stagedChanges.progression?.classes || [];
            const processedClasses = new Set();

            for (const classEntry of allClasses) {
                const missingFeatures = this._getMissingHistoricalFeatures(classEntry.name, validationReport);
                if (missingFeatures.length > 0) {
                    features.push(...missingFeatures);
                    processedClasses.add(classEntry.name);
                }
            }
        }

        // Then, gather NEW features from leveled classes
        for (const classInfo of leveledClasses) {
            const classData = classService.getClass(classInfo.name);
            if (!classData) continue;

            // Get subclass from session if user selected one, otherwise use current
            let subclass = null;
            if (this.session.stepData.selectedSubclasses[classInfo.name]) {
                const selectedSubclassName = this.session.stepData.selectedSubclasses[classInfo.name];
                subclass = classService.getSubclass(classInfo.name, selectedSubclassName);
            } else if (classInfo.subclass) {
                // Fetch subclass data object (classInfo.subclass is just a string)
                subclass = classService.getSubclass(classInfo.name, classInfo.subclass);
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
                levelFeatures.push(...this._getKnownChoiceFeatures(classInfo.name, level, subclass));

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
     * Uses optionalfeatureProgression from class and subclass JSON data
     */
    _getKnownChoiceFeatures(className, level, subclass = null) {
        const features = [];
        const classData = classService.getClass(className);

        // Check class optionalfeatureProgression
        if (classData?.optionalfeatureProgression) {
            features.push(...this._processOptionalFeatureProgression(classData.optionalfeatureProgression, className, level));
        }

        // Check subclass optionalfeatureProgression
        if (subclass?.optionalfeatureProgression) {
            features.push(...this._processOptionalFeatureProgression(subclass.optionalfeatureProgression, className, level));
        }

        // Check for specific subclass features like "Additional Fighting Style"
        if (subclass) {
            features.push(...this._processSubclassFeatureStrings(subclass, className, level));
        }

        return features;
    }

    /**
     * Process subclass feature strings to find choice features at a specific level
     * @private
     */
    _processSubclassFeatureStrings(subclass, className, level) {
        const features = [];

        if (!subclass.subclassFeatures || !Array.isArray(subclass.subclassFeatures)) {
            console.debug('[Step1]', 'No subclassFeatures array found');
            return features;
        }

        console.debug('[Step1]', `Processing ${subclass.subclassFeatures.length} subclass features for level ${level}`);

        // Parse subclass feature strings like "Additional Fighting Style|Fighter||Champion||10"
        for (const featureStr of subclass.subclassFeatures) {
            if (typeof featureStr !== 'string') continue;

            const parts = featureStr.split('|');
            const featureName = parts[0];
            const featureLevel = parseInt(parts[parts.length - 1], 10);

            console.debug('[Step1]', `  - "${featureName}" at level ${featureLevel}`);

            // Check if this feature is at the requested level
            if (featureLevel !== level) continue;

            console.debug('[Step1]', `    ✓ Matches current level ${level}`);

            // Check if this is a known choice feature
            const lowerName = featureName.toLowerCase();

            // Additional Fighting Style
            if (lowerName.includes('additional fighting style') || lowerName.includes('fighting style')) {
                console.debug('[Step1]', '    ✓ Identified as Fighting Style choice feature');

                const options = optionalFeatureService.getFeaturesByType(['FS:F', 'FS:R', 'FS:P'])
                    .filter(opt => sourceService.isSourceAllowed(opt.source))
                    .map(opt => ({
                        id: `${opt.name}_${opt.source}`,
                        name: opt.name,
                        source: opt.source,
                        description: this._getFeatureDescription(opt),
                        entries: opt.entries
                    }));

                console.debug('[Step1]', `    Found ${options.length} Fighting Style options`);

                if (options.length > 0) {
                    const feature = {
                        id: `${className.toLowerCase()}_${subclass.shortName.toLowerCase()}_fighting_style_${level}`,
                        name: featureName,
                        type: 'fighting-style',
                        options,
                        required: true,
                        description: `Choose an additional Fighting Style`,
                        count: 1
                    };
                    features.push(feature);
                    console.debug('[Step1]', `    ✓ Added feature with ID: ${feature.id}`);
                }
            }
            // Add more feature type checks here as needed
            // For example: Maneuver choices, Metamagic, etc.
        }

        console.debug('[Step1]', `Processed subclass features, found ${features.length} choice features`);
        return features;
    }

    /**
     * Process optionalfeatureProgression array and return features for the given level
     * @private
     */
    _processOptionalFeatureProgression(progressions, className, level) {
        const features = [];

        // Check each optional feature progression
        for (const progression of progressions) {
            const featureTypes = progression.featureType || [];
            const featureName = progression.name;

            // Determine if this level gains new features
            const prevLevel = level - 1;
            let countAtPrev = 0;
            let countAtCurrent = 0;

            // Handle array-based progression (indexed by level-1)
            if (Array.isArray(progression.progression)) {
                countAtPrev = prevLevel > 0 ? (progression.progression[prevLevel - 1] || 0) : 0;
                countAtCurrent = progression.progression[level - 1] || 0;
            }
            // Handle object-based progression (level as key)
            else if (typeof progression.progression === 'object') {
                countAtPrev = prevLevel > 0 ? (progression.progression[prevLevel.toString()] || 0) : 0;
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

        // Also check for standard choice features like Fighting Style from ClassService
        const classData = classService.getClass(className);
        const classFeatures = classService.getClassFeatures(className, level, classData?.source || 'PHB');
        for (const feature of classFeatures) {
            if (feature.level === level) {
                const featureName = feature.name || '';

                // Check for Fighting Style
                if (featureName.includes('Fighting Style')) {
                    const options = optionalFeatureService.getFeaturesByType(['FS:F', 'FS:R', 'FS:P'])
                        .filter(opt => sourceService.isSourceAllowed(opt.source))
                        .map(opt => ({
                            id: `${opt.name}_${opt.source}`,
                            name: opt.name,
                            source: opt.source,
                            description: this._getFeatureDescription(opt),
                            entries: opt.entries
                        }));

                    if (options.length > 0) {
                        features.push({
                            id: `${className.toLowerCase()}_fighting_style_${level}`,
                            name: 'Fighting Style',
                            type: 'fighting-style',
                            options,
                            required: true,
                            description: 'Choose a Fighting Style',
                            count: 1
                        });
                    }
                }
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
     * Render grouped features for a single class
     */
    _renderClassFeatureGroup(classGroup) {
        const { className, minLevel, maxLevel, features, subclassPrompt } = classGroup;

        // Build level range display
        const levelRange = minLevel === maxLevel ? `Level ${minLevel}` : `Level ${minLevel}-${maxLevel}`;

        return `
            <div class="card mb-3 class-features-card">
                <div class="card-header d-flex justify-content-between align-items-center">
                    <h6 class="mb-0">
                        <i class="fas fa-star"></i>
                        ${className}
                    </h6>
                    <small class="text-muted">
                        ${levelRange}
                    </small>
                </div>
                <div class="card-body">
                    ${subclassPrompt ? this._renderSubclassSelectionInline(subclassPrompt) : ''}
                    ${features.length > 0 ? features.map(feature => {
            const featureId = feature.id;
            const isMultiSelect = feature.count > 1;
            const currentSelections = this.session.stepData.selectedFeatures[featureId] || [];
            const options = feature.options || [];

            let selectedDisplay = '<span class="text-muted">None</span>';
            if (currentSelections.length > 0) {
                const selectedNames = currentSelections.map(selId => {
                    const opt = options.find(o => o.id === selId);
                    return opt ? opt.name : selId;
                });
                selectedDisplay = selectedNames.join(', ');
            }


            return `
                            <div class="d-flex justify-content-between align-items-center mb-2 p-2 border rounded" 
                                 style="border-color: color-mix(in srgb, var(--accent-color) 18%, var(--secondary-color)) !important;"
                                 data-feature-card="${featureId}">
                                <div class="flex-grow-1">
                                    <div class="d-flex justify-content-between align-items-center">
                                        <div>
                                            <strong>${this._getFeatureIcon(feature.type)} ${feature.name}</strong>
                                            <span class="text-muted small ms-2">— Level ${feature.gainLevel}</span>
                                        </div>
                                        ${isMultiSelect ? `<span class="badge" style="background-color: var(--accent-color);" data-selection-count="${featureId}">${currentSelections.length}/${feature.count}</span>` : ''}
                                    </div>
                                    <div class="text-muted small mt-1" data-selected-display="${featureId}">
                                        <strong>Selected:</strong> ${selectedDisplay}
                                    </div>
                                </div>
                                <button 
                                    class="btn btn-primary btn-sm ms-2" 
                                    data-feature-select-btn="${featureId}"
                                    data-feature-type="${feature.type}"
                                    data-feature-class="${feature.class}"
                                    data-feature-level="${feature.gainLevel}"
                                    data-is-multi="${isMultiSelect}">
                                    <i class="fas fa-list"></i> Choose
                                </button>
                            </div>
                        `;
        }).join('') : (subclassPrompt ? '' : '<p class="text-muted mb-0"><i class="fas fa-info-circle"></i> No feature choices at these levels</p>')}
                </div>
            </div>
        `;
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
     * Render a single feature choice UI with button-based modal selector
     */
    _renderFeatureChoice(feature) {
        const featureId = feature.id;
        const isMultiSelect = (feature.count || 1) > 1;

        // Get current selections for this feature
        const currentSelections = this.session.stepData.selectedFeatures[featureId]
            ? (Array.isArray(this.session.stepData.selectedFeatures[featureId])
                ? this.session.stepData.selectedFeatures[featureId]
                : [this.session.stepData.selectedFeatures[featureId]])
            : [];

        // Display selected feature names
        let selectedDisplay = 'None selected';
        if (currentSelections.length > 0) {
            const options = feature.options || [];
            const selectedNames = currentSelections.map(selId => {
                const opt = options.find(o => o.id === selId);
                return opt ? opt.name : selId;
            });
            selectedDisplay = selectedNames.join(', ');
        }

        const selectionText = isMultiSelect
            ? `Select ${feature.count} ${feature.name}`
            : `Select ${feature.name}`;

        const html = `
            <div class="card mb-3 feature-choice-card" data-feature-card="${featureId}">
                <div class="card-header d-flex justify-content-between align-items-center">
                    <h6 class="mb-0">
                        ${this._getFeatureIcon(feature.type)}
                        ${feature.name}
                    </h6>
                    <small class="text-muted">
                        ${feature.class} • Level ${feature.gainLevel}
                    </small>
                </div>
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-center mb-2">
                        <div>
                            <strong>${selectionText}</strong>
                            ${isMultiSelect ? `<span class="ms-2 badge" style="background-color: var(--accent-color);" data-selection-count="${featureId}">${currentSelections.length}/${feature.count}</span>` : ''}
                        </div>
                        <button 
                            class="btn btn-primary btn-sm" 
                            data-feature-select-btn="${featureId}"
                            data-feature-type="${feature.type}"
                            data-feature-class="${feature.class}"
                            data-feature-level="${feature.gainLevel}"
                            data-is-multi="${isMultiSelect}">
                            <i class="fas fa-list"></i> Choose
                        </button>
                    </div>
                    <div class="alert alert-secondary mb-0 small" data-selected-display="${featureId}">
                        <strong>Selected:</strong> ${selectedDisplay}
                    </div>
                </div>
            </div>
        `;

        return html;
    }

    /**
     * Handle dynamic feature addition when subclass is selected
     * @param {string} className - The class name
     * @param {string} subclassName - The selected subclass name
     * @param {HTMLElement} contentArea - The container element for step content
     */
    async _handleSubclassSelectionChange(className, subclassName, contentArea) {
        if (!subclassName) {
            // Subclass deselected - could potentially remove dynamic features here
            return;
        }

        console.info('[Step1]', '=== Subclass Selection Change ===');
        console.info('[Step1]', 'Class:', className, '| Subclass:', subclassName);

        // Get the character's current level for this class
        const summary = this.session.getChangeSummary();
        const leveledClass = summary.leveledClasses.find(lc => lc.name === className);

        let levelsToCheck = [];

        if (!leveledClass) {
            // Not actively leveling this class, check current level from character
            console.info('[Step1]', 'Not actively leveling, checking current character level');
            const character = this.session.originalCharacter;
            if (character?.progression?.classes) {
                const charClass = character.progression.classes.find(c => c.name === className);
                if (charClass) {
                    const currentLevel = charClass.levels || 1;
                    console.info('[Step1]', 'Current character level:', currentLevel);
                    levelsToCheck = [currentLevel];
                } else {
                    console.warn('[Step1]', 'Could not find class in character progression');
                    return;
                }
            } else {
                console.warn('[Step1]', 'No progression data in character');
                return;
            }
        } else {
            // Actively leveling - check all levels from old to new
            const oldLevel = leveledClass.from || 0;
            const newLevel = leveledClass.to;
            console.info('[Step1]', `Leveling from ${oldLevel} to ${newLevel}`);

            for (let level = oldLevel + 1; level <= newLevel; level++) {
                levelsToCheck.push(level);
            }
        }

        console.info('[Step1]', 'Levels to check for features:', levelsToCheck);

        // Get the subclass data
        const subclass = classService.getSubclass(className, subclassName);
        if (!subclass) {
            console.warn('[Step1]', 'Could not load subclass data for', className, subclassName);
            return;
        }

        console.info('[Step1]', 'Subclass data loaded:', subclass.name, '| Features:', subclass.subclassFeatures?.length || 0);

        // Check each level for features
        const allNewFeatures = [];
        for (const level of levelsToCheck) {
            const levelFeatures = this._getKnownChoiceFeatures(className, level, subclass);
            console.info('[Step1]', `  Level ${level}: found ${levelFeatures.length} choice features`);

            levelFeatures.forEach(f => {
                console.info('[Step1]', `    - ${f.name} (${f.type}) with ${f.options?.length || 0} options`);
            });

            allNewFeatures.push(...levelFeatures);
        }

        if (allNewFeatures.length === 0) {
            console.debug('[Step1]', 'No new choice features from subclass at checked levels');
            return;
        }

        // Filter to only features that aren't already displayed
        const existingFeatureIds = new Set(
            Array.from(contentArea.querySelectorAll('[data-feature-card]'))
                .map(card => card.dataset.featureCard)
        );

        console.info('[Step1]', 'Existing feature IDs:', Array.from(existingFeatureIds));

        const featuresToAdd = allNewFeatures.filter(f => !existingFeatureIds.has(f.id));

        if (featuresToAdd.length === 0) {
            console.debug('[Step1]', 'All subclass features already displayed');
            return;
        }

        console.info('[Step1]', `Adding ${featuresToAdd.length} new feature choice(s) from ${subclassName} subclass`);

        // Find the insertion point (after subclass dropdown card)
        const subclassCard = contentArea.querySelector(`[data-subclass-card="${className}"]`);
        let insertionPoint = null;

        if (subclassCard) {
            // Insert after the subclass card's parent
            insertionPoint = subclassCard.closest('.card');
            console.info('[Step1]', 'Insertion point found: after subclass card');
        } else {
            console.warn('[Step1]', 'Subclass card not found, will append to end');
        }

        // Render and insert each new feature
        for (const feature of featuresToAdd) {
            console.info('[Step1]', 'Rendering feature:', feature.id);
            const featureHtml = this._renderFeatureChoice(feature);

            if (insertionPoint) {
                insertionPoint.insertAdjacentHTML('afterend', featureHtml);
                // Update insertion point for next feature
                insertionPoint = insertionPoint.nextElementSibling;
            } else {
                // Fallback: append to content area
                contentArea.insertAdjacentHTML('beforeend', featureHtml);
            }

            // Attach listener for the new feature button
            const newFeatureCard = contentArea.querySelector(`[data-feature-card="${feature.id}"]`);
            if (newFeatureCard) {
                const selectBtn = newFeatureCard.querySelector('[data-feature-select-btn]');
                if (selectBtn) {
                    this._attachFeatureSelectListener(selectBtn, feature);
                    console.info('[Step1]', 'Listener attached for feature:', feature.id);
                } else {
                    console.warn('[Step1]', 'Select button not found in feature card:', feature.id);
                }
            } else {
                console.warn('[Step1]', 'Feature card not found after insertion:', feature.id);
            }
        }

        console.info('[Step1]', '=== Subclass Feature Addition Complete ===');
    }

    /**
     * Attach listener for a single feature select button
     * @param {HTMLElement} button - The button element
     * @param {Object} feature - The feature data (optional, will be fetched if not provided)
     */
    _attachFeatureSelectListener(button, feature = null) {
        this._cleanup.on(button, 'click', async () => {
            const featureId = button.dataset.featureSelectBtn;
            const featureType = button.dataset.featureType;
            const className = button.dataset.featureClass;
            const level = parseInt(button.dataset.featureLevel, 10);
            const isMulti = button.dataset.isMulti === 'true';

            // If feature data not provided, fetch it
            if (!feature) {
                const summary = this.session.getChangeSummary();
                const leveledClasses = summary.leveledClasses.map(lc => ({
                    name: lc.name,
                    newLevel: lc.to,
                    oldLevel: lc.from
                }));
                const allFeatures = await this._gatherFeaturesForLevel(leveledClasses);
                feature = allFeatures.find(f => f.id === featureId);

                if (!feature || !feature.options) {
                    console.error('[Step1]', 'Feature not found or has no options:', featureId);
                    return;
                }
            }

            // Get current selections
            const currentSelections = this.session.stepData.selectedFeatures[featureId]
                ? (Array.isArray(this.session.stepData.selectedFeatures[featureId])
                    ? this.session.stepData.selectedFeatures[featureId]
                    : [this.session.stepData.selectedFeatures[featureId]])
                : [];

            // Map selected IDs to full feature objects
            const currentFeatureObjects = currentSelections
                .map(selId => feature.options.find(opt => opt.id === selId))
                .filter(Boolean);

            // Open feature selector modal
            const selector = new LevelUpFeatureSelector(
                this.session,
                this,
                className,
                featureType,
                level,
                featureId
            );

            await selector.show(
                feature.options,
                currentFeatureObjects,
                isMulti,
                feature.count || 1
            );
        });
    }

    /**
     * Convert validation report missing features into feature objects for display
     * @param {string} className - Class name to filter by
     * @param {Object} validationReport - Validation report from CharacterValidationService
     * @returns {Array} Feature objects for missing historical choices
     */
    _getMissingHistoricalFeatures(className, validationReport) {
        const features = [];

        // Process missing invocations
        for (const missing of validationReport.missing.invocations || []) {
            if (missing.class !== className) continue;

            const options = optionalFeatureService.getFeaturesByType(['EI'])
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
                id: `${className.toLowerCase()}_invocation_${missing.level}_missing`,
                name: 'Eldritch Invocations',
                type: 'invocation',
                options,
                required: true,
                description: `Select ${missing.missing} missing Eldritch Invocation(s) from level ${missing.level}`,
                count: missing.missing,
                class: className,
                gainLevel: missing.level,
                isMissing: true // Flag to indicate this is a historical gap
            });
        }

        // Process missing metamagic
        for (const missing of validationReport.missing.metamagic || []) {
            if (missing.class !== className) continue;

            const options = optionalFeatureService.getFeaturesByType(['MM'])
                .filter(opt => sourceService.isSourceAllowed(opt.source))
                .map(opt => ({
                    id: `${opt.name}_${opt.source}`,
                    name: opt.name,
                    source: opt.source,
                    description: this._getFeatureDescription(opt),
                    entries: opt.entries
                }));

            features.push({
                id: `${className.toLowerCase()}_metamagic_${missing.level}_missing`,
                name: 'Metamagic Options',
                type: 'metamagic',
                options,
                required: true,
                description: `Select ${missing.missing} missing Metamagic option(s) from level ${missing.level}`,
                count: missing.missing,
                class: className,
                gainLevel: missing.level,
                isMissing: true
            });
        }

        // Process missing fighting styles
        for (const missing of validationReport.missing.fightingStyles || []) {
            if (missing.class !== className) continue;

            const options = optionalFeatureService.getFeaturesByType(['FS:F', 'FS:R', 'FS:P'])
                .filter(opt => sourceService.isSourceAllowed(opt.source))
                .map(opt => ({
                    id: `${opt.name}_${opt.source}`,
                    name: opt.name,
                    source: opt.source,
                    description: this._getFeatureDescription(opt),
                    entries: opt.entries
                }));

            features.push({
                id: `${className.toLowerCase()}_fighting_style_${missing.level}_missing`,
                name: 'Fighting Style',
                type: 'fighting-style',
                options,
                required: true,
                description: `Select missing Fighting Style from level ${missing.level}`,
                count: 1,
                class: className,
                gainLevel: missing.level,
                isMissing: true
            });
        }

        // Process missing pact boons
        for (const missing of validationReport.missing.pactBoons || []) {
            if (missing.class !== className) continue;

            const options = optionalFeatureService.getFeaturesByType(['PB'])
                .filter(opt => sourceService.isSourceAllowed(opt.source))
                .map(opt => ({
                    id: `${opt.name}_${opt.source}`,
                    name: opt.name,
                    source: opt.source,
                    description: this._getFeatureDescription(opt),
                    entries: opt.entries
                }));

            features.push({
                id: `${className.toLowerCase()}_pact_boon_${missing.level}_missing`,
                name: 'Pact Boon',
                type: 'patron',
                options,
                required: true,
                description: `Select missing Pact Boon from level ${missing.level}`,
                count: 1,
                class: className,
                gainLevel: missing.level,
                isMissing: true
            });
        }

        return features;
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
