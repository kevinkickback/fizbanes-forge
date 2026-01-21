// Demo script for split card layout functionality with real data
// Handles info panel collapse/expand and focus-driven content switching

import { AppState } from '../../app/AppState.js';
import { textProcessor } from '../../lib/TextProcessor.js';
import { getAbilityData } from '../../services/AbilityScoreService.js';
import { classService } from '../../services/ClassService.js';
import { featService } from '../../services/FeatService.js';
import { levelUpService } from '../../services/LevelUpService.js';
import { raceService } from '../../services/RaceService.js';
import { spellService } from '../../services/SpellService.js';

export class SplitCardDemo {
    constructor() {
        this.character = null;
        // Don't call init from constructor - let PageHandler await it
    }

    async init() {
        console.debug('[SplitCardDemo] Initializing demo with real data...');

        // Get current character or create demo data
        this.character = AppState.getCurrentCharacter();

        // Update data source message
        const dataSourceEl = document.getElementById('dataSource');
        console.debug('[SplitCardDemo] Data source element:', dataSourceEl);

        if (dataSourceEl) {
            if (this.character) {
                const level = this.character.getTotalLevel ? this.character.getTotalLevel() : 1;
                dataSourceEl.textContent = `Using current character: ${this.character.name} (Level ${level})`;
                dataSourceEl.parentElement.classList.remove('alert-info');
                dataSourceEl.parentElement.classList.add('alert-success');
            } else {
                dataSourceEl.textContent = 'No character loaded. Using default examples (Cleric 4, Half-Elf).';
            }
        } else {
            console.error('[SplitCardDemo] dataSource element not found!');
        }

        // Wait for services to be ready
        await this.ensureServicesReady();

        // Populate cards with real data
        console.debug('[SplitCardDemo] Populating cards...');
        await this.populateClassCard();
        await this.populateRaceCard();
        await this.populateFeatCard();

        // Set up toggle buttons
        console.debug('[SplitCardDemo] Setting up toggle buttons...');
        this.setupToggleButtons();

        // Set up focus-driven info switching
        console.debug('[SplitCardDemo] Setting up focus-driven info...');
        this.setupFocusDrivenInfo();

        // Set up clickable choice items
        console.debug('[SplitCardDemo] Setting up clickable choices...');
        this.setupClickableChoices();

        // Load saved preferences
        console.debug('[SplitCardDemo] Loading preferences...');
        this.loadPreferences();

        console.debug('[SplitCardDemo] Initialization complete!');
    }

    async ensureServicesReady() {
        const services = [classService, raceService, featService, spellService];
        await Promise.all(services.map(s => s.initialize()));
    }

    setupToggleButtons() {
        const toggleButtons = document.querySelectorAll('.info-toggle');

        toggleButtons.forEach(button => {
            button.addEventListener('click', () => {
                const targetId = button.getAttribute('data-target');
                const infoPanel = document.getElementById(targetId);

                if (infoPanel) {
                    const isCollapsed = infoPanel.classList.contains('collapsed');

                    if (isCollapsed) {
                        this.expandPanel(infoPanel, button);
                    } else {
                        this.collapsePanel(infoPanel, button);
                    }

                    // Save preference
                    this.savePreference(targetId, !isCollapsed);
                }
            });
        });
    }

    collapsePanel(panel, button) {
        panel.classList.add('collapsed');
        button.classList.add('active');

        // Update button text
        const buttonText = button.querySelector('i');
        if (buttonText) {
            buttonText.className = 'fas fa-eye';
        }

        // Announce to screen readers
        button.setAttribute('aria-label', 'Show information panel');
        panel.setAttribute('aria-hidden', 'true');
    }

    expandPanel(panel, button) {
        panel.classList.remove('collapsed');
        button.classList.remove('active');

        // Update button text
        const buttonText = button.querySelector('i');
        if (buttonText) {
            buttonText.className = 'fas fa-info-circle';
        }

        // Announce to screen readers
        button.setAttribute('aria-label', 'Hide information panel');
        panel.setAttribute('aria-hidden', 'false');
    }

    setupFocusDrivenInfo() {
        // When a choice item gets focus/hover, show relevant info
        const choiceItems = document.querySelectorAll('.choice-item[data-info]');

        choiceItems.forEach(item => {
            // Mouse hover
            item.addEventListener('mouseenter', () => {
                this.showInfo(item);
            });

            // Focus (keyboard navigation)
            item.addEventListener('focusin', () => {
                this.showInfo(item);
            });

            // Click
            item.addEventListener('click', () => {
                this.showInfo(item);
            });
        });
    }

    showInfo(choiceItem) {
        const infoKey = choiceItem.getAttribute('data-info');
        if (!infoKey) return;

        // Find the parent card's info panel
        const card = choiceItem.closest('.split-card-demo');
        if (!card) return;

        const infoPanel = card.querySelector('.info-panel');
        if (!infoPanel) return;

        // Don't auto-expand if user has manually collapsed it
        if (infoPanel.classList.contains('collapsed')) {
            // Just switch the content but don't expand
            const allInfoContent = infoPanel.querySelectorAll('.info-content');
            allInfoContent.forEach(content => {
                content.classList.add('d-none');
            });

            const targetInfo = infoPanel.querySelector(`[data-for="${infoKey}"]`);
            if (targetInfo) {
                targetInfo.classList.remove('d-none');
            }
            return;
        }

        // Hide all info content blocks
        const allInfoContent = infoPanel.querySelectorAll('.info-content');
        allInfoContent.forEach(content => {
            content.classList.add('d-none');
        });

        // Show the relevant info content
        const targetInfo = infoPanel.querySelector(`[data-for="${infoKey}"]`);
        if (targetInfo) {
            targetInfo.classList.remove('d-none');
        }
    }

