/**
 * TooltipManager.js
 * Manages tooltip functionality for the D&D Character Creator
 */

let instance = null;

export class TooltipManager {
    constructor() {
        if (instance) {
            throw new Error('TooltipManager is a singleton. Use TooltipManager.getInstance() instead.');
        }
        this.tooltip = null;
        this.tooltipContent = null;
        this.tooltipTitle = null;
        this.tooltipDescription = null;
        this.tooltipDetails = null;
        this.tooltipActions = null;
        this.tooltipFooter = null;
        this.activeTooltip = null;
        this.tooltipDelay = 200;
        this.tooltipTimeout = null;
        this.tooltipOffset = 10;
        this._initialized = false;
        instance = this;
    }

    initialize() {
        if (this._initialized) return;

        this.tooltip = document.createElement('div');
        this.tooltip.className = 'tooltip';
        this.tooltip.style.display = 'none';
        document.body.appendChild(this.tooltip);

        this.tooltipContent = document.createElement('div');
        this.tooltipContent.className = 'tooltip-content';
        this.tooltip.appendChild(this.tooltipContent);

        this.tooltipTitle = document.createElement('h3');
        this.tooltipTitle.className = 'tooltip-title';
        this.tooltipContent.appendChild(this.tooltipTitle);

        this.tooltipDescription = document.createElement('p');
        this.tooltipDescription.className = 'tooltip-description';
        this.tooltipContent.appendChild(this.tooltipDescription);

        this.tooltipDetails = document.createElement('div');
        this.tooltipDetails.className = 'tooltip-details';
        this.tooltipContent.appendChild(this.tooltipDetails);

        this.tooltipActions = document.createElement('div');
        this.tooltipActions.className = 'tooltip-actions';
        this.tooltipContent.appendChild(this.tooltipActions);

        this.tooltipFooter = document.createElement('div');
        this.tooltipFooter.className = 'tooltip-footer';
        this.tooltipContent.appendChild(this.tooltipFooter);

        this._initialized = true;
    }

    positionTooltip(event) {
        const tooltipRect = this.tooltip.getBoundingClientRect();
        const scrollTop = document.documentElement.scrollTop;
        const scrollLeft = document.documentElement.scrollLeft;
        const viewportWidth = document.documentElement.clientWidth;
        const viewportHeight = document.documentElement.clientHeight;

        let left = event.clientX + this.tooltipOffset + scrollLeft;
        let top = event.clientY + this.tooltipOffset + scrollTop;

        // Adjust position if tooltip would overflow viewport
        if (left + tooltipRect.width > viewportWidth) {
            left = event.clientX - tooltipRect.width - this.tooltipOffset + scrollLeft;
        }
        if (top + tooltipRect.height > viewportHeight) {
            top = viewportHeight - tooltipRect.height - this.tooltipOffset + scrollTop;
        }

        this.tooltip.style.left = `${left}px`;
        this.tooltip.style.top = `${top}px`;
    }

    handleMouseOver(event) {
        const tooltipTarget = event.target.closest('[data-tooltip]');
        if (!tooltipTarget || Array.from(this.activeTooltips.values()).includes(tooltipTarget)) return;

        this.createTooltip(tooltipTarget, tooltipTarget.closest('.tooltip'));
    }

    createTooltip(target, parentTooltip) {
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
        });

        tooltip.addEventListener('mouseleave', () => {
            tooltip.dataset.isHovered = 'false';
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
                    this.checkTooltip(parentTooltip);
                }
            }
        });

        target.addEventListener('mouseenter', () => {
            target.dataset.isHovered = 'true';
            if (tooltip) tooltip.dataset.triggerHovered = 'true';
        });

        target.addEventListener('mouseleave', () => {
            target.dataset.isHovered = 'false';
            if (tooltip) {
                tooltip.dataset.triggerHovered = 'false';
                this.checkTooltip(tooltip);
            }
        });

        // Add to DOM and position
        this.container.appendChild(tooltip);
        this.positionTooltip(event);

        // Trigger show animation after positioning
        requestAnimationFrame(() => {
            tooltip.classList.add('show');
        });

        this.activeTooltips.set(tooltip, target);
    }

    checkTooltip(tooltip) {
        setTimeout(() => {
            const isHovered = tooltip.dataset.isHovered === 'true';
            const isTriggerHovered = tooltip.dataset.triggerHovered === 'true';
            const hasChildren = this.hasChildTooltips(tooltip);
            const isMouseOverTooltip = tooltip.matches(':hover');

            if (!isHovered && !isTriggerHovered && !hasChildren && !isMouseOverTooltip) {
                tooltip.classList.remove('show');
            }
        }, 50);
    }

    hasChildTooltips(tooltip) {
        return Array.from(this.activeTooltips.keys())
            .some(t => t.dataset.parentTooltip === tooltip.id);
    }

    getParentTooltip(tooltip) {
        if (!tooltip.dataset.parentTooltip) return null;
        return Array.from(this.activeTooltips.keys())
            .find(t => t.id === tooltip.dataset.parentTooltip);
    }

    static getInstance() {
        if (!instance) {
            instance = new TooltipManager();
        }
        return instance;
    }
}

export const tooltipManager = TooltipManager.getInstance(); 