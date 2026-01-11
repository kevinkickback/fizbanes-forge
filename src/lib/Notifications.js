/** Notifications.js - Temporary user notifications with debouncing and auto-close. */

const NOTIFICATION_CONFIG = Object.freeze({
	DEBOUNCE_DELAY: 3000,
	CLOSE_ANIMATION_DURATION: 150,
	AUTO_CLOSE_DELAY: 5000,
});

let lastNotification = { message: '', type: '', timestamp: 0 };

function getOrCreateNotificationContainer() {
	let container = document.getElementById('notificationContainer');
	if (!container) {
		container = document.createElement('div');
		container.id = 'notificationContainer';
		container.className = 'notification-container';
		document.body.appendChild(container);
	}
	return container;
}

function createNotificationElement(message, type) {
	const notification = document.createElement('div');
	notification.className = `notification ${type}`;
	notification.innerHTML = `
        <div class="notification-content">
            <div class="notification-message">${message}</div>
            <button type="button" class="btn-close notification-close" aria-label="Close"></button>
        </div>
		<div class="notification-progress" aria-hidden="true">
			<div class="notification-progress-bar"></div>
		</div>
    `;
	return notification;
}

export function showNotification(message, type = 'info') {
	// Check if this is a duplicate notification within the debounce window
	const now = Date.now();
	if (
		lastNotification.message === message &&
		lastNotification.type === type &&
		now - lastNotification.timestamp < NOTIFICATION_CONFIG.DEBOUNCE_DELAY
	) {
		return; // Skip duplicate notification
	}

	// Update last notification
	lastNotification = { message, type, timestamp: now };

	// Get or create notification container
	const notificationContainer = getOrCreateNotificationContainer();

	// Create and add notification element
	const notification = createNotificationElement(message, type);
	notificationContainer.appendChild(notification);

	const progressBar = notification.querySelector('.notification-progress-bar');
	let remaining = NOTIFICATION_CONFIG.AUTO_CLOSE_DELAY;
	let lastTick = performance.now();
	let paused = false;
	let rafId = null;

	// Function to close notification with animation
	const closeNotification = (isManualClose = false) => {
		if (rafId) {
			cancelAnimationFrame(rafId);
			rafId = null;
		}
		notification.classList.add('notification-closing');
		setTimeout(() => {
			notification.remove();
			// Remove container if empty
			if (notificationContainer.children.length === 0) {
				notificationContainer.remove();
			}
			// Reset last notification if manually closed
			if (isManualClose) {
				lastNotification = { message: '', type: '', timestamp: 0 };
			}
		}, NOTIFICATION_CONFIG.CLOSE_ANIMATION_DURATION);
	};

	// Add close button handler
	const closeButton = notification.querySelector('.notification-close');
	closeButton.addEventListener('click', () => closeNotification(true));

	const tick = (now) => {
		if (!notification.parentElement) return;
		const delta = now - lastTick;
		lastTick = now;
		if (!paused) {
			remaining -= delta;
			const ratio =
				Math.max(0, remaining) / NOTIFICATION_CONFIG.AUTO_CLOSE_DELAY;
			if (progressBar) {
				progressBar.style.width = `${Math.max(0, Math.min(1, ratio)) * 100}%`;
			}
			if (remaining <= 0) {
				closeNotification(false);
				return;
			}
		}
		rafId = requestAnimationFrame(tick);
	};

	notification.addEventListener('mouseenter', () => {
		paused = true;
	});

	notification.addEventListener('mouseleave', () => {
		paused = false;
		lastTick = performance.now();
	});

	// Start progress animation loop
	progressBar.style.width = '100%';
	lastTick = performance.now();
	rafId = requestAnimationFrame(tick);
}