    setupClickableChoices() {
        // Handle radio button selections and hover for all clickable items
        const clickableChoices = document.querySelectorAll('.choice-item.clickable, .nested-race-item.clickable, .nested-subrace-item.clickable');

        clickableChoices.forEach(item => {
            // Click handler
            item.addEventListener('click', (e) => {
                // Don't trigger if clicking the expand icon
                if (e.target.classList.contains('expand-icon')) return;

                // If the click wasn't on the radio button itself, trigger it
                if (e.target !== item.querySelector('input[type="radio"]')) {
                    const radio = item.querySelector('input[type="radio"]');
                    if (radio) {
                        radio.checked = true;
                    }
                }
            });

            // Hover handler for showing info
            item.addEventListener('mouseenter', () => {
                this.showInfo(item);
            });
        });
    }

    savePreference(panelId, isCollapsed) {
        try {
            const prefs = this.getPreferences();
            prefs[panelId] = isCollapsed ? 'collapsed' : 'expanded';
            localStorage.setItem('splitCardPrefs', JSON.stringify(prefs));
        } catch (e) {
            console.warn('[SplitCardDemo] Could not save preference:', e);
        }
    }

    loadPreferences() {
        const prefs = this.getPreferences();

        // Apply saved preferences
        Object.keys(prefs).forEach(panelId => {
            const panel = document.getElementById(panelId);
            const button = document.querySelector(`[data-target="${panelId}"]`);

            if (panel && button) {
                if (prefs[panelId] === 'collapsed') {
                    this.collapsePanel(panel, button);
                } else {
                    this.expandPanel(panel, button);
                }
            }
        });

        // Default behavior: collapse on mobile, expand on desktop
        if (Object.keys(prefs).length === 0) {
            const isMobile = window.innerWidth < 992;
            if (isMobile) {
                document.querySelectorAll('.info-panel').forEach(panel => {
                    const button = document.querySelector(`[data-target="${panel.id}"]`);
                    if (button) {
                        this.collapsePanel(panel, button);
                    }
                });
            }
        }
    }

    getPreferences() {
        try {
            const saved = localStorage.getItem('splitCardPrefs');
            return saved ? JSON.parse(saved) : {};
        } catch {
            return {};
        }
    }

