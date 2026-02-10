import fs from 'node:fs/promises';
import path from 'node:path';
import { PDFDocument, PDFName } from 'pdf-lib';
import { MainLogger } from '../Logger.js';
import { buildFieldMap } from './FieldMapping.js';

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

    // Hide MPMB interactive chrome (buttons, overlays, watermarks) without
    // flattening — flatten renders hidden elements visible.
    hideInteractiveFields(form);

    // Clear MPMB Attack.*.Mod dropdowns that default to "empty",
    // which renders as truncated "emp" text.
    clearAttackModDropdowns(form);

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

// Layout / visual buttons that should be preserved (portraits, logos,
// icons, decorative elements). Everything else is MPMB interactive chrome.
const MPMB_BUTTON_KEEP_PATTERNS = [
    /^Portrait$/i,
    /^Symbol$/i,
    /^HeaderIcon$/i,
    /^Image\./i,
    /^Weight /i,
];

function shouldHideField(field) {
    if (field.constructor.name !== 'PDFButton') return false;
    const name = field.getName();
    return !MPMB_BUTTON_KEEP_PATTERNS.some(p => p.test(name));
}

/**
 * Hide MPMB interactive buttons ("Add", "Show extra features", arrow
 * buttons, etc.) by zeroing their widget rectangles and removing
 * appearance streams. Layout buttons (Portrait, Image.*, logos) are kept.
 */
function hideInteractiveFields(form) {
    const fields = form.getFields();
    let hidden = 0;
    for (const field of fields) {
        if (!shouldHideField(field)) continue;
        try {
            const widgets = field.acroField.getWidgets();
            for (const widget of widgets) {
                widget.setRectangle({ x: 0, y: 0, width: 0, height: 0 });
                widget.dict.delete(PDFName.of('AP'));
            }
            hidden++;
        } catch {
            MainLogger.debug('PdfExporter', `Could not hide field: ${field.getName()}`);
        }
    }
    MainLogger.debug('PdfExporter', `Hidden ${hidden} interactive/overlay fields`);
}

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

/**
 * Inspect a PDF template and return its form field names and types.
 *
 * @param {string} templatePath - Absolute path to the PDF template
 * @returns {Promise<Array<{name: string, type: string}>>} Array of field descriptors
 */
export async function inspectTemplate(templatePath) {
    MainLogger.debug('PdfExporter', `Inspecting PDF template: ${templatePath}`);

    const templateBytes = await fs.readFile(templatePath);
    const pdfDoc = await PDFDocument.load(templateBytes, { ignoreEncryption: false });
    const form = pdfDoc.getForm();
    const fields = form.getFields();

    const fieldDescriptors = fields.map(field => ({
        name: field.getName(),
        type: field.constructor.name,
    }));

    MainLogger.debug('PdfExporter', `Found ${fieldDescriptors.length} form fields`);
    return fieldDescriptors;
}
