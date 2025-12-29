/**
 * Unit tests for RaceDataUtils
 * Tests the utility functions used for processing race and subrace data
 */

import { describe, expect, it } from '@jest/globals';
import {
	buildRaceBundle,
	createRaceKey,
	deriveVersionSubracesFromRace,
	groupSubracesByRace,
} from '../src/renderer/scripts/utils/RaceDataUtils.js';

describe('RaceDataUtils', () => {
	describe('createRaceKey', () => {
		it('should create lowercase key with name and source', () => {
			expect(createRaceKey('Elf', 'PHB')).toBe('elf:PHB');
			expect(createRaceKey('DWARF', 'MTF')).toBe('dwarf:MTF');
		});

		it('should default to PHB source', () => {
			expect(createRaceKey('Human')).toBe('human:PHB');
		});

		it('should handle null/undefined names gracefully', () => {
			expect(createRaceKey(null, 'PHB')).toBe('null:PHB');
			expect(createRaceKey(undefined, 'PHB')).toBe('undefined:PHB');
		});
	});

	describe('groupSubracesByRace', () => {
		it('should group subraces by race name and source', () => {
			const subraces = [
				{ raceName: 'Elf', raceSource: 'PHB', name: 'High Elf' },
				{ raceName: 'Elf', raceSource: 'PHB', name: 'Wood Elf' },
				{ raceName: 'Dwarf', source: 'PHB', name: 'Mountain Dwarf' },
			];

			const result = groupSubracesByRace(subraces);

			expect(result.size).toBe(2);
			expect(result.get('elf:PHB')).toHaveLength(2);
			expect(result.get('dwarf:PHB')).toHaveLength(1);
		});

		it('should handle empty array', () => {
			const result = groupSubracesByRace([]);
			expect(result.size).toBe(0);
		});

		it('should skip subraces without raceName', () => {
			const subraces = [
				{ raceSource: 'PHB', name: 'Invalid' },
				{ raceName: 'Elf', raceSource: 'PHB', name: 'High Elf' },
			];

			const result = groupSubracesByRace(subraces);

			expect(result.size).toBe(1);
			expect(result.get('elf:PHB')).toHaveLength(1);
		});
	});

	describe('deriveVersionSubracesFromRace', () => {
		it('should handle race without versions', () => {
			const race = { name: 'Human', source: 'PHB' };
			const result = deriveVersionSubracesFromRace(race, 'PHB');
			expect(result).toEqual([]);
		});

		it('should derive from abstract/implementation pattern', () => {
			const race = {
				name: 'Dragonborn',
				source: 'PHB',
				_versions: [
					{
						_abstract: { template: 'data' },
						_implementations: [
							{ _variables: { color: 'Black' } },
							{ _variables: { color: 'Blue' } },
						],
					},
				],
			};

			const result = deriveVersionSubracesFromRace(race, 'PHB');

			expect(result).toHaveLength(2);
			expect(result[0].name).toBe('Black');
			expect(result[0]._isVersion).toBe(true);
			expect(result[0].raceName).toBe('Dragonborn');
			expect(result[1].name).toBe('Blue');
		});

		it('should derive from simple version pattern', () => {
			const race = {
				name: 'Elf',
				source: 'PHB',
				_versions: [{ name: 'Variant; Sea Elf', source: 'MTF' }],
			};

			const result = deriveVersionSubracesFromRace(race, 'PHB');

			expect(result).toHaveLength(1);
			expect(result[0].name).toBe('Sea Elf');
			expect(result[0].source).toBe('MTF');
			expect(result[0]._isVersion).toBe(true);
		});
	});

	describe('buildRaceBundle', () => {
		it('should build complete race bundle', () => {
			const race = {
				name: 'Elf',
				source: 'PHB',
			};

			const explicitSubraces = [
				{ name: 'High Elf', source: 'PHB' },
				{ name: 'Wood Elf', source: 'PHB' },
				{ source: 'PHB' }, // base subrace (no name)
			];

			const bundle = buildRaceBundle(race, explicitSubraces, 'PHB');

			expect(bundle.race).toBe(race);
			expect(bundle.baseSubrace).toBeDefined();
			expect(bundle.baseSubrace.name).toBeUndefined();
			expect(bundle.subraces).toHaveLength(2); // named subraces only
			expect(bundle.subraces[0].name).toBe('High Elf');
		});

		it('should handle race with no subraces', () => {
			const race = { name: 'Human', source: 'PHB' };
			const bundle = buildRaceBundle(race, [], 'PHB');

			expect(bundle.race).toBe(race);
			expect(bundle.subraces).toEqual([]);
			expect(bundle.baseSubrace).toBeNull();
		});

		it('should merge named, derived, and base subraces', () => {
			const race = {
				name: 'Dragonborn',
				source: 'PHB',
				_versions: [
					{
						_abstract: {},
						_implementations: [{ _variables: { color: 'Red' } }],
					},
				],
			};

			const explicitSubraces = [{ name: 'Draconblood', source: 'ERLW' }];

			const bundle = buildRaceBundle(race, explicitSubraces, 'PHB');

			expect(bundle.subraces).toHaveLength(2);
			expect(bundle.subraces.some((sr) => sr.name === 'Draconblood')).toBe(
				true,
			);
			expect(bundle.subraces.some((sr) => sr.name === 'Red')).toBe(true);
		});
	});
});
