# Phase 5: Presentation Layer Refactoring

**Objective:** Refactor Navigation.js and extract templates from index.html.

**Duration:** Weeks 7-9 (16-20 hours)

**Files Created:** 15 files (5 JS + 10 HTML templates)

**Files Modified:** Navigation.js → deleted, index.html → simplified

**Dependencies:** Phases 1-4

---

## Overview

Split Navigation.js (692 lines) into:
- Router.js - Route management
- PageLoader.js - Template loading  
- NavigationController.js - Coordination
- ComponentRegistry.js - Component lifecycle
- TemplateLoader.js - HTML caching

Extract index.html (1052 lines) into:
- Reduced index.html (~200 lines)
- 5 page templates
- 3 modal templates
- 2 component templates

---

## Step 1: Create Router.js

Create `app/js/presentation/Router.js`:

```javascript
/**
 * Client-side routing system.
 * 
 * @module presentation/Router
 */

import { Logger } from '../infrastructure/Logger.js';
import { Result } from '../infrastructure/Result.js';
import { AppState } from '../application/AppState.js';
import { eventBus, EVENTS } from '../infrastructure/EventBus.js';

class RouterImpl {
  constructor() {
    this.routes = new Map();
    this.currentRoute = null;
    Logger.info('Router', 'Router initialized');
  }

  register(path, config) {
    Logger.debug('Router', 'Registering route', { path, config });
    this.routes.set(path, config);
  }

  async navigate(path) {
    Logger.info('Router', 'Navigating to', { path });
    
    if (!this.routes.has(path)) {
      Logger.error('Router', 'Route not found', { path });
      return Result.err(`Route not found: ${path}`);
    }
    
    const route = this.routes.get(path);
    
    // Check if character required
    if (route.requiresCharacter && !AppState.getCurrentCharacter()) {
      Logger.warn('Router', 'Route requires character', { path });
      return Result.err('Character required for this page');
    }
    
    this.currentRoute = path;
    AppState.setCurrentPage(path);
    eventBus.emit(EVENTS.PAGE_CHANGED, path);
    
    return Result.ok(route);
  }

  getCurrentRoute() {
    return this.currentRoute;
  }
}

export const Router = new RouterImpl();

// Register all routes
Router.register('home', {
  template: 'home.html',
  requiresCharacter: false
});

Router.register('build', {
  template: 'build.html',
  requiresCharacter: true
});

Router.register('equipment', {
  template: 'equipment.html',
  requiresCharacter: true
});

Router.register('details', {
  template: 'details.html',
  requiresCharacter: true
});

Router.register('settings', {
  template: 'settings.html',
  requiresCharacter: false
});
```

---

## Step 2: Create PageLoader.js

Create `app/js/presentation/PageLoader.js`:

```javascript
/**
 * Page template loading and rendering.
 * 
 * @module presentation/PageLoader
 */

import { Logger } from '../infrastructure/Logger.js';
import { Result } from '../infrastructure/Result.js';

class PageLoaderImpl {
  async loadPage(templateName) {
    Logger.debug('PageLoader', 'Loading page', { templateName });
    
    try {
      const response = await fetch(`templates/pages/${templateName}`);
      
      if (!response.ok) {
        throw new Error(`Failed to load ${templateName}: ${response.statusText}`);
      }
      
      const html = await response.text();
      Logger.info('PageLoader', 'Page loaded', { templateName });
      
      return Result.ok(html);
    } catch (error) {
      Logger.error('PageLoader', 'Load failed', error);
      return Result.err(error.message);
    }
  }

  renderPage(html) {
    const contentArea = document.getElementById('content-area');
    
    if (!contentArea) {
      Logger.error('PageLoader', 'Content area not found');
      return Result.err('Content area not found');
    }
    
    contentArea.innerHTML = html;
    Logger.debug('PageLoader', 'Page rendered');
    
    return Result.ok(true);
  }
}

export const PageLoader = new PageLoaderImpl();
```

---

## Step 3: Create NavigationController.js

Create `app/js/presentation/NavigationController.js`:

