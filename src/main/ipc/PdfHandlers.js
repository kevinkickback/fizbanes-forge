import { dialog, ipcMain } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MainLogger } from '../Logger.js';
import { generateFilledPdf } from '../pdf/PdfExporter.js';
import { IPC_CHANNELS } from './channels.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** Absolute path to the bundled PDF templates directory. */
const TEMPLATES_DIR = path.join(__dirname, '..', '..', 'ui', 'assets', 'pdf');

/**
 * Resolve a template name (e.g. "2024_CharacterSheet") to its absolute path
 * inside the bundled assets directory. Prevents path traversal.
 */
function resolveTemplatePath(templateName) {
    if (!templateName || typeof templateName !== 'string') return null;
    // Strip any directory separators to prevent traversal
    const safe = path.basename(templateName);
    // Ensure .pdf extension
    const filename = safe.endsWith('.pdf') ? safe : `${safe}.pdf`;
    const resolved = path.resolve(path.join(TEMPLATES_DIR, filename));
    if (!resolved.startsWith(path.resolve(TEMPLATES_DIR))) return null;
    return resolved;
}

export function registerPdfHandlers(_preferencesManager, windowManager) {
    MainLogger.debug('PdfHandlers', 'Registering PDF handlers');

    // List available bundled PDF templates
    ipcMain.handle(IPC_CHANNELS.PDF_LIST_TEMPLATES, async () => {
        try {
            const files = await fs.readdir(TEMPLATES_DIR);
            const templates = files
                .filter(f => f.toLowerCase().endsWith('.pdf'))
                .map(f => ({
                    name: f.replace(/\.pdf$/i, '').replace(/_/g, ' '),
                    filename: f,
                }));

            MainLogger.debug('PdfHandlers', `Found ${templates.length} bundled templates`);
            return { success: true, templates };
        } catch (error) {
            MainLogger.error('PdfHandlers', 'Failed to list templates:', error);
            return { success: true, templates: [] };
        }
    });

    // Generate filled PDF bytes for preview (no save dialog)
    ipcMain.handle(IPC_CHANNELS.CHARACTER_PDF_PREVIEW, async (_event, characterData, templateName) => {
        try {
            MainLogger.debug('PdfHandlers', 'Generating PDF preview for character:', characterData?.name);

            if (!characterData || !templateName) {
                return { success: false, error: 'Character data and template name are required' };
            }

            const templatePath = resolveTemplatePath(templateName);
            if (!templatePath) {
                return { success: false, error: 'Invalid template name' };
            }

            const pdfBytes = await generateFilledPdf(characterData, templatePath);

            // IPC can't transfer Uint8Array directly — convert to regular Array
            return { success: true, pdfBytes: Array.from(pdfBytes) };
        } catch (error) {
            MainLogger.error('PdfHandlers', 'PDF preview failed:', error);

            if (error.message?.includes('encrypted')) {
                return { success: false, error: 'This PDF template is encrypted and cannot be used' };
            }
            return { success: false, error: error.message };
        }
    });

    // Generate filled PDF and save via native dialog
    ipcMain.handle(IPC_CHANNELS.CHARACTER_EXPORT_PDF, async (_event, characterData, templateName) => {
        try {
            MainLogger.debug('PdfHandlers', 'Exporting PDF for character:', characterData?.name);

            if (!characterData || !templateName) {
                return { success: false, error: 'Character data and template name are required' };
            }

            const templatePath = resolveTemplatePath(templateName);
            if (!templatePath) {
                return { success: false, error: 'Invalid template name' };
            }

            const characterName = characterData.name || 'character';

            const pdfBytes = await generateFilledPdf(characterData, templatePath);

            const parentWindow =
                typeof windowManager.getMainWindow === 'function'
                    ? windowManager.getMainWindow()
                    : windowManager.mainWindow;

            const result = await dialog.showSaveDialog(parentWindow, {
                title: 'Save Character Sheet',
                defaultPath: `${characterName.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`,
                filters: [{ name: 'PDF Document', extensions: ['pdf'] }],
            });

            if (result.canceled) {
                return { success: false, canceled: true };
            }

            await fs.writeFile(result.filePath, Buffer.from(pdfBytes));

            MainLogger.debug('PdfHandlers', 'PDF exported to:', result.filePath);
            return { success: true, path: result.filePath };
        } catch (error) {
            MainLogger.error('PdfHandlers', 'PDF export failed:', error);

            if (error.message?.includes('encrypted')) {
                return { success: false, error: 'This PDF template is encrypted and cannot be used' };
            }
            return { success: false, error: error.message };
        }
    });

    MainLogger.debug('PdfHandlers', 'PDF handlers registered');
}
