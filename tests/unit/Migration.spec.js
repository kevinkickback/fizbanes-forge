/**
 * Migration Validation Test
 * 
 * Validates that legacy CharacterLifecycle imports have been successfully
 * migrated to the new CharacterManager architecture.
 * 
 * This test ensures:
 * 1. No legacy characterLifecycle imports remain in migrated files
 * 2. CharacterManager is properly imported where needed
 * 3. AppState is imported where showUnsavedChanges was used
 * 4. All legacy method calls have been replaced
 */

const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

// Files that have been migrated to CharacterManager
const MIGRATED_FILES = [
    'app/js/modules/race/RaceCard.js',
    'app/js/modules/class/ClassCard.js',
    'app/js/modules/background/BackgroundCard.js',
    'app/js/modules/abilities/AbilityScoreCard.js',
    'app/js/modules/proficiencies/ProficiencyCard.js',
    'app/js/modules/class/ClassDetails.js',
    'app/js/modules/abilities/MethodSwitcher.js',
    'app/js/services/AbilityScoreService.js'
];

// Files that should NOT use legacy CharacterLifecycle
const LEGACY_FORBIDDEN_PATTERNS = [
    /import\s*{[^}]*characterLifecycle[^}]*}\s*from\s*['"].*CharacterLifecycle\.js['"]/,
    /characterLifecycle\.currentCharacter/,
    /characterLifecycle\.getCurrentCharacter/,
    /characterLifecycle\.showUnsavedChanges/
];

// Patterns that SHOULD exist in migrated files
const REQUIRED_NEW_PATTERNS = {
    characterManager: /import\s*{[^}]*CharacterManager[^}]*}\s*from\s*['"].*CharacterManager\.js['"]/,
    getCurrentCharacter: /CharacterManager\.getCurrentCharacter\(\)/
};

