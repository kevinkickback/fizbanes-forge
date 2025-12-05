/**
 * BaseCard.js
 * Base UI component for displaying entity information in card format.
 * This serves as a foundation for more specific entity cards like ClassCard, RaceCard, etc.
 */

import { Logger } from '../infrastructure/Logger.js';
import { textProcessor } from '../utils/TextProcessor.js';

/**
 * Base class for entity cards that provides common functionality for displaying
 * entity information in a standardized card format.
 */
export class BaseCard {
	/**
	 * Creates a new EntityCard instance
	 * @param {string} cardId - The ID of the HTML element containing the card
	 */
	constructor(cardId) {
		if (!cardId) {
			return;
		}

		/**
		 * The root element of the card
		 * @type {HTMLElement}
		 * @private
		 */
		this._card = document.getElementById(cardId);

		if (!this._card) {
			Logger.error('BaseCard', `Card element with ID "${cardId}" not found`);
			return;
		}

		/**
		 * The element displaying the entity image
		 * @type {HTMLElement}
		 * @private
		 */
		this._entityImage = this._card.querySelector('.entity-image');

		/**
		 * The element displaying a quick description of the entity
		 * @type {HTMLElement}
		 * @private
		 */
		this._quickDesc = this._card.querySelector('.quick-description');

		/**
		 * The element containing detailed information about the entity
		 * @type {HTMLElement}
		 * @private
		 */
		this._details = this._card.querySelector('.details');
	}

	//-------------------------------------------------------------------------
	// Image Management Methods
	//-------------------------------------------------------------------------

	/**
	 * Updates the entity image in the card
	 * @param {string} imagePath - The path to the image
	 * @param {string} altText - Alternative text for the image
	 * @returns {void}
	 */
	updateEntityImage(imagePath, altText) {
		if (!this._entityImage) {
			return;
		}

		try {
			// Clear existing content
			this._entityImage.innerHTML = '';

			// Create and append the image element
			if (imagePath) {
				const img = document.createElement('img');
				img.src = imagePath;
				img.alt = altText || 'Entity image';
				img.classList.add('entity-img');
				this._entityImage.appendChild(img);
			} else {
				this._setDefaultImage(altText);
			}
		} catch (error) {
			Logger.error('BaseCard', 'Error updating entity image:', error);
			this._setDefaultImage(altText);
		}
	}

	/**
	 * Sets a default placeholder image when no image is available
	 * @param {string} altText - Alternative text for the placeholder
	 * @private
	 */
	_setDefaultImage(altText) {
		const placeholder = document.createElement('div');
		placeholder.classList.add('placeholder-image');
		placeholder.textContent = altText ? altText.charAt(0) : '?';
		this._entityImage.appendChild(placeholder);
	}

	//-------------------------------------------------------------------------
	// Description Management Methods
	//-------------------------------------------------------------------------

	/**
	 * Updates the quick description section of the card
	 * @param {string} title - The title to display
	 * @param {string} description - The description text
	 * @returns {Promise<void>}
	 */
	async updateQuickDescription(title, description) {
		if (!this._quickDesc) {
			return;
		}

		try {
			this._quickDesc.innerHTML = '';

			if (title && description) {
				const titleElem = document.createElement('h5');
				titleElem.textContent = title;

				const descElem = document.createElement('p');
				descElem.classList.add('text-content');
				descElem.textContent = description;

				this._quickDesc.appendChild(titleElem);
				this._quickDesc.appendChild(descElem);

				// Process any reference tags in the description
				await textProcessor.processElement(this._quickDesc);
			} else {
				this.setPlaceholderContent();
			}
		} catch (error) {
			Logger.error('BaseCard', 'Error updating quick description:', error);
			this.setPlaceholderContent();
		}
	}

	/**
	 * Sets placeholder content when no entity is selected
	 * @param {string} title - Optional custom title for the placeholder
	 * @param {string} message - Optional custom message for the placeholder
	 * @returns {void}
	 */
	setPlaceholderContent(
		title = 'Select an Entity',
		message = 'Choose an entity to view its details.',
	) {
		if (!this._quickDesc) {
			return;
		}

		const placeholderDiv = document.createElement('div');
		placeholderDiv.classList.add('placeholder-content');

		const titleElem = document.createElement('h5');
		titleElem.textContent = title;

		const messageElem = document.createElement('p');
		messageElem.textContent = message;

		placeholderDiv.appendChild(titleElem);
		placeholderDiv.appendChild(messageElem);

		this._quickDesc.innerHTML = '';
		this._quickDesc.appendChild(placeholderDiv);
	}

	//-------------------------------------------------------------------------
	// Details Management Methods
	//-------------------------------------------------------------------------

	/**
	 * Creates a section in the details area with the given title
	 * @param {string} title - The title of the section
	 * @param {boolean} asList - Whether to create a list container in the section
	 * @returns {HTMLElement} The created section element
	 */
	createDetailSection(title, asList = true) {
		if (!this._details) {
			Logger.warn('BaseCard', 'Details element not found in card');
			return null;
		}

		const section = document.createElement('div');
		section.classList.add('detail-section');

		const titleElem = document.createElement('h6');
		titleElem.textContent = title;
		section.appendChild(titleElem);

		if (asList) {
			const list = document.createElement('ul');
			section.appendChild(list);
		}

		this._details.appendChild(section);
		return section;
	}

	/**
	 * Adds an item to a section list
	 * @param {HTMLElement} section - The section to add the item to
	 * @param {string} content - The content of the item
	 * @returns {HTMLElement} The created list item
	 */
	addDetailItem(section, content) {
		if (!section) {
			Logger.warn('BaseCard', 'Invalid section provided to addDetailItem');
			return null;
		}

		let list = section.querySelector('ul');
		if (!list) {
			list = document.createElement('ul');
			section.appendChild(list);
		}

		const item = document.createElement('li');
		item.textContent = content;
		list.appendChild(item);

		return item;
	}

	/**
	 * Adds a text paragraph to a section
	 * @param {HTMLElement} section - The section to add the paragraph to
	 * @param {string} content - The content of the paragraph
	 * @returns {HTMLElement} The created paragraph element
	 */
	addDetailParagraph(section, content) {
		if (!section) {
			Logger.warn('BaseCard', 'Invalid section provided to addDetailParagraph');
			return null;
		}

		const para = document.createElement('p');
		para.classList.add('text-content');
		para.textContent = content;
		section.appendChild(para);

		return para;
	}

	/**
	 * Clears all content from the details area
	 * @returns {void}
	 */
	clearDetails() {
		if (this._details) {
			this._details.innerHTML = '';
		}
	}

	//-------------------------------------------------------------------------
	// Utility Methods
	//-------------------------------------------------------------------------

	/**
	 * Processes all text content in the card for reference tags and formatting
	 * @returns {Promise<void>}
	 */
	async processCardText() {
		if (!textProcessor.isInitialized) {
			await textProcessor.initialize();
		}

		if (this._card) {
			await textProcessor.processElement(this._card);
		}
	}

	/**
	 * Checks if the card is fully initialized and ready to use
	 * @returns {boolean} True if the card is ready, false otherwise
	 */
	isReady() {
		return !!(
			this._card &&
			this._entityImage &&
			this._quickDesc &&
			this._details
		);
	}
}

export { BaseCard as EntityCard };
