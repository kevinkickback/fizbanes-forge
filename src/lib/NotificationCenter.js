/** NotificationCenter.js - Manages the notification center modal and history */

import { DOMCleanup } from './DOMCleanup.js';
import {
    clearNotificationHistory,
    getNotificationHistory,
    markAllAsRead,
} from './Notifications.js';

export class NotificationCenter {
    constructor() {
        this._cleanup = DOMCleanup.create();
        this._modal = null;
        this._listContainer = null;
    }

    initialize() {
        const notificationCenterBtn = document.getElementById('notificationCenterBtn');
        if (notificationCenterBtn) {
            this._cleanup.on(notificationCenterBtn, 'click', () => this.show());
        }

        const clearBtn = document.getElementById('clearNotificationsBtn');
        if (clearBtn) {
            this._cleanup.on(clearBtn, 'click', () => this.clearAll());
        }

        this._listContainer = document.getElementById('notificationCenterList');
    }

    show() {
        try {
            // Mark all notifications as read when opening center
            markAllAsRead();

            // Refresh the notification list
            this.refreshList();

            // Get or create Bootstrap modal instance
            const modalElement = document.getElementById('notificationCenterModal');
            if (modalElement) {
                const bs = window.bootstrap || globalThis.bootstrap;
                if (bs) {
                    const existingModal = bs.Modal.getInstance(modalElement);
                    if (existingModal) {
                        existingModal.show();
                    } else {
                        const newModal = new bs.Modal(modalElement);
                        this._modal = newModal;
                        newModal.show();
                    }
                }
            }
        } catch (error) {
            console.error('NotificationCenter', 'Failed to show notification center', error);
        }
    }

    refreshList() {
        if (!this._listContainer) {
            this._listContainer = document.getElementById('notificationCenterList');
            if (!this._listContainer) return;
        }

        const notifications = getNotificationHistory();

        if (notifications.length === 0) {
            this._listContainer.innerHTML = `
				<div class="text-center py-4">
					<i class="fas fa-inbox" style="font-size: 2rem;"></i>
					<p class="mt-2">No notifications yet</p>
				</div>
			`;
            return;
        }

        this._listContainer.innerHTML = '';

        notifications.forEach(notification => {
            const item = this._createNotificationItem(notification);
            this._listContainer.appendChild(item);
        });
    }

    _createNotificationItem(notification) {
        const div = document.createElement('div');
        div.className = `notification-center-item ${notification.type}`;
        div.dataset.notificationId = notification.id;

        const iconMap = {
            success: 'fa-check-circle',
            danger: 'fa-exclamation-circle',
            error: 'fa-exclamation-circle',
            warning: 'fa-exclamation-triangle',
            info: 'fa-info-circle',
        };

        const iconClass = iconMap[notification.type] || iconMap.info;
        const timeString = this._formatTime(notification.timestamp);

        div.innerHTML = `
			<div class="notification-center-icon">
				<i class="fas ${iconClass}"></i>
			</div>
			<div class="notification-center-content">
				<div class="notification-center-message">${notification.message}</div>
				<div class="notification-center-time">${timeString}</div>
			</div>
			<button type="button" class="notification-center-close" aria-label="Remove notification">
				<i class="fas fa-times"></i>
			</button>
		`;

        // Add close button handler
        const closeBtn = div.querySelector('.notification-center-close');
        if (closeBtn) {
            this._cleanup.on(closeBtn, 'click', e => {
                e.preventDefault();
                e.stopPropagation();
                div.remove();
                if (this._listContainer.children.length === 0) {
                    this._listContainer.innerHTML = `
						<div class="text-center py-4">
							<i class="fas fa-inbox" style="font-size: 2rem;"></i>
							<p class="mt-2">No notifications yet</p>
						</div>
					`;
                }
            });
        }

        return div;
    }

    _formatTime(timestamp) {
        const now = new Date();
        const diff = now - timestamp;

        // Less than a minute
        if (diff < 60000) {
            return 'just now';
        }

        // Less than an hour
        if (diff < 3600000) {
            const minutes = Math.floor(diff / 60000);
            return `${minutes}m ago`;
        }

        // Less than a day
        if (diff < 86400000) {
            const hours = Math.floor(diff / 3600000);
            return `${hours}h ago`;
        }

        // Less than a week
        if (diff < 604800000) {
            const days = Math.floor(diff / 86400000);
            return `${days}d ago`;
        }

        // Format as date
        const month = String(timestamp.getMonth() + 1).padStart(2, '0');
        const day = String(timestamp.getDate()).padStart(2, '0');
        return `${month}/${day}`;
    }

    clearAll() {
        clearNotificationHistory();
        this.refreshList();
    }

    dispose() {
        this._cleanup.cleanup();
        if (this._modal) {
            this._modal.dispose();
            this._modal = null;
        }
    }
}

// Create singleton instance
let _instance = null;

export function getNotificationCenter() {
    if (!_instance) {
        _instance = new NotificationCenter();
    }
    return _instance;
}
