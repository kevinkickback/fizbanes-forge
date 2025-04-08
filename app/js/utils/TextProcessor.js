/**
 * TextProcessor.js
 * Process text content, handle references, and apply formatting to D&D game content.
 * 
 * @typedef {Object} TextProcessingOptions
 * @property {boolean} [processReferences=true] - Whether to process references in text
 * @property {boolean} [processFormatting=true] - Whether to process text formatting
 * @property {boolean} [processDynamicContent=true] - Whether to process dynamically added content
 */

import { referenceResolver } from './ReferenceResolver.js';

/**
 * Class responsible for processing text content, handling references, and formatting.
 * Manages both static and dynamic content processing with configurable options.
 */
class TextProcessor {
    /**
     * Creates a TextProcessor instance with the given reference resolver
     * @param {ReferenceResolver} referenceResolver - The reference resolver instance
     * @throws {Error} If referenceResolver is not provided
     */
    constructor(referenceResolver) {
        if (!referenceResolver) {
            throw new Error('ReferenceResolver is required for TextProcessor');
        }

        /**
         * Reference resolver instance used to process references in text
         * @type {ReferenceResolver}
         * @private
         */
        this._referenceResolver = referenceResolver;

        /**
         * Mutation observer for dynamic content processing
         * @type {MutationObserver|null}
         * @private
         */
        this._observer = null;

        /**
         * Default options for text processing
         * @type {TextProcessingOptions}
         * @private
         */
        this._defaultOptions = {
            processReferences: true,
            processFormatting: true,
            processDynamicContent: true
        };
    }

    //-------------------------------------------------------------------------
    // Initialization & Cleanup
    //-------------------------------------------------------------------------

    /**
     * Initialize the text processor and set up observers for dynamic content processing.
     * Sets up a MutationObserver to watch for DOM changes and processes new content.
     * Also processes the initial page content.
     * 
     * @returns {Promise<void>}
     */
    async initialize() {
        try {
            console.debug('Initializing text processor');

            // Set up mutation observer to process dynamically added content
            this._observer = new MutationObserver((mutations) => {
                this._handleDOMChanges(mutations);
            });

            // Start observing the document body for dynamic content changes
            this._observer.observe(document.body, {
                childList: true,
                subtree: true
            });

            // Process initial page content
            await this.processPageContent(document.body);

            console.debug('Text processor initialization complete');
        } catch (error) {
            console.error('Error initializing text processor:', error);
        }
    }

    /**
     * Clean up resources and disconnect observers.
     * Should be called when the text processor is no longer needed.
     */
    destroy() {
        try {
            if (this._observer) {
                this._observer.disconnect();
                this._observer = null;
                console.debug('Text processor observer disconnected');
            }
        } catch (error) {
            console.error('Error destroying text processor:', error);
        }
    }

