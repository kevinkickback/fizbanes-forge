/**
 * TooltipManager.js
 * Manages tooltip functionality for the D&D Character Creator
 * 
 * @typedef {Object} TooltipOptions
 * @property {string} title - The title of the tooltip
 * @property {string} description - The main description text
 * @property {string} [details] - Additional details to display
 * @property {string} [source] - Source book reference
 * @property {string} [type] - Type of tooltip (spell, condition, action, etc.)
 * 
 * @typedef {Object} TooltipState
 * @property {boolean} isHovered - Whether the tooltip is being hovered
 * @property {boolean} triggerHovered - Whether the trigger element is being hovered
 * @property {boolean} hasActiveChild - Whether the tooltip has active child tooltips
 */

let instance = null;

export class TooltipManager {
    /**
     * Creates a new TooltipManager instance.
     * This is a singleton class - use TooltipManager.getInstance() instead.
     * 
     * @throws {Error} If instance already exists
     */
    constructor() {
        if (instance) {
            throw new Error('TooltipManager is a singleton. Use TooltipManager.getInstance() instead.');
        }
        this.tooltipDelay = 200;
        this.tooltipTimeout = null;
        this.tooltipOffset = 10;
        this._initialized = false;
        this.activeTooltips = new Map();
        instance = this;
    }

    /**
     * Initializes the tooltip system by creating necessary DOM elements and event listeners.
     * This method should be called once when the application starts.
     */
    initialize() {
        if (this._initialized) return;

        // Get or create tooltip container
        this.container = document.getElementById('tooltipContainer');
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.id = 'tooltipContainer';
            this.container.className = 'tooltip-container';
            document.body.appendChild(this.container);
        }

        // Add event listeners for tooltip triggers
        document.addEventListener('mouseover', this.handleMouseOver.bind(this));
        document.addEventListener('mouseout', this.handleMouseOut.bind(this));

