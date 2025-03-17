/**
 * TextProcessor.js
 * Handles text processing for D&D content formatting and references
 * 
 * @typedef {Object} TextProcessingOptions
 * @property {boolean} [processReferences=true] - Whether to process references in text
 * @property {boolean} [processFormatting=true] - Whether to process text formatting
 * 
 * @typedef {Object} ProcessedText
 * @property {string} text - The processed text content
 * @property {Array<string>} references - List of references found in the text
 */

import { referenceResolver } from './ReferenceResolver.js';

/**
 * Class responsible for processing text content, handling references, and formatting
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
    }

    /**
     * Initialize the text processor and set up observers
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

        console.log('TextProcessor initialized successfully');
    }

    /**
     * Process all content within a container element
     * @param {HTMLElement} container - The container element to process
     * @param {TextProcessingOptions} [options] - Processing options
     * @returns {Promise<void>}
     */
    async processPageContent(container, options = {}) {
        // Find all text nodes that might contain references
        const textElements = container.querySelectorAll('.description, .text-content, .tooltip-content, p, li, td, .card-text');

        for (const element of textElements) {
            try {
                const originalText = element.innerHTML;
                // Skip if already processed or empty
                if (!originalText || element.hasAttribute('data-processed')) continue;

                const processedText = await this.processText(originalText, options);
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
     * Process text content and handle references
     * @param {string} text - The text to process
     * @param {TextProcessingOptions} [options] - Processing options
     * @returns {Promise<string>} The processed text
     */
    async processText(text, options = {}) {
        if (!text) return '';
        return this.processString(text);
    }

    /**
     * Process a string value and handle references
     * @param {string} text - The string to process
     * @returns {Promise<string>} The processed string
     */
    async processString(text) {
        // Replace references
        const withReferences = await this.replaceReferences(text);

        // Process markdown-style formatting
        const formatted = this.processFormatting(withReferences);

        return formatted;
    }

    /**
     * Replace references in text with their resolved values
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
     * Process text formatting (bold, italic, etc.)
     * @param {string} input - The text to format
     * @returns {string} The formatted text
     */
    processFormatting(input) {
        // Bold
        const withBold = input.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

        // Italic
        const withItalic = withBold.replace(/\*([^*]+)\*/g, '<em>$1</em>');

        // Headers
        const withH3 = withItalic.replace(/^### (.+)$/gm, '<h3>$1</h3>');
        const withH2 = withH3.replace(/^## (.+)$/gm, '<h2>$1</h2>');
        const withH1 = withH2.replace(/^# (.+)$/gm, '<h1>$1</h1>');

        return withH1;
    }

    /**
     * Clean up resources and disconnect observers
     */
    destroy() {
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
    }
}

// Create and export singleton instance with injected dependency
export const textProcessor = new TextProcessor(referenceResolver); 