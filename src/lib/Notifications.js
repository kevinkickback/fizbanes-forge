// Temporary user notifications with debouncing and auto-close

// Suppress noisy success/info toasts for changes already visible in the UI
function shouldSuppressNotification(message, type) {
	if (!message || !type) return false;

	const t = String(type).toLowerCase();
	// Never suppress errors or warnings - user must see these
	if (t === 'error' || t === 'danger' || t === 'warning') return false;

	// Only suppress success and info toasts for routine, inline-visible changes
	if (t !== 'success' && t !== 'info') return false;

	const m = String(message).trim();

	// Suppress routine CRUD operations that are visually obvious
	const suppressPatterns = [
		// Character operations - card create/delete/rename is visible
		/^new character created/i,
		/^character created/i,
		/^character deleted successfully/i,
		/^character deleted/i,
		/^character renamed/i,
		/^character duplicated/i,

		// Item/spell/equipment operations - list updates are self-evident
		/^added .+ to .+$/i, // "Added Fireball to Wizard"
		/^added \d+ (item|spell)/i, // "Added 3 items to inventory"
		/^removed .+ from .+$/i, // "Removed Longsword from inventory"
		/^item (added|removed)/i,
		/^spell (added|removed)/i,

		// Equipment state changes - visual indicators are clear
		/^(equipped|unequipped|attuned|unattuned)/i,

		// Auto-save - should use inline badge instead
		/^auto.?saved/i,
		/^character saved$/i,

		// Selection confirmations - UI already shows selection
		/^(selected|deselected|applied)/i,
	];

	// If message matches any suppress pattern, block the toast
	if (suppressPatterns.some((re) => re.test(m))) return true;

	// Allow explicit user-initiated save/export commands (has "successfully")
	if (
		/saved successfully|exported successfully|imported successfully/i.test(m)
	) {
		return false;
	}

	return false; // Default: allow notification
}

const NOTIFICATION_CONFIG = Object.freeze({
	DEBOUNCE_DELAY: 3000,
	CLOSE_ANIMATION_DURATION: 200,
	AUTO_CLOSE_DELAY: 5000,
});

let lastNotification = { message: '', type: '', timestamp: 0 };
let notificationHistory = []; // Store all notifications for notification center
const MAX_HISTORY = 50; // Keep last 50 notifications

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

function updateNotificationBadge() {
	const badge = document.getElementById('notificationBadge');
	if (!badge) return;

	const unreadCount = notificationHistory.filter((n) => !n.read).length;
	if (unreadCount > 0) {
		badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
		badge.style.display = 'block';
	} else {
		badge.style.display = 'none';
	}
}

function addToNotificationHistory(message, type) {
	const notification = {
		id: Date.now() + Math.random(),
		message,
		type: type || 'info',
		timestamp: new Date(),
		read: false,
	};

	notificationHistory.unshift(notification); // Add to front

	// Keep history size manageable
	if (notificationHistory.length > MAX_HISTORY) {
		notificationHistory = notificationHistory.slice(0, MAX_HISTORY);
	}

	updateNotificationBadge();
	return notification;
}

function createNotificationElement(message, type) {
	const notification = document.createElement('div');
	notification.className = `notification ${type}`;

	// Map notification types to icons
	const iconMap = {
		success: 'fa-check-circle',
		danger: 'fa-exclamation-circle',
		error: 'fa-exclamation-circle',
		warning: 'fa-exclamation-triangle',
		info: 'fa-info-circle',
	};

	const iconClass = iconMap[type] || iconMap.info;

	notification.innerHTML = `
        <div class="notification-icon">
            <i class="fas ${iconClass}"></i>
        </div>
        <div class="notification-content">
            <div class="notification-message">${message}</div>
        </div>
        <button type="button" class="notification-close" aria-label="Close notification">
            <i class="fas fa-times"></i>
        </button>
		<div class="notification-progress" aria-hidden="true">
			<div class="notification-progress-bar"></div>
		</div>
    `;
	return notification;
}

export function showNotification(message, type = 'info') {
	// Policy gate: avoid noisy success/info toasts for inline-visible updates
	try {
		if (shouldSuppressNotification(message, type)) {
			return;
		}
	} catch (_) {
		// Fail open if policy throws for any reason
	}
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

	// Add to notification history for notification center and keep a handle
	const historyEntry = addToNotificationHistory(message, type);

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
				// Mark the corresponding history entry as read to decrement badge
				if (historyEntry?.id) {
					markNotificationAsRead(historyEntry.id);
				}
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

// Export notification center functions
export function getNotificationHistory() {
	return [...notificationHistory];
}

export function clearNotificationHistory() {
	notificationHistory = [];
	updateNotificationBadge();
}

export function markNotificationAsRead(notificationId) {
	const notification = notificationHistory.find((n) => n.id === notificationId);
	if (notification) {
		notification.read = true;
		updateNotificationBadge();
	}
}

export function markAllAsRead() {
	notificationHistory.forEach((n) => {
		n.read = true;
	});
	updateNotificationBadge();
}

// Add a persistent notification entry to the history without showing a toast.
// Useful for long-lived warnings (e.g., failed service loads) that should appear in the notification center.
export function addPersistentNotification(
	message,
	type = 'warning',
	options = {},
) {
	const { dedupe = true } = options;

	if (dedupe) {
		const existing = notificationHistory.find(
			(n) => n.message === message && n.type === type,
		);
		if (existing) {
			existing.read = false;
			updateNotificationBadge();
			return existing;
		}
	}

	return addToNotificationHistory(message, type);
}