    /**
     * Handles DOM mutations by processing added nodes
     * @param {MutationRecord[]} mutations - The mutation records to process
     * @private
     */
    _handleDOMChanges(mutations) {
        try {
            for (const mutation of mutations) {
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    for (const node of mutation.addedNodes) {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            this.processPageContent(node);
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Error handling DOM changes:', error);
        }
    }

    //-------------------------------------------------------------------------
    // Content Processing
    //-------------------------------------------------------------------------

    /**
     * Process all content within a container element.
     * Finds text elements and applies reference resolution and formatting.
     * 
     * @param {HTMLElement} container - The container element to process
     * @param {TextProcessingOptions} [options] - Processing options to override defaults
     * @param {boolean} [forceReprocess=false] - Whether to reprocess elements even if already processed
     * @returns {Promise<void>}
     */
    async processPageContent(container, options = {}, forceReprocess = false) {
        try {
            if (!container) {
                console.debug('Skipping processing: No container provided');
                return;
            }

            const mergedOptions = { ...this._defaultOptions, ...options };

            // Find all text nodes that might contain references
            const textElements = container.querySelectorAll('.description, .text-content, .tooltip-content, p, li, td, .card-text');

            for (const element of textElements) {
                await this._processTextElement(element, mergedOptions, forceReprocess);
            }
        } catch (error) {
            console.error('Error processing page content:', error);
        }
    }

    /**
     * Process a specific DOM element
     * Use this method when you need to immediately process content that was just added
     * 
     * @param {HTMLElement} element - The element to process 
     * @param {boolean} [forceReprocess=true] - Whether to reprocess already processed elements
     * @returns {Promise<void>}
     */
    async processElement(element) {
        try {
            if (!element) {
                console.debug('Skipping element processing: No element provided');
                return;
            }

            await this.processPageContent(element, {}, true);
        } catch (error) {
            console.error('Error processing element:', error);
        }
    }

    /**
     * Process a single text element with the given options
     * 
     * @param {HTMLElement} element - The element to process
     * @param {TextProcessingOptions} options - Processing options
     * @param {boolean} forceReprocess - Whether to reprocess already processed elements
     * @returns {Promise<void>}
     * @private
     */
    async _processTextElement(element, options, forceReprocess) {
        try {
            const originalText = element.innerHTML;

            // Skip if already processed or empty, unless force reprocessing
            if (!originalText || (element.hasAttribute('data-processed') && !forceReprocess)) {
                return;
            }

            const processedText = await this.processString(originalText, options);
            if (processedText !== originalText) {
                element.innerHTML = processedText;
            }

            // Mark as processed to avoid reprocessing
            element.setAttribute('data-processed', 'true');
        } catch (error) {
            console.warn('Error processing text element:', error);
        }
    }

    //-------------------------------------------------------------------------
    // Text Processing
    //-------------------------------------------------------------------------

    /**
     * Process a string value and handle references and formatting.
     * Applies reference resolution and text formatting based on provided options.
     * 
     * @param {string} text - The string to process
     * @param {TextProcessingOptions} [options] - Processing options to override defaults
     * @returns {Promise<string>} The processed string with resolved references and formatting
     */
    async processString(text, options = {}) {
        try {
            if (!text) return '';

            const mergedOptions = { ...this._defaultOptions, ...options };
            let processedText = text;

            // Process references if enabled
            if (mergedOptions.processReferences) {
                processedText = await this._replaceReferences(processedText);
            }

            // Process formatting if enabled
            if (mergedOptions.processFormatting) {
                processedText = this._processFormatting(processedText);
            }

            return processedText;
        } catch (error) {
            console.error('Error processing string:', error);
            return text || '';
        }
    }

    /**
     * Replace references in text with their resolved values.
     * Handles D&D-style references in the format {@reference}.
     * 
     * @param {string} text - The text containing references
     * @returns {Promise<string>} The text with resolved references
     * @private
     */
    async _replaceReferences(text) {
        try {
            const refRegex = /{@[^}]+}/g;
            const matches = text.match(refRegex);

            if (!matches) return text;

            let result = text;
            for (const match of matches) {
                try {
                    const resolved = await this._referenceResolver.resolveRef(match);
                    result = result.replace(match, resolved);
                } catch (resolveError) {
                    console.warn('Error resolving reference:', resolveError);
                    // Keep the original reference in case of error
                }
            }

            return result;
        } catch (error) {
            console.error('Error replacing references:', error);
            return text;
        }
    }

    /**
     * Process text formatting (bold, italic, headers).
     * Applies markdown-style formatting to text content.
     * 
     * @param {string} input - The text to format
     * @returns {string} The formatted text with HTML tags
     * @private
     */
    _processFormatting(input) {
        try {
            if (!input) return '';

            // Define formatting patterns
            const patterns = [
                { regex: /\*\*([^*]+)\*\*/g, replacement: '<strong>$1</strong>' }, // Bold
                { regex: /\*([^*]+)\*/g, replacement: '<em>$1</em>' }, // Italic
                { regex: /^### (.+)$/gm, replacement: '<h3>$1</h3>' }, // H3
                { regex: /^## (.+)$/gm, replacement: '<h2>$1</h2>' }, // H2
                { regex: /^# (.+)$/gm, replacement: '<h1>$1</h1>' }  // H1
            ];

            // Apply each formatting pattern
            return patterns.reduce((text, { regex, replacement }) =>
                text.replace(regex, replacement),
                input
            );
        } catch (error) {
            console.error('Error processing formatting:', error);
            return input;
        }
    }
}

// Create and export singleton instance with injected dependency
export const textProcessor = new TextProcessor(referenceResolver); 