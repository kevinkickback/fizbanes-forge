/**
 * notifications.js
 * Displays temporary messages to the user with configurable types, debouncing, and auto-closing.
 * Provides a centralized notification system for user feedback across the application.
 * 
 * @typedef {'info'|'success'|'warning'|'danger'|'error'} NotificationType
 * 
 * @typedef {Object} NotificationOptions
 * @property {string} message - The message to display in the notification
 * @property {NotificationType} type - The type of notification that determines its appearance
 * @property {number} [autoCloseDelay] - Custom auto-close delay in ms (overrides default)
 * @property {boolean} [allowDuplicates=false] - Whether to allow duplicate notifications
 */

//-------------------------------------------------------------------------
// Notification Configuration
//-------------------------------------------------------------------------

/**
 * Constants for notification behavior
 * @type {Object}
 * @private
 */
const _NOTIFICATION_CONFIG = Object.freeze({
    /** @type {number} Time in ms to prevent duplicate notifications from appearing */
    DEBOUNCE_DELAY: 3000,
    /** @type {number} Time in ms for the close animation when removing notifications */
    CLOSE_ANIMATION_DURATION: 150,
    /** @type {number} Time in ms before notifications automatically close */
    AUTO_CLOSE_DELAY: 5000
});

/**
 * Tracks the last notification to prevent duplicates
 * @type {{message: string, type: NotificationType, timestamp: number}}
 * @private
 */
let _lastNotification = { message: '', type: '', timestamp: 0 };

//-------------------------------------------------------------------------
// DOM Manipulation Functions
//-------------------------------------------------------------------------

/**
 * Creates the notification container if it doesn't exist
 * @returns {HTMLElement} The notification container element that holds all notifications
 * @private
 */
function _getOrCreateNotificationContainer() {
    try {
        let container = document.getElementById('notificationContainer');
        if (!container) {
            container = document.createElement('div');
            container.id = 'notificationContainer';
            container.className = 'notification-container';
            document.body.appendChild(container);
            console.debug('Created notification container');
        }
        return container;
    } catch (error) {
        console.error('Error creating notification container:', error);
        // Create a fallback container if the main one failed
        const fallbackContainer = document.createElement('div');
        fallbackContainer.id = 'notificationContainer';
        fallbackContainer.className = 'notification-container';
        document.body.appendChild(fallbackContainer);
        return fallbackContainer;
    }
}

/**
 * Creates a notification element with the given message and type
 * @param {string} message - The notification message to display
 * @param {NotificationType} type - The notification type that determines its appearance
 * @returns {HTMLElement} The notification element with message and close button
 * @private
 */
function _createNotificationElement(message, type) {
    try {
        // Normalize the notification type
        const normalizedType = type === 'error' ? 'danger' : type;

        const notification = document.createElement('div');
        notification.className = `notification ${normalizedType}`;
        notification.innerHTML = `
            <div class="notification-content">
                <div class="notification-message">${message}</div>
                <button type="button" class="btn-close notification-close" aria-label="Close"></button>
            </div>
        `;
        return notification;
    } catch (error) {
        console.error('Error creating notification element:', error);
        // Create a minimal fallback notification
        const fallbackNotification = document.createElement('div');
        fallbackNotification.className = 'notification';
        fallbackNotification.textContent = message;
        return fallbackNotification;
    }
}

//-------------------------------------------------------------------------
// Notification Management Functions
//-------------------------------------------------------------------------

/**
 * Closes a notification with animation
 * @param {HTMLElement} notification - The notification element to close
 * @param {boolean} [isManualClose=false] - Whether the close was triggered manually
 * @private
 */
function _closeNotification(notification, isManualClose = false) {
    try {
        if (!notification || !notification.parentElement) return;

        // Get the container for cleanup check later
        const container = notification.parentElement;

        // Add closing animation class
        notification.classList.add('notification-closing');

        // Remove after animation completes
        setTimeout(() => {
            try {
                if (notification.parentElement) {
                    notification.remove();
                    console.debug('Notification removed');

                    // Remove container if empty
                    if (container && container.children.length === 0) {
                        container.remove();
                        console.debug('Empty notification container removed');
                    }
                }

                // Reset last notification if manually closed
                if (isManualClose) {
                    _lastNotification = { message: '', type: '', timestamp: 0 };
                }
            } catch (removeError) {
                console.error('Error removing notification:', removeError);
            }
        }, _NOTIFICATION_CONFIG.CLOSE_ANIMATION_DURATION);
    } catch (error) {
        console.error('Error closing notification:', error);
        // Attempt forced removal as fallback
        try {
            notification.remove();
        } catch (e) {
            // Last resort - silent fail
        }
    }
}

/**
 * Checks if a notification is a duplicate that should be debounced
 * @param {string} message - The notification message
 * @param {NotificationType} type - The notification type
 * @param {boolean} allowDuplicates - Whether to allow duplicate notifications
 * @returns {boolean} True if this is a duplicate notification within the debounce window
 * @private
 */
function _isDuplicateNotification(message, type, allowDuplicates) {
    if (allowDuplicates) return false;

    const now = Date.now();
    return (
        _lastNotification.message === message &&
        _lastNotification.type === type &&
        (now - _lastNotification.timestamp) < _NOTIFICATION_CONFIG.DEBOUNCE_DELAY
    );
}

//-------------------------------------------------------------------------
// Public API
//-------------------------------------------------------------------------

/**
 * Shows a notification to the user with debouncing and auto-closing
 * 
 * @param {string} message - The message to display in the notification
 * @param {NotificationType} [type='info'] - The type of notification
 * @param {Object} [options={}] - Additional notification options
 * @param {number} [options.autoCloseDelay] - Custom auto-close delay in ms
 * @param {boolean} [options.allowDuplicates=false] - Whether to allow duplicate notifications
 */
export function showNotification(message, type = 'info', options = {}) {
    try {
        if (!message) {
            console.warn('Attempted to show notification with empty message');
            return;
        }

        // Normalize parameters
        const normalizedType = type || 'info';
        const { autoCloseDelay, allowDuplicates = false } = options;

        // Check if this is a duplicate notification within the debounce window
        if (_isDuplicateNotification(message, normalizedType, allowDuplicates)) {
            console.debug('Skipping duplicate notification:', message);
            return;
        }

        // Update last notification
        _lastNotification = {
            message,
            type: normalizedType,
            timestamp: Date.now()
        };

        // Get or create notification container
        const notificationContainer = _getOrCreateNotificationContainer();

        // Create and add notification element
        const notification = _createNotificationElement(message, normalizedType);
        notificationContainer.appendChild(notification);
        console.debug(`Showing ${normalizedType} notification:`, message);

        // Add close button handler
        const closeButton = notification.querySelector('.notification-close');
        if (closeButton) {
            closeButton.addEventListener('click', () => _closeNotification(notification, true));
        }

        // Auto-remove notification after configured delay
        setTimeout(() => {
            if (notification.parentElement) {
                _closeNotification(notification, false);
            }
        }, autoCloseDelay || _NOTIFICATION_CONFIG.AUTO_CLOSE_DELAY);
    } catch (error) {
        console.error('Error showing notification:', error);
        // Attempt to show a fallback alert in case of critical failure
        try {
            alert(`${type.toUpperCase()}: ${message}`);
        } catch (e) {
            // Last resort - silent fail
        }
    }
} 