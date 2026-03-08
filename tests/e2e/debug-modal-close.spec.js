import { expect, test } from '../fixtures.js';
import { clickCreateCharacterBtn, deleteCharacterByName, launchAndWaitForHome } from './helpers.js';

/**
 * Regression test: spell modal should close after subclass + spell confirm.
 * Bug: concurrent _renderClassChoices calls during subclass confirm create
 *       duplicate click handlers on spell buttons, spawning two modals.
 *       Only the second closes on confirm; the first stays visible.
 */

async function createWizard(page, name) {
    await clickCreateCharacterBtn(page);
    await page.waitForSelector('#newCharacterModal.show', { timeout: 10_000 });

    await page.locator('#characterName').fill(name);
    await page.locator('#wizardNextBtn').click();
    await expect(
        page.locator('#newCharacterStepper .list-group-item[data-step="1"]'),
    ).toHaveClass(/active/, { timeout: 5_000 });

    const pointBuyRadio = page.locator('#pointBuy');
    if (!(await pointBuyRadio.isChecked())) {
        await pointBuyRadio.click();
    }
    await page.locator('#wizardNextBtn').click();
    await expect(
        page.locator('#newCharacterStepper .list-group-item[data-step="2"]'),
    ).toHaveClass(/active/, { timeout: 5_000 });

    const raceSelect = page.locator('#modalRaceSelect');
    await page.waitForFunction(
        () => {
            const sel = document.getElementById('modalRaceSelect');
            return sel && sel.options.length > 1;
        },
        { timeout: 15_000 },
    );
    await raceSelect.selectOption({ label: /Human/ });
    await page.locator('#wizardNextBtn').click();
    await expect(
        page.locator('#newCharacterStepper .list-group-item[data-step="3"]'),
    ).toHaveClass(/active/, { timeout: 5_000 });

    // Select Wizard — gets Arcane Tradition (subclass) at level 2 + spellcasting
    const classSelect = page.locator('#modalClassSelect');
    await page.waitForFunction(
        () => {
            const sel = document.getElementById('modalClassSelect');
            return sel && sel.options.length > 1;
        },
        { timeout: 15_000 },
    );
    await classSelect.selectOption({ label: /Wizard/ });
    await page.locator('#wizardNextBtn').click();
    await expect(
        page.locator('#newCharacterStepper .list-group-item[data-step="4"]'),
    ).toHaveClass(/active/, { timeout: 5_000 });

    const bgSelect = page.locator('#modalBackgroundSelect');
    await page.waitForFunction(
        () => {
            const sel = document.getElementById('modalBackgroundSelect');
            return sel && sel.options.length > 1;
        },
        { timeout: 15_000 },
    );
    await bgSelect.selectOption({ label: /Acolyte/ });
    await page.locator('#wizardNextBtn').click();
    await expect(
        page.locator('#newCharacterStepper .list-group-item[data-step="5"]'),
    ).toHaveClass(/active/, { timeout: 5_000 });

    await page.locator('#wizardNextBtn').click();
    await expect(
        page.locator('#newCharacterStepper .list-group-item[data-step="6"]'),
    ).toHaveClass(/active/, { timeout: 5_000 });

    await page.locator('#wizardNextBtn').click();
    await expect(page.locator('#newCharacterModal')).not.toBeVisible({
        timeout: 10_000,
    });
    await expect(page.locator('#titlebarCharacterName')).toHaveText(name, {
        timeout: 10_000,
    });
}

async function levelUpCharacter(page) {
    const levelUpBtn = page.locator('#openLevelUpModalBtn');
    await expect(levelUpBtn).not.toHaveAttribute('disabled', '', {
        timeout: 5_000,
    });
    await levelUpBtn.click();

    const modal = page.locator('#levelUpModal');
    await expect(modal).toBeVisible({ timeout: 10_000 });

    const addLevelBtn = modal.locator('[data-add-level]').first();
    await expect(addLevelBtn).toBeVisible({ timeout: 5_000 });
    await addLevelBtn.click();

    await page.waitForFunction(
        () => {
            const cards = document.querySelectorAll('.class-level-card');
            for (const card of cards) {
                if (card.textContent.includes('2')) return true;
            }
            return false;
        },
        { timeout: 10_000 },
    );

    await page.locator('#levelUpModal .btn-close').click();
    await expect(modal).not.toBeVisible({ timeout: 5_000 });
    await page.waitForTimeout(1000);
}

