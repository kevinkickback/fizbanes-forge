// Step 0: Basics - character name, gender, and portrait selection

import { DOMCleanup } from '../../../lib/DOMCleanup.js';
import { PortraitSelector } from '../shared/PortraitSelector.js';

export class CharacterStepBasics {
	constructor(session, modal) {
		this.session = session;
		this.modal = modal;
		this._cleanup = DOMCleanup.create();
		this.selectedPortrait = null;
	}

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
                </div>
                
                <div class="row g-3 mt-2">
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

	attachListeners(contentArea) {
		this._initPortraitSelector(contentArea);
	}

	async _initPortraitSelector(contentArea) {
		const grid = contentArea.querySelector('#portraitGrid');
		const preview = contentArea.querySelector('#portraitPreview');
		const uploadInput = contentArea.querySelector('#portraitUpload');

		if (!grid || !preview) return;

		// Pre-populate so save() preserves value without user interaction
		this.selectedPortrait = this.session.get('portrait') || null;

		const selector = new PortraitSelector({
			grid,
			preview,
			uploadInput,
			cleanup: this._cleanup,
			onSelect: (src) => { this.selectedPortrait = src; },
		});

		await selector.initialize(this.session.get('portrait'));
	}

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
	}
}
