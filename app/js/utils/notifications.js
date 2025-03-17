/**
 * notifications.js
 * Handles user feedback through a notification system
 * 
 * @typedef {'info'|'success'|'warning'|'danger'} NotificationType
 */

// Track last notification to prevent duplicates
let lastNotification = { message: '', type: '', timestamp: 0 };
const DEBOUNCE_DELAY = 3000;
const CLOSE_ANIMATION_DURATION = 150;

/**
 * Shows a notification to the user with debouncing
 * @param {string} message - The message to display
 * @param {NotificationType} [type='info'] - The type of notification
 */
export function showNotification(message, type = 'info') {
    // Check if this is a duplicate notification within the debounce window
    const now = Date.now();
    if (lastNotification.message === message &&
        lastNotification.type === type &&
        (now - lastNotification.timestamp) < DEBOUNCE_DELAY) {
        return; // Skip duplicate notification
    }

    // Update last notification
    lastNotification = { message, type, timestamp: now };

    // Create notification container if it doesn't exist
    let notificationContainer = document.getElementById('notificationContainer');
    if (!notificationContainer) {
        notificationContainer = document.createElement('div');
        notificationContainer.id = 'notificationContainer';
        notificationContainer.className = 'notification-container';
        document.body.appendChild(notificationContainer);
    }

    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <div class="notification-message">${message}</div>
            <button type="button" class="btn-close notification-close" aria-label="Close"></button>
        </div>
    `;

    // Add notification to container
    notificationContainer.appendChild(notification);

    // Function to close notification with animation
    const closeNotification = (isManualClose = false) => {
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
        }, CLOSE_ANIMATION_DURATION);
    };

    // Add close button handler
    const closeButton = notification.querySelector('.notification-close');
    closeButton.addEventListener('click', () => closeNotification(true));

    // Auto-remove notification after 5 seconds
    setTimeout(() => {
        if (notification.parentElement) {
            closeNotification(false);
        }
    }, 5000);
} 