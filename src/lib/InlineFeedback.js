/** Utility helpers for inline feedback. Prefer these over toasts for routine CRUD operations. */

export function highlightElement(element, duration = 1000) {
    if (!element) return;

    element.classList.add('highlight-new');
    setTimeout(() => {
        element.classList.remove('highlight-new');
    }, duration);
}

export function showSaveIndicator(
    container = '.save-indicator',
    message = '✓ Saved',
    duration = 2000,
) {
    const indicator =
        typeof container === 'string'
            ? document.querySelector(container)
            : container;
    if (!indicator) return;

    indicator.textContent = message;
    indicator.classList.add('show');

    setTimeout(() => {
        indicator.classList.remove('show');
    }, duration);
}

export function pulseBadge(badge) {
    if (!badge) return;

    badge.classList.remove('badge-pulse');
    void badge.offsetWidth; // Force reflow
    badge.classList.add('badge-pulse');

    setTimeout(() => {
        badge.classList.remove('badge-pulse');
    }, 400);
}

export function showUndoBar(message, onUndo, duration = 5000) {
    // Create undo bar if it doesn't exist
    let undoBar = document.querySelector('.undo-bar');
    if (!undoBar) {
        undoBar = document.createElement('div');
        undoBar.className = 'undo-bar';
        undoBar.innerHTML = `
			<span class="undo-message"></span>
			<button type="button" class="undo-btn">Undo</button>
		`;
        document.body.appendChild(undoBar);
    }

    const messageEl = undoBar.querySelector('.undo-message');
    const undoBtn = undoBar.querySelector('.undo-btn');

    messageEl.textContent = message;

    // Show the bar
    setTimeout(() => undoBar.classList.add('show'), 10);

    let timeoutId = null;
    let isUndone = false;

    // Handle undo click
    const handleUndo = () => {
        if (isUndone) return;
        isUndone = true;
        if (timeoutId) clearTimeout(timeoutId);
        onUndo();
        hide();
    };

    // Hide the bar
    const hide = () => {
        undoBar.classList.remove('show');
        setTimeout(() => {
            if (undoBar.parentElement) {
                undoBar.remove();
            }
        }, 300);
        undoBtn.removeEventListener('click', handleUndo);
    };

    // Auto-hide after duration
    if (duration > 0) {
        timeoutId = setTimeout(hide, duration);
    }

    undoBtn.addEventListener('click', handleUndo);

    // Return cleanup function
    return hide;
}

export function slideInElement(element) {
    if (!element) return;

    element.classList.add('slide-in-fade');
    setTimeout(() => {
        element.classList.remove('slide-in-fade');
    }, 500);
}

export function fadeOutElement(element, onComplete) {
    if (!element) {
        if (onComplete) onComplete();
        return;
    }

    element.classList.add('fade-out-slide');
    setTimeout(() => {
        if (element.parentElement) {
            element.remove();
        }
        if (onComplete) onComplete();
    }, 400);
}

export function showInlineFeedback(
    container,
    message,
    type = 'success',
    duration = 3000,
) {
    if (!container) return;

    // Remove existing feedback
    const existing = container.querySelector('.inline-feedback');
    if (existing) existing.remove();

    // Create new feedback element
    const feedback = document.createElement('div');
    feedback.className = `inline-feedback ${type}`;

    const iconMap = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        warning: 'fa-exclamation-triangle',
    };

    feedback.innerHTML = `
		<i class="fas ${iconMap[type] || iconMap.success}"></i>
		<span>${message}</span>
	`;

    container.appendChild(feedback);

    // Show with animation
    setTimeout(() => feedback.classList.add('show'), 10);

    // Auto-hide if duration specified
    if (duration > 0) {
        setTimeout(() => {
            feedback.classList.remove('show');
            setTimeout(() => feedback.remove(), 300);
        }, duration);
    }

    return feedback;
}

export function updateProgress(progressBar, percent) {
    if (!progressBar) return;

    const bar = progressBar.querySelector('.inline-progress-bar');
    if (bar) {
        bar.style.width = `${Math.max(0, Math.min(100, percent))}%`;
    }
}

export function showSelectionIndicator(element, selected = true) {
    if (!element) return;

    if (selected) {
        element.classList.add('selected');
        // Ensure indicator exists
        if (!element.querySelector('.selection-indicator')) {
            const indicator = document.createElement('div');
            indicator.className = 'selection-indicator';
            indicator.innerHTML = '<i class="fas fa-check"></i>';
            element.appendChild(indicator);
        }
    } else {
        element.classList.remove('selected');
    }
}

export function focusElement(element) {
    if (!element) return;

    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => {
        highlightElement(element, 1500);
    }, 300);
}
