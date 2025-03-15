// Notification utilities

// Track last notification to prevent duplicates
const notificationState = {
    lastNotification: { message: '', type: '', timestamp: 0 }
};

/**
 * Show a notification to the user
 * @param {string} message - The message to display
 * @param {string} type - The type of notification ('info', 'success', 'warning', 'danger')
 */
export function showNotification(message, type = 'info') {
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

    // Add close button handler
    const closeButton = notification.querySelector('.notification-close');
    closeButton.addEventListener('click', () => {
        notification.classList.add('fade-out');
        setTimeout(() => {
            notification.remove();
            // Remove container if empty
            if (notificationContainer.children.length === 0) {
                notificationContainer.remove();
            }
        }, 300);
    });

    // Auto-remove notification after 5 seconds
    setTimeout(() => {
        if (notification.parentElement) {
            notification.classList.add('fade-out');
            setTimeout(() => {
                notification.remove();
                // Remove container if empty
                if (notificationContainer.children.length === 0) {
                    notificationContainer.remove();
                }
            }, 300);
        }
    }, 5000);
} 