```javascript
/**
 * Navigation coordination.
 * 
 * @module presentation/NavigationController
 */

import { Logger } from '../infrastructure/Logger.js';
import { Router } from './Router.js';
import { PageLoader } from './PageLoader.js';
import { eventBus, EVENTS } from '../infrastructure/EventBus.js';

class NavigationControllerImpl {
  constructor() {
    this.setupEventListeners();
    Logger.info('NavigationController', 'Initialized');
  }

  setupEventListeners() {
    // Listen for page change events
    eventBus.on(EVENTS.PAGE_CHANGED, async (page) => {
      await this.handlePageChange(page);
    });
    
    // Setup nav button clicks
    document.addEventListener('click', (e) => {
      const navButton = e.target.closest('[data-page-button]');
      if (navButton) {
        const page = navButton.dataset.pageButton;
        this.navigateTo(page);
      }
    });
  }

  async navigateTo(page) {
    Logger.info('NavigationController', 'Navigate to', { page });
    
    const result = await Router.navigate(page);
    
    if (result.isErr()) {
      Logger.error('NavigationController', 'Navigation failed', result.error);
      return;
    }
    
    const route = result.value;
    await this.loadAndRenderPage(route.template);
    this.updateNavButtons(page);
  }

  async loadAndRenderPage(template) {
    const result = await PageLoader.loadPage(template);
    
    if (result.isErr()) {
      Logger.error('NavigationController', 'Failed to load page', result.error);
      return;
    }
    
    PageLoader.renderPage(result.value);
  }

  updateNavButtons(activePage) {
    document.querySelectorAll('[data-page-button]').forEach(button => {
      button.classList.toggle('active', button.dataset.pageButton === activePage);
    });
  }

  async handlePageChange(page) {
    Logger.debug('NavigationController', 'Handling page change', { page });
  }
}

export const NavigationController = new NavigationControllerImpl();
```

---

## Step 4: Extract Templates

### Reduce index.html

Update `app/index.html` to:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Fizbane's Forge</title>
  
  <!-- CSS -->
  <link rel="stylesheet" href="assets/bootstrap/css/bootstrap.min.css">
  <link rel="stylesheet" href="assets/fontawesome/css/all.min.css">
  <link rel="stylesheet" href="css/main.css">
  <link rel="stylesheet" href="css/modal.css">
</head>
<body>
  <!-- Navigation -->
  <nav id="main-nav" class="navbar">
    <div class="nav-brand">Fizbane's Forge</div>
    <div class="nav-buttons">
      <button data-page-button="home">Home</button>
      <button data-page-button="build">Build</button>
      <button data-page-button="equipment">Equipment</button>
      <button data-page-button="details">Details</button>
      <button data-page-button="settings">Settings</button>
    </div>
  </nav>

  <!-- Content Area -->
  <main id="content-area"></main>

  <!-- Modal Container -->
  <div id="modal-container"></div>

  <!-- Scripts -->
  <script type="module" src="js/infrastructure/Logger.js"></script>
  <script type="module" src="js/infrastructure/Result.js"></script>
  <script type="module" src="js/infrastructure/EventBus.js"></script>
  <script type="module" src="js/application/AppState.js"></script>
  <script type="module" src="js/presentation/Router.js"></script>
  <script type="module" src="js/presentation/PageLoader.js"></script>
  <script type="module" src="js/presentation/NavigationController.js"></script>
  <script type="module" src="js/core/AppInitializer.js"></script>
</body>
</html>
```

### Create Page Templates

Create `app/templates/pages/home.html`:

```html
<div class="page-home">
  <h1>Character Selection</h1>
  
  <button id="create-character-btn" class="btn btn-primary">
    Create New Character
  </button>
  
  <div id="character-list" class="character-list">
    <!-- Characters will be loaded here -->
  </div>
</div>
```

Create similar templates for:
- `build.html`
- `equipment.html`
- `details.html`
- `settings.html`

### Create Modal Templates

Create `app/templates/modals/newCharacter.html`:

```html
<div class="modal">
  <div class="modal-content">
    <h2>Create New Character</h2>
    <input type="text" id="character-name" placeholder="Character Name">
    <button id="confirm-create">Create</button>
    <button id="cancel-create">Cancel</button>
  </div>
</div>
```

---

## Step 5: Update AppInitializer

Update `app/js/core/AppInitializer.js` to:
- Initialize Router
- Load initial page
- Setup NavigationController

---

## Step 6: Delete Old Files

```powershell
Remove-Item app/js/core/Navigation.js
```

---

## Step 7: Test & Validate

```powershell
npm start
```

Verify:
- [ ] All pages load correctly
- [ ] Navigation works
- [ ] Templates render
- [ ] No console errors

---

## Step 8: Git Checkpoint

```powershell
git add app/js/presentation/ app/templates/ app/index.html
git rm app/js/core/Navigation.js
git commit -m "refactor(presentation): split Navigation and extract templates

Phase 5 Complete - Presentation Layer

Presentation Layer Created:
- Router.js - Client-side routing
- PageLoader.js - Template loading
- NavigationController.js - Navigation coordination
- ComponentRegistry.js - Component lifecycle
- TemplateLoader.js - HTML caching

Templates Extracted:
- index.html reduced from 1052 to ~200 lines
- 5 page templates created
- 3 modal templates created

Files Deleted:
- Navigation.js (split into new files)"

git push origin refactor
```

---

## Phase 5 Completion Checklist

- [ ] All presentation files created
- [ ] All templates extracted
- [ ] index.html simplified
- [ ] Navigation working
- [ ] App functional

**Next:** PHASE_6_TESTING.md