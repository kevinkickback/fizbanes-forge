# Phase 6: Background and Proficiency Integration

## Overview
Enhance background and proficiency handling using the unified data processing system.

## Implementation Steps

### 1. Update Background Data Loading
Update data-loader.js:

```javascript
// Update loadBackgrounds function
async function loadBackgrounds() {
    if (dataCache.backgrounds) {
        return dataCache.backgrounds;
    }

    try {
        // Load main background data and fluff
        const backgroundData = await loadJsonFile('data/backgrounds.json');
        const fluffData = await loadJsonFile('data/fluff-backgrounds.json').catch(() => ({}));

        // Process backgrounds
        const processedBackgrounds = await Promise.all((backgroundData.background || []).map(async bg => {
            const fluff = fluffData.backgroundFluff?.find(f => 
                f.name === bg.name && f.source === bg.source
            );
            return processEntityData(bg, 'background', fluff);
        }));

        // Cache and return
        dataCache.backgrounds = processedBackgrounds;
        return processedBackgrounds;
    } catch (error) {
        console.error('Error loading background data:', error);
        throw error;
    }
}
```

### 2. Update Character Background Management
Add to character.js:

```javascript
// Add to character.js
class BackgroundManager {
    constructor(character) {
        this.character = character;
        this.selectedBackground = null;
        this.selectedVariant = null;
        this.characteristics = {
            personalityTrait: null,
            ideal: null,
            bond: null,
            flaw: null
        };
    }

    async setBackground(backgroundId, variantName = null) {
        try {
            const backgrounds = await window.dndDataLoader.loadBackgrounds();
            const background = backgrounds.find(b => b.id === backgroundId);
            if (!background) return false;

            // Clear existing background features
            this.clearBackground();

            // Set new background
            this.selectedBackground = background;
            if (variantName) {
                this.selectedVariant = background.variants?.find(v => v.name === variantName);
            }

            // Apply proficiencies
            const proficiencies = this.selectedVariant?.proficiencies || background.proficiencies;
            await this.applyProficiencies(proficiencies);

            // Apply languages
            await this.applyLanguages(background.languages);

            // Add equipment
            if (background.equipment) {
                await this.character.equipment.addStartingEquipment(null, backgroundId);
            }

            // Add feature
            const feature = this.selectedVariant?.feature || background.feature;
            if (feature) {
                this.character.addFeature('background', feature.name, feature.description);
            }

            return true;
        } catch (error) {
            console.error('Error setting background:', error);
            return false;
        }
    }

    async applyProficiencies(proficiencies) {
        // Apply fixed proficiencies
        for (const skill of proficiencies.skills.fixed) {
            this.character.addProficiency('skill', skill, 'Background');
        }
        for (const tool of proficiencies.tools.fixed) {
            this.character.addProficiency('tool', tool, 'Background');
        }

        // Store choices for UI
        this.character.pendingChoices.backgroundSkills = proficiencies.skills.choices;
        this.character.pendingChoices.backgroundTools = proficiencies.tools.choices;
    }

    async applyLanguages(languages) {
        // Apply fixed languages
        for (const language of languages.fixed) {
            this.character.addLanguage(language, 'Background');
        }

        // Store choices for UI
        this.character.pendingChoices.backgroundLanguages = languages.choices;
    }

    setCharacteristic(type, value) {
        if (this.characteristics.hasOwnProperty(type)) {
            this.characteristics[type] = value;
            return true;
        }
        return false;
    }

    clearBackground() {
        // Remove proficiencies
        this.character.removeProficienciesBySource('Background');

        // Remove languages
        this.character.removeLanguagesBySource('Background');

        // Remove features
        this.character.removeFeaturesBySource('background');

        // Clear characteristics
        Object.keys(this.characteristics).forEach(key => {
            this.characteristics[key] = null;
        });

        this.selectedBackground = null;
        this.selectedVariant = null;
    }

    getBackgroundFeature() {
        if (!this.selectedBackground) return null;
        return this.selectedVariant?.feature || this.selectedBackground.feature;
    }

    getCharacteristics() {
        if (!this.selectedBackground) return null;
        return {
            ...this.characteristics,
            options: this.selectedBackground.characteristics
        };
    }
}
```

### 3. Update Background UI
Update the existing BackgroundUI class to use EntityCard:

```javascript
class BackgroundUI {
    constructor(container, backgroundManager) {
        this.container = container;
        this.manager = backgroundManager;
        this.initialize();
    }

    async initialize() {
        this.container.innerHTML = `
            <div class="background-section">
                <div class="background-selection"></div>
                <div class="background-details"></div>
                <div class="background-characteristics"></div>
            </div>
        `;

        await this.renderBackgroundSelection();
    }

    async renderBackgroundSelection() {
        const backgrounds = await window.dndDataLoader.loadBackgrounds();
        const selection = this.container.querySelector('.background-selection');

        selection.innerHTML = `
            <div class="form-group">
                <label for="backgroundSelect">Background</label>
                <select class="form-select" id="backgroundSelect">
                    <option value="">Choose a background...</option>
                    ${backgrounds.map(bg => `
                        <option value="${bg.id}">${bg.name}</option>
                    `).join('')}
                </select>
            </div>
            <div class="form-group" id="variantContainer" style="display: none;">
                <label for="variantSelect">Variant</label>
                <select class="form-select" id="variantSelect">
                    <option value="">Standard background</option>
                </select>
            </div>
        `;

        this.attachSelectionListeners();
    }

    async renderBackgroundDetails(backgroundId) {
        const backgrounds = await window.dndDataLoader.loadBackgrounds();
        const background = backgrounds.find(b => b.id === backgroundId);
        if (!background) return;

        const details = this.container.querySelector('.background-details');
        details.innerHTML = new EntityCard(this.container, background, this.manager).render();
    }

    async renderCharacteristics(backgroundId) {
        const backgrounds = await window.dndDataLoader.loadBackgrounds();
        const background = backgrounds.find(b => b.id === backgroundId);
        if (!background?.characteristics) return;

        const container = this.container.querySelector('.background-characteristics');
        container.innerHTML = `
            <div class="characteristics-section">
                <h3>Characteristics</h3>
                
                <div class="form-group">
                    <label>Personality Trait</label>
                    <select class="form-select" name="personalityTrait">
                        <option value="">Choose a personality trait...</option>
                        ${background.characteristics.personalityTraits.map((trait, i) => `
                            <option value="${i}">${trait}</option>
                        `).join('')}
                    </select>
                </div>

                <div class="form-group">
                    <label>Ideal</label>
                    <select class="form-select" name="ideal">
                        <option value="">Choose an ideal...</option>
                        ${background.characteristics.ideals.map((ideal, i) => `
                            <option value="${i}">${ideal}</option>
                        `).join('')}
                    </select>
                </div>

                <div class="form-group">
                    <label>Bond</label>
                    <select class="form-select" name="bond">
                        <option value="">Choose a bond...</option>
                        ${background.characteristics.bonds.map((bond, i) => `
                            <option value="${i}">${bond}</option>
                        `).join('')}
                    </select>
                </div>

                <div class="form-group">
                    <label>Flaw</label>
                    <select class="form-select" name="flaw">
                        <option value="">Choose a flaw...</option>
                        ${background.characteristics.flaws.map((flaw, i) => `
                            <option value="${i}">${flaw}</option>
                        `).join('')}
                    </select>
                </div>
            </div>
        `;

        this.attachCharacteristicListeners();
    }

    attachSelectionListeners() {
        const backgroundSelect = this.container.querySelector('#backgroundSelect');
        const variantSelect = this.container.querySelector('#variantSelect');
        const variantContainer = this.container.querySelector('#variantContainer');

        backgroundSelect?.addEventListener('change', async () => {
            const backgroundId = backgroundSelect.value;
            if (!backgroundId) {
                variantContainer.style.display = 'none';
                return;
            }

            const backgrounds = await window.dndDataLoader.loadBackgrounds();
            const background = backgrounds.find(b => b.id === backgroundId);
            
            // Update variant options
            if (background.variants?.length > 0) {
                variantSelect.innerHTML = `
                    <option value="">Standard background</option>
                    ${background.variants.map(v => `
                        <option value="${v.name}">${v.name}</option>
                    `).join('')}
                `;
                variantContainer.style.display = 'block';
            } else {
                variantContainer.style.display = 'none';
            }

            // Update background
            await this.manager.setBackground(backgroundId);
            await this.renderBackgroundDetails(backgroundId);
            await this.renderCharacteristics(backgroundId);
        });

        variantSelect?.addEventListener('change', async () => {
            const backgroundId = backgroundSelect.value;
            const variantName = variantSelect.value;
            if (backgroundId) {
                await this.manager.setBackground(backgroundId, variantName);
                await this.renderBackgroundDetails(backgroundId);
            }
        });
    }

    attachCharacteristicListeners() {
        const selects = this.container.querySelectorAll('.characteristics-section select');
        selects.forEach(select => {
            select?.addEventListener('change', () => {
                const type = select.name;
                const value = select.value;
                if (value) {
                    const option = select.options[select.selectedIndex].text;
                    this.manager.setCharacteristic(type, option);
                }
            });
        });
    }
}
```

## Testing Steps
1. Test background loading:
```javascript
const backgrounds = await window.dndDataLoader.loadBackgrounds();
console.log('Loaded backgrounds:', backgrounds);
```

2. Test background selection:
```javascript
const manager = character.background;
await manager.setBackground('acolyte');
console.log('Character after background update:', character);
```

3. Test UI display:
```javascript
const ui = new BackgroundUI(document.getElementById('backgroundSection'), manager);
```

## Implementation Order
1. Update background data loading to use unified system
2. Update background management
3. Update UI components to use EntityCard
4. Test with various backgrounds and variants