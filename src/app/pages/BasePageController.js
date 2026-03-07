import { DOMCleanup } from '../../lib/DOMCleanup.js';

/**
 * Base class for per-page controllers. Subclasses implement initialize()
 * and optionally override cleanup() for page-specific teardown.
 */
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