    async populateClassCard() {
        console.debug('[SplitCardDemo] Populating class card...');

        const classData = this.character
            ? classService.getClass(this.character.getPrimaryClass()?.name, this.character.getPrimaryClass()?.source)
            : classService.getClass('Cleric', 'PHB');

        if (!classData) {
            console.warn('[SplitCardDemo] No class data found');
            return;
        }

        const level = this.character ? (this.character.getTotalLevel ? this.character.getTotalLevel() : 4) : 4;
        const subclass = this.character?.getPrimaryClass()?.subclass || null;

        // Update card header
        const header = document.querySelector('#classCardDemo .card-header h5');
        if (header) {
            header.textContent = `${classData.name}${subclass ? ` (${subclass})` : ''} (Level ${level})`;
        }

        const choicesPanel = document.getElementById('classChoicesPanel');
        const infoPanel = document.getElementById('classInfo');

        if (!choicesPanel || !infoPanel) return;

        // Clear existing content
        choicesPanel.innerHTML = '';
        infoPanel.innerHTML = '';

        // Add section header
        choicesPanel.innerHTML = `<div class="section-header"><h6 class="mb-3">Level ${level} Choices</h6></div>`;

        // Get class features at this level
        const features = classData.classFeatures?.[level - 1] || [];

        // Check for ASI
        let hasASI = false;
        if (this.character) {
            hasASI = levelUpService.hasASIAvailable(this.character);
        } else {
            const asiLevels = [4, 8, 12, 16, 19];
            hasASI = asiLevels.includes(level);
        }

        // Add ASI/Feat choice if available
        if (hasASI) {
            const asiChoice = document.createElement('div');
            asiChoice.className = 'choice-item';
            asiChoice.setAttribute('data-info', 'asi-feat');
            asiChoice.innerHTML = `
                <div class="choice-label">
                    <span class="badge bg-warning text-dark">Required</span>
                    <strong>Improvement Option</strong>
                </div>
                <select class="form-select form-select-sm mt-2">
                    <option value="">Choose one...</option>
                    <option value="asi">Ability Score Improvement</option>
                    <option value="feat">Take a Feat</option>
                </select>
            `;
            choicesPanel.appendChild(asiChoice);
        }

        // Add class features
        if (Array.isArray(features) && features.length > 0) {
            for (const feature of features) {
                if (!feature || !feature.name) continue;

                const featureChoice = document.createElement('div');
                featureChoice.className = 'choice-item';
                featureChoice.setAttribute('data-info', this.sanitizeId(feature.name));
                featureChoice.innerHTML = `
                    <div class="choice-label">
                        <i class="fas fa-star text-primary"></i>
                        <strong>${feature.name}</strong>
                    </div>
                    <div class="choice-value">${feature.type || 'Class Feature'}</div>
                `;
                choicesPanel.appendChild(featureChoice);

                // Create info panel for feature
                await this.createFeatureInfoPanel(feature, 'classInfo');
            }
        }

        // Add subclass features
        if (subclass) {
            const subclassData = classService.getSubclass(classData.name, subclass);
            if (subclassData?.subclassFeatures) {
                const subclassFeatures = subclassData.subclassFeatures.flat().filter(f => f.level === level);
                for (const feature of subclassFeatures) {
                    if (!feature || !feature.name) continue;

                    const featureChoice = document.createElement('div');
                    featureChoice.className = 'choice-item';
                    featureChoice.setAttribute('data-info', this.sanitizeId(feature.name));
                    featureChoice.innerHTML = `
                        <div class="choice-label">
                            <i class="fas fa-certificate text-success"></i>
                            <strong>${feature.name}</strong>
                        </div>
                        <div class="choice-value">${subclass} Feature</div>
                    `;
                    choicesPanel.appendChild(featureChoice);

                    await this.createFeatureInfoPanel(feature, 'classInfo');
                }
            }
        }

        // Add default info content
        const fluff = classService.getClassFluff(classData.name, classData.source);
        const intro = fluff?.entries?.[0];

        const defaultInfo = document.createElement('div');
        defaultInfo.className = 'info-content';
        defaultInfo.setAttribute('data-for', 'default');
        defaultInfo.innerHTML = `
            <h6>${classData.name}</h6>
            <p class="text-muted small">${typeof intro === 'string' ? intro : 'Class features and abilities.'}</p>
            <hr>
            <h6>Level ${level}</h6>
            <p class="text-muted small">
                <strong>Hit Die:</strong> d${classData.hd?.faces || 8}<br>
                <strong>Primary Ability:</strong> ${classData.spellcastingAbility || 'Varies'}<br>
                <strong>Proficiency Bonus:</strong> +${Math.floor((level - 1) / 4) + 2}
            </p>
        `;
        infoPanel.appendChild(defaultInfo);

        // Add ASI info
        if (hasASI) {
            const asiInfo = document.createElement('div');
            asiInfo.className = 'info-content d-none';
            asiInfo.setAttribute('data-for', 'asi-feat');
            asiInfo.innerHTML = `
                <h6>Ability Score Improvement or Feat</h6>
                <p class="text-muted small mb-2">
                    <strong>Ability Score Improvement:</strong> Increase one ability score by 2, 
                    or two ability scores by 1 each. You can't increase an ability score above 20.
                </p>
                <p class="text-muted small mb-2">
                    <strong>Feat:</strong> Gain a special feature that provides unique abilities 
                    or bonuses. Some feats have prerequisites.
                </p>
                <div class="alert alert-sm alert-warning mb-0">
                    <small>💡 <strong>Tip:</strong> ASI is generally more powerful early on, 
                    but feats can define your character's playstyle.</small>
                </div>
            `;
            infoPanel.appendChild(asiInfo);
        }
    }

    async createFeatureInfoPanel(feature, panelId) {
        const infoPanel = document.getElementById(panelId);
        if (!infoPanel || !feature) return;

        const infoContent = document.createElement('div');
        infoContent.className = 'info-content d-none';
        infoContent.setAttribute('data-for', this.sanitizeId(feature.name));

        let html = `<h6>${feature.name}</h6>`;

        if (feature.entries) {
            html += `<div class="text-muted small feature-text"></div>`;
        }

        infoContent.innerHTML = html;

        const entriesDiv = infoContent.querySelector('.feature-text');
        if (entriesDiv && feature.entries) {
            entriesDiv.innerHTML = this.formatEntries(feature.entries);
            await textProcessor.processElement(entriesDiv);
        }

        infoPanel.appendChild(infoContent);
    }

