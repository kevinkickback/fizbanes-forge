/** @file Modal wizard for character level progression and multiclass management. */

import { AppState } from '../../../app/AppState.js';
import { levelUpService } from '../../../services/LevelUpService.js';
import { eventBus, EVENTS } from '../../../lib/EventBus.js';
import { showNotification } from '../../../lib/Notifications.js';
import { textProcessor } from '../../../lib/TextProcessor.js';

export class LevelUpModal {
    constructor() {
        this.modalEl = null;
        this.bootstrapModal = null;
        this.character = null;
        this.selectedClassName = null; // Track which class is being leveled
        this.ignoreMulticlassReqs = false; // Toggle for multiclass requirements
        this._listeners = [];
    }

    async show() {
        try {
            this.modalEl = document.getElementById('levelUpModal');
            if (!this.modalEl) {
                console.error('LevelUpModal', 'modal element not found');
                showNotification('Could not open Level Up modal', 'error');
                return;
            }

            this.character = AppState.getCurrentCharacter();
            if (!this.character) {
                showNotification('No character loaded', 'error');
                return;
            }

            // Initialize Bootstrap modal once, using global fallback
            const bs = window.bootstrap || globalThis.bootstrap;
            if (!bs) {
                console.error('LevelUpModal', 'Bootstrap not found on window');
                showNotification('UI components failed to load. Please reload.', 'error');
                return;
            }
            if (!this.bootstrapModal) {
                this.bootstrapModal = new bs.Modal(this.modalEl, {
                    backdrop: true,
                    keyboard: true,
                });
            }

            // Show the modal first so failures in rendering don't block UI
            this.bootstrapModal.show();

            // Ensure progression exists
            levelUpService.initializeProgression(this.character);

            // Set initial selected class to first/primary class
            if (this.character.progression?.classes?.length > 0) {
                this.selectedClassName = this.character.progression.classes[0].name;
            }

            // Attach event listeners (dedupe existing)
            this._attachEventListeners();

            // Load features for all existing classes and render content
            await this._loadAllClassFeatures();
            await this._renderAll();
        } catch (err) {
            console.error('LevelUpModal', 'show() failed', err);
            showNotification('Failed to prepare Level Up modal', 'error');
        }
    }

    cleanup() {
        // No-op for now; we reuse instance
    }

    _attachEventListeners() {
        const bind = (selector, event, handler) => {
            const el = this.modalEl.querySelector(selector);
            if (!el) return;
            const bound = handler.bind(this);
            el.addEventListener(event, bound);
            this._listeners.push({ el, event, bound });
        };

        // Clear previous listeners
        for (const l of this._listeners) {
            l.el.removeEventListener(l.event, l.bound);
        }
        this._listeners = [];

        bind('#levelUpIncreaseBtn', 'click', this._handleIncreaseLevel);
        bind('#levelUpDecreaseBtn', 'click', this._handleDecreaseLevel);
        bind('#levelUpAddClassBtn', 'click', this._handleAddClass);
        bind('#levelUpRecalcHPBtn', 'click', this._handleRecalcHP);
        bind('#levelUpSelectFeatBtn', 'click', this._handleSelectFeat);
        bind('#ignoreMulticlassReqsToggle', 'click', this._handleToggleRequirements);

        // Re-render on character changes
        const rerender = async () => {
            this.character = AppState.getCurrentCharacter();
            await this._renderAll();
        };
        eventBus.off?.(EVENTS.CHARACTER_UPDATED, rerender); // guard if off exists
        eventBus.on(EVENTS.CHARACTER_UPDATED, rerender);
    }

    async _handleIncreaseLevel() {
        if (!this.character || !this.selectedClassName) {
            showNotification('Select a class to level up', 'warning');
            return;
        }

        // Find the selected class entry
        const classEntry = this.character.progression.classes.find(
            (c) => c.name === this.selectedClassName
        );
        if (!classEntry) {
            showNotification('Selected class not found', 'error');
            return;
        }

        // Increase class level and total level
        classEntry.level++;
        this.character.level++;

        // Load and apply new features for this level
        await this._loadFeaturesForClass(classEntry);

        levelUpService.updateSpellSlots(this.character);
        showNotification(`Leveled up ${this.selectedClassName} to level ${classEntry.level}!`, 'success');
        eventBus.emit(EVENTS.CHARACTER_UPDATED, this.character);
        await this._renderAll();
    }

