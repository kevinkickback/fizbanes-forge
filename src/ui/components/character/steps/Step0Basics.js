/**
 * Step 0: Basics
 * 
 * User enters character name, gender, and selects a portrait.
 */

import { DOMCleanup } from '../../../../lib/DOMCleanup.js';

export class Step0Basics {
    constructor(session, modal) {
        this.session = session;
        this.modal = modal;
        this._cleanup = DOMCleanup.create();
        this.selectedPortrait = null;
    }

    /**
     * Render the step HTML.
     */
    async render() {
        const name = this.session.get('name') || '';
        const gender = this.session.get('gender') || 'male';

        return `
            <div class="step-0-basics">
                <div class="row g-3">
                    <div class="col-md-8">
                        <div class="card">
                            <div class="card-header">
                                <i class="fas fa-user"></i> Character Name
                            </div>
                            <div class="card-body">
                                <input type="text" 
                                       class="form-control" 
                                       id="characterName" 
                                       value="${name}"
                                       placeholder="Enter character name"
                                       required>
                            </div>
                        </div>
                    </div>
                    
                    <div class="col-md-4">
                        <div class="card">
                            <div class="card-header">
                                <i class="fas fa-venus-mars"></i> Gender
                            </div>
                            <div class="card-body">
                                <select class="form-select" id="characterGender" required>
                                    <option value="male" ${gender === 'male' ? 'selected' : ''}>Male</option>
                                    <option value="female" ${gender === 'female' ? 'selected' : ''}>Female</option>
                                    <option value="other" ${gender === 'other' ? 'selected' : ''}>Other</option>
                                </select>
                            </div>
                        </div>
                    </div>
                    
                    <div class="col-md-12">
                        <div class="card">
                            <div class="card-header">
                                <i class="fas fa-image"></i> Portrait
                            </div>
                            <div class="card-body">
                                <div class="character-icon-selector-horizontal">
                                    <div class="portrait-preview-horizontal">
                                        <img id="portraitPreview" 
                                             src="assets/images/characters/placeholder_char_card.webp"
                                             alt="Portrait preview">
                                    </div>
                                    <div class="portrait-options">
                                        <div id="portraitGrid" class="icon-grid-horizontal">
                                            <!-- Portrait options will be added here -->
                                        </div>
                                        <input type="file" 
                                               id="portraitUpload" 
                                               class="d-none" 
                                               accept="image/*">
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
    attachListeners(contentArea) {
        console.debug('[Step0Basics]', 'Attaching listeners');

        // Initialize portrait selector
        this._initPortraitSelector(contentArea);

        // No other listeners needed - form inputs are saved on next/back
    }

    /**
     * Initialize portrait selector with default and user portraits.
     */
    async _initPortraitSelector(contentArea) {
        const grid = contentArea.querySelector('#portraitGrid');
        const preview = contentArea.querySelector('#portraitPreview');
        const uploadInput = contentArea.querySelector('#portraitUpload');

        if (!grid || !preview) return;

        // Default portrait images
        const defaults = [
            'assets/images/characters/placeholder_char_card.webp',
            'assets/images/characters/placeholder_char_card2.webp',
            'assets/images/characters/placeholder_char_card3.webp',
            'assets/images/characters/placeholder_char_card4.jpg',
            'assets/images/characters/placeholder_char_card5.jpg',
            'assets/images/characters/placeholder_char_card6.jpg',
            'assets/images/characters/placeholder_char_card7.jpg',
            'assets/images/characters/placeholder_char_card8.jpg',
            'assets/images/characters/placeholder_char_card9.jpg',
            'assets/images/characters/placeholder_char_card10.jpg',
            'assets/images/characters/placeholder_char_card11.jpg',
        ];

        grid.innerHTML = '';

        // Add upload button
        const uploadBtn = document.createElement('button');
        uploadBtn.type = 'button';
        uploadBtn.className = 'portrait-icon-btn upload';
        uploadBtn.setAttribute('aria-label', 'Upload portrait');
        uploadBtn.innerHTML = '<i class="fas fa-upload" aria-hidden="true"></i>';
        this._cleanup.on(uploadBtn, 'click', () => {
            if (uploadInput) uploadInput.click();
        });
        grid.appendChild(uploadBtn);

        // Add default portraits
        let firstPortraitBtn = null;
        for (const src of defaults) {
            const btn = this._createPortraitButton(src, preview, grid);
            grid.appendChild(btn);
            if (!firstPortraitBtn) firstPortraitBtn = btn;
        }

        // Auto-select first portrait or previously selected one
        const currentPortrait = this.session.get('portrait');
        if (currentPortrait) {
            preview.src = currentPortrait;
            this.selectedPortrait = currentPortrait;
        } else if (firstPortraitBtn) {
            firstPortraitBtn.click();
        }

        // Load user portraits from portraits folder
        await this._loadUserPortraits(grid, preview);

        // Handle file uploads
        if (uploadInput) {
            this._cleanup.on(uploadInput, 'change', async (ev) => {
                await this._handlePortraitUpload(ev, preview, grid);
            });
        }
    }

    /**
     * Create a portrait button.
     */
    _createPortraitButton(src, preview, grid) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'portrait-icon-btn';
        btn.innerHTML = `<img src="${src}" alt="Portrait option" />`;
        btn.setAttribute('data-src', src);

        this._cleanup.on(btn, 'click', () => {
            this.selectedPortrait = src;
            preview.src = src;

            // Remove selection from all buttons
            const allBtns = grid.querySelectorAll('.portrait-icon-btn');
            for (const b of allBtns) {
                b.classList.remove('selected');
            }
            btn.classList.add('selected');
        });

        return btn;
    }

    /**
     * Load user portraits from portraits folder.
     */
    async _loadUserPortraits(grid, preview) {
        try {
            const characterPath = await window.characterStorage?.getDefaultSavePath();
            if (!characterPath || typeof characterPath !== 'string') return;

            const sep = characterPath.includes('\\') ? '\\' : '/';
            const idx = characterPath.lastIndexOf(sep);
            const basePath = idx > 0 ? characterPath.slice(0, idx) : characterPath;
            const portraitsPath = `${basePath}${sep}portraits`;

            const result = await window.characterStorage?.listPortraits?.(portraitsPath);
            if (result?.success && Array.isArray(result.files)) {
                for (const filePath of result.files) {
                    const fileSrc = filePath.startsWith('file://')
                        ? filePath
                        : `file://${filePath.replace(/\\/g, '/')}`;

                    const btn = this._createPortraitButton(fileSrc, preview, grid);
                    grid.appendChild(btn);
                }
            }
        } catch (error) {
            console.warn('[Step0Basics]', 'Failed to load user portraits', error);
        }
    }

    /**
     * Handle portrait file upload.
     */
    async _handlePortraitUpload(ev, preview, grid) {
        const file = ev.target.files?.[0];
        if (!file) return;

        try {
            const characterPath = await window.characterStorage?.getDefaultSavePath();
            if (!characterPath || typeof characterPath !== 'string') {
                console.warn('[Step0Basics]', 'Could not determine portraits directory');
                return;
            }

            const sep = characterPath.includes('\\') ? '\\' : '/';
            const idx = characterPath.lastIndexOf(sep);
            const basePath = idx > 0 ? characterPath.slice(0, idx) : characterPath;
            const portraitsPath = `${basePath}${sep}portraits`;

            // Read file as data URL
            const reader = new FileReader();
            reader.onload = async () => {
                const dataUrl = reader.result;
                if (typeof dataUrl !== 'string') return;

                try {
                    const saveResult = await window.characterStorage?.savePortrait(
                        portraitsPath,
                        dataUrl,
                        file.name
                    );

                    if (saveResult?.success && saveResult.filePath) {
                        const fileUrl = saveResult.filePath.startsWith('file://')
                            ? saveResult.filePath
                            : `file://${saveResult.filePath.replace(/\\/g, '/')}`;

                        this.selectedPortrait = fileUrl;
                        preview.src = fileUrl;

                        // Create and add button for the uploaded portrait
                        const btn = this._createPortraitButton(fileUrl, preview, grid);
                        grid.appendChild(btn);
                        btn.classList.add('selected');

                        // Clear other selection highlights
                        const allBtns = grid.querySelectorAll('.portrait-icon-btn');
                        for (const b of allBtns) {
                            if (b !== btn) {
                                b.classList.remove('selected');
                            }
                        }
                    }
                } catch (error) {
                    console.error('[Step0Basics]', 'Error saving portrait:', error);
                }
            };
            reader.readAsDataURL(file);
        } catch (error) {
            console.error('[Step0Basics]', 'Error handling portrait upload:', error);
        }
    }

    /**
     * Validate step data.
     */
    async validate() {
        const nameInput = document.getElementById('characterName');
        const genderSelect = document.getElementById('characterGender');

        if (!nameInput || !genderSelect) {
            console.error('[Step0Basics]', 'Form fields not found');
            return false;
        }

        if (!nameInput.value.trim()) {
            nameInput.focus();
            return false;
        }

        return true;
    }

    /**
     * Save step data to session.
     */
    async save() {
        const nameInput = document.getElementById('characterName');
        const genderSelect = document.getElementById('characterGender');

        if (nameInput) {
            this.session.set('name', nameInput.value.trim());
        }

        if (genderSelect) {
            this.session.set('gender', genderSelect.value);
        }

        if (this.selectedPortrait) {
            this.session.set('portrait', this.selectedPortrait);
        }

        console.debug('[Step0Basics]', 'Saved data:', {
            name: this.session.get('name'),
            gender: this.session.get('gender'),
            portrait: this.session.get('portrait'),
        });
    }
}