    async populateRaceCard() {
        console.debug('[SplitCardDemo] Populating race card...');

        const races = raceService.getAllRaces();
        const choicesPanel = document.getElementById('raceChoicesPanel');
        const infoPanel = document.getElementById('raceInfo');

        if (!choicesPanel || !infoPanel) return;

        // Clear existing content
        choicesPanel.innerHTML = '';
        infoPanel.innerHTML = '';

        // Add section header
        choicesPanel.innerHTML = `
            <div class="section-header">
                <h6 class="mb-3">Available Races (4 Different Styles)</h6>
                <p class="text-muted small mb-3">Hover to see details • Each race shows a different subrace selection style</p>
            </div>
            <div class="race-list nested-list" id="raceList"></div>
        `;

        const raceList = document.getElementById('raceList');

        if (!races || races.length === 0) {
            console.warn('[SplitCardDemo] No races found');
            raceList.innerHTML = '<p class="text-muted small">No races available</p>';
            return;
        }

        // Filter to PHB races only and limit to 4 for demo
        const phbRaces = races.filter(r => r.source === 'PHB').slice(0, 4);

        // Sort alphabetically
        phbRaces.sort((a, b) => a.name.localeCompare(b.name));

        // Define 4 different subrace selection styles
        const styles = ['nested-expandable', 'list-replacement', 'inline-info', 'inline-dropdown'];

        for (let i = 0; i < phbRaces.length; i++) {
            const race = phbRaces[i];
            const style = styles[i];
            const subraces = raceService.getSubraces(race.name, race.source);
            const hasSubraces = subraces && subraces.length > 0;
            const raceId = this.sanitizeId(race.name);

            // Create race container based on style
            if (style === 'nested-expandable') {
                await this.createNestedExpandableRace(raceList, race, subraces, raceId);
            } else if (style === 'list-replacement') {
                await this.createListReplacementRace(raceList, race, subraces, raceId);
            } else if (style === 'inline-info') {
                await this.createInlineInfoRace(raceList, race, subraces, raceId);
            } else if (style === 'inline-dropdown') {
                await this.createInlineDropdownRace(raceList, race, subraces, raceId);
            }

            // Create info panel content for this race
            await this.createRaceInfoPanel(race);
        }

        // Add default info content
        const defaultInfo = document.createElement('div');
        defaultInfo.className = 'info-content';
        defaultInfo.setAttribute('data-for', 'default');
        defaultInfo.innerHTML = `
            <h6>Choose a Race</h6>
            <p class="text-muted small">
                Your race determines many of your character's innate abilities, including ability score increases, 
                size, speed, and special traits.
            </p>
            <div class="alert alert-sm alert-info mb-0">
                <small>💡 Select a race to see its traits. Races with ▶ have subraces you can expand.</small>
            </div>
        `;
        infoPanel.appendChild(defaultInfo);
    }

    // Style 1: Nested Expandable (click ▶ to expand subraces below)
    async createNestedExpandableRace(container, race, subraces, raceId) {
        const hasSubraces = subraces && subraces.length > 0;
        const raceContainer = document.createElement('div');
        raceContainer.className = 'nested-race-container style-nested';
        raceContainer.innerHTML = `<div class="style-label">Style 1: Nested Expandable</div>`;

        const raceItem = document.createElement('div');
        raceItem.className = 'nested-race-item clickable';
        raceItem.setAttribute('data-info', raceId);

        raceItem.innerHTML = `
            <div class="d-flex align-items-center gap-2">
                ${hasSubraces ? '<span class="expand-icon">▶</span>' : '<span class="expand-icon-spacer"></span>'}
                <input type="radio" name="race" value="${race.name}" class="form-check-input">
                <div class="flex-grow-1">
                    <strong>${race.name}</strong>
                </div>
            </div>
        `;

        raceContainer.appendChild(raceItem);

        if (hasSubraces) {
            const subraceList = document.createElement('div');
            subraceList.className = 'subrace-list collapsed';

            for (const subrace of subraces) {
                const subraceId = this.sanitizeId(`${race.name}-${subrace.name}`);
                const subraceItem = document.createElement('div');
                subraceItem.className = 'nested-subrace-item clickable';
                subraceItem.setAttribute('data-info', subraceId);

                subraceItem.innerHTML = `
                    <div class="d-flex align-items-center gap-2">
                        <input type="radio" name="race" value="${race.name}|${subrace.name}" class="form-check-input">
                        <div class="flex-grow-1"><strong>${subrace.name}</strong></div>
                    </div>
                `;

                subraceList.appendChild(subraceItem);
                await this.createRaceInfoPanel(race, subrace);
            }

            raceContainer.appendChild(subraceList);

            const expandIcon = raceItem.querySelector('.expand-icon');
            expandIcon?.addEventListener('click', (e) => {
                e.stopPropagation();
                const isExpanded = subraceList.classList.contains('expanded');
                subraceList.classList.toggle('expanded', !isExpanded);
                subraceList.classList.toggle('collapsed', isExpanded);
                expandIcon.textContent = isExpanded ? '▶' : '▼';
            });
        }

        container.appendChild(raceContainer);
    }

    // Style 2: List Replacement (click race to swap list with subraces + back button)
    async createListReplacementRace(container, race, subraces, raceId) {
        const hasSubraces = subraces && subraces.length > 0;
        const raceContainer = document.createElement('div');
        raceContainer.className = 'nested-race-container style-replacement';
        raceContainer.innerHTML = `<div class="style-label">Style 2: List Replacement</div>`;

        const raceItem = document.createElement('div');
        raceItem.className = 'nested-race-item clickable';
        raceItem.setAttribute('data-info', raceId);

        raceItem.innerHTML = `
            <div class="d-flex align-items-center gap-2">
                ${hasSubraces ? '<span class="expand-icon">→</span>' : '<span class="expand-icon-spacer"></span>'}
                <input type="radio" name="race" value="${race.name}" class="form-check-input">
                <div class="flex-grow-1">
                    <strong>${race.name}</strong>
                </div>
            </div>
        `;

        raceContainer.appendChild(raceItem);

        if (hasSubraces) {
            // Create subrace selection view (hidden initially)
            const subraceView = document.createElement('div');
            subraceView.className = 'subrace-replacement-view d-none';
            subraceView.innerHTML = `<button class="btn btn-sm btn-outline-secondary mb-2 back-btn">← Back to Races</button>`;

            for (const subrace of subraces) {
                const subraceId = this.sanitizeId(`${race.name}-${subrace.name}`);
                const subraceItem = document.createElement('div');
                subraceItem.className = 'nested-subrace-item clickable';
                subraceItem.setAttribute('data-info', subraceId);

                subraceItem.innerHTML = `
                    <div class="d-flex align-items-center gap-2">
                        <input type="radio" name="race" value="${race.name}|${subrace.name}" class="form-check-input">
                        <div class="flex-grow-1"><strong>${subrace.name}</strong></div>
                    </div>
                `;

                subraceView.appendChild(subraceItem);
                await this.createRaceInfoPanel(race, subrace);
            }

            raceContainer.appendChild(subraceView);

            // Arrow click shows subrace view
            const expandIcon = raceItem.querySelector('.expand-icon');
            expandIcon?.addEventListener('click', (e) => {
                e.stopPropagation();
                raceItem.classList.add('d-none');
                subraceView.classList.remove('d-none');
            });

            // Back button returns to race view
            const backBtn = subraceView.querySelector('.back-btn');
            backBtn?.addEventListener('click', (e) => {
                e.stopPropagation();
                subraceView.classList.add('d-none');
                raceItem.classList.remove('d-none');
            });
        }

        container.appendChild(raceContainer);
    }

