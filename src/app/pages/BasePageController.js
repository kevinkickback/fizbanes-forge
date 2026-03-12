import { DOMCleanup } from '../../lib/DOMCleanup.js';

export class BasePageController {
    constructor(name) {
        this._name = name;
        this._cleanup = DOMCleanup.create();
    }

    cleanup() {
        this._cleanup.cleanup();
        console.debug(`[${this._name}]`, 'Cleaned up');
    }
}
