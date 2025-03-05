/**
 * TextProcessor.js
 * Handles text processing for the D&D Character Creator
 */

export class TextProcessor {
    constructor(referenceResolver) {
        this.referenceResolver = referenceResolver;
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
} 