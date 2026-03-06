export class PortraitSelector {
    static get DEFAULTS() {
        return [
            'assets/images/characters/placeholder_char_card.jpg',
            'assets/images/characters/placeholder_char_card2.jpg',
            'assets/images/characters/placeholder_char_card3.jpg',
            'assets/images/characters/placeholder_char_card4.jpg',
            'assets/images/characters/placeholder_char_card5.jpg',
            'assets/images/characters/placeholder_char_card6.jpg',
            'assets/images/characters/placeholder_char_card7.jpg',
            'assets/images/characters/placeholder_char_card8.jpg',
            'assets/images/characters/placeholder_char_card9.jpg',
            'assets/images/characters/placeholder_char_card10.jpg',
            'assets/images/characters/placeholder_char_card11.jpg',
        ];
    }

    constructor({ grid, preview, uploadInput, cleanup, onSelect }) {
        this._grid = grid;
        this._preview = preview;
        this._uploadInput = uploadInput;
        this._cleanup = cleanup;
        this._onSelect = onSelect;
    }

    async initialize(currentPortrait) {
        this._grid.innerHTML = '';

        const uploadBtn = document.createElement('button');
        uploadBtn.type = 'button';
        uploadBtn.className = 'portrait-icon-btn upload';
        uploadBtn.setAttribute('aria-label', 'Upload portrait');
        uploadBtn.innerHTML = '<i class="fas fa-upload" aria-hidden="true"></i>';
        this._cleanup.on(uploadBtn, 'click', () => {
            if (this._uploadInput) this._uploadInput.click();
        });
        this._grid.appendChild(uploadBtn);

        let firstPortraitBtn = null;
        for (const src of PortraitSelector.DEFAULTS) {
            const btn = this._createPortraitButton(src);
            this._grid.appendChild(btn);
            if (!firstPortraitBtn) firstPortraitBtn = btn;
        }

        await this._loadUserPortraits();

        if (currentPortrait) {
            this._preview.src = currentPortrait;
            const allBtns = this._grid.querySelectorAll('.portrait-icon-btn[data-src]');
            for (const btn of allBtns) {
                if (btn.getAttribute('data-src') === currentPortrait) {
                    btn.classList.add('selected');
                    break;
                }
            }
        } else if (firstPortraitBtn) {
            firstPortraitBtn.click();
        }

        if (this._uploadInput) {
            this._cleanup.on(this._uploadInput, 'change', async (ev) => {
                await this._handlePortraitUpload(ev);
            });
        }
    }

    _createPortraitButton(src) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'portrait-icon-btn';
        btn.innerHTML = `<img src="${src}" alt="Portrait option" />`;
        btn.setAttribute('data-src', src);

        this._cleanup.on(btn, 'click', () => {
            this._preview.src = src;
            const allBtns = this._grid.querySelectorAll('.portrait-icon-btn');
            for (const b of allBtns) {
                b.classList.remove('selected');
            }
            btn.classList.add('selected');
            this._onSelect(src);
        });

        return btn;
    }

    async _loadUserPortraits() {
        try {
            const characterPath = await window.characterStorage?.getDefaultSavePath();
            if (!characterPath || typeof characterPath !== 'string') return;

            const sep = characterPath.includes('\\') ? '\\' : '/';
            const idx = characterPath.lastIndexOf(sep);
            const basePath = idx > 0 ? characterPath.slice(0, idx) : characterPath;
            const portraitsPath = `${basePath}${sep}portraits`;

            const result = await window.characterStorage?.listPortraits?.(portraitsPath);
            if (result?.success && Array.isArray(result.files)) {
                for (const filePath of result.files) {
                    const fileSrc = filePath.startsWith('file://')
                        ? filePath
                        : `file://${filePath.replace(/\\/g, '/')}`;
                    const btn = this._createPortraitButton(fileSrc);
                    this._grid.appendChild(btn);
                }
            }
        } catch (error) {
            console.warn('[PortraitSelector]', 'Failed to load user portraits', error);
        }
    }

    async _handlePortraitUpload(ev) {
        const file = ev.target.files?.[0];
        if (!file) return;

        try {
            const characterPath = await window.characterStorage?.getDefaultSavePath();
            if (!characterPath || typeof characterPath !== 'string') {
                console.warn('[PortraitSelector]', 'Could not determine portraits directory');
                return;
            }

            const sep = characterPath.includes('\\') ? '\\' : '/';
            const idx = characterPath.lastIndexOf(sep);
            const basePath = idx > 0 ? characterPath.slice(0, idx) : characterPath;
            const portraitsPath = `${basePath}${sep}portraits`;

            const reader = new FileReader();
            reader.onload = async () => {
                const dataUrl = reader.result;
                if (typeof dataUrl !== 'string') return;

                try {
                    const saveResult = await window.characterStorage?.savePortrait(
                        portraitsPath,
                        dataUrl,
                        file.name,
                    );

                    if (saveResult?.success && saveResult.filePath) {
                        const fileUrl = saveResult.filePath.startsWith('file://')
                            ? saveResult.filePath
                            : `file://${saveResult.filePath.replace(/\\/g, '/')}`;

                        this._preview.src = fileUrl;

                        const btn = this._createPortraitButton(fileUrl);
                        this._grid.appendChild(btn);
                        btn.classList.add('selected');

                        const allBtns = this._grid.querySelectorAll('.portrait-icon-btn');
                        for (const b of allBtns) {
                            if (b !== btn) b.classList.remove('selected');
                        }

                        this._onSelect(fileUrl);
                    }
                } catch (error) {
                    console.error('[PortraitSelector]', 'Error saving portrait:', error);
                }
            };
            reader.readAsDataURL(file);
        } catch (error) {
            console.error('[PortraitSelector]', 'Error handling portrait upload:', error);
        }
    }
}