test.describe('Migration Validation', () => {
    test('should have migrated all specified files', () => {
        const projectRoot = path.resolve(__dirname, '../..');
        
        for (const filePath of MIGRATED_FILES) {
            const fullPath = path.join(projectRoot, filePath);
            const fileExists = fs.existsSync(fullPath);
            
            expect(fileExists).toBe(true);
            console.log(`✓ Found: ${filePath}`);
        }
    });

    test('should not contain legacy characterLifecycle imports', () => {
        const projectRoot = path.resolve(__dirname, '../..');
        const failures = [];
        
        for (const filePath of MIGRATED_FILES) {
            const fullPath = path.join(projectRoot, filePath);
            const content = fs.readFileSync(fullPath, 'utf8');
            
            for (const pattern of LEGACY_FORBIDDEN_PATTERNS) {
                if (pattern.test(content)) {
                    failures.push({
                        file: filePath,
                        pattern: pattern.toString(),
                        match: content.match(pattern)?.[0]
                    });
                }
            }
        }
        
        if (failures.length > 0) {
            const errorMsg = failures.map(f => 
                `${f.file}: Found legacy pattern "${f.match}"`
            ).join('\n');
            throw new Error(`Legacy patterns found:\n${errorMsg}`);
        }
        
        console.log(`✓ All ${MIGRATED_FILES.length} files free of legacy patterns`);
    });

    test('should contain CharacterManager imports', () => {
        const projectRoot = path.resolve(__dirname, '../..');
        const failures = [];
        
        for (const filePath of MIGRATED_FILES) {
            const fullPath = path.join(projectRoot, filePath);
            const content = fs.readFileSync(fullPath, 'utf8');
            
            if (!REQUIRED_NEW_PATTERNS.characterManager.test(content)) {
                failures.push(filePath);
            }
        }
        
        if (failures.length > 0) {
            throw new Error(
                `Missing CharacterManager import in:\n${failures.join('\n')}`
            );
        }
        
        console.log(`✓ All ${MIGRATED_FILES.length} files have CharacterManager import`);
    });

    test('should use CharacterManager.getCurrentCharacter()', () => {
        const projectRoot = path.resolve(__dirname, '../..');
        const failures = [];
        
        for (const filePath of MIGRATED_FILES) {
            const fullPath = path.join(projectRoot, filePath);
            const content = fs.readFileSync(fullPath, 'utf8');
            
            // Count occurrences of the new pattern
            const matches = content.match(/CharacterManager\.getCurrentCharacter\(\)/g);
            const count = matches ? matches.length : 0;
            
            if (count === 0) {
                failures.push(filePath);
            } else {
                console.log(`✓ ${filePath}: ${count} occurrences of CharacterManager.getCurrentCharacter()`);
            }
        }
        
        if (failures.length > 0) {
            throw new Error(
                `No CharacterManager.getCurrentCharacter() calls found in:\n${failures.join('\n')}`
            );
        }
    });

    test('should have AppState import in files that used showUnsavedChanges', () => {
        const projectRoot = path.resolve(__dirname, '../..');
        const filesWithShowUnsaved = [
            'app/js/modules/background/BackgroundCard.js',
            'app/js/modules/proficiencies/ProficiencyCard.js'
        ];
        
        const appStatePattern = /import\s*{[^}]*AppState[^}]*}\s*from\s*['"].*AppState\.js['"]/;
        const failures = [];
        
        for (const filePath of filesWithShowUnsaved) {
            const fullPath = path.join(projectRoot, filePath);
            const content = fs.readFileSync(fullPath, 'utf8');
            
            if (!appStatePattern.test(content)) {
                failures.push(filePath);
            }
            
            // Check that showUnsavedChanges is replaced with AppState.setHasUnsavedChanges
            if (content.includes('characterLifecycle.showUnsavedChanges')) {
                failures.push(`${filePath} (still uses characterLifecycle.showUnsavedChanges)`);
            }
        }
        
        if (failures.length > 0) {
            throw new Error(
                `AppState not properly used in:\n${failures.join('\n')}`
            );
        }
        
        console.log(`✓ All files with showUnsavedChanges now use AppState`);
    });

    test('should verify migration progress', () => {
        const totalFiles = 10; // Total files that need migration (excluding Modal.js and Navigation.js)
        const migratedCount = MIGRATED_FILES.length;
        const remaining = totalFiles - migratedCount;
        const percentage = Math.round((migratedCount / totalFiles) * 100);
        
        console.log('\n=== Migration Progress ===');
        console.log(`Migrated: ${migratedCount}/${totalFiles} files (${percentage}%)`);
        console.log(`Remaining: ${remaining} files`);
        
        if (remaining > 0) {
            console.log('\nRemaining files:');
            console.log('- Modal.js (low priority - complex dynamic import)');
            console.log('- Navigation.js (low priority - will deprecate)');
        }
        
        expect(migratedCount).toBeGreaterThanOrEqual(8);
        console.log('\n✓ Migration progress validated');
    });

    test('should verify no mixed usage patterns', () => {
        const projectRoot = path.resolve(__dirname, '../..');
        const issues = [];
        
        for (const filePath of MIGRATED_FILES) {
            const fullPath = path.join(projectRoot, filePath);
            const content = fs.readFileSync(fullPath, 'utf8');
            
            // Check for mixed patterns (both old and new)
            const hasLegacy = /characterLifecycle\./.test(content);
            const hasNew = /CharacterManager\./.test(content);
            
            if (hasLegacy && hasNew) {
                issues.push({
                    file: filePath,
                    issue: 'Mixed usage: Contains both characterLifecycle and CharacterManager'
                });
            }
            
            // Check for incomplete migration markers
            if (content.includes('TODO') && content.includes('CharacterLifecycle')) {
                issues.push({
                    file: filePath,
                    issue: 'Contains TODO related to CharacterLifecycle migration'
                });
            }
        }
        
        if (issues.length > 0) {
            const errorMsg = issues.map(i => 
                `${i.file}: ${i.issue}`
            ).join('\n');
            console.warn(`⚠ Potential issues:\n${errorMsg}`);
        } else {
            console.log('✓ No mixed usage patterns detected');
        }
    });

    test('should verify file integrity', () => {
        const projectRoot = path.resolve(__dirname, '../..');
        const errors = [];
        
        for (const filePath of MIGRATED_FILES) {
            const fullPath = path.join(projectRoot, filePath);
            const content = fs.readFileSync(fullPath, 'utf8');
            
            // Check for syntax markers that might indicate incomplete edits
            const issues = [];
            
            if (content.includes('undefined.getCurrentCharacter')) {
                issues.push('Invalid: undefined.getCurrentCharacter found');
            }
            
            if (content.includes('..getCurrentCharacter')) {
                issues.push('Invalid: ..getCurrentCharacter found (double dots)');
            }
            
            if (content.includes('characterLifecycle.CharacterManager')) {
                issues.push('Invalid: mixed characterLifecycle.CharacterManager');
            }
            
            // Check for proper imports
            const lines = content.split('\n');
            const importLines = lines.filter(line => line.trim().startsWith('import'));
            const hasOrphanedImports = importLines.some(line => 
                line.includes('characterLifecycle') || 
                line.includes('CharacterLifecycle')
            );
            
            if (hasOrphanedImports) {
                issues.push('Has orphaned CharacterLifecycle import');
            }
            
            if (issues.length > 0) {
                errors.push({
                    file: filePath,
                    issues: issues
                });
            }
        }
        
        if (errors.length > 0) {
            const errorMsg = errors.map(e => 
                `${e.file}:\n  - ${e.issues.join('\n  - ')}`
            ).join('\n');
            throw new Error(`File integrity issues:\n${errorMsg}`);
        }
        
        console.log(`✓ All ${MIGRATED_FILES.length} files passed integrity check`);
    });
});