/** Expand all class-choice accordions on the build page. */
async function expandAccordions(page) {
    await page.evaluate(() => {
        document
            .querySelectorAll('#classChoicesAccordion .accordion-collapse')
            .forEach((c) => { c.classList.add('show'); });
        document
            .querySelectorAll('#classChoicesAccordion .accordion-button')
            .forEach((b) => {
                b.classList.remove('collapsed');
                b.setAttribute('aria-expanded', 'true');
            });
    });
    await page.waitForTimeout(500);
}

test('spell modal closes after confirming subclass then spell selection', async () => {
    test.setTimeout(120_000);
    const { electronApp, page } = await launchAndWaitForHome();

    try {
        await createWizard(page, 'Spell Modal Close Test');
        await levelUpCharacter(page);

        // Navigate to build page
        const buildBtn = page.locator('button[data-page="build"]');
        await expect(buildBtn).not.toHaveAttribute('disabled', '', {
            timeout: 10_000,
        });
        await buildBtn.click();
        await page.waitForFunction(
            () => document.body.getAttribute('data-current-page') === 'build',
            { timeout: 10_000 },
        );

        await page.waitForSelector('#classChoicesContent', { timeout: 10_000 });
        await page.waitForTimeout(2000);
        await expandAccordions(page);

        // -- STEP 1: Confirm subclass selection --
        const subclassBtn = page.locator('[data-feature-type="subclass"]').first();
        await expect(subclassBtn).toBeVisible({ timeout: 5_000 });
        await subclassBtn.click();

        const subclassModal = page.locator('.modal.show').last();
        await expect(subclassModal).toBeVisible({ timeout: 10_000 });

        // Wait for items and select first
        await page.waitForFunction(() => {
            const m = document.querySelector('.modal.show');
            return (
                m &&
                m.querySelectorAll('.spell-card, .selector-card, .card').length >
                0
            );
        }, { timeout: 15_000 });
        await subclassModal
            .locator('.spell-card, .selector-card, .card')
            .first()
            .click();
        await page.waitForTimeout(300);

        const subclassConfirm = subclassModal.locator('.btn-confirm');
        await expect(subclassConfirm).toBeEnabled({ timeout: 3_000 });
        await subclassConfirm.click();

        // Wait for subclass modal to close
        await page.waitForTimeout(2000);

        // -- STEP 2: Confirm spell selection --
        await expandAccordions(page);

        const spellBtn = page.locator('[data-spell-select-level]').first();
        await expect(spellBtn).toBeVisible({ timeout: 5_000 });
        await spellBtn.click();

        const spellModal = page.locator('.modal.show').last();
        await expect(spellModal).toBeVisible({ timeout: 10_000 });

        await page.waitForFunction(() => {
            const m = document.querySelector('.modal.show');
            return m && m.querySelectorAll('.spell-card').length > 0;
        }, { timeout: 15_000 });
        await spellModal.locator('.spell-card').first().click();
        await page.waitForTimeout(300);

        const spellConfirm = spellModal.locator('.btn-confirm');
        await expect(spellConfirm).toBeEnabled({ timeout: 3_000 });
        await spellConfirm.click();

        // Wait and verify modal closed
        await page.waitForTimeout(3000);

        const finalState = await page.evaluate(() => ({
            visibleModals: document.querySelectorAll('.modal.show').length,
            backdropCount: document.querySelectorAll('.modal-backdrop').length,
            bodyModalOpen: document.body.classList.contains('modal-open'),
        }));

        expect(finalState.visibleModals).toBe(0);
        expect(finalState.backdropCount).toBe(0);
        expect(finalState.bodyModalOpen).toBe(false);
    } finally {
        try {
            await deleteCharacterByName(page, 'Spell Modal Close Test');
        } catch (_) {
            /* ignore cleanup errors */
        }
        await electronApp.close();
    }
});
