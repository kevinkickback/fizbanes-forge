import fs from 'node:fs/promises';
import path from 'node:path';
import { PDFDocument, PDFName, PDFNumber } from 'pdf-lib';
import { MainLogger } from '../Logger.js';
import { buildFieldMap } from './FieldMapping.js';

// Fields that are calculated/read-only in the MPMB template and need
// to be converted to editable after we fill them with our values.
const CALCULATED_FIELDS = ['AC', 'Proficiency Bonus'];

/**
 * Generate a filled PDF from a template and character data.
 *
 * @param {Object} characterData - Serialized character JSON (from .ffp file)
 * @param {string} templatePath - Absolute path to the form-fillable PDF template
 * @returns {Promise<Uint8Array>} Filled PDF bytes
 */
export async function generateFilledPdf(characterData, templatePath) {
    MainLogger.debug('PdfExporter', `Generating filled PDF from template: ${templatePath}`);

    const templateBytes = await fs.readFile(templatePath);
    const pdfDoc = await PDFDocument.load(templateBytes, { ignoreEncryption: false });
    const form = pdfDoc.getForm();

    const { textFields, checkboxFields } = buildFieldMap(characterData, templatePath);

    // Fill text fields
    for (const [fieldName, value] of Object.entries(textFields)) {
        try {
            const field = form.getTextField(fieldName);
            field.setText(value);
        } catch {
            // Field might be a dropdown — try that instead
            try {
                const dropdown = form.getDropdown(fieldName);
                const options = dropdown.getOptions();
                if (options.includes(value)) {
                    dropdown.select(value);
                } else if (value) {
                    dropdown.addOptions([value]);
                    dropdown.select(value);
                }
            } catch {
                MainLogger.debug('PdfExporter', `Skipping missing field: ${fieldName}`);
            }
        }
    }

    // Fill checkbox fields
    for (const [fieldName, checked] of Object.entries(checkboxFields)) {
        try {
            const field = form.getCheckBox(fieldName);
            if (checked) {
                field.check();
            } else {
                field.uncheck();
            }
        } catch {
            MainLogger.debug('PdfExporter', `Skipping missing checkbox field: ${fieldName}`);
        }
    }

    // Embed portrait image if available
    if (characterData.portrait) {
        try {
            await embedPortrait(pdfDoc, form, characterData.portrait);
        } catch (error) {
            MainLogger.warn('PdfExporter', 'Failed to embed portrait image:', error.message);
        }
    }

    // Hide MPMB interactive chrome (buttons, overlays, watermarks) and
    // ammunition tracker checkboxes. Does not flatten — that would make
    // hidden elements visible.
    hideUnwantedFields(form);

    // Clear MPMB Attack.*.Mod dropdowns that default to "empty",
    // which renders as truncated "emp" text.
    clearAttackModDropdowns(form);

    // Strip calculation formulas from all fields and make calculated
    // fields (AC, Proficiency Bonus) editable for the exported PDF.
    stripCalculationActions(form);
    makeCalculatedFieldsEditable(form);

    // Generate text-field appearance streams, then strip the /Off
    // appearance state that pdf-lib adds to checkboxes — it draws a
    // square border around every checkbox widget. The original MPMB
    // template has no /Off state; checked boxes use a circle-style
    // ZapfDingbats glyph under /True.
    form.updateFieldAppearances();
    stripCheckboxOffAppearances(form);

    const filledBytes = await pdfDoc.save({ updateFieldAppearances: false });
    MainLogger.debug('PdfExporter', `Generated filled PDF: ${filledBytes.length} bytes`);
    return filledBytes;
}

// ── Field Visibility ──────────────────────────────────────────────────────────

// Layout / visual buttons that should be preserved (portraits, logos,
// icons, decorative elements). Everything else is MPMB interactive chrome.
const MPMB_BUTTON_KEEP_PATTERNS = [
    /^Portrait$/i,
    /^Symbol$/i,
    /^HeaderIcon$/i,
    /^Image\./i,
    /^Weight /i,
];

/** Ammunition tracker checkboxes and icon buttons to hide. */
const AMMO_CHECKBOX_PATTERN = /^Ammo(Left|Right)\.(Top|Base|Bullet|Icon)\./;

/**
 * Zero the widget rectangle and remove appearance streams for a field,
 * making it invisible without flattening.
 */
function hideFieldWidgets(field) {
    for (const widget of field.acroField.getWidgets()) {
        widget.setRectangle({ x: 0, y: 0, width: 0, height: 0 });
        widget.dict.delete(PDFName.of('AP'));
    }
}

/**
 * Hide MPMB interactive buttons and ammunition tracker checkboxes.
 * Layout buttons (Portrait, Image.*, logos) and ammo Name/Amount fields are kept.
 */
