/**
 * TextProcessor.js
 * Process text content, handle references, and apply formatting to D&D game content.
 * 
 * @typedef {Object} TextProcessingOptions
 * @property {boolean} [processReferences=true] - Whether to process references in text
 * @property {boolean} [processFormatting=true] - Whether to process text formatting
 * @property {boolean} [processDynamicContent=true] - Whether to process dynamically added content
 * @property {('tooltip'|'displayName')} [resolveMode] - How to resolve references ('tooltip' or 'displayName')
 */

import { referenceResolver } from './ReferenceResolver.js';

/**
 * Class responsible for processing text content, handling references, and formatting.
 * Manages both static and dynamic content processing with configurable options.
 */
class TextProcessor {
    /**
     * Configuration: CSS selectors for elements where references should be resolved
     * to display name only (no tooltip).
     * @type {string[]}
     * @private
     * @static
     */
    static _DISPLAY_NAME_SELECTORS = [
        '.text-content'
        // Add other selectors here if needed, e.g., '.some-other-class'
    ];

    /**
     * Configuration: CSS selectors for elements where references should be resolved
     * into full tooltips.
     * @type {string[]}
     * @private
     * @static
     */
    static _TOOLTIP_SELECTORS = [
        '.description',
        '.tooltip-content',
        'p',
        'li',
        'td',
        '.card-text',
        '.proficiency-note'
        // Add other selectors here if needed
    ];

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
            processDynamicContent: true,
            resolveMode: 'tooltip' // Default resolve mode
        };
    }


    /**
     * Initialize the text processor and set up observers for dynamic content processing.
     * Sets up a MutationObserver to watch for DOM changes and processes new content.
     * Also processes the initial page content.
     * 
     * @returns {Promise<void>}
     */
    async initialize() {
        try {

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
                            // Pass the element itself as the container
                            this.processPageContent(node);
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Error handling DOM changes:', error);
        }
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
        try {
            // Ensure container is an HTMLElement
            if (!(container instanceof HTMLElement)) {
                return;
            }

            const mergedOptions = { ...this._defaultOptions, ...options };

            // Combine all configured selectors for initial gathering
            const allSelectors = [
                ...TextProcessor._DISPLAY_NAME_SELECTORS,
                ...TextProcessor._TOOLTIP_SELECTORS
            ];
            const processingSelector = allSelectors.join(', ');

            const elementsToProcess = [];
            // Check if the container itself matches any processing selector
            // Use allSelectors here for the check
            if (allSelectors.some(selector => container.matches(selector))) {
                elementsToProcess.push(container);
            }

            // Add descendants that match using the combined processingSelector
            if (processingSelector) { // Ensure selector is not empty
                elementsToProcess.push(...container.querySelectorAll(processingSelector));
            }

            // Use a Set to avoid processing the same element multiple times if it's nested
            const uniqueElements = new Set(elementsToProcess);

            for (const element of uniqueElements) {
                await this._processTextElement(element, mergedOptions, forceReprocess);
            }
        } catch (error) {
            console.error('Error processing page content:', error, container);
        }
    }


    /**
     * Process a specific DOM element
     * Use this method when you need to immediately process content that was just added
     * 
     * @param {HTMLElement} element - The element to process 
     * @returns {Promise<void>}
     */
    async processElement(element) {
        try {
            if (!element) {
                return;
            }
            // Force reprocess when called directly on an element
            await this.processPageContent(element, {}, true);
        } catch (error) {
            console.error('Error processing element:', error);
        }
    }

    /**
     * Process a single text element with the given options
     * 
     * @param {HTMLElement} element - The element to process
     * @param {TextProcessingOptions} options - Processing options passed down (may include resolveMode)
     * @param {boolean} forceReprocess - Whether to reprocess already processed elements
     * @returns {Promise<void>}
     * @private
     */
    async _processTextElement(element, options, forceReprocess) {
        try {
            const originalText = element.innerHTML;

            // Skip if empty, or already processed unless forced
            if (!originalText.trim() || (element.hasAttribute('data-processed') && !forceReprocess)) {
                return;
            }

            // --- Determine Resolve Mode Based on Element Class Configuration ---
            let resolveMode = options.resolveMode || 'tooltip'; // Start with default/passed option

            const useDisplayName = TextProcessor._DISPLAY_NAME_SELECTORS.some(selector =>
                element.matches(selector)
            );
            const useTooltip = TextProcessor._TOOLTIP_SELECTORS.some(selector =>
                element.matches(selector)
            );

            if (useDisplayName) {
                resolveMode = 'displayName';
            } else if (useTooltip) {
                resolveMode = 'tooltip';
            }
            // If it matches neither list, it will keep the default 'tooltip' mode.


            // Pass the determined mode down in the options for processString
            const processingOptions = { ...options, resolveMode: resolveMode };

            // Only process if there's text content to avoid unnecessary async calls
            if (element.textContent.includes('{@')) {
                const processedText = await this.processString(originalText, processingOptions);

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


            // Mark as processed to avoid reprocessing by the MutationObserver unless forced
            element.setAttribute('data-processed', 'true');
        } catch (error) {
            console.warn('Error processing text element:', error, element);
        }
    }


    /**
     * Process a string value and handle references and formatting.
     * Applies reference resolution and text formatting based on provided options.
     * 
     * @param {string} text - The string to process
     * @param {TextProcessingOptions} [options] - Processing options to override defaults (includes resolveMode)
     * @returns {Promise<string>} The processed string with resolved references and formatting
     */
    async processString(text, options = {}) {
        try {
            if (!text) return '';

            // Merge passed options with defaults
            const mergedOptions = { ...this._defaultOptions, ...options };
            let processedText = text;

            // Process references if enabled, passing the options (including resolveMode)
            if (mergedOptions.processReferences && text.includes('{@')) {
                processedText = await this._replaceReferences(processedText, mergedOptions);
            }

            // Process formatting if enabled
            if (mergedOptions.processFormatting) {
                processedText = this._processFormatting(processedText);
            }

            return processedText;
        } catch (error) {
            console.error('Error processing string:', error);
            return text || ''; // Return original text on error
        }
    }

    /**
     * Replace references in text with their resolved values.
     * Handles D&D-style references in the format {@reference}.
     * 
     * @param {string} text - The text containing references
     * @param {TextProcessingOptions} options - Processing options (includes resolveMode)
     * @returns {Promise<string>} The text with resolved references
     * @private
     */
    async _replaceReferences(text, options = {}) {
        // Regex to find {@type content} tags
        const referenceRegex = /{@(\w+)\s+([^}]+)}/g;
        let lastIndex = 0;
        const promises = [];
        const segments = [];

        // First pass: find matches and store promises for resolution
        let match;
        while (true) {
            match = referenceRegex.exec(text);
            if (match === null) {
                break;
            }

            // Add segment of text before the match
            if (match.index > lastIndex) {
                segments.push(text.substring(lastIndex, match.index));
            }
            // Store a promise for the resolved reference
            const promiseIndex = promises.length;
            promises.push(this._referenceResolver.resolveRef(match[0], options));
            // Add a placeholder to the segments array
            segments.push({ promiseIndex });
            lastIndex = referenceRegex.lastIndex;
        }
        // Add any remaining text after the last match
        if (lastIndex < text.length) {
            segments.push(text.substring(lastIndex));
        }

        // If no references were found, return the original text
        if (promises.length === 0) {
            return text;
        }

        // Resolve all reference promises
        const resolvedValues = await Promise.all(promises);

        // Second pass: build the final string using resolved values
        return segments.map(segment => {
            if (typeof segment === 'string') {
                return segment;
            }
            if (segment.promiseIndex !== undefined) {
                return resolvedValues[segment.promiseIndex];
            }
            return ''; // Should not happen, but ensures a return value
        }).join('');
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
                { regex: /\*\*([^\*\n][^\*]*?)\*\*/g, replacement: '<strong>$1</strong>' }, // Bold, avoid matching across newlines initially
                { regex: /\*([^\*\n][^\*]*?)\*/g, replacement: '<em>$1</em>' }, // Italic, avoid matching across newlines initially
                // Add more formatting rules as needed
            ];

            // Apply each formatting pattern
            let formattedText = input;
            for (const { regex, replacement } of patterns) {
                formattedText = formattedText.replace(regex, replacement);
            }
            return formattedText;

        } catch (error) {
            console.error('Error processing formatting:', error);
            return input; // Return original input on error
        }
    }
}

// Create and export singleton instance with injected dependency
// Ensure referenceResolver is initialized and exported from its module
export const textProcessor = new TextProcessor(referenceResolver); 