    // Style 3: Inline Info Panel (subraces show as buttons in the info pane)
    async createInlineInfoRace(container, race, subraces, raceId) {
        const hasSubraces = subraces && subraces.length > 0;
        const raceContainer = document.createElement('div');
        raceContainer.className = 'nested-race-container style-inline-info';
        raceContainer.innerHTML = `<div class="style-label">Style 3: Info Pane Selection</div>`;

        const raceItem = document.createElement('div');
        raceItem.className = 'nested-race-item clickable';
        raceItem.setAttribute('data-info', raceId + '-with-subraces');

        raceItem.innerHTML = `
            <div class="d-flex align-items-center gap-2">
                <input type="radio" name="race" value="${race.name}" class="form-check-input">
                <div class="flex-grow-1">
                    <strong>${race.name}</strong>
                </div>
            </div>
        `;

        raceContainer.appendChild(raceItem);
        container.appendChild(raceContainer);

        // Create special info panel with subrace buttons
        if (hasSubraces) {
            const infoPanel = document.getElementById('raceInfo');
            const infoContent = document.createElement('div');
            infoContent.className = 'info-content d-none';
            infoContent.setAttribute('data-for', raceId + '-with-subraces');

            let html = `<h6>${race.name}</h6>`;
            html += `<p class="text-muted small mb-3">Choose a subrace to see its details:</p>`;
            html += `<div class="subrace-button-group mb-3">`;

            for (const subrace of subraces) {
                const subraceId = this.sanitizeId(`${race.name}-${subrace.name}`);
                html += `<button class="btn btn-sm btn-outline-primary subrace-btn" data-subrace-info="${subraceId}">${subrace.name}</button>`;
            }

            html += `</div>`;
            html += `<div class="subrace-details-container"></div>`;

            infoContent.innerHTML = html;
            infoPanel.appendChild(infoContent);

            // Add click handlers for subrace buttons
            setTimeout(() => {
                const buttons = infoContent.querySelectorAll('.subrace-btn');
                const detailsContainer = infoContent.querySelector('.subrace-details-container');

                buttons.forEach(btn => {
                    btn.addEventListener('click', () => {
                        // Remove active state from all buttons
                        buttons.forEach(b => b.classList.remove('active'));
                        btn.classList.add('active');

                        // Show the corresponding subrace info
                        const subraceInfoId = btn.getAttribute('data-subrace-info');
                        const subraceInfo = infoPanel.querySelector(`[data-for="${subraceInfoId}"]`);
                        if (subraceInfo) {
                            detailsContainer.innerHTML = subraceInfo.innerHTML;
                        }
                    });
                });
            }, 100);

            // Create subrace info panels (hidden, for reference)
            for (const subrace of subraces) {
                await this.createRaceInfoPanel(race, subrace);
            }
        }
    }

