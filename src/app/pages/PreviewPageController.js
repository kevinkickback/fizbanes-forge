import { EVENTS } from '../../lib/EventBus.js';
import { showNotification } from '../../lib/Notifications.js';
import { PdfPreviewRenderer } from '../../ui/components/preview/PdfPreviewRenderer.js';
import { AppState } from '../AppState.js';
import { serializeCharacter } from '../Character.js';
import { BasePageController } from './BasePageController.js';

// Module-level cache so the preview survives page navigation
let _previewCache = null;

export class PreviewPageController extends BasePageController {
    constructor() {
        super('PreviewPageController');
        this._renderer = new PdfPreviewRenderer();
        this._templateName = null;
        this._isGenerating = false;
    }

    async initialize() {
        try {
            const character = AppState.getCurrentCharacter();
            if (!character) {
                console.warn('[PreviewPageController]', 'No character loaded for preview page');
                return;
            }

            await this._loadTemplateList();
            this._bindListeners();

            // Restore cached preview if it matches the current character
            if (_previewCache && _previewCache.characterId === character.id) {
                await this._restoreFromCache();
            }

            // Auto-refresh when character is updated if a preview is already showing
            this._trackListener(EVENTS.CHARACTER_UPDATED, () => {
                if (this._templateName && !this._isGenerating && this._renderer.getPageCount() > 0) {
                    this._generatePreview();
                }
            });
        } catch (error) {
            console.error('[PreviewPageController]', 'Error initializing preview page', error);
            showNotification('Error loading preview page', 'error');
        }
    }

    async _loadTemplateList() {
        const select = document.getElementById('previewTemplateSelect');
        if (!select) return;

        try {
            const result = await window.characterStorage.listPdfTemplates();
            if (!result.success || !result.templates.length) {
                select.innerHTML = '<option value="">No templates available</option>';
                return;
            }

            select.innerHTML = '';
            for (const template of result.templates) {
                const option = document.createElement('option');
                option.value = template.filename;
                option.textContent = template.name;
                select.appendChild(option);
            }

            // Select the first template by default
            this._templateName = result.templates[0].filename;

            // Restore last-used template if still available
            try {
                const saved = await window.app.settings.get('pdfTemplateName');
                if (saved && result.templates.some(t => t.filename === saved)) {
                    this._templateName = saved;
                    select.value = saved;
                }
            } catch {
                // No saved preference — use default
            }
        } catch (error) {
            console.error('[PreviewPageController]', 'Failed to load templates', error);
            select.innerHTML = '<option value="">Error loading templates</option>';
        }
    }

    _bindListeners() {
        const select = document.getElementById('previewTemplateSelect');
        const generateBtn = document.getElementById('previewGenerateBtn');
        const exportBtn = document.getElementById('previewExportBtn');

        if (select) {
            select.addEventListener('change', (e) => {
                this._templateName = e.target.value;
                window.app.settings.set('pdfTemplateName', this._templateName);
            });
        }
        if (generateBtn) {
            generateBtn.addEventListener('click', () => this._generatePreview());
        }
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this._handleExport());
        }
    }

    async _generatePreview() {
        const character = AppState.getCurrentCharacter();
        if (!character?.id || !this._templateName) return;

        this._isGenerating = true;
        this._showLoading();

        try {
            const characterData = serializeCharacter(character);
            const result = await window.characterStorage.previewPdf(characterData, this._templateName);

            if (!result.success) {
                this._showError(result.error || 'Failed to generate character sheet');
                return;
            }

            const container = document.getElementById('previewCanvasContainer');
            if (!container) return;

            this._hideAllStates();

            const pdfBytes = new Uint8Array(result.pdfBytes);

            // Copy before render — pdf.js detaches the ArrayBuffer when posting to its Worker
            _previewCache = {
                pdfBytes: new Uint8Array(pdfBytes),
                templateName: this._templateName,
                characterId: character.id,
            };

            const { numPages } = await this._renderer.render(pdfBytes, container);

            this._updatePageIndicator(numPages);

            // Enable export button after successful generation
            const exportBtn = document.getElementById('previewExportBtn');
            if (exportBtn) exportBtn.disabled = false;
        } catch (error) {
            console.error('[PreviewPageController]', 'Preview generation failed', error);
            this._showError(error.message || 'Preview generation failed');
        } finally {
            this._isGenerating = false;
        }
    }

    async _handleExport() {
        const character = AppState.getCurrentCharacter();
        if (!character?.id || !this._templateName) return;

        const exportBtn = document.getElementById('previewExportBtn');
        const originalContent = exportBtn?.innerHTML;

        try {
            if (exportBtn) {
                exportBtn.disabled = true;
                exportBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Preparing\u2026';
            }

            const characterData = serializeCharacter(character);
            const result = await window.characterStorage.exportPdf(characterData, this._templateName);

            if (result.canceled) return;

            if (!result.success) {
                showNotification(result.error || 'Export failed', 'error');
                return;
            }

            showNotification('Character sheet saved successfully', 'success');
        } catch (error) {
            console.error('[PreviewPageController]', 'PDF export failed', error);
            showNotification('Failed to save character sheet', 'error');
        } finally {
            if (exportBtn) {
                exportBtn.innerHTML = originalContent;
                exportBtn.disabled = false;
            }
        }
    }

    _showLoading() {
        this._hideAllStates();
        const loading = document.getElementById('previewLoading');
        if (loading) loading.classList.remove('u-hidden');
    }

    _showError(message) {
        this._hideAllStates();
        const errorEl = document.getElementById('previewError');
        const errorMsg = document.getElementById('previewErrorMessage');
        if (errorEl) errorEl.classList.remove('u-hidden');
        if (errorMsg) errorMsg.textContent = message;
    }

    _hideAllStates() {
        const emptyState = document.getElementById('previewEmptyState');
        const loading = document.getElementById('previewLoading');
        const errorEl = document.getElementById('previewError');

        if (emptyState) emptyState.classList.add('u-hidden');
        if (loading) loading.classList.add('u-hidden');
        if (errorEl) errorEl.classList.add('u-hidden');
    }

    _updatePageIndicator(numPages) {
        const indicator = document.getElementById('previewPageIndicator');
        const totalEl = document.getElementById('previewTotalPages');

        if (indicator && numPages > 1) {
            indicator.classList.remove('u-hidden');
        }
        if (totalEl) totalEl.textContent = String(numPages);
    }

    cleanup() {
        this._renderer.destroy();
        super.cleanup();
    }

    async _restoreFromCache() {
        const container = document.getElementById('previewCanvasContainer');
        if (!container || !_previewCache) return;

        console.debug('[PreviewPageController]', 'Restoring preview from cache');

        this._hideAllStates();

        try {
            const { numPages } = await this._renderer.render(new Uint8Array(_previewCache.pdfBytes), container);
            this._updatePageIndicator(numPages);

            // Restore template selection to match cached preview
            if (_previewCache.templateName) {
                this._templateName = _previewCache.templateName;
                const select = document.getElementById('previewTemplateSelect');
                if (select) select.value = _previewCache.templateName;
            }

            const exportBtn = document.getElementById('previewExportBtn');
            if (exportBtn) exportBtn.disabled = false;
        } catch (error) {
            console.error('[PreviewPageController]', 'Failed to restore cached preview', error);
            _previewCache = null;
        }
    }

    static clearCache() {
        _previewCache = null;
    }

    static clearCacheIfChanged(characterId) {
        if (_previewCache && _previewCache.characterId !== characterId) {
            _previewCache = null;
        }
    }
}