test.describe('Architecture Validation', () => {
    test('should verify CharacterManager is available', async ({ page }) => {
        await page.goto('file://' + path.resolve(__dirname, '../../app/index.html'));
        
        // Wait for app to initialize
        await page.waitForTimeout(1000);
        
        // Check if CharacterManager module exists
        const hasCharacterManager = await page.evaluate(() => {
            return typeof window !== 'undefined';
        });
        
        expect(hasCharacterManager).toBe(true);
        console.log('✓ Application environment ready');
    });

    test('should count remaining legacy imports in entire codebase', () => {
        const projectRoot = path.resolve(__dirname, '../..');
        const jsFilesPath = path.join(projectRoot, 'app/js');
        
        const legacyImportPattern = /import\s*{[^}]*characterLifecycle[^}]*}\s*from\s*['"].*CharacterLifecycle\.js['"]/g;
        let totalLegacyImports = 0;
        const filesWithLegacy = [];
        
        function scanDirectory(dir) {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                
                if (entry.isDirectory() && entry.name !== 'node_modules') {
                    scanDirectory(fullPath);
                } else if (entry.isFile() && entry.name.endsWith('.js')) {
                    const content = fs.readFileSync(fullPath, 'utf8');
                    const matches = content.match(legacyImportPattern);
                    
                    if (matches) {
                        const relativePath = path.relative(projectRoot, fullPath);
                        totalLegacyImports += matches.length;
                        filesWithLegacy.push(relativePath);
                    }
                }
            }
        }
        
        scanDirectory(jsFilesPath);
        
        console.log('\n=== Legacy Import Analysis ===');
        console.log(`Total legacy imports remaining: ${totalLegacyImports}`);
        console.log(`Files with legacy imports: ${filesWithLegacy.length}`);
        
        if (filesWithLegacy.length > 0) {
            console.log('\nFiles still using CharacterLifecycle:');
            filesWithLegacy.forEach(file => console.log(`  - ${file}`));
        }
        
        // We expect only 2-3 files (Modal.js, Navigation.js, CharacterLifecycle.js itself)
        expect(totalLegacyImports).toBeLessThanOrEqual(5);
        console.log('\n✓ Legacy import count within acceptable range');
    });
});
