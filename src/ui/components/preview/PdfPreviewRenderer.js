import * as pdfjsLib from 'pdfjs-dist';

// Configure the pdf.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = '../../node_modules/pdfjs-dist/build/pdf.worker.mjs';

const DEFAULT_SCALE = 1.5;

export class PdfPreviewRenderer {
    constructor() {
        this._pdfDoc = null;
        this._canvases = [];
        this._container = null;
        this._scale = DEFAULT_SCALE;
    }

    /**
     * Render PDF bytes into canvas elements inside the given container.
     *
     * @param {ArrayBuffer|Uint8Array} pdfBytes - The PDF document bytes
     * @param {HTMLElement} containerElement - DOM element to append canvases to
     * @param {Object} [options] - Rendering options
     * @param {number} [options.scale] - Render scale (default 1.5)
     */
    async render(pdfBytes, containerElement, options = {}) {
        this.destroy();
        this._container = containerElement;
        this._scale = options.scale || DEFAULT_SCALE;

        const data = pdfBytes instanceof Uint8Array ? pdfBytes : new Uint8Array(pdfBytes);

        const loadingTask = pdfjsLib.getDocument({ data });
        this._pdfDoc = await loadingTask.promise;

        const numPages = this._pdfDoc.numPages;
        console.debug('[PdfPreviewRenderer]', `Rendering ${numPages} page(s)`);

        for (let pageNum = 1; pageNum <= numPages; pageNum++) {
            const page = await this._pdfDoc.getPage(pageNum);
            const viewport = page.getViewport({ scale: this._scale });

            const canvas = document.createElement('canvas');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            canvas.dataset.pageNum = pageNum;

            const context = canvas.getContext('2d');
            await page.render({ canvasContext: context, viewport }).promise;

            this._container.appendChild(canvas);
            this._canvases.push(canvas);
        }

        return { numPages };
    }

    /**
     * Get the total number of pages in the loaded PDF.
     * @returns {number}
     */
    getPageCount() {
        return this._pdfDoc?.numPages || 0;
    }

    /**
     * Destroy all created canvas elements and release the PDF document.
     */
    destroy() {
        for (const canvas of this._canvases) {
            canvas.remove();
        }
        this._canvases = [];

        if (this._pdfDoc) {
            this._pdfDoc.destroy();
            this._pdfDoc = null;
        }

        this._container = null;
        console.debug('[PdfPreviewRenderer]', 'Destroyed');
    }
}
