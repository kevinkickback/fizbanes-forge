// Base UI card foundation shared by entity cards (race, class, etc.)

import { textProcessor } from '../../lib/TextProcessor.js';

export class BaseCard {
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
			console.error('BaseCard', `Card element with ID "${cardId}" not found`);
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
			console.error('BaseCard', 'Error updating entity image:', error);
			this._setDefaultImage(altText);
		}
	}

	_setDefaultImage(altText) {
		const placeholder = document.createElement('div');
		placeholder.classList.add('placeholder-image');
		placeholder.textContent = altText ? altText.charAt(0) : '?';
		this._entityImage.appendChild(placeholder);
	}

	//-------------------------------------------------------------------------
	// Description Management Methods
	//-------------------------------------------------------------------------

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
			console.error('BaseCard', 'Error updating quick description:', error);
			this.setPlaceholderContent();
		}
	}

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

	createDetailSection(title, asList = true) {
		if (!this._details) {
			console.warn('BaseCard', 'Details element not found in card');
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

	addDetailItem(section, content) {
		if (!section) {
			console.warn('BaseCard', 'Invalid section provided to addDetailItem');
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

	addDetailParagraph(section, content) {
		if (!section) {
			console.warn(
				'BaseCard',
				'Invalid section provided to addDetailParagraph',
			);
			return null;
		}

		const para = document.createElement('p');
		para.classList.add('text-content');
		para.textContent = content;
		section.appendChild(para);

		return para;
	}

	clearDetails() {
		if (this._details) {
			this._details.innerHTML = '';
		}
	}

	//-------------------------------------------------------------------------
	// Utility Methods
	//-------------------------------------------------------------------------

	async processCardText() {
		if (!textProcessor.isInitialized) {
			await textProcessor.initialize();
		}

		if (this._card) {
			await textProcessor.processElement(this._card);
		}
	}

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
