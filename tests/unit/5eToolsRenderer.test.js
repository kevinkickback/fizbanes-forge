import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    Renderer5etools,
    processEntries,
    processString,
    registerTagHandler,
    renderStringWithTags,
    renderTag,
} from '../../src/lib/5eToolsRenderer.js';

describe('5eToolsRenderer', () => {
    describe('HTML Escaping', () => {
        it('should escape HTML special characters', () => {
            const escaped = Renderer5etools.escapeHtml('<script>alert("xss")</script>');
            expect(escaped).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
        });

        it('should escape ampersands', () => {
            const escaped = Renderer5etools.escapeHtml('A & B');
            expect(escaped).toBe('A &amp; B');
        });

        it('should escape single quotes', () => {
            const escaped = Renderer5etools.escapeHtml("It's here");
            expect(escaped).toBe('It&#x27;s here');
        });

        it('should handle empty string', () => {
            const escaped = Renderer5etools.escapeHtml('');
            expect(escaped).toBe('');
        });

        it('should handle null/undefined', () => {
            expect(Renderer5etools.escapeHtml(null)).toBe('');
            expect(Renderer5etools.escapeHtml(undefined)).toBe('');
        });

        it('should convert numbers to strings', () => {
            const escaped = Renderer5etools.escapeHtml(123);
            expect(escaped).toBe('123');
        });
    });

    describe('Tag Rendering - Core Types', () => {
        it('should render class tag', () => {
            const result = renderTag('class', 'Fighter');
            expect(result).toContain('Fighter');
            expect(result).toContain('data-hover-type="class"');
            expect(result).toContain('data-hover-name="Fighter"');
            expect(result).toContain('rd__class-link');
        });

        it('should render class tag with source', () => {
            const result = renderTag('class', 'Fighter|PHB');
            expect(result).toContain('Fighter');
            expect(result).toContain('data-hover-source="PHB"');
        });

        it('should render race tag', () => {
            const result = renderTag('race', 'Elf');
            expect(result).toContain('Elf');
            expect(result).toContain('data-hover-type="race"');
            expect(result).toContain('rd__race-link');
        });

        it('should render race tag with source', () => {
            const result = renderTag('race', 'Elf|PHB');
            expect(result).toContain('Elf');
            expect(result).toContain('data-hover-source="PHB"');
        });

        it('should render background tag', () => {
            const result = renderTag('background', 'Acolyte');
            expect(result).toContain('Acolyte');
            expect(result).toContain('data-hover-type="background"');
        });

        it('should render feat tag', () => {
            const result = renderTag('feat', 'Alert');
            expect(result).toContain('Alert');
            expect(result).toContain('data-hover-type="feat"');
        });

        it('should render spell tag', () => {
            const result = renderTag('spell', 'Fireball');
            expect(result).toContain('Fireball');
            expect(result).toContain('data-hover-type="spell"');
        });

        it('should render item tag', () => {
            const result = renderTag('item', 'Longsword');
            expect(result).toContain('Longsword');
            expect(result).toContain('data-hover-type="item"');
        });

        it('should render creature tag', () => {
            const result = renderTag('creature', 'Dragon');
            expect(result).toContain('Dragon');
            expect(result).toContain('data-hover-type="creature"');
        });

        it('should render condition tag', () => {
            const result = renderTag('condition', 'Poisoned');
            expect(result).toContain('Poisoned');
            expect(result).toContain('data-hover-type="condition"');
        });
    });

    describe('Tag Rendering - Formatting', () => {
        it('should render bold tag', () => {
            const result = renderTag('bold', 'Important');
            expect(result).toBe('<strong>Important</strong>');
        });

        it('should render b tag (shorthand bold)', () => {
            const result = renderTag('b', 'Important');
            expect(result).toBe('<strong>Important</strong>');
        });

        it('should render italic tag', () => {
            const result = renderTag('italic', 'Emphasis');
            expect(result).toBe('<em>Emphasis</em>');
        });

        it('should render i tag (shorthand italic)', () => {
            const result = renderTag('i', 'Emphasis');
            expect(result).toBe('<em>Emphasis</em>');
        });

        it('should render note tag', () => {
            const result = renderTag('note', 'Side note');
            expect(result).toContain('rd__note');
            expect(result).toContain('Side note');
        });

        it('should escape HTML in formatted text', () => {
            const result = renderTag('bold', '<script>alert()</script>');
            expect(result).not.toContain('<script>');
            expect(result).toContain('&lt;script&gt;');
        });
    });

    describe('Tag Rendering - Game Mechanics', () => {
        it('should render dice tag', () => {
            const result = renderTag('dice', '1d20');
            expect(result).toContain('1d20');
            expect(result).toContain('data-roll="1d20"');
            expect(result).toContain('rd__dice');
        });

        it('should render dc tag', () => {
            const result = renderTag('dc', '15');
            expect(result).toBe('<span class="rd__dc">DC 15</span>');
        });

        it('should render damage tag', () => {
            const result = renderTag('damage', 'Fire');
            expect(result).toContain('Fire');
            expect(result).toContain('rd__damage-type');
        });

        it('should render skill tag', () => {
            const result = renderTag('skill', 'Athletics');
            expect(result).toContain('Athletics');
            expect(result).toContain('rd__skill');
        });

        it('should render ability tag', () => {
            const result = renderTag('ability', 'Strength');
            expect(result).toContain('Strength');
            expect(result).toContain('rd__ability');
        });

        it('should render hit tag', () => {
            const result = renderTag('hit', '5');
            expect(result).toContain('5');
            expect(result).toContain('rd__hit-bonus');
        });

        it('should render recharge tag', () => {
            const result = renderTag('recharge', '5-6');
            expect(result).toContain('Recharge 5-6');
            expect(result).toContain('rd__recharge');
        });

        it('should render h tag (Hit:)', () => {
            const result = renderTag('h', '');
            expect(result).toContain('Hit:');
            expect(result).toContain('rd__hit');
        });

        it('should render m tag (Miss:)', () => {
            const result = renderTag('m', '');
            expect(result).toContain('Miss:');
            expect(result).toContain('rd__miss');
        });

        it('should render hom tag (Hit or Miss:)', () => {
            const result = renderTag('hom', '');
            expect(result).toContain('Hit or Miss:');
            expect(result).toContain('rd__hit-or-miss');
        });

        it('should render chance tag', () => {
            const result = renderTag('chance', '50');
            expect(result).toContain('50%');
            expect(result).toContain('rd__chance');
        });
    });

    describe('Tag Rendering - Advanced Types', () => {
        it('should render action tag', () => {
            const result = renderTag('action', 'Attack');
            expect(result).toContain('Attack');
            expect(result).toContain('data-hover-type="action"');
        });

        it('should render optfeature tag', () => {
            const result = renderTag('optfeature', 'Eldritch Invocation');
            expect(result).toContain('Eldritch Invocation');
            expect(result).toContain('data-hover-type="optfeature"');
        });

        it('should render deity tag', () => {
            const result = renderTag('deity', 'Bahamut');
            expect(result).toContain('Bahamut');
            expect(result).toContain('data-hover-type="deity"');
        });

        it('should render vehicle tag', () => {
            const result = renderTag('vehicle', 'Sailing Ship');
            expect(result).toContain('Sailing Ship');
            expect(result).toContain('data-hover-type="vehicle"');
        });

        it('should render trap tag', () => {
            const result = renderTag('trap', 'Pit Trap');
            expect(result).toContain('Pit Trap');
            expect(result).toContain('data-hover-type="trap"');
        });

        it('should render hazard tag', () => {
            const result = renderTag('hazard', 'Lava');
            expect(result).toContain('Lava');
            expect(result).toContain('data-hover-type="hazard"');
        });

        it('should render reward tag', () => {
            const result = renderTag('reward', 'Blessing');
            expect(result).toContain('Blessing');
            expect(result).toContain('data-hover-type="reward"');
        });

        it('should render language tag', () => {
            const result = renderTag('language', 'Elvish');
            expect(result).toContain('Elvish');
            expect(result).toContain('rd__language');
        });

        it('should render table tag', () => {
            const result = renderTag('table', 'Treasure Table');
            expect(result).toContain('Treasure Table');
            expect(result).toContain('data-hover-type="table"');
        });

        it('should render book tag', () => {
            const result = renderTag('book', "Player's Handbook|PHB");
            // Apostrophe is escaped in HTML
            expect(result).toContain('Player');
            expect(result).toContain('Handbook');
            expect(result).toContain('data-book="PHB"');
        });
    });

    describe('Tag Rendering - Special Tags', () => {
        it('should render link tag', () => {
            const result = renderTag('link', 'Click here|https://example.com');
            expect(result).toContain('Click here');
            expect(result).toContain('href="https://example.com"');
            expect(result).toContain('target="_blank"');
            expect(result).toContain('rel="noopener noreferrer"');
        });

        it('should render coinflip tag', () => {
            const result = renderTag('coinflip', '');
            expect(result).toContain('flip a coin');
            expect(result).toContain('rd__coinflip');
        });

        it('should render 5etools tag', () => {
            const result = renderTag('5etools', '');
            expect(result).toContain('5etools');
            expect(result).toContain('https://5e.tools');
        });

        it('should render 5etools tag with custom text', () => {
            const result = renderTag('5etools', 'Visit 5etools|https://5e.tools');
            expect(result).toContain('Visit 5etools');
        });
    });

    describe('Unknown Tag Handling', () => {
        it('should handle unknown tag gracefully', () => {
            const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });

            const result = renderTag('unknowntag', 'content|source');
            expect(result).toBe('content'); // Returns first part, escaped
            expect(consoleWarnSpy).toHaveBeenCalledWith(
                '[Renderer5etools Unknown tag:]',
                'unknowntag',
            );

            consoleWarnSpy.mockRestore();
        });

        it('should escape content of unknown tags', () => {
            const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });

            const result = renderTag('unknowntag', '<script>alert()</script>');
            expect(result).not.toContain('<script>');
            expect(result).toContain('&lt;script&gt;');

            consoleWarnSpy.mockRestore();
        });
    });

    describe('renderStringWithTags', () => {
        it('should render single tag in text', () => {
            const result = renderStringWithTags('You see a {@creature Dragon}.');
            expect(result).toContain('You see a');
            expect(result).toContain('Dragon');
            expect(result).toContain('data-hover-type="creature"');
        });

        it('should render multiple tags in text', () => {
            const result = renderStringWithTags(
                'The {@class Fighter} casts {@spell Fireball}.',
            );
            expect(result).toContain('Fighter');
            expect(result).toContain('Fireball');
            expect(result).toContain('data-hover-type="class"');
            expect(result).toContain('data-hover-type="spell"');
        });

        it('should render tags with sources', () => {
            const result = renderStringWithTags('A {@race Elf|PHB} appears.');
            expect(result).toContain('Elf');
            expect(result).toContain('data-hover-source="PHB"');
        });

        it('should render formatting tags', () => {
            const result = renderStringWithTags('This is {@bold important} text.');
            expect(result).toContain('This is');
            expect(result).toContain('<strong>important</strong>');
            expect(result).toContain('text.');
        });

        it('should handle text without tags', () => {
            const result = renderStringWithTags('Plain text without tags.');
            expect(result).toBe('Plain text without tags.');
        });

        it('should handle empty string', () => {
            const result = renderStringWithTags('');
            expect(result).toBe('');
        });

        it('should handle null/undefined', () => {
            expect(renderStringWithTags(null)).toBe('');
            expect(renderStringWithTags(undefined)).toBe('');
        });

        it('should handle adjacent tags', () => {
            const result = renderStringWithTags('{@bold Bold}{@italic Italic}');
            expect(result).toContain('<strong>Bold</strong>');
            expect(result).toContain('<em>Italic</em>');
        });

        it('should handle multiple instances of same tag', () => {
            const result = renderStringWithTags(
                '{@dice 1d6} damage or {@dice 2d6} damage',
            );
            expect(result).toContain('data-roll="1d6"');
            expect(result).toContain('data-roll="2d6"');
        });
    });

    describe('processString', () => {
        it('should be an alias for renderStringWithTags', () => {
            const text = 'The {@class Wizard} casts {@spell Magic Missile}.';
            const result1 = processString(text);
            const result2 = renderStringWithTags(text);
            expect(result1).toBe(result2);
        });

        it('should handle empty string', () => {
            const result = processString('');
            expect(result).toBe('');
        });
    });

    describe('processEntries', () => {
        it('should process string entry', () => {
            const entries = 'Simple string';
            const result = processEntries(entries);
            expect(result).toBe('Simple string');
        });

        it('should process array of strings', () => {
            const entries = ['First sentence.', 'Second sentence.'];
            const result = processEntries(entries);
            expect(result).toContain('First sentence.');
            expect(result).toContain('Second sentence.');
        });

        it('should process strings with tags in array', () => {
            const entries = [
                'A {@class Fighter} attacks.',
                'The {@creature Dragon} roars.',
            ];
            const result = processEntries(entries);
            expect(result).toContain('Fighter');
            expect(result).toContain('Dragon');
            expect(result).toContain('data-hover-type="class"');
            expect(result).toContain('data-hover-type="creature"');
        });

        it('should process nested entry objects', () => {
            const entries = [
                { entries: ['Nested text with {@spell Fireball}.'] },
            ];
            const result = processEntries(entries);
            expect(result).toContain('Fireball');
            expect(result).toContain('data-hover-type="spell"');
        });

        it('should process mixed array of strings and objects', () => {
            const entries = [
                'First line.',
                { entries: ['Nested line.'] },
                'Last line.',
            ];
            const result = processEntries(entries);
            expect(result).toContain('First line.');
            expect(result).toContain('Nested line.');
            expect(result).toContain('Last line.');
        });

        it('should handle empty array', () => {
            const result = processEntries([]);
            expect(result).toBe('');
        });

        it('should handle non-string, non-object entries gracefully', () => {
            // processEntries only processes strings and objects with entries
            // Other types are skipped (return empty string)
            const entries = [123, 'Valid text'];
            const result = processEntries(entries);
            expect(result).toContain('Valid text');
            // Numbers are not processed, so 123 won't appear in output
        });
    });

    describe('Custom Tag Registration', () => {
        let originalHandler;

        beforeEach(() => {
            // Save original handler if it exists
            originalHandler = null;
        });

        it('should allow registering custom tag handlers', () => {
            registerTagHandler('custom', (text) => {
                return `<span class="custom">${text}</span>`;
            });

            const result = renderTag('custom', 'test');
            expect(result).toBe('<span class="custom">test</span>');
        });

        it('should allow overriding existing tag handlers', () => {
            // Register custom handler
            registerTagHandler('bold', (text) => {
                return `<b class="custom-bold">${text}</b>`;
            });

            const result = renderTag('bold', 'test');
            expect(result).toBe('<b class="custom-bold">test</b>');
        });

        it('should use custom handler in renderStringWithTags', () => {
            registerTagHandler('myTag', (text) => {
                return `[CUSTOM:${text}]`;
            });

            const result = renderStringWithTags('Text with {@myTag content}.');
            expect(result).toContain('[CUSTOM:content]');
        });
    });

    describe('Edge Cases', () => {
        it('should handle tag with spaces in content', () => {
            const result = renderStringWithTags('{@spell Magic Missile}');
            expect(result).toContain('Magic Missile');
        });

        it('should handle tag with special characters in content', () => {
            const result = renderStringWithTags("{@item Bag of Holding}");
            expect(result).toContain('Bag of Holding');
        });

        it('should handle malformed tags gracefully', () => {
            const result = renderStringWithTags('Text with {@incomplete');
            // Should not crash, returns original text
            expect(result).toContain('Text with {@incomplete');
        });

        it('should handle tags with empty content', () => {
            const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });
            const result = renderStringWithTags('{@bold }');
            // Should handle gracefully
            expect(result).toBeDefined();
            consoleWarnSpy.mockRestore();
        });

        it('should handle pipe separator with extra spaces', () => {
            const result = renderTag('spell', 'Fireball | PHB');
            expect(result).toContain('Fireball');
            expect(result).toContain('data-hover-source="PHB"');
        });

        it('should handle multiple pipe separators', () => {
            // Only first two parts are typically used
            const result = renderTag('spell', 'Fireball|PHB|extra');
            expect(result).toContain('Fireball');
            expect(result).toContain('data-hover-source="PHB"');
        });

        it('should prevent XSS in tag content', () => {
            // Note: Built-in tags escape HTML, but custom tags may not
            const result = renderStringWithTags(
                '{@spell <script>alert("xss")</script>}',
            );
            expect(result).not.toContain('<script>');
            expect(result).toContain('&lt;script&gt;');
        });

        it('should prevent XSS in source field', () => {
            const result = renderTag('spell', 'Test|<script>alert()</script>');
            expect(result).not.toContain('<script>');
            expect(result).toContain('&lt;script&gt;');
        });

        it('should handle very long tag content', () => {
            const longName = 'A'.repeat(1000);
            const result = renderTag('spell', longName);
            expect(result).toContain(longName);
        });

        it('should handle unicode characters', () => {
            const result = renderStringWithTags('{@deity Ōkuninushi}');
            expect(result).toContain('Ōkuninushi');
        });

        it('should handle newlines in content', () => {
            const result = processEntries(['Line 1\nLine 2']);
            expect(result).toContain('Line 1');
            expect(result).toContain('Line 2');
        });
    });

    describe('Renderer5etools Export Object', () => {
        it('should export all public functions', () => {
            expect(Renderer5etools.registerTagHandler).toBeDefined();
            expect(Renderer5etools.renderTag).toBeDefined();
            expect(Renderer5etools.renderStringWithTags).toBeDefined();
            expect(Renderer5etools.processString).toBeDefined();
            expect(Renderer5etools.processEntries).toBeDefined();
            expect(Renderer5etools.escapeHtml).toBeDefined();
        });

        it('should use exported functions correctly', () => {
            const result = Renderer5etools.processString('{@spell Fireball}');
            expect(result).toContain('Fireball');
            expect(result).toContain('data-hover-type="spell"');
        });
    });
});