    // Style 4: Inline Dropdown (dropdown appears inline when race selected)
    async createInlineDropdownRace(container, race, subraces, raceId) {
        const hasSubraces = subraces && subraces.length > 0;
        const raceContainer = document.createElement('div');
        raceContainer.className = 'nested-race-container style-dropdown';
        raceContainer.innerHTML = `<div class="style-label">Style 4: Inline Dropdown</div>`;

        const raceItem = document.createElement('div');
        raceItem.className = 'nested-race-item clickable';
        raceItem.setAttribute('data-info', raceId);

        const itemWrapper = document.createElement('div');
        itemWrapper.className = 'race-item-wrapper';

        itemWrapper.innerHTML = `
            <div class="d-flex align-items-center gap-2">
                <input type="radio" name="race" value="${race.name}" class="form-check-input race-radio-style4">
                <div class="flex-grow-1">
                    <strong>${race.name}</strong>
                </div>
            </div>
        `;

        raceItem.appendChild(itemWrapper);

        if (hasSubraces) {
            const dropdownContainer = document.createElement('div');
            dropdownContainer.className = 'inline-dropdown-container';

            const select = document.createElement('select');
            select.className = 'form-select form-select-sm';

            // Add each subrace as an option (first one will be default)
            for (const subrace of subraces) {
                const option = document.createElement('option');
                option.value = `${race.name}|${subrace.name}`;
                option.textContent = subrace.name;
                select.appendChild(option);
                await this.createRaceInfoPanel(race, subrace);
            }

            dropdownContainer.appendChild(select);

            // Insert dropdown into the flex container inline with the race name
            const flexContainer = itemWrapper.querySelector('.d-flex');
            flexContainer.appendChild(dropdownContainer);

            // Show dropdown when race item clicked or radio checked
            const radio = itemWrapper.querySelector('input[type="radio"]');

            raceItem.addEventListener('click', (e) => {
                // Don't trigger if clicking on the select itself
                if (e.target.tagName === 'SELECT' || e.target.closest('.inline-dropdown-container')) return;

                if (radio) {
                    radio.checked = true;
                    // Show the first subrace's info by default
                    const [raceName, subraceName] = select.value.split('|');
                    const subraceId = this.sanitizeId(`${raceName}-${subraceName}`);
                    const dummyItem = document.createElement('div');
                    dummyItem.setAttribute('data-info', subraceId);
                    this.showInfo(dummyItem);
                }
            });

            // Update info when subrace selected from dropdown
            select.addEventListener('change', () => {
                if (select.value) {
                    const [raceName, subraceName] = select.value.split('|');
                    const subraceId = this.sanitizeId(`${raceName}-${subraceName}`);
                    const dummyItem = document.createElement('div');
                    dummyItem.setAttribute('data-info', subraceId);
                    this.showInfo(dummyItem);
                }
            });
        }

        raceContainer.appendChild(raceItem);

        container.appendChild(raceContainer);
    }

    getRaceSummary(race) {
        const parts = [];

        if (race.size) {
            parts.push(Array.isArray(race.size) ? race.size.join('/') : race.size);
        }

        if (race.speed?.walk) {
            parts.push(`${race.speed.walk} ft.`);
        }

        if (race.ability) {
            const abilityCount = Object.keys(race.ability).filter(k => k !== 'choose').length;
            if (abilityCount > 0) {
                parts.push(`+${abilityCount} abilities`);
            }
        }

        return parts.length > 0 ? parts.join(' • ') : 'Playable race';
    }

    async createRaceInfoPanel(race, subrace = null) {
        const infoPanel = document.getElementById('raceInfo');
        if (!infoPanel) return;

        const infoContent = document.createElement('div');
        infoContent.className = 'info-content d-none';

        // Use combined ID if subrace is provided
        const contentId = subrace
            ? this.sanitizeId(`${race.name}-${subrace.name}`)
            : this.sanitizeId(race.name);
        infoContent.setAttribute('data-for', contentId);

        // Get fluff for description
        const fluff = raceService.getRaceFluff(race.name, race.source);
        const intro = fluff?.entries?.[0];

        // Title shows subrace name if provided
        const title = subrace ? `${race.name} (${subrace.name})` : race.name;
        let html = `<h6>${title}</h6>`;

        // Add description
        if (typeof intro === 'string') {
            html += `<p class="text-muted small">${intro.substring(0, 200)}${intro.length > 200 ? '...' : ''}</p>`;
        }

        html += `<hr class="my-2">`;

        // Ability Scores section (combine race and subrace)
        html += `<div class="mb-3">
            <h6 class="small">Ability Score Increase</h6>
            <ul class="text-muted small mb-0 list-unstyled">`;
        const abilityImprovements = this.formatAbilityImprovements(race, subrace).split('\n');
        html += abilityImprovements.map(improvement => `<li>${improvement}</li>`).join('');
        html += `</ul></div>`;

        // Size section
        html += `<div class="mb-3">
            <h6 class="small">Size</h6>
            <ul class="text-muted small mb-0 list-unstyled">
                <li>${this.formatSize(race)}</li>
            </ul>
        </div>`;

        // Speed section
        html += `<div class="mb-3">
            <h6 class="small">Speed</h6>
            <ul class="text-muted small mb-0 list-unstyled">`;
        const speeds = this.formatMovementSpeeds(race).split('\n');
        html += speeds.map(speed => `<li>${speed}</li>`).join('');
        html += `</ul></div>`;

        // Languages section
        html += `<div class="mb-3">
            <h6 class="small">Languages</h6>
            <ul class="text-muted small mb-0 list-unstyled">`;
        const languages = this.formatLanguages(race).split('\n');
        html += languages.map(lang => {
            // Only title-case single-word or known language names, not phrases
            if (/^choose|one other|none/i.test(lang)) return `<li>${lang}</li>`;
            // Title-case each word in comma-separated lists
            return `<li>${lang.split(', ').map(this.toTitleCase).join(', ')}</li>`;
        }).join('');
        html += `</ul></div>`;

        // Traits section (combine race and subrace traits)
        const traits = this.getCombinedTraits(race, subrace);
        if (traits.length > 0) {
            html += `<div class="mb-3">
                <h6 class="small">Traits</h6>
                <div class="traits-grid">`;

            for (const trait of traits) {
                const name = trait.name || trait.text;
                html += `<span class="trait-tag">${name}</span>`;
            }

            html += `</ul></div>`;
        }

        infoContent.innerHTML = html;
        infoPanel.appendChild(infoContent);
    }