    async _handleDecreaseLevel() {
        if (!this.character || !this.selectedClassName) {
            showNotification('Select a class to level down', 'warning');
            return;
        }

        // Find the selected class entry
        const classEntry = this.character.progression.classes.find(
            (c) => c.name === this.selectedClassName
        );
        if (!classEntry || classEntry.level <= 1) {
            showNotification('Cannot reduce class level below 1', 'warning');
            return;
        }

        const confirmed = confirm(`Decrease ${this.selectedClassName} level to ${classEntry.level - 1}?`);
        if (!confirmed) return;

        // Decrease class level and total level
        classEntry.level--;
        this.character.level--;

        // Remove features above new level
        classEntry.features = (classEntry.features || []).filter(
            (f) => f.level <= classEntry.level
        );

        levelUpService.updateSpellSlots(this.character);
        showNotification(`Leveled down ${this.selectedClassName} to ${classEntry.level}`, 'info');
        eventBus.emit(EVENTS.CHARACTER_UPDATED, this.character);
        await this._renderAll();
    }

    async _handleAddClass() {
        if (!this.character) return;
        const select = this.modalEl.querySelector('#levelUpClassSelect');
        const value = select?.value || '';
        if (!value) {
            showNotification('Select a class to add', 'warning');
            return;
        }
        const options = levelUpService.getMulticlassOptions(this.character, this.ignoreMulticlassReqs);
        const selectedOption = options.find((o) => o.name === value);
        if (!selectedOption) {
            showNotification('Selected class is unavailable', 'error');
            return;
        }
        if (!this.ignoreMulticlassReqs && !selectedOption.meetsRequirements) {
            showNotification('Ability scores do not meet the multiclass requirements. Toggle restrictions to override.', 'warning');
            return;
        }
        try {
            console.info('LevelUpModal', `Adding class: ${value}`);
            const classEntry = levelUpService.addClassLevel(this.character, value, 1);
            this.character.level++;

            // Load features for the new class
            if (classEntry) {
                await this._loadFeaturesForClass(classEntry);
            }

            levelUpService.updateSpellSlots(this.character);
            showNotification(`Added ${value} level 1`, 'success');
            eventBus.emit(EVENTS.CHARACTER_UPDATED, this.character);

            // Reset selection and set new class as selected
            select.value = '';
            this.selectedClassName = value;
            await this._renderAll();
        } catch (err) {
            console.error('LevelUpModal', '_handleAddClass failed', err);
            showNotification(`Failed to add ${value}`, 'error');
        }
    }

    _handleRecalcHP() {
        if (!this.character) return;
        const maxHP = levelUpService.calculateMaxHitPoints(this.character);
        this.character.hitPoints = {
            ...this.character.hitPoints,
            max: maxHP,
            current: Math.min(this.character.hitPoints?.current || maxHP, maxHP),
        };
        showNotification(`Hit points recalculated: ${maxHP}`, 'success');
        eventBus.emit(EVENTS.CHARACTER_UPDATED, this.character);
    }

    async _handleSelectFeat() {
        // Lazy import to avoid circular deps
        const { FeatCard } = await import('../Feat.js');
        const modal = new FeatCard();
        await modal.show();
    }

    _handleToggleRequirements() {
        // Toggle the restrictions flag
        this.ignoreMulticlassReqs = !this.ignoreMulticlassReqs;

        // Update button state
        const btn = this.modalEl.querySelector('#ignoreMulticlassReqsToggle');
        if (btn) {
            btn.setAttribute('data-restrictions', this.ignoreMulticlassReqs ? 'true' : 'false');
        }

        // Re-render the class select to apply new filter
        this._renderClassSelect();

        console.debug('LevelUpModal', `Multiclass requirements ${this.ignoreMulticlassReqs ? 'disabled' : 'enabled'}`);
    }

