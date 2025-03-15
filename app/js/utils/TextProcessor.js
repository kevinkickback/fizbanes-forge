/**
 * TextProcessor.js
 * Handles text processing for the D&D Character Creator
 */

import { referenceResolver } from './ReferenceResolver.js';

class TextProcessor {
    constructor(referenceResolver) {
        if (!referenceResolver) {
            throw new Error('ReferenceResolver is required for TextProcessor');
        }
        this.referenceResolver = referenceResolver;
        this.observer = null;
    }

    /**
     * Initialize the text processor and set up observers
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
     * Process text content in a container
     * @param {HTMLElement} container - The container element to process
     */
    async processPageContent(container) {
        // Find all text nodes that might contain references
        const textElements = container.querySelectorAll('.description, .text-content, .tooltip-content, p, li, td, .card-text');

        for (const element of textElements) {
            try {
                const originalText = element.innerHTML;
                // Skip if already processed or empty
                if (!originalText || element.hasAttribute('data-processed')) continue;

                const processedText = await this.processText(originalText);
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

    async processText(text) {
        if (!text) return '';
        if (typeof text === 'string') {
            return this.processString(text);
        }
        if (Array.isArray(text)) {
            return this.processArray(text);
        }
        if (typeof text === 'object') {
            return this.processObject(text);
        }
        return String(text);
    }

    async processString(text) {
        // Replace references
        const withReferences = await this.replaceReferences(text);

        // Process markdown-style formatting
        const formatted = this.processFormatting(withReferences);

        return formatted;
    }

    async processArray(array) {
        const processed = await Promise.all(array.map(item => this.processText(item)));
        return processed.join('\n');
    }

    async processObject(obj) {
        if (obj.type === 'list') {
            return this.processList(obj);
        }
        if (obj.type === 'table') {
            return this.processTable(obj);
        }
        if (obj.entries) {
            return this.processText(obj.entries);
        }
        return '';
    }

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

    async processList(list) {
        const items = await Promise.all(list.items.map(async item => {
            const processed = await this.processText(item);
            return `<li>${processed}</li>`;
        }));

        const tag = list.ordered ? 'ol' : 'ul';
        return `<${tag}>${items.join('')}</${tag}>`;
    }

    async processTable(table) {
        const headers = table.headers.map(h => `<th>${h}</th>`).join('');
        const rows = await Promise.all(table.rows.map(async row => {
            const cells = await Promise.all(row.map(cell => this.processText(cell)));
            return `<tr>${cells.map(c => `<td>${c}</td>`).join('')}</tr>`;
        }));

        return `
            <table class="data-table">
                <thead><tr>${headers}</tr></thead>
                <tbody>${rows.join('')}</tbody>
            </table>
        `;
    }

    /**
     * Clean up resources when the processor is no longer needed
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