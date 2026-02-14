// Shared collapse-toggle helper for collapsible sections with localStorage persistence.

/**
 * Renders a collapsible section header + content wrapper HTML.
 * @param {string} storageKey - localStorage key for collapsed state
 * @param {string} title - header title text
 * @returns {{ headerHtml: string, openTag: string, closeTag: string }}
 */
export function renderCollapsibleSection(storageKey, title = 'Sources') {
    const isCollapsed = localStorage.getItem(storageKey) === 'true';
    const chevronClass = isCollapsed ? 'fa-chevron-down' : 'fa-chevron-up';

    const headerHtml = `
		<div class="sources-collapsible-header u-collapsible-header">
			<h6 class="mb-0">${title}</h6>
			<i class="fas ${chevronClass} u-text-md"></i>
		</div>`;
    const openTag = `<div class="sources-collapsible-content ${isCollapsed ? 'u-hidden' : 'u-block'}">`;
    const closeTag = '</div>';

    return { headerHtml, openTag, closeTag };
}

/**
 * Attach a click listener to toggle the collapsible section and persist state.
 * @param {HTMLElement} container - parent element containing the header/content
 * @param {string} storageKey - localStorage key for collapsed state
 */
export function attachCollapseToggle(container, storageKey) {
    const header = container.querySelector('.sources-collapsible-header');
    if (!header) return;

    header.addEventListener('click', () => {
        const content = container.querySelector(
            '.sources-collapsible-content',
        );
        const icon = container.querySelector(
            '.sources-collapsible-header i',
        );
        if (!content || !icon) return;

        const isCurrentlyCollapsed =
            content.classList.contains('u-hidden');

        if (isCurrentlyCollapsed) {
            content.classList.remove('u-hidden');
            content.classList.add('u-block');
            icon.className = 'fas fa-chevron-up u-text-md';
            localStorage.setItem(storageKey, 'false');
        } else {
            content.classList.remove('u-block');
            content.classList.add('u-hidden');
            icon.className = 'fas fa-chevron-down u-text-md';
            localStorage.setItem(storageKey, 'true');
        }
    });
}
