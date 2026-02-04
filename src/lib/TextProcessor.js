// Processes text content, references, and formatting for D&D content.

import { processString as renderStringWithTags } from './5eToolsRenderer.js';
import { initializeTooltipListeners } from './TooltipManager.js';

class TextProcessor {
	static _DISPLAY_NAME_SELECTORS = [
		'.text-content',
		// Add other selectors here if needed, e.g., '.some-other-class'
	];

	static _TOOLTIP_SELECTORS = [
		'.description',
		'.tooltip-content',
		'.proficiency-info',
		'.ability-info',
		'p',
		'li',
		'td',
		'.card-text',
		'.proficiency-note',
		// Add other selectors here if needed
	];

	constructor() {
		this._observer = null;
		this._pendingNodes = [];
		this._rafScheduled = false;

		this._defaultOptions = {
			processReferences: true,
			processFormatting: true,
			processDynamicContent: true,
			resolveMode: 'tooltip', // Default resolve mode
		};
	}

	async initialize() {
		try {
			// Initialize tooltip system
			initializeTooltipListeners();

			// Set up mutation observer to process dynamically added content
			this._observer = new MutationObserver((mutations) => {
				this._handleDOMChanges(mutations);
			});

			// Start observing the document body for dynamic content changes
			this._observer.observe(document.body, {
				childList: true,
				subtree: true,
			});

			// Process initial page content
			await this.processPageContent(document.body);
		} catch (error) {
			console.error(
				'[TextProcessor]',
				'Error initializing text processor:',
				error,
			);
		}
	}

	_handleDOMChanges(mutations) {
		try {
			for (const mutation of mutations) {
				if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
					for (const node of mutation.addedNodes) {
						if (node.nodeType === Node.ELEMENT_NODE) {
							this._pendingNodes.push(node);
						}
					}
				}
			}

			if (!this._rafScheduled && this._pendingNodes.length > 0) {
				this._rafScheduled = true;
				requestAnimationFrame(() => {
					this._flushPendingNodes();
				});
			}
		} catch (error) {
			console.error('[TextProcessor]', 'Error handling DOM changes:', error);
		}
	}

	_flushPendingNodes() {
		try {
			this._rafScheduled = false;
			if (this._pendingNodes.length === 0) return;
			const batch = this._pendingNodes;
			this._pendingNodes = [];
			const unique = new Set();
			for (const node of batch) {
				if (node && node.nodeType === Node.ELEMENT_NODE) {
					unique.add(node);
				}
			}
			unique.forEach((el) => {
				this.processPageContent(el);
			});
		} catch (error) {
			console.error('[TextProcessor]', 'Error flushing pending nodes:', error);
		}
	}

	async processPageContent(container, options = {}, forceReprocess = false) {
		try {
			// Ensure container is an HTMLElement
			if (!(container instanceof HTMLElement)) {
				return;
			}

			const mergedOptions = { ...this._defaultOptions, ...options };

			const allSelectors = [
				...TextProcessor._DISPLAY_NAME_SELECTORS,
				...TextProcessor._TOOLTIP_SELECTORS,
			];
			const processingSelector = allSelectors.join(', ');

			const elementsToProcess = [];
			if (allSelectors.some((selector) => container.matches(selector))) {
				elementsToProcess.push(container);
			}

			if (processingSelector) {
				elementsToProcess.push(
					...container.querySelectorAll(processingSelector),
				);
			}

			const uniqueElements = new Set(elementsToProcess);

			for (const element of uniqueElements) {
				await this._processTextElement(element, mergedOptions, forceReprocess);
			}
		} catch (error) {
			console.error(
				'[TextProcessor]',
				'Error processing page content:',
				error,
				container,
			);
		}
	}

	async processElement(element) {
		try {
			if (!element) {
				return;
			}
			await this.processPageContent(element, {}, true);
		} catch (error) {
			console.error('[TextProcessor]', 'Error processing element:', error);
		}
	}

	async _processTextElement(element, options, forceReprocess) {
		try {
			const originalText = element.innerHTML;

			if (
				!originalText.trim() ||
				(element.hasAttribute('data-processed') && !forceReprocess)
			) {
				return;
			}

			let resolveMode = options.resolveMode || 'tooltip';

			const useDisplayName = TextProcessor._DISPLAY_NAME_SELECTORS.some(
				(selector) => element.matches(selector),
			);
			const useTooltip = TextProcessor._TOOLTIP_SELECTORS.some((selector) =>
				element.matches(selector),
			);

			if (useDisplayName) {
				resolveMode = 'displayName';
			} else if (useTooltip) {
				resolveMode = 'tooltip';
			}

			const processingOptions = { ...options, resolveMode };

			if (element.textContent.includes('{@')) {
				const processedText = await this.processString(
					originalText,
					processingOptions,
				);

				// Only update innerHTML if it actually changed
				if (processedText !== originalText) {
					element.innerHTML = processedText;
				}
			} else if (options.processFormatting) {
				// Apply formatting even if no references are present
				const formattedText = this._processFormatting(originalText);
				if (formattedText !== originalText) {
					element.innerHTML = formattedText;
				}
			}

			element.setAttribute('data-processed', 'true');
		} catch (error) {
			console.warn('[TextProcessor]', 'Error processing text element', {
				error,
				element,
			});
		}
	}

	async processString(text, options = {}) {
		try {
			if (!text) return '';

			const mergedOptions = { ...this._defaultOptions, ...options };
			let processedText = text;

			if (mergedOptions.processReferences && text.includes('{@')) {
				processedText = this._replaceReferences(processedText, mergedOptions);
			}

			if (mergedOptions.processFormatting) {
				processedText = this._processFormatting(processedText);
			}

			return processedText;
		} catch (error) {
			console.error('[TextProcessor]', 'Error processing string:', error);
			return text || ''; // Return original text on error
		}
	}

	_replaceReferences(text, _options = {}) {
		// Use Renderer5etools for consistent tag processing
		return renderStringWithTags(text);
	}

	_processFormatting(input) {
		try {
			if (!input) return '';

			const patterns = [
				{
					regex: /\*\*([^*\n][^*]*?)\*\*/g,
					replacement: '<strong>$1</strong>',
				},
				{ regex: /\*([^*\n][^*]*?)\*/g, replacement: '<em>$1</em>' },
			];

			let formattedText = input;
			for (const { regex, replacement } of patterns) {
				formattedText = formattedText.replace(regex, replacement);
			}
			return formattedText;
		} catch (error) {
			console.error('[TextProcessor]', 'Error processing formatting:', error);
			return input;
		}
	}

	static normalizeForLookup(str) {
		if (!str || typeof str !== 'string') return '';
		return str.trim().toLowerCase();
	}
}

export default TextProcessor;
export const textProcessor = new TextProcessor();
