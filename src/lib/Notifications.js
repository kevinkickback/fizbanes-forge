/** Notifications.js - Temporary user notifications with debouncing and auto-close. */

/**
 * @typedef {'info'|'success'|'warning'|'danger'} NotificationType
 * @property {string} message - The message to display in the notification
 * @property {NotificationType} type - The type of notification that determines its appearance
 * @property {number} timestamp - When the notification was created
 */

// Constants for notification behavior
const NOTIFICATION_CONFIG = Object.freeze({
	/** @type {number} Time in ms to prevent duplicate notifications from appearing */
	DEBOUNCE_DELAY: 3000,
	/** @type {number} Time in ms for the close animation when removing notifications */
	CLOSE_ANIMATION_DURATION: 150,
	/** @type {number} Time in ms before notifications automatically close */
	AUTO_CLOSE_DELAY: 5000,
});

/** @type {{message: string, type: string, timestamp: number}} */
let lastNotification = { message: '', type: '', timestamp: 0 };

/**
 * Creates the notification container if it doesn't exist
 * @returns {HTMLElement} The notification container element that holds all notifications
 * @private
 */
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

/**
 * Creates a notification element with the given message and type
 * @param {string} message - The notification message to display
 * @param {NotificationType} type - The notification type that determines its appearance
 * @returns {HTMLElement} The notification element with message and close button
 * @private
 */
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

/**
 * Shows a notification to the user with debouncing and auto-closing
 * @param {string} message - The message to display in the notification
 * @param {NotificationType} [type='info'] - The type of notification that determines its appearance
 */
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