    async populateFeatCard() {
        console.debug('[SplitCardDemo] Populating feat card...');

        const feats = featService.getAllFeats();
        const choicesPanel = document.getElementById('featChoicesPanel');
        const infoPanel = document.getElementById('featInfo');

        if (!choicesPanel || !infoPanel || !feats || feats.length === 0) {
            console.warn('[SplitCardDemo] No feats found');
            return;
        }

        // Clear existing content
        choicesPanel.innerHTML = '';
        infoPanel.innerHTML = '';

        // Add section header with search
        choicesPanel.innerHTML = `
            <div class="section-header">
                <h6 class="mb-3">Available Feats</h6>
                <input type="text" class="form-control form-control-sm mb-3" placeholder="Search feats..." id="featSearchInput">
            </div>
            <div class="feat-list" id="featList"></div>
        `;

        const featList = document.getElementById('featList');

        // Show first 10 feats
        const featsToShow = feats.slice(0, 10);

        for (const feat of featsToShow) {
            const featItem = document.createElement('div');
            featItem.className = 'choice-item clickable';
            featItem.setAttribute('data-info', this.sanitizeId(feat.name));

            featItem.innerHTML = `
                <div class="d-flex justify-content-between align-items-start">
                    <div>
                        <strong>${feat.name}</strong>
                        <div class="text-muted small">${this.getFeatSummary(feat)}</div>
                    </div>
                    <input type="radio" name="feat" class="form-check-input">
                </div>
            `;

            featList.appendChild(featItem);

            // Create info panel content for this feat
            await this.createFeatInfoPanel(feat);
        }

        // Add default info content
        const defaultInfo = document.createElement('div');
        defaultInfo.className = 'info-content';
        defaultInfo.setAttribute('data-for', 'default');
        defaultInfo.innerHTML = `
            <h6>About Feats</h6>
            <p class="text-muted small">
                Feats are special features that customize your character. 
                Each feat provides unique abilities or bonuses.
            </p>
            <div class="alert alert-sm alert-info mb-0">
                <small>💡 Hover over a feat to see its full description and benefits.</small>
            </div>
        `;
        infoPanel.appendChild(defaultInfo);
    }

    getTraitSummary(trait) {
        if (trait.type === 'ability' && trait.data) {
            return this.formatAbilityScores(trait.data);
        }
        if (trait.data?.entries) {
            const firstEntry = trait.data.entries[0];
            if (typeof firstEntry === 'string') {
                return firstEntry.substring(0, 60) + (firstEntry.length > 60 ? '...' : '');
            }
        }
        return 'Racial trait';
    }

    async createTraitInfoPanel(trait) {
        const infoPanel = document.getElementById('raceInfo');
        if (!infoPanel) return;

        const infoContent = document.createElement('div');
        infoContent.className = 'info-content d-none';
        infoContent.setAttribute('data-for', this.sanitizeId(trait.name));

        let html = `<h6>${trait.name}</h6>`;

        if (trait.type === 'ability' && trait.data) {
            html += `<p class="text-muted small">${this.formatAbilityScores(trait.data)}</p>`;
            html += `<div class="alert alert-sm alert-info mb-0">
                <small>💡 Choose ability scores that complement your class.</small>
            </div>`;
        } else if (trait.data?.entries) {
            html += `<div class="text-muted small trait-text"></div>`;
        }

        infoContent.innerHTML = html;

        const entriesDiv = infoContent.querySelector('.trait-text');
        if (entriesDiv && trait.data?.entries) {
            entriesDiv.innerHTML = this.formatEntries(trait.data.entries);
            await textProcessor.processElement(entriesDiv);
        }

        infoPanel.appendChild(infoContent);
    }

    async createFeatInfoPanel(feat) {
        const featInfo = document.getElementById('featInfo');
        if (!featInfo) return;

        const infoContent = document.createElement('div');
        infoContent.className = 'info-content d-none';
        infoContent.setAttribute('data-for', this.sanitizeId(feat.name));

        let html = `<h6>${feat.name}</h6>`;

        if (feat.prerequisite) {
            html += `<div class="badge bg-secondary mb-2">Prerequisite: ${this.formatPrerequisite(feat.prerequisite)}</div>`;
        }

        if (feat.entries) {
            html += `<div class="text-muted small feat-entries"></div>`;
        }

        infoContent.innerHTML = html;

        const entriesDiv = infoContent.querySelector('.feat-entries');
        if (entriesDiv && feat.entries) {
            entriesDiv.innerHTML = this.formatEntries(feat.entries);
            await textProcessor.processElement(entriesDiv);
        }

        featInfo.appendChild(infoContent);
    }

    formatAbilityScores(ability) {
        if (!ability) return 'No ability score increases.';

        const increases = [];
        for (const [key, value] of Object.entries(ability)) {
            if (key === 'choose') continue;
            increases.push(`${key.toUpperCase()} +${value}`);
        }

        if (ability.choose) {
            increases.push(`Choose ${ability.choose.count || 1} ability score(s) to increase`);
        }

        return increases.join(', ') || 'Variable ability score increases.';
    }

    getFeatSummary(feat) {
        if (!feat.entries || feat.entries.length === 0) return 'Special feature';

        const firstEntry = feat.entries[0];
        if (typeof firstEntry === 'string') {
            return firstEntry.substring(0, 50) + (firstEntry.length > 50 ? '...' : '');
        }

        return 'Special feature';
    }

    formatPrerequisite(prereq) {
        if (typeof prereq === 'string') return prereq;
        if (Array.isArray(prereq)) {
            return prereq.map(p => this.formatPrerequisite(p)).join(', ');
        }
        if (prereq.ability) {
            return Object.entries(prereq.ability).map(([key, val]) => `${key.toUpperCase()} ${val}`).join(', ');
        }
        return 'Special';
    }

    formatEntries(entries) {
        if (!entries) return '';

        return entries.map(entry => {
            if (typeof entry === 'string') {
                return `<p class="mb-2">${entry}</p>`;
            }
            if (entry.type === 'list') {
                const items = entry.items.map(item => `<li>${typeof item === 'string' ? item : item.name || ''}</li>`).join('');
                return `<ul class="mb-2">${items}</ul>`;
            }
            if (entry.type === 'entries' && entry.name) {
                return `<p class="mb-2"><strong>${entry.name}:</strong> ${entry.entries?.join(' ') || ''}</p>`;
            }
            return '';
        }).join('');
    }

    sanitizeId(name) {
        return name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    }

    // Helper methods from RaceDetailsView for consistent formatting
    formatAbilityImprovements(race, subrace = null) {
        // Combine race and subrace ability arrays
        const abilityArray = [
            ...(race?.ability || []),
            ...(subrace?.ability || []),
        ];

        if (abilityArray.length === 0) {
            return 'None';
        }

        // Use the unified ability parsing utility from AbilityScoreService
        const data = getAbilityData(abilityArray);

        // Return formatted text (use short format for compact display)
        return data.asTextShort || data.asText || 'None';
    }

    formatSize(race) {
        // Default to Medium size if not specified
        if (!race?.size) return 'Medium';

        if (Array.isArray(race.size)) {
            // Multiple size options
            return race.size.map(s => this.sizeAbvToFull(s)).join(' or ');
        }

        return this.sizeAbvToFull(race.size);
    }

    sizeAbvToFull(abbrev) {
        const sizes = {
            'T': 'Tiny',
            'S': 'Small',
            'M': 'Medium',
            'L': 'Large',
            'H': 'Huge',
            'G': 'Gargantuan'
        };
        return sizes[abbrev] || abbrev;
    }

    formatMovementSpeeds(race) {
        // Default to standard 30 ft. walking speed if not specified
        if (!race?.speed) return 'Walk: 30 ft.';

        const speeds = [];

        if (race.speed.walk) {
            speeds.push(`Walk: ${race.speed.walk} ft.`);
        }

        if (race.speed.fly) {
            speeds.push(`Fly: ${race.speed.fly} ft.`);
        }

        if (race.speed.swim) {
            speeds.push(`Swim: ${race.speed.swim} ft.`);
        }

        if (race.speed.climb) {
            speeds.push(`Climb: ${race.speed.climb} ft.`);
        }

        if (race.speed.burrow) {
            speeds.push(`Burrow: ${race.speed.burrow} ft.`);
        }

        return speeds.length > 0 ? speeds.join('\n') : 'Walk: 30 ft.';
    }

    formatLanguages(race) {
        if (!race?.languageProficiencies) return 'None';

        const languages = [];

        for (const langEntry of race.languageProficiencies) {
            // First, add all fixed languages
            for (const [lang, value] of Object.entries(langEntry)) {
                const langLower = lang.toLowerCase();
                if (
                    value === true &&
                    langLower !== 'other' &&
                    langLower !== 'anystandard' &&
                    langLower !== 'choose'
                ) {
                    languages.push(lang);
                }
            }

            // Then add optional language choices
            const anyStandardCount =
                langEntry.anyStandard || langEntry.anystandard || 0;
            if (anyStandardCount > 0) {
                languages.push(
                    `Choose ${anyStandardCount} standard language${anyStandardCount > 1 ? 's' : ''}`,
                );
            }

            if (langEntry.choose) {
                const count = langEntry.choose.count || 1;
                languages.push(`Choose ${count} language${count > 1 ? 's' : ''}`);
            }

            // Handle race's unique language ('other')
            if (langEntry.other === true) {
                languages.push('One other language of your choice');
            }
        }

        return languages.join('\n') || 'None';
    }

    getCombinedTraits(race, subrace = null) {
        const traits = [];
        // Entries to exclude - they have dedicated sections
        const excludedNames = ['Age', 'Size', 'Languages', 'Alignment', 'Speed'];

        // Add race entries
        if (race?.entries) {
            for (const entry of race.entries) {
                if (
                    entry.type === 'entries' &&
                    entry.name &&
                    !excludedNames.includes(entry.name)
                ) {
                    traits.push(entry);
                }
            }
        }

        // Add subrace entries
        if (subrace?.entries) {
            for (const entry of subrace.entries) {
                if (
                    entry.type === 'entries' &&
                    entry.name &&
                    !excludedNames.includes(entry.name)
                ) {
                    traits.push(entry);
                }
            }
        }

        return traits;
    }

    toTitleCase(str) {
        return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    }
}