function hideUnwantedFields(form) {
    let hidden = 0;
    for (const field of form.getFields()) {
        const name = field.getName();
        const isInteractiveButton = field.constructor.name === 'PDFButton'
            && !MPMB_BUTTON_KEEP_PATTERNS.some(p => p.test(name));
        const isAmmoCheckbox = AMMO_CHECKBOX_PATTERN.test(name);

        if (!isInteractiveButton && !isAmmoCheckbox) continue;

        try {
            hideFieldWidgets(field);
            hidden++;
        } catch {
            MainLogger.debug('PdfExporter', `Could not hide field: ${name}`);
        }
    }
    MainLogger.debug('PdfExporter', `Hidden ${hidden} interactive/ammo fields`);
}

// ── Form Cleanup ──────────────────────────────────────────────────────────────

/**
 * Remove the /Off appearance state that pdf-lib's updateFieldAppearances()
 * adds to every checkbox. The MPMB template originally has no /Off state;
 * its presence draws visible square borders around each checkbox widget.
 */
function stripCheckboxOffAppearances(form) {
    let stripped = 0;
    for (const field of form.getFields()) {
        if (field.constructor.name !== 'PDFCheckBox') continue;
        for (const widget of field.acroField.getWidgets()) {
            const ap = widget.dict.get(PDFName.of('AP'));
            if (!ap) continue;
            const n = ap.get(PDFName.of('N'));
            if (n?.has(PDFName.of('Off'))) {
                n.delete(PDFName.of('Off'));
                stripped++;
            }
        }
    }
    MainLogger.debug('PdfExporter', `Stripped /Off appearance from ${stripped} checkbox widgets`);
}

function clearAttackModDropdowns(form) {
    for (let i = 1; i <= 5; i++) {
        try {
            const dropdown = form.getDropdown(`Attack.${i}.Mod`);
            dropdown.clear();
        } catch {
            // Field may not exist
        }
    }
}

/**
 * Remove Additional Actions (AA) — which contain JavaScript calculation
 * scripts — from all form fields. Prevents PDF viewers from recalculating
 * filled values while keeping fields editable and hidden elements invisible.
 */
function stripCalculationActions(form) {
    const aaKey = PDFName.of('AA');
    let stripped = 0;
    for (const field of form.getFields()) {
        if (field.acroField.dict.has(aaKey)) {
            field.acroField.dict.delete(aaKey);
            stripped++;
        }
    }
    MainLogger.debug('PdfExporter', `Stripped calculation actions from ${stripped} fields`);
}

/**
 * Clear the read-only flag on calculated fields (AC, Proficiency Bonus)
 * so users can manually edit them in the exported PDF.
 */
function makeCalculatedFieldsEditable(form) {
    const ffKey = PDFName.of('Ff');
    for (const fieldName of CALCULATED_FIELDS) {
        try {
            const field = form.getTextField(fieldName);
            const flags = field.acroField.dict.get(ffKey);
            if (flags && typeof flags.numberValue === 'number') {
                field.acroField.dict.set(ffKey, PDFNumber.of(flags.numberValue & ~1));
                MainLogger.debug('PdfExporter', `Made field editable: ${fieldName}`);
            }
        } catch {
            // Field may not exist in this template
        }
    }
}

// ── Portrait Embedding ────────────────────────────────────────────────────────

/**
 * Embed a portrait image into the PDF form's image button field.
 *
 * @param {PDFDocument} pdfDoc
 * @param {Object} form - PDF form object
 * @param {string} portraitPath - Path to the portrait image file
 */
async function embedPortrait(pdfDoc, form, portraitPath) {
    const resolvedPath = path.resolve(portraitPath);
    const imageBytes = await fs.readFile(resolvedPath);
    const ext = path.extname(resolvedPath).toLowerCase();

    let image;
    if (ext === '.png') {
        image = await pdfDoc.embedPng(imageBytes);
    } else if (ext === '.jpg' || ext === '.jpeg') {
        image = await pdfDoc.embedJpg(imageBytes);
    } else {
        MainLogger.debug('PdfExporter', `Unsupported portrait format: ${ext}`);
        return;
    }

    // Try common image field names
    const imageFieldNames = ['CHARACTER IMAGE', 'CharacterImage', 'Portrait'];
    for (const fieldName of imageFieldNames) {
        try {
            const button = form.getButton(fieldName);
            button.setImage(image);
            MainLogger.debug('PdfExporter', `Embedded portrait in field: ${fieldName}`);
            return;
        } catch {
            // Field doesn't exist — try next
        }
    }

    MainLogger.debug('PdfExporter', 'No image field found in PDF template for portrait');
}
