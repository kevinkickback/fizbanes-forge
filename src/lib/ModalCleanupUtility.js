/** Utility for cleaning up orphaned modal backdrops and preventing z-index stacking issues */

/**
 * Removes any orphaned modal backdrops from the DOM.
 * Orphaned backdrops can occur when modals are closed improperly or when
 * multiple modal instances are created without proper disposal.
 * This should be called when modal backdrop issues are detected.
 */
export function cleanupOrphanedBackdrops() {
    try {
        const backdrops = document.querySelectorAll('.modal-backdrop');
        const openModals = document.querySelectorAll('.modal.show');

        // If there are more backdrops than open modals, remove the extras
        if (backdrops.length > openModals.length) {
            console.debug(
                '[ModalCleanup]',
                `Found ${backdrops.length} backdrops but only ${openModals.length} open modals. Cleaning up orphaned backdrops.`
            );

            // Remove backdrops that don't correspond to open modals
            const backdropCount = backdrops.length;
            const toKeep = openModals.length;

            for (let i = 0; i < backdropCount - toKeep; i++) {
                backdrops[i].remove();
            }
        }

        // If there are no open modals, remove all backdrops
        if (openModals.length === 0 && backdrops.length > 0) {
            console.debug(
                '[ModalCleanup]',
                `No open modals found. Removing all ${backdrops.length} backdrops.`
            );
            for (const backdrop of backdrops) {
                backdrop.remove();
            }

            // Also ensure body classes are reset
            document.body.classList.remove('modal-open');
            document.body.style.overflow = '';
            document.body.style.paddingRight = '';
        }
    } catch (error) {
        console.error('[ModalCleanup]', 'Error cleaning up orphaned backdrops', error);
    }
}

/**
 * Ensures proper disposal of a Bootstrap modal instance.
 * This handles the full cleanup: hiding, disposing, and removing orphaned backdrops.
 * 
 * @param {HTMLElement} modalElement - The modal DOM element
 */
export function disposeBootstrapModal(modalElement) {
    if (!modalElement) return;

    try {
        const bs = window.bootstrap || globalThis.bootstrap;
        if (!bs) return;

        const instance = bs.Modal.getInstance(modalElement);
        if (instance) {
            // Hide first, then dispose
            instance.hide();

            // Wait for hide animation to complete before disposing
            modalElement.addEventListener('hidden.bs.modal', () => {
                try {
                    instance.dispose();
                    // Clean up any orphaned backdrops after disposal
                    cleanupOrphanedBackdrops();
                } catch (e) {
                    console.warn('[ModalCleanup]', 'Error disposing modal instance', e);
                }
            }, { once: true });
        }
    } catch (error) {
        console.error('[ModalCleanup]', 'Error in disposeBootstrapModal', error);
    }
}

/**
 * Safe modal initialization that checks for and disposes of existing instances.
 * This prevents multiple Bootstrap modal instances on the same element.
 * 
 * @param {HTMLElement} modalElement - The modal DOM element
 * @param {Object} options - Bootstrap modal options
 * @returns {bootstrap.Modal|null} - The modal instance or null if failed
 */
export function initializeBootstrapModal(modalElement, options = {}) {
    if (!modalElement) {
        console.error('[ModalCleanup]', 'Cannot initialize modal: element is null');
        return null;
    }

    try {
        const bs = window.bootstrap || globalThis.bootstrap;
        if (!bs) {
            console.error('[ModalCleanup]', 'Bootstrap not available');
            return null;
        }

        // Clean up any orphaned backdrops before creating a new modal
        cleanupOrphanedBackdrops();

        // Check for and dispose of existing instance
        const existing = bs.Modal.getInstance(modalElement);
        if (existing) {
            console.debug('[ModalCleanup]', 'Disposing existing modal instance before creating new one');
            try {
                existing.dispose();
            } catch (e) {
                console.warn('[ModalCleanup]', 'Error disposing existing modal', e);
            }
        }

        // Create and return new instance
        return new bs.Modal(modalElement, options);
    } catch (error) {
        console.error('[ModalCleanup]', 'Error initializing Bootstrap modal', error);
        return null;
    }
}
