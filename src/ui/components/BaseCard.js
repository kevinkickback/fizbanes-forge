// Base UI card foundation shared by entity cards (race, class, etc.)

import { eventBus } from '../../lib/EventBus.js';
import { textProcessor } from '../../lib/TextProcessor.js';

export class BaseCard {
	constructor(cardId) {
		if (!cardId) {
			return;
		}

		this._card = document.getElementById(cardId);

		if (!this._card) {
			console.error('BaseCard', `Card element with ID "${cardId}" not found`);
			return;
		}

		this._entityImage = this._card.querySelector('.entity-image');
		this._quickDesc = this._card.querySelector('.quick-description');
		this._details = this._card.querySelector('.details');
		this._eventHandlers = {};
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

	//-------------------------------------------------------------------------
	// EventBus Cleanup Methods
	//-------------------------------------------------------------------------

	/**
	 * Register an EventBus listener with automatic cleanup tracking.
	 * Stores handler reference for manual removal via cleanup().
	 *
	 * @param {string} event - Event name (e.g., EVENTS.CHARACTER_SELECTED)
	 * @param {Function} handler - Handler function
	 * @returns {void}
	 */
	onEventBus(event, handler) {
		if (typeof handler !== 'function') {
			console.warn('[BaseCard]', 'Handler must be a function', { event });
			return;
		}

		eventBus.on(event, handler);

		// Track handler for cleanup
		if (!this._eventHandlers[event]) {
			this._eventHandlers[event] = [];
		}
		this._eventHandlers[event].push(handler);
	}

	/**
	 * Unregister a specific EventBus listener.
	 *
	 * @param {string} event - Event name
	 * @param {Function} handler - Handler function to remove
	 * @returns {void}
	 */
	offEventBus(event, handler) {
		eventBus.off(event, handler);

		if (this._eventHandlers[event]) {
			this._eventHandlers[event] = this._eventHandlers[event].filter(
				(h) => h !== handler,
			);
			if (this._eventHandlers[event].length === 0) {
				delete this._eventHandlers[event];
			}
		}
	}

	/**
	 * Remove all registered EventBus listeners.
	 * Call this in component teardown/destructor to prevent memory leaks.
	 *
	 * @returns {Object} Summary of cleanup operations (event count, handler count)
	 */
	cleanup() {
		const summary = {
			eventsCleaned: 0,
			handlersCleaned: 0,
		};

		for (const [event, handlers] of Object.entries(this._eventHandlers)) {
			if (Array.isArray(handlers)) {
				for (const handler of handlers) {
					try {
						eventBus.off(event, handler);
						summary.handlersCleaned++;
					} catch (e) {
						console.warn('[BaseCard]', 'Error removing listener', {
							event,
							error: e,
						});
					}
				}
				summary.eventsCleaned++;
			}
		}

		this._eventHandlers = {};

		console.debug('[BaseCard]', 'Cleanup complete', summary);
		return summary;
	}

	/**
	 * Get current state for debugging (shows which events have active handlers).
	 *
	 * @returns {Object} Debug info
	 */
	getListenerState() {
		const state = {};
		for (const [event, handlers] of Object.entries(this._eventHandlers)) {
			if (Array.isArray(handlers)) {
				state[event] = handlers.length;
			}
		}
		return state;
	}
}

export { BaseCard as EntityCard };
