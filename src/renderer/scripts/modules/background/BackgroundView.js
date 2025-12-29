/** View for background selection and quick description display. */

import { textProcessor } from '../../utils/TextProcessor.js';

/** Manages background selection view (dropdowns + quick description). */
export class BackgroundCardView {
	/**
	 * @param {HTMLElement} card - Root card element
	 */
	constructor(card) {
		this._card = card;
		this._backgroundSelect = document.getElementById('backgroundSelect');
		this._variantContainer = document.getElementById('variantContainer');
		this._variantSelect = document.getElementById('variantSelect');
		this._quickDescription = document.getElementById('backgroundQuickDesc');
		this._imageElement = document.getElementById('backgroundImage');

		// Create variant container if it doesn't exist
		if (!this._variantContainer) {
			this._createVariantContainer();
		}
	}

	/**
	 * Creates the variant selection container if it doesn't exist
	 * @private
	 */
	_createVariantContainer() {
		const selectors = document.querySelector('.background-selectors');
		if (!selectors) {
			console.warn(
				'BackgroundView',
				'Background selectors container not found',
			);
			return;
		}

		this._variantContainer = document.createElement('div');
		this._variantContainer.id = 'variantContainer';
		this._variantContainer.className = 'background-select-container';
		this._variantContainer.style.display = 'none';
		this._variantContainer.innerHTML = `
            <label for="variantSelect">Variant</label>
            <select class="form-select" id="variantSelect">
                <option value="">Standard background</option>
            </select>
        `;
		selectors.appendChild(this._variantContainer);

		// Update the reference to the variant select element
		this._variantSelect = document.getElementById('variantSelect');
	}

	/**
	 * Populate background selection dropdown
	 * @param {Array} backgrounds - Array of background objects from backgroundService
	 */
	populateBackgroundSelect(backgrounds) {
		if (!this._backgroundSelect) return;

		// Clear existing options except the first (default)
		while (this._backgroundSelect.options.length > 1) {
			this._backgroundSelect.remove(1);
		}

		// Add background options
		backgrounds.forEach((background) => {
			const option = document.createElement('option');
			option.value = `${background.name}_${background.source}`;
			option.textContent = `${background.name} (${background.source})`;
			this._backgroundSelect.appendChild(option);
		});
	}

	/**
	 * Populate variant selection dropdown
	 * @param {Array} variants - Array of variant background objects
	 */
	populateVariantSelect(variants) {
		if (!this._variantSelect) return;

		// Clear existing options except the first (default)
		while (this._variantSelect.options.length > 1) {
			this._variantSelect.remove(1);
		}

		// Add variant options
		variants.forEach((variant) => {
			const option = document.createElement('option');
			option.value = variant.name;
			option.textContent = `${variant.name} (${variant.source})`;
			this._variantSelect.appendChild(option);
		});
	}

	/**
	 * Update quick description display
	 * @param {Object} background - Background object
	 */
	async updateQuickDescription(background) {
		if (!this._quickDescription || !background) return;

		const description = this._extractDescription(background);
		this._quickDescription.innerHTML = description;
		await textProcessor.processElement(this._quickDescription);
	}

	/**
	 * Reset quick description to default state
	 */
	resetQuickDescription() {
		if (!this._quickDescription) return;
		this._quickDescription.innerHTML = `
            <div class="placeholder-content">
                <h5>Select a Background</h5>
                <p>Choose a background to see details about their traits, proficiencies, and other characteristics.</p>
            </div>
        `;
	}

	/**
	 * Update background image
	 * @param {string} imageSrc - Image source URL
	 * @param {string} altText - Alternative text for the image
	 */
	updateBackgroundImage(imageSrc, altText = 'Background image') {
		if (!this._imageElement) return;

		try {
			// Clear existing content
			this._imageElement.innerHTML = '';

			// Create and append the image element
			if (imageSrc) {
				const img = document.createElement('img');
				img.src = imageSrc;
				img.alt = altText;
				img.classList.add('entity-img');
				this._imageElement.appendChild(img);
			} else {
				// Set a default icon
				this._imageElement.innerHTML =
					'<i class="fas fa-user-circle placeholder-icon"></i>';
			}
		} catch (error) {
			console.error(
				'BackgroundView',
				'Error updating background image:',
				error,
			);
			// Set a default icon on error
			this._imageElement.innerHTML =
				'<i class="fas fa-user-circle placeholder-icon"></i>';
		}
	}

	/**
	 * Show variant selector
	 */
	showVariantSelector() {
		if (this._variantContainer) {
			this._variantContainer.style.display = 'block';
		}
	}

	/**
	 * Hide variant selector and reset selection
	 */
	hideVariantSelector() {
		if (this._variantContainer) {
			this._variantContainer.style.display = 'none';
		}
		if (this._variantSelect) {
			this._variantSelect.selectedIndex = 0;
		}
	}

	/**
	 * Get current background selection
	 * @returns {string} Selected background name
	 */
	getSelectedBackground() {
		return this._backgroundSelect?.value || '';
	}

	/**
	 * Get current variant selection
	 * @returns {string} Selected variant name
	 */
	getSelectedVariant() {
		return this._variantSelect?.value || '';
	}

	/**
	 * Set background selection
	 * @param {string} backgroundName - Background name to select
	 */
	setSelectedBackground(backgroundName) {
		if (!this._backgroundSelect) return;

		// Find and select the option
		for (let i = 0; i < this._backgroundSelect.options.length; i++) {
			if (this._backgroundSelect.options[i].value === backgroundName) {
				this._backgroundSelect.selectedIndex = i;
				break;
			}
		}
	}

	/**
	 * Set variant selection
	 * @param {string} variantName - Variant name to select
	 */
	setSelectedVariant(variantName) {
		if (!this._variantSelect) return;

		// Find and select the option
		for (let i = 0; i < this._variantSelect.options.length; i++) {
			if (this._variantSelect.options[i].value === variantName) {
				this._variantSelect.selectedIndex = i;
				break;
			}
		}
	}

	/**
	 * Attach event listeners
	 * @param {Function} onBackgroundChange - Handler for background selection change
	 * @param {Function} onVariantChange - Handler for variant selection change
	 */
	attachListeners(onBackgroundChange, onVariantChange) {
		if (this._backgroundSelect) {
			this._backgroundSelect.addEventListener('change', onBackgroundChange);
		}
		if (this._variantSelect) {
			this._variantSelect.addEventListener('change', onVariantChange);
		}
	}

	/**
	 * Extract description from background data
	 * @param {Object} background - Background object
	 * @returns {string} HTML description
	 * @private
	 */
	_extractDescription(background) {
		if (background?.entries) {
			for (const entry of background.entries) {
				if (typeof entry === 'string') {
					return `<p>${entry}</p>`;
				}
				if (entry.type === 'entries' && entry.entries) {
					for (const subEntry of entry.entries) {
						if (typeof subEntry === 'string') {
							return `<p>${subEntry}</p>`;
						}
					}
				}
			}
		}
		return `<p>${background.name} is a character background from ${background.source}.</p>`;
	}
}