        this._initialized = true;
    }

    /**
     * Handles mouse out events for tooltip triggers.
     * Hides tooltips after a delay when the mouse leaves the trigger.
     * 
     * @param {MouseEvent} event - The mouse out event
     */
    handleMouseOut(event) {
        const tooltipTarget = event.target.closest('[data-tooltip]');
        if (!tooltipTarget) return;

        // Clear any existing timeout
        if (this.tooltipTimeout) {
            clearTimeout(this.tooltipTimeout);
        }

        // Set a timeout to hide the tooltip
        this.tooltipTimeout = setTimeout(() => {
            const tooltip = this.activeTooltips.get(tooltipTarget);
            if (tooltip && !tooltip.matches(':hover')) {
                tooltip.classList.remove('show');
                this.activeTooltips.delete(tooltip);
            }
        }, this.tooltipDelay);
    }

    /**
     * Positions a tooltip relative to its trigger element.
     * Ensures the tooltip stays within viewport bounds.
     * 
     * @param {MouseEvent} event - The mouse event that triggered the tooltip
     * @param {HTMLElement} tooltip - The tooltip element to position
     */
    positionTooltip(event, tooltip) {
        const tooltipRect = tooltip.getBoundingClientRect();
        const triggerRect = event.target.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        // Calculate position relative to the viewport (since container is fixed)
        let left = triggerRect.right + this.tooltipOffset;
        let top = triggerRect.top;

        // If tooltip would overflow viewport on the right, try positioning on the left
        if (left + tooltipRect.width > viewportWidth) {
            left = triggerRect.left - tooltipRect.width - this.tooltipOffset;
        }

        // If tooltip would overflow viewport on the left, position it at the left edge
        if (left < 0) {
            left = 0;
        }

        // If tooltip would overflow viewport on the right, position it at the right edge
        if (left + tooltipRect.width > viewportWidth) {
            left = viewportWidth - tooltipRect.width;
        }

        // Ensure tooltip stays within vertical bounds
        if (top + tooltipRect.height > viewportHeight) {
            top = viewportHeight - tooltipRect.height;
        }

        // Apply the position
        tooltip.style.left = `${left}px`;
        tooltip.style.top = `${top}px`;
    }

    /**
     * Handles mouse over events for tooltip triggers.
     * Shows tooltips after a delay when the mouse enters the trigger.
     * 
     * @param {MouseEvent} event - The mouse over event
     */
    handleMouseOver(event) {
        const tooltipTarget = event.target.closest('[data-tooltip]');
        if (!tooltipTarget) return;

        // Clear any existing timeout
        if (this.tooltipTimeout) {
            clearTimeout(this.tooltipTimeout);
        }

        // Set a timeout to show the tooltip
        this.tooltipTimeout = setTimeout(() => {
            this.createTooltip(tooltipTarget, tooltipTarget.closest('.tooltip'), event);
        }, this.tooltipDelay);
    }

    /**
     * Creates and positions a new tooltip for a trigger element.
     * 
     * @param {HTMLElement} target - The trigger element
     * @param {HTMLElement} parentTooltip - Optional parent tooltip for nested tooltips
     * @param {MouseEvent} event - The mouse event that triggered the tooltip
     */
    createTooltip(target, parentTooltip, event) {
        // Clear any existing tooltip for this target
        const existingTooltip = this.activeTooltips.get(target);
        if (existingTooltip) {
            existingTooltip.remove();
            this.activeTooltips.delete(existingTooltip);
        }

        const tooltip = document.createElement('div');
        tooltip.className = 'tooltip';
        tooltip.id = `tooltip-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

        // Create content wrapper
        const content = document.createElement('div');
        content.className = 'tooltip-content';

        // Parse the HTML content safely
        const tempDiv = document.createElement('div');
        tempDiv.style.whiteSpace = 'pre-line';  // Preserve meaningful line breaks
        let tooltipContent = decodeURIComponent(target.dataset.tooltip)
            .replace(/\n\s*\n/g, '\n')  // Replace multiple line breaks with single
            .replace(/\s+/g, ' ')  // Normalize spaces
            .trim();  // Remove leading/trailing whitespace

        // Format source references
        tooltipContent = tooltipContent.replace(/\b(PHB|XPHB)\b/g, (match) => {
            return match === 'PHB' ? 'PHB\'14' :
                match === 'XPHB' ? 'PHB\'24' :
                    match;
        });

        tempDiv.innerHTML = tooltipContent;

        // Extract title if it exists (wrapped in <strong>)
        const titleElement = tempDiv.querySelector('strong');
        if (titleElement) {
            const title = document.createElement('div');
            title.className = 'tooltip-title';
            title.textContent = titleElement.textContent;
            content.appendChild(title);

            // Remove the title element and any immediately following <br>
            let nextElement = titleElement.nextSibling;
            titleElement.remove();
            while (nextElement && (nextElement.nodeType === Node.TEXT_NODE && !nextElement.textContent.trim() || nextElement.nodeName === 'BR')) {
                const toRemove = nextElement;
                nextElement = nextElement.nextSibling;
                toRemove.remove();
            }
        }

        // Add remaining content
        content.style.whiteSpace = 'normal';  // Allow normal text wrapping
        while (tempDiv.firstChild) {
            content.appendChild(tempDiv.firstChild);
        }

        tooltip.appendChild(content);

        // Set parent relationship if exists
        if (parentTooltip) {
            const parentId = parentTooltip.id || `tooltip-${Date.now()}`;
            parentTooltip.id = parentId;
            tooltip.dataset.parentTooltip = parentId;
        }

        // Add event listeners
        tooltip.addEventListener('mouseenter', () => {
            tooltip.dataset.isHovered = 'true';
            tooltip.dataset.triggerHovered = target.dataset.isHovered || 'false';

            // Keep parent tooltips open when hovering over child
            if (parentTooltip) {
                parentTooltip.dataset.hasActiveChild = 'true';
            }
        });

        tooltip.addEventListener('mouseleave', () => {
            tooltip.dataset.isHovered = 'false';
            if (parentTooltip) {
                parentTooltip.dataset.hasActiveChild = 'false';
            }
            this.checkTooltip(tooltip);
        });

        // Handle animation end
        tooltip.addEventListener('transitionend', (e) => {
            if (e.propertyName === 'opacity' && !tooltip.classList.contains('show')) {
                const parentTooltip = this.getParentTooltip(tooltip);
                tooltip.remove();
                this.activeTooltips.delete(tooltip);

                // Check if parent tooltip should also be removed
                if (parentTooltip) {
                    parentTooltip.dataset.hasActiveChild = 'false';
                    this.checkTooltip(parentTooltip);
                }
            }
        });

        target.addEventListener('mouseenter', () => {
            target.dataset.isHovered = 'true';
            if (tooltip) {
                tooltip.dataset.triggerHovered = 'true';
                if (parentTooltip) {
                    parentTooltip.dataset.hasActiveChild = 'true';
                }
            }
        });

        target.addEventListener('mouseleave', () => {
            target.dataset.isHovered = 'false';
            if (tooltip) {
                tooltip.dataset.triggerHovered = 'false';
                if (parentTooltip) {
                    parentTooltip.dataset.hasActiveChild = 'false';
                }
                this.checkTooltip(tooltip);
            }
        });

        // Add to DOM and position
        this.container.appendChild(tooltip);
        this.positionTooltip(event, tooltip);

        // Trigger show animation after positioning
        requestAnimationFrame(() => {
            tooltip.classList.add('show');
        });

        this.activeTooltips.set(target, tooltip);
    }

    /**
     * Checks if a tooltip should be hidden based on hover state.
     * 
     * @param {HTMLElement} tooltip - The tooltip to check
     */
    checkTooltip(tooltip) {
        setTimeout(() => {
            const isHovered = tooltip.dataset.isHovered === 'true';
            const isTriggerHovered = tooltip.dataset.triggerHovered === 'true';
            const hasChildren = this.hasChildTooltips(tooltip);
            const isMouseOverTooltip = tooltip.matches(':hover');

            // Only remove if not hovered, no children, and not being moused over
            if (!isHovered && !isTriggerHovered && !hasChildren && !isMouseOverTooltip) {
                tooltip.classList.remove('show');
            }
        }, 50);
    }

    /**
     * Checks if a tooltip has any active child tooltips.
     * 
     * @param {HTMLElement} tooltip - The tooltip to check
     * @returns {boolean} True if the tooltip has active children
     */
    hasChildTooltips(tooltip) {
        return Array.from(this.activeTooltips.values())
            .some(t => t.dataset.parentTooltip === tooltip.id && t.classList.contains('show'));
    }

    /**
     * Gets the parent tooltip of a given tooltip.
     * 
     * @param {HTMLElement} tooltip - The tooltip to get the parent for
     * @returns {HTMLElement|null} The parent tooltip or null if none exists
     */
    getParentTooltip(tooltip) {
        if (!tooltip.dataset.parentTooltip) return null;
        return Array.from(this.activeTooltips.values())
            .find(t => t.id === tooltip.dataset.parentTooltip);
    }

    /**
     * Gets the singleton instance of TooltipManager.
     * 
     * @returns {TooltipManager} The singleton instance
     */
    static getInstance() {
        if (!instance) {
            instance = new TooltipManager();
        }
        return instance;
    }
}

export const tooltipManager = TooltipManager.getInstance(); 