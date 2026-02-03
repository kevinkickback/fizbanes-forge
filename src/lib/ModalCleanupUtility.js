// Utility for cleaning up orphaned modal backdrops and preventing z-index stacking issues

export function cleanupOrphanedBackdrops() {
    try {
        const backdrops = document.querySelectorAll('.modal-backdrop');
        const openModals = document.querySelectorAll('.modal.show');

        // If there are more backdrops than open modals, remove the extras
        if (backdrops.length > openModals.length) {
            console.debug(
                'ModalCleanup',
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
                'ModalCleanup',
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
        console.error('ModalCleanup', 'Error cleaning up orphaned backdrops', error);
    }
}

export function disposeBootstrapModal(modalInstance) {
    if (!modalInstance) return;

    try {
        // Check if already disposed by checking internal state
        if (typeof modalInstance.dispose === 'function' && modalInstance._element) {
            modalInstance.dispose();
        }
    } catch (error) {
        // Silently handle already-disposed modals
        if (error.message && !error.message.includes('Cannot read properties of null')) {
            console.warn('ModalCleanup', 'Error disposing modal instance', error);
        }
    }
}

export function hideBootstrapModal(modalInstance, modalElement) {
    if (!modalInstance && !modalElement) {
        console.warn('ModalCleanup', 'Cannot hide modal: no instance or element provided');
        return Promise.resolve();
    }

    return new Promise((resolve) => {
        let cleaned = false;

        const performCleanup = () => {
            if (cleaned) return;
            cleaned = true;

            // Clean up backdrops
            cleanupOrphanedBackdrops();

            // Force hide the modal element
            if (modalElement) {
                modalElement.classList.remove('show');
                modalElement.style.display = 'none';
                modalElement.setAttribute('aria-hidden', 'true');
                modalElement.removeAttribute('aria-modal');
            }

            resolve();
        };

        try {
            if (modalInstance && modalElement) {
                // Wait for Bootstrap's hide event
                modalElement.addEventListener('hidden.bs.modal', () => {
                    performCleanup();
                }, { once: true });

                // Fallback timeout in case event doesn't fire
                setTimeout(() => {
                    if (!cleaned) {
                        console.debug('ModalCleanup', 'Forcing modal cleanup after timeout');
                        performCleanup();
                    }
                }, 500);

                // Trigger Bootstrap hide
                modalInstance.hide();
            } else {
                // No Bootstrap instance, clean up immediately
                performCleanup();
            }
        } catch (error) {
            console.error('ModalCleanup', 'Error hiding modal', error);
            performCleanup();
        }
    });
}

export function initializeBootstrapModal(modalElement, options = {}) {
    if (!modalElement) {
        console.error('ModalCleanup', 'Cannot initialize modal: element is null');
        return null;
    }

    try {
        const bs = window.bootstrap || globalThis.bootstrap;
        if (!bs) {
            console.error('ModalCleanup', 'Bootstrap not available');
            return null;
        }

        // Clean up any orphaned backdrops before creating a new modal
        cleanupOrphanedBackdrops();

        // Check for and dispose of existing instance
        const existing = bs.Modal.getInstance(modalElement);
        if (existing) {
            console.debug('ModalCleanup', 'Disposing existing modal instance before creating new one');
            try {
                existing.dispose();
            } catch (e) {
                console.warn('ModalCleanup', 'Error disposing existing modal', e);
            }
        }

        // Create and return new instance
        return new bs.Modal(modalElement, options);
    } catch (error) {
        console.error('ModalCleanup', 'Error initializing Bootstrap modal', error);
        return null;
    }
}
