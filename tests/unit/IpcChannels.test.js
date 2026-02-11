import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __dirname = resolve(fileURLToPath(import.meta.url), '..');

/**
 * Parse an IPC_CHANNELS object literal from a JS/CJS source file.
 * Returns a plain { KEY: 'value' } map of channel constants.
 */
function parseChannelsFromFile(filePath) {
    const source = readFileSync(filePath, 'utf-8');
    const match = source.match(/(?:const|export const) IPC_CHANNELS\s*=\s*\{([\s\S]*?)\};/);
    if (!match) throw new Error(`Could not find IPC_CHANNELS in ${filePath}`);

    const entries = {};
    const pairRegex = /(\w+):\s*'([^']+)'/g;
    let m = pairRegex.exec(match[1]);
    while (m !== null) {
        entries[m[1]] = m[2];
        m = pairRegex.exec(match[1]);
    }
    return entries;
}

const channelsPath = resolve(__dirname, '../../src/main/ipc/channels.js');
const preloadPath = resolve(__dirname, '../../src/main/Preload.cjs');

const sourceOfTruth = parseChannelsFromFile(channelsPath);
const preloadChannels = parseChannelsFromFile(preloadPath);

describe('IPC Channel Sync', () => {
    it('should have channels.js as the superset containing all Preload.cjs channels', () => {
        // Every channel used in Preload.cjs must exist in channels.js with the same value
        for (const [key, value] of Object.entries(preloadChannels)) {
            expect(sourceOfTruth).toHaveProperty(key);
            expect(sourceOfTruth[key]).toBe(value);
        }
    });

    it('should have Preload.cjs define at least the core channels', () => {
        const coreChannels = [
            'CHARACTER_SAVE',
            'CHARACTER_LIST',
            'DATA_LOAD_JSON',
            'SETTINGS_GET_ALL',
            'UTIL_GET_USER_DATA',
        ];

        for (const key of coreChannels) {
            expect(preloadChannels).toHaveProperty(key);
        }
    });

    it('should export all expected channel groups from channels.cjs', () => {
        const groups = [
            'CHARACTER_',
            'FILE_',
            'SETTINGS_',
            'PORTRAITS_',
            'DATA_',
            'UTIL_',
            'EQUIPMENT_',
            'SPELL_',
            'PROGRESSION_',
            'PDF_',
        ];

        for (const prefix of groups) {
            const matching = Object.keys(sourceOfTruth).filter(k => k.startsWith(prefix));
            expect(matching.length).toBeGreaterThan(0);
        }
    });
});
