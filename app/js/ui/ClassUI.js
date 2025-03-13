export class ClassUI {
    constructor(character) {
        this.character = character;
    }

    /**
     * Initialize class selection
     */
    async initializeClassSelection() {
        const classSelect = document.getElementById('classSelect');
        const subclassSelect = document.getElementById('subclassSelect');

        if (!classSelect || !subclassSelect) return;

        try {
            // Load classes using ClassManager
            const classes = await this.character.class.loadClasses();

            // Populate class select
            classSelect.innerHTML = `
                <option value="">Choose a class...</option>
                ${classes.map(cls => `
                    <option value="${cls.id}">${cls.name}</option>
                `).join('')}
            `;

            // Show initial skeleton preview if no class is selected
            if (!this.character.class) {
                const classImage = document.getElementById('classImage');
                const classQuickDesc = document.getElementById('classQuickDesc');
                const classDetails = document.getElementById('classDetails');
                this.setClassPlaceholderContent(classImage, classQuickDesc, classDetails);
            }

            // Handle class selection
            classSelect.addEventListener('change', async () => {
                const classId = classSelect.value;

                // Clear subclass selection
                subclassSelect.innerHTML = '<option value="">Choose a subclass...</option>';
                subclassSelect.disabled = true;

                if (!classId) {
                    // Clear class selection and show skeleton preview
                    this.character.class = '';
                    this.character.subclass = '';
                    await this.updateClassDetails('', '');
                    if (window.markUnsavedChanges) {
                        window.markUnsavedChanges();
                    }
                    return;
                }

                // Get selected class data
                const classData = await this.character.class.loadClass(classId);
                if (!classData) {
                    await this.updateClassDetails('', '');
                    return;
                }

                // Update subclass options if available
                if (classData.subclasses && classData.subclasses.length > 0) {
                    subclassSelect.innerHTML = `
                        <option value="">Choose a subclass...</option>
                        ${classData.subclasses.map(subclass => `
                            <option value="${subclass.id}">${subclass.name}</option>
                        `).join('')}
                    `;
                    subclassSelect.disabled = false;
                }

                // Update class details
                this.character.class = classId;
                await this.updateClassDetails(classId, '');
                if (window.markUnsavedChanges) {
                    window.markUnsavedChanges();
                }
            });

            // Handle subclass selection
            subclassSelect.addEventListener('change', async () => {
                const classId = classSelect.value;
                const subclassId = subclassSelect.value;

                if (!classId) {
                    await this.updateClassDetails('', '');
                    return;
                }

                // Update class details with subclass
                this.character.subclass = subclassId;
                await this.updateClassDetails(classId, subclassId);
                if (window.markUnsavedChanges) {
                    window.markUnsavedChanges();
                }
            });

            // Initialize with current class if any
            if (this.character.class) {
                classSelect.value = this.character.class;

                const classData = await this.character.class.loadClass(this.character.class);
                if (classData?.subclasses && classData.subclasses.length > 0) {
                    subclassSelect.innerHTML = `
                        <option value="">Choose a subclass...</option>
                        ${classData.subclasses.map(subclass => `
                            <option value="${subclass.id}">${subclass.name}</option>
                        `).join('')}
                    `;
                    subclassSelect.disabled = false;

                    if (this.character.subclass) {
                        subclassSelect.value = this.character.subclass;
                    }
                }
                await this.updateClassDetails(this.character.class, this.character.subclass);
            }
        } catch (error) {
            console.error('Error initializing class selection:', error);
            window.showNotification('Error loading classes', 'danger');
            const classImage = document.getElementById('classImage');
            const classQuickDesc = document.getElementById('classQuickDesc');
            const classDetails = document.getElementById('classDetails');
            this.setClassPlaceholderContent(classImage, classQuickDesc, classDetails);
        }
    }

    // Update class details
    async updateClassDetails(characterClass, subclass) {
        console.group('updateClassDetails');

        const classImage = document.getElementById('classImage');
        const classQuickDesc = document.getElementById('classQuickDesc');
        const classDetails = document.getElementById('classDetails');

        if (!classImage || !classQuickDesc || !classDetails) {
            console.error('Required elements not found');
            console.groupEnd();
            return;
        }

        try {
            if (!characterClass) {
                this.setClassPlaceholderContent(classImage, classQuickDesc, classDetails);
                console.groupEnd();
                return;
            }

            // Load class data using the character's ClassManager
            const classData = await this.character.class.loadClass(characterClass);
            if (!classData) {
                console.error('Class data not found:', characterClass);
                this.setClassPlaceholderContent(classImage, classQuickDesc, classDetails);
                console.groupEnd();
                return;
            }

            // Load subclass data if applicable
            let subclassData = null;
            if (subclass) {
                subclassData = await this.character.class.loadSubclass(subclass, characterClass);
                if (!subclassData) {
                    console.warn('Subclass data not found:', subclass);
                }
            }

            // Update class image
            if (classData.imageUrl) {
                classImage.innerHTML = `<img src="${classData.imageUrl}" alt="${classData.name}" class="class-image">`;
            } else {
                classImage.innerHTML = '<i class="fas fa-user-circle placeholder-icon"></i>';
            }

            // Update quick description
            classQuickDesc.innerHTML = `
                <div class="class-quick-desc">
                    <h6>Class Description</h6>
                    <p>${this.getQuickDescription(classData)}</p>
                </div>`;

            // Update detailed information
            const detailsHTML = `
                <div class="class-details-grid">
                    <div class="detail-section">
                        <h6>Hit Die</h6>
                        <p>d${classData.hd?.faces || '8'}</p>
                    </div>
                    <div class="detail-section">
                        <h6>Primary Ability</h6>
                        <p>${this.getPrimaryAbility(classData)}</p>
                    </div>
                    <div class="detail-section">
                        <h6>Saving Throw Proficiencies</h6>
                        <ul class="mb-0">
                            ${this.getSavingThrows(classData)}
                        </ul>
                    </div>
                    <div class="detail-section">
                        <h6>Armor Proficiencies</h6>
                        <ul class="mb-0">
                            ${this.getArmorProficiencies(classData)}
                        </ul>
                    </div>
                    <div class="detail-section">
                        <h6>Weapon Proficiencies</h6>
                        <ul class="mb-0">
                            ${this.getWeaponProficiencies(classData)}
                        </ul>
                    </div>
                    <div class="detail-section">
                        <h6>Tool Proficiencies</h6>
                        <ul class="mb-0">
                            ${this.getToolProficiencies(classData)}
                        </ul>
                    </div>
                    ${subclassData ? `
                    <div class="detail-section col-span-full">
                        <h6>Subclass Features</h6>
                        <ul class="mb-0">
                            ${this.getSubclassFeatures(subclassData)}
                        </ul>
                    </div>
                    ` : ''}
                </div>`;

            classDetails.innerHTML = detailsHTML;

            // Process tooltips for the newly added content
            const textToProcess = [classQuickDesc, classDetails];
            for (const element of textToProcess) {
                const textNodes = element.querySelectorAll('p, li');
                for (const node of textNodes) {
                    const originalText = node.innerHTML;
                    const processedText = await window.dndTextProcessor.processText(originalText);
                    node.innerHTML = processedText;
                }
            }

            // Log recalculation calls
            console.log('Calling recalculation functions');
            if (window.calculateBonusesAndProficiencies) {
                window.calculateBonusesAndProficiencies();
                console.log('Bonuses and proficiencies recalculated');
            }
            if (window.setupAbilityScores) {
                window.setupAbilityScores();
                console.log('Ability scores setup complete');
            }
            if (window.setupProficiencies) {
                window.setupProficiencies();
                console.log('Proficiencies setup complete');
            }

            console.log('Class details update completed successfully');
        } catch (error) {
            console.error('Error displaying class details:', error);
            console.error('Error stack:', error.stack);
            window.showNotification('Error displaying class details', 'danger');
            this.setClassPlaceholderContent(classImage, classQuickDesc, classDetails);
        } finally {
            console.groupEnd();
        }
    }

    getPrimaryAbility(classData) {
        if (!classData.primaryAbility) return 'Varies';

        const abilities = [];
        for (const ability of classData.primaryAbility) {
            if (typeof ability === 'string') {
                abilities.push(ability.toUpperCase());
            } else {
                if (ability.str) abilities.push('Strength');
                if (ability.dex) abilities.push('Dexterity');
                if (ability.con) abilities.push('Constitution');
                if (ability.int) abilities.push('Intelligence');
                if (ability.wis) abilities.push('Wisdom');
                if (ability.cha) abilities.push('Charisma');
            }
        }

        return abilities.length > 0 ? abilities.join(' or ') : 'Varies';
    }

    getSavingThrows(classData) {
        if (!classData.proficiency?.length) return '<li>None</li>';

        const proficiencyMap = {
            'str': 'Strength',
            'dex': 'Dexterity',
            'con': 'Constitution',
            'int': 'Intelligence',
            'wis': 'Wisdom',
            'cha': 'Charisma'
        };

        return classData.proficiency
            .map(prof => `<li>${proficiencyMap[prof] || prof}</li>`)
            .join('');
    }

    getArmorProficiencies(classData) {
        if (!classData.startingProficiencies?.armor?.length) return '<li>None</li>';

        return classData.startingProficiencies.armor
            .map(armor => {
                if (typeof armor === 'string') {
                    return `<li>${armor.charAt(0).toUpperCase() + armor.slice(1)}</li>`;
                } if (typeof armor === 'object') {
                    // Handle object format (e.g., {proficiency: "light armor"})
                    const proficiency = armor.proficiency || armor.name || JSON.stringify(armor);
                    return `<li>${proficiency.charAt(0).toUpperCase() + proficiency.slice(1)}</li>`;
                }
                return '';
            })
            .filter(item => item) // Remove empty strings
            .join('');
    }

    getWeaponProficiencies(classData) {
        if (!classData.startingProficiencies?.weapons?.length) return '<li>None</li>';

        return classData.startingProficiencies.weapons
            .map(weapon => {
                if (typeof weapon === 'string') {
                    return `<li>${weapon.charAt(0).toUpperCase() + weapon.slice(1)}</li>`;
                } if (typeof weapon === 'object') {
                    // Handle object format (e.g., {proficiency: "simple weapons"})
                    const proficiency = weapon.proficiency || weapon.name || JSON.stringify(weapon);
                    return `<li>${proficiency.charAt(0).toUpperCase() + proficiency.slice(1)}</li>`;
                }
                return '';
            })
            .filter(item => item) // Remove empty strings
            .join('');
    }

    getToolProficiencies(classData) {
        if (!classData.startingProficiencies?.tools?.length) return '<li>None</li>';

        return classData.startingProficiencies.tools
            .map(tool => `<li>${tool.charAt(0).toUpperCase() + tool.slice(1)}</li>`)
            .join('');
    }

    getSubclassFeatures(subclassData) {
        if (!subclassData?.subclassFeatures?.length) return '<li>No subclass features available</li>';

        return subclassData.subclassFeatures
            .map(feature => {
                if (typeof feature === 'string') return `<li>${feature}</li>`;
                return `<li>${feature.name || 'Unnamed Feature'}</li>`;
            })
            .join('');
    }

    // Helper function to set placeholder content for class
    setClassPlaceholderContent(classImage, classQuickDesc, classDetails) {
        console.log('Setting class placeholder content');

        // Set placeholder image
        classImage.innerHTML = '<i class="fas fa-user-circle placeholder-icon"></i>';

        // Set placeholder quick description
        classQuickDesc.innerHTML = `
            <h6>Class Description</h6>
            <p>Select a Class to see their abilities, proficiencies, and other characteristics.</p>`;

        // Set placeholder details with grid layout
        classDetails.innerHTML = `
            <div class="class-details-grid">
                <div class="detail-section">
                    <h6>Hit Die</h6>
                    <p class="placeholder-text">—</p>
                </div>

                <div class="detail-section">
                    <h6>Primary Ability</h6>
                    <p class="placeholder-text">—</p>
                </div>

                <div class="detail-section">
                    <h6>Saving Throw Proficiencies</h6>
                    <ul class="mb-0">
                        <li class="placeholder-text">—</li>
                    </ul>
                </div>

                <div class="detail-section">
                    <h6>Armor Proficiencies</h6>
                    <ul class="mb-0">
                        <li class="placeholder-text">—</li>
                    </ul>
                </div>

                <div class="detail-section">
                    <h6>Weapon Proficiencies</h6>
                    <ul class="mb-0">
                        <li class="placeholder-text">—</li>
                    </ul>
                </div>

                <div class="detail-section">
                    <h6>Tool Proficiencies</h6>
                    <ul class="mb-0">
                        <li class="placeholder-text">—</li>
                    </ul>
                </div>
            </div>`;
    }

    // Helper method to get quick description
    getQuickDescription(classData) {
        // Try to find a description in the entries or fluff
        if (classData.fluff?.entries) {
            const desc = classData.fluff.entries.find(entry =>
                (typeof entry === 'string') ||
                (typeof entry === 'object' && !entry.name && entry.entries)
            );

            if (desc) {
                if (typeof desc === 'string') {
                    return desc;
                } if (Array.isArray(desc.entries)) {
                    return desc.entries.join(' ');
                } if (typeof desc.entries === 'string') {
                    return desc.entries;
                }
            }
        }

        // If no fluff description found, try class entries
        if (classData.entries) {
            const desc = classData.entries.find(entry =>
                (typeof entry === 'string') ||
                (typeof entry === 'object' && entry.type === 'entries' && entry.name?.toLowerCase() === 'description')
            );

            if (desc) {
                if (typeof desc === 'string') {
                    return desc;
                } if (Array.isArray(desc.entries)) {
                    return desc.entries.join(' ');
                } if (typeof desc.entries === 'string') {
                    return desc.entries;
                }
            }
        }

        // Fallback to a generic description
        return `${classData.name} class features and abilities.`;
    }
} 