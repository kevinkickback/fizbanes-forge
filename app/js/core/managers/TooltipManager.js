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
        this.container = null;
        this.initialize();
        instance = this;
    }

    initialize() {
        // Create tooltip container if it doesn't exist
        this.container = document.getElementById('tooltipContainer');
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.id = 'tooltipContainer';
            this.container.className = 'tooltip-container';
            document.body.appendChild(this.container);
        }

        // Add event listeners
        document.addEventListener('mouseover', this.handleMouseOver.bind(this));
        document.addEventListener('mouseout', this.handleMouseOut.bind(this));
        document.addEventListener('mousemove', this.handleMouseMove.bind(this));
    }

    handleMouseOver(event) {
        const target = event.target.closest('[data-tooltip]');
        if (!target) return;

        const tooltip = document.createElement('div');
        tooltip.className = 'tooltip';
        tooltip.innerHTML = decodeURIComponent(target.dataset.tooltip);

        if (target.dataset.source) {
            const source = document.createElement('div');
            source.className = 'tooltip-source';
            source.textContent = target.dataset.source;
            tooltip.appendChild(source);
        }

        this.container.appendChild(tooltip);
        this.positionTooltip(tooltip, target, event);
    }

    handleMouseOut(event) {
        const tooltip = this.container.querySelector('.tooltip');
        if (tooltip) {
            tooltip.remove();
        }
    }

    handleMouseMove(event) {
        const tooltip = this.container.querySelector('.tooltip');
        const target = event.target.closest('[data-tooltip]');
        if (tooltip && target) {
            this.positionTooltip(tooltip, target, event);
        }
    }

    positionTooltip(tooltip, target, event) {
        const rect = target.getBoundingClientRect();
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

        // Get tooltip dimensions
        const tooltipRect = tooltip.getBoundingClientRect();
        const tooltipWidth = tooltipRect.width;
        const tooltipHeight = tooltipRect.height;

        // Calculate position
        let left = event.clientX + scrollLeft + 10;
        let top = event.clientY + scrollTop + 10;

        // Adjust position if tooltip would go off screen
        if (left + tooltipWidth > window.innerWidth) {
            left = window.innerWidth - tooltipWidth - 10;
        }
        if (top + tooltipHeight > window.innerHeight) {
            top = window.innerHeight - tooltipHeight - 10;
        }

        // Apply position
        tooltip.style.left = `${left}px`;
        tooltip.style.top = `${top}px`;

        // Show tooltip
        tooltip.classList.add('show');
    }

    static getInstance() {
        if (!instance) {
            instance = new TooltipManager();
        }
        return instance;
    }
}

// Export singleton instance
export const tooltipManager = TooltipManager.getInstance(); 