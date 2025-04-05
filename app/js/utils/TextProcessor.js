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
     * @param {ReferenceResolver} referenceResolver - The reference resolver instance
     * @throws {Error} If referenceResolver is not provided
     */
    constructor(referenceResolver) {
        if (!referenceResolver) {
            throw new Error('ReferenceResolver is required for TextProcessor');
        }
        this.referenceResolver = referenceResolver;
        this.observer = null;
        this.defaultOptions = {
            processReferences: true,
            processFormatting: true,
            processDynamicContent: true
        };
    }

    /**
     * Initialize the text processor and set up observers for dynamic content processing.
     * Sets up a MutationObserver to watch for DOM changes and processes new content.
     * Also processes the initial page content.
     * 
     * @returns {Promise<void>}
     */
    initialize() {
        // Set up mutation observer to process dynamically added content
        this.observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    for (const node of mutation.addedNodes) {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            this.processPageContent(node);
                        }
                    }
                }
            }
        });

        // Start observing the document body for dynamic content changes
        this.observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        // Process initial page content
        this.processPageContent(document.body);
    }

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
        const mergedOptions = { ...this.defaultOptions, ...options };

        // Find all text nodes that might contain references
        const textElements = container.querySelectorAll('.description, .text-content, .tooltip-content, p, li, td, .card-text');

        for (const element of textElements) {
            try {
                const originalText = element.innerHTML;
                // Skip if already processed or empty, unless force reprocessing
                if (!originalText || (element.hasAttribute('data-processed') && !forceReprocess)) continue;

                const processedText = await this.processString(originalText, mergedOptions);
                if (processedText !== originalText) {
                    element.innerHTML = processedText;
                }
                // Mark as processed to avoid reprocessing
                element.setAttribute('data-processed', 'true');
            } catch (error) {
                console.warn('Error processing text content:', error);
            }
        }
    }

    /**
     * Process a string value and handle references and formatting.
     * Applies reference resolution and text formatting based on provided options.
     * 
     * @param {string} text - The string to process
     * @param {TextProcessingOptions} [options] - Processing options to override defaults
     * @returns {Promise<string>} The processed string with resolved references and formatting
     */
    async processString(text, options = {}) {
        if (!text) return '';

        let processedText = text;

        // Process references if enabled
        if (options.processReferences) {
            processedText = await this.replaceReferences(processedText);
        }

        // Process formatting if enabled
        if (options.processFormatting) {
            processedText = this.processFormatting(processedText);
        }

        return processedText;
    }

    /**
     * Replace references in text with their resolved values.
     * Handles D&D-style references in the format {@reference}.
     * 
     * @param {string} text - The text containing references
     * @returns {Promise<string>} The text with resolved references
     */
    async replaceReferences(text) {
        const refRegex = /{@[^}]+}/g;
        const matches = text.match(refRegex);
        if (!matches) return text;

        let result = text;
        for (const match of matches) {
            const resolved = await this.referenceResolver.resolveRef(match);
            result = result.replace(match, resolved);
        }
        return result;
    }

    /**
     * Process text formatting (bold, italic, headers).
     * Applies markdown-style formatting to text content.
     * 
     * @param {string} input - The text to format
     * @returns {string} The formatted text with HTML tags
     */
    processFormatting(input) {
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
    }

    /**
     * Clean up resources and disconnect observers.
     * Should be called when the text processor is no longer needed.
     * 
     * @returns {void}
     */
    destroy() {
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
    }

    /**
     * Explicitly process a specific DOM element
     * Use this method when you need to immediately process content that was just added
     * @param {HTMLElement} element - The element to process 
     * @param {boolean} [forceReprocess=true] - Whether to reprocess already processed elements
     * @returns {Promise<void>}
     */
    async processElement(element) {
        if (!element) return;
        await this.processPageContent(element, {}, true);
    }
}

// Create and export singleton instance with injected dependency
export const textProcessor = new TextProcessor(referenceResolver); 