    async _renderAll() {
        this._renderOverview();
        await this._renderClassSelect();
        await this._renderFeatures();
        this._renderHP();
        this._renderSpellSlots();
        this._renderASI();
    }

    _renderOverview() {
        const total = this.modalEl.querySelector('#levelUpTotalLevel');
        const breakdown = this.modalEl.querySelector('#levelUpClassBreakdown');
        if (!total || !breakdown) return;
        total.textContent = this.character?.level || 1;
        if (this.character?.progression?.classes?.length) {
            let html = '<div class="d-flex flex-column gap-2">';
            for (const c of this.character.progression.classes) {
                const isSelected = c.name === this.selectedClassName;
                const selectedClass = isSelected ? 'border-primary bg-light' : '';
                const cursor = 'cursor-pointer';
                html += `
                    <div class="d-flex justify-content-between align-items-center p-2 border rounded ${selectedClass} ${cursor}" 
                         data-class-name="${c.name}" 
                         style="cursor: pointer;">
                        <div>
                            ${isSelected ? '<i class="fas fa-check-circle text-primary me-2"></i>' : ''}
                            <strong>${c.name}</strong> ${c.subclass ? `<span class="text-muted">(${c.subclass.name})</span>` : ''}
                        </div>
                        <div>
                            <span class="badge bg-primary">Level ${c.level}</span>
                            <span class="badge bg-secondary">${c.hitDice || ''}</span>
                        </div>
                    </div>`;
            }
            html += '</div>';
            breakdown.innerHTML = html;

            // Add click handlers for class selection
            const classCards = breakdown.querySelectorAll('[data-class-name]');
            classCards.forEach(card => {
                card.addEventListener('click', () => {
                    this.selectedClassName = card.getAttribute('data-class-name');
                    this._renderOverview();
                    this._renderFeatures();
                });
            });
        } else {
            breakdown.innerHTML = '<p class="text-muted">No classes selected.</p>';
        }
    }

    async _renderClassSelect() {
        const select = this.modalEl.querySelector('#levelUpClassSelect');
        if (!select) {
            console.warn('LevelUpModal', '_renderClassSelect: select element not found');
            return;
        }
        try {
            const options = levelUpService.getMulticlassOptions(this.character, this.ignoreMulticlassReqs);
            const prev = select.value;
            const optionHtml = options.map((o) => {
                const label = o.requirementText ? `${o.name} (${o.requirementText})` : o.name;
                // When ignoring requirements, don't disable any options
                const disabledAttr = (this.ignoreMulticlassReqs || o.meetsRequirements) ? '' : ' disabled';
                return `<option value="${o.name}"${disabledAttr}>${label}</option>`;
            }).join('');
            select.innerHTML = `<option value="">Select a class...</option>${optionHtml}`;
            if (options.some((o) => o.name === prev)) select.value = prev;
            console.debug('LevelUpModal', `Populated class select with ${options.length} options (requirements ${this.ignoreMulticlassReqs ? 'off' : 'on'})`);
        } catch (err) {
            console.error('LevelUpModal', '_renderClassSelect failed', err);
            select.innerHTML = '<option value="">Select a class...</option>';
        }
    }

    async _renderFeatures() {
        const list = this.modalEl.querySelector('#levelUpFeaturesList');
        if (!list) return;

        // Collect features from all classes
        const allFeatures = [];
        for (const classEntry of this.character.progression.classes || []) {
            for (const f of classEntry.features || []) {
                allFeatures.push({
                    name: f.name,
                    level: f.level || 1,
                    source: f.source,
                    description: f.description,
                    className: classEntry.name,
                });
            }
        }

        if (!allFeatures.length) {
            list.innerHTML = '<p class="text-muted">No features yet.</p>';
            return;
        }

        // Group features by level
        const byLevel = new Map();
        for (const feat of allFeatures) {
            const lvl = feat.level || 1;
            if (!byLevel.has(lvl)) byLevel.set(lvl, []);
            byLevel.get(lvl).push(feat);
        }

        // Sort levels ascending
        const sortedLevels = Array.from(byLevel.keys()).sort((a, b) => a - b);
        let html = '';
        for (const lvl of sortedLevels) {
            const feats = byLevel.get(lvl);
            html += `<div class="mb-3">
                        <div class="d-flex align-items-center mb-2">
                            <h6 class="mb-0">Level ${lvl}</h6>
                        </div>
                        <div class="row g-2">`;
            for (const feat of feats) {
                const tooltipContent = await this._featureEntriesToHtml(feat.description);
                const escapedContent = (tooltipContent || '').replace(/"/g, '&quot;');
                html += `
                    <div class="col-12 col-md-6 col-xl-4">
                        <div class="list-group-item d-flex justify-content-between align-items-center">
                                <span class="rd__hover-link" 
                                    data-hover-type="feature" 
                                    data-hover-name="${this._escapeHtml(feat.name)}" 
                                    data-hover-content="${escapedContent}">${feat.name}</span>
                            <span class="badge bg-secondary">${feat.className}</span>
                        </div>
                    </div>`;
            }
            html += `</div>
                    </div>`;
        }

        list.innerHTML = html;

        // Process element for custom tooltips
        try {
            await textProcessor.processElement(list);
        } catch (err) {
            console.warn('LevelUpModal', 'Failed to process tooltips', err);
        }
    }

    async _featureEntriesToHtml(entries) {
        if (!entries) return '';

        // If entries is already a string, process formatting/tags
        if (typeof entries === 'string') {
            return await textProcessor.processString(entries);
        }

        if (!Array.isArray(entries)) {
            return '';
        }

        let result = '';

        for (const entry of entries) {
            if (typeof entry === 'string') {
                const processed = await textProcessor.processString(entry);
                result += `<p>${processed}</p>`;
                continue;
            }

            if (Array.isArray(entry)) {
                result += await this._featureEntriesToHtml(entry);
                continue;
            }

            if (entry.entries) {
                result += await this._featureEntriesToHtml(entry.entries);
                continue;
            }

            if (entry.entry) {
                result += await this._featureEntriesToHtml(entry.entry);
                continue;
            }

            if (entry.name || entry.text) {
                const processed = await textProcessor.processString(entry.name || entry.text);
                result += `<p>${processed}</p>`;
            }
        }

        return result;
    }

    _entriesToPlainText(entries) {
        if (!entries) return '';
        const parts = [];
        const walk = (e) => {
            if (typeof e === 'string') { parts.push(e); return; }
            if (Array.isArray(e)) { e.forEach(walk); return; }
            if (e && typeof e === 'object') {
                if (e.entry) walk(e.entry);
                if (e.entries) walk(e.entries);
                if (e.name) parts.push(e.name);
                if (e.text) parts.push(e.text);
            }
        };
        walk(entries);
        return parts.join(' ').replace(/\s+/g, ' ').trim();
    }

    _escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    _renderHP() {
        const maxEl = this.modalEl.querySelector('#levelUpMaxHP');
        const brEl = this.modalEl.querySelector('#levelUpHPBreakdown');
        if (!maxEl || !brEl) {
            console.warn('LevelUpModal', '_renderHP: HP elements not found');
            return;
        }
        try {
            const maxHP = levelUpService.calculateMaxHitPoints(this.character);
            maxEl.textContent = maxHP || this.character.hitPoints?.max || 0;
            let breakdown = '';
            const classes = this.character.progression?.classes || [];
            if (classes.length > 0) {
                for (const c of classes) {
                    breakdown += `${c.name}: ${c.hitDice || 'd8'} × ${c.level}<br>`;
                }
            } else {
                breakdown += 'No classes yet<br>';
            }
            const conMod = this.character.getAbilityModifier?.('constitution') || 0;
            breakdown += `Constitution modifier: ${conMod >= 0 ? '+' : ''}${conMod} per level`;
            brEl.innerHTML = breakdown;
            console.debug('LevelUpModal', `Rendered HP: ${maxHP}`);
        } catch (err) {
            console.error('LevelUpModal', '_renderHP failed', err);
            maxEl.textContent = this.character.hitPoints?.max || 0;
            brEl.innerHTML = 'HP calculation unavailable';
        }
    }

    _renderSpellSlots() {
        const card = this.modalEl.querySelector('#levelUpSpellSlotsContainer');
        if (!card) {
            console.warn('LevelUpModal', '_renderSpellSlots: container not found');
            return;
        }
        try {
            let html = '';
            const classes = this.character.spellcasting?.classes || {};
            for (const [className, data] of Object.entries(classes)) {
                if (data.spellSlots && Object.keys(data.spellSlots).length) {
                    html += `<div class="mb-2"><strong>${className}</strong></div>`;
                    html += '<div class="d-flex gap-2 flex-wrap">';
                    for (const [lvl, slots] of Object.entries(data.spellSlots)) {
                        html += `<div class="badge bg-primary">Lv ${lvl}: ${slots.current}/${slots.max}</div>`;
                    }
                    html += '</div>';
                }
            }
            card.innerHTML = html || '<p class="text-muted">No spell slots.</p>';
            console.debug('LevelUpModal', `Rendered spell slots for ${Object.keys(classes).length} classes`);
        } catch (err) {
            console.error('LevelUpModal', '_renderSpellSlots failed', err);
            card.innerHTML = '<p class="text-muted">No spell slots.</p>';
        }
    }

    _renderASI() {
        const badge = this.modalEl.querySelector('#levelUpASIIndicator');
        const btn = this.modalEl.querySelector('#levelUpSelectFeatBtn');
        const hasASI = levelUpService.hasASIAvailable(this.character);
        if (badge) badge.style.display = hasASI ? 'block' : 'none';
        if (btn) btn.style.display = hasASI ? 'block' : 'none';
    }

    async _loadAllClassFeatures() {
        try {
            // Load features for all existing classes up to their current level
            const { classService } = await import('../../services/ClassService.js');

            for (const classEntry of this.character.progression.classes || []) {
                await this._loadFeaturesForClass(classEntry, classService);
            }
        } catch (err) {
            console.error('LevelUpModal', '_loadAllClassFeatures failed', err);
            showNotification('Failed to load class features', 'error');
        }
    }

    async _loadFeaturesForClass(classEntry, classServiceInstance = null) {
        try {
            // Lazy import if not provided
            const classService = classServiceInstance || (await import('../../services/ClassService.js')).classService;

            // Initialize features array if needed
            if (!classEntry.features) {
                classEntry.features = [];
            }

            // Use classService.getClassFeatures to get all features up to current level
            const features = classService.getClassFeatures(classEntry.name, classEntry.level);

            console.info('LevelUpModal', `Found ${features.length} features for ${classEntry.name} level ${classEntry.level}`);

            for (const feature of features) {
                const exists = classEntry.features.some(x => x.name === feature.name && x.level === feature.level);
                if (!exists) {
                    classEntry.features.push({
                        name: feature.name,
                        level: feature.level,
                        source: feature.source,
                        description: feature.entries
                    });
                }
            }

            // Load subclass features if applicable
            if (classEntry.subclass) {
                const subFeatures = classService.getSubclassFeatures(
                    classEntry.name,
                    classEntry.subclass.shortName || classEntry.subclass.name,
                    classEntry.level
                );

                console.info('LevelUpModal', `Found ${subFeatures.length} subclass features for ${classEntry.subclass?.name || classEntry.subclass}`);

                for (const feature of subFeatures) {
                    const exists = classEntry.features.some(x => x.name === feature.name && x.level === feature.level);
                    if (!exists) {
                        classEntry.features.push({
                            name: feature.name,
                            level: feature.level,
                            source: feature.source,
                            description: feature.entries
                        });
                    }
                }
            }

            console.info('LevelUpModal', `Total ${classEntry.features.length} features loaded for ${classEntry.name}`);
        } catch (err) {
            console.error('LevelUpModal', `_loadFeaturesForClass failed for ${classEntry?.name}`, err);
        }
    }
}
