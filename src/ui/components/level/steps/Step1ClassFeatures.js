import { ClassService } from '../../../../services/ClassService.js';
import { DOMCleanup } from '../../../../lib/DOMCleanup.js';

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
        this.classService = ClassService;
        
        // Initialize step data if not present
        if (!this.session.stepData.selectedFeatures) {
            this.session.stepData.selectedFeatures = {};
        }
    }

    async render() {
        const leveledClasses = this.session.get('leveledClasses');
        const character = this.session.character;
        
        // Collect all features for newly gained levels
        const features = await this._gatherFeaturesForLevel(leveledClasses, character);
        
        if (features.length === 0) {
            return `
                <div class="step-1-class-features">
                    <h5 class="mb-3"><i class="fas fa-tasks"></i> Class Features</h5>
                    <div class="alert alert-info mb-0">
                        <i class="fas fa-info-circle"></i>
                        No feature choices available at this level for your selected classes.
                    </div>
                </div>
            `;
        }

        let html = `
            <div class="step-1-class-features">
                <h5 class="mb-3"><i class="fas fa-tasks"></i> Class Features</h5>
                <div class="alert alert-info small mb-3">
                    <i class="fas fa-info-circle"></i>
                    Review and make any required feature selections for your new level(s).
                </div>
        `;

        // Render each feature choice
        for (const feature of features) {
            html += this._renderFeatureChoice(feature);
        }

        html += `
            </div>
        `;

        return html;
    }

    attachListeners(contentArea) {
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
    async _gatherFeaturesForLevel(leveledClasses, character) {
        const features = [];

        for (const classInfo of leveledClasses) {
            const classData = this.classService.getClassData(classInfo.name);
            if (!classData) continue;

            // Get features for each newly gained level
            const startLevel = (character.classes?.[classInfo.name] || 0);
            for (let level = startLevel + 1; level <= classInfo.newLevel; level++) {
                const levelFeatures = await this._getClassFeaturesAtLevel(
                    classData,
                    classInfo.subclass,
                    level
                );
                
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

        // Render each option
        feature.options.forEach((option) => {
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
