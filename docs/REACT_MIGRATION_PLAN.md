# React Migration Plan — Fizbane's Forge

> **Purpose**: Actionable, step-by-step guide for migrating Fizbane's Forge from its current vanilla JavaScript architecture to React. Written for execution by an AI agent or developer.

---

## Table of Contents

1. [High-Level Assessment](#1-high-level-assessment)
2. [Migration Strategy](#2-migration-strategy)
3. [Mapping Existing Systems to React Concepts](#3-mapping-existing-systems-to-react-concepts)
4. [State and Data Flow](#4-state-and-data-flow)
5. [Incremental Migration Plan](#5-incremental-migration-plan)
6. [Refactoring and Cleanup](#6-refactoring-and-cleanup)
7. [Risks and Mitigation](#7-risks-and-mitigation)
8. [Example Conversions](#8-example-conversions)
9. [AI-Agent Execution Guidance](#9-ai-agent-execution-guidance)

---

## 1. High-Level Assessment

### 1.1 Why the Current Architecture Has Become Difficult to Maintain

The application is a single-page Electron app built entirely with vanilla JavaScript, Bootstrap 5, and manual DOM manipulation. As the feature set has grown — spanning 8 page controllers, ~65 UI component files, ~30 services, a 77-event EventBus, and a custom global state manager — the codebase has accumulated substantial custom infrastructure that exists solely to compensate for the absence of a UI framework.

**Core maintenance pain points:**

| Problem | Where It Manifests |
|---|---|
| **Manual DOM lifecycle management** | Every component manually creates, updates, and tears down DOM elements via `innerHTML`, `createElement`, and explicit `cleanup()` calls. A missed cleanup causes memory leaks. |
| **Custom memory management system (DOMCleanup)** | An entire abstraction (`DOMCleanup.js`) tracks DOM listeners, EventBus subscriptions, Bootstrap modal instances, and timers — then requires manual `cleanup()` on teardown. React's component unmounting eliminates this entire class. |
| **Global event bus for UI coordination** | `EventBus.js` defines 77 event constants and acts as the sole mechanism for cross-component communication. It requires manual subscription/unsubscription, has custom leak detection (warns at 10+ listeners), and includes debug infrastructure (history tracking, performance metrics). React's unidirectional data flow, Context, and lifting state up replace the need for a global pub/sub system. |
| **Custom state management with manual notifications** | `AppState.js` is a hand-rolled singleton that stores global state and emits `state:*:changed` events via EventBus whenever properties change. Consumers must manually subscribe and unsubscribe. React state (useState/useReducer) and Context provide this reactively. |
| **Imperative page navigation** | `NavigationController.js` implements a custom Router + PageLoader that fetches HTML templates, injects them via `innerHTML`, then instantiates page controllers. React Router handles this declaratively. |
| **Imperative UI updates** | After any data change, code must manually call methods like `refreshForRaceChange()`, `refreshForProficiencyChange()`, `refreshForCharacterChange()` on sibling components. React re-renders automatically when state changes. |
| **Modal lifecycle complexity** | `BaseSelectorModal.js` and `ModalCleanupUtility.js` handle Bootstrap modal creation, disposal, backdrop cleanup, and event tracking manually. React portals and controlled components eliminate this. |

### 1.2 Custom Code That Duplicates React Ecosystem Functionality

| Custom System | Files | React Ecosystem Replacement |
|---|---|---|
| `EventBus.js` (77 events, debug mode, metrics) | `src/lib/EventBus.js` | React state/context propagation, lifting state up, `useReducer` dispatch |
| `AppState.js` (global singleton with event emissions) | `src/app/AppState.js` | React Context + `useReducer`, or Zustand |
| `DOMCleanup.js` (listener tracking, timer tracking, modal tracking) | `src/lib/DOMCleanup.js` | React `useEffect` cleanup returns, automatic unmounting |
| `NavigationController.js` + `Router` + `PageLoader` (custom SPA routing) | `src/app/NavigationController.js` | React Router (`react-router-dom`) |
| `PageHandler.js` (controller instantiation/cleanup per page) | `src/app/PageHandler.js` | React Router route components |
| `BasePageController.js` + 8 page controllers | `src/app/pages/*.js` | React page components with hooks |
| `Notifications.js` (toast system with history, badges, suppression) | `src/lib/Notifications.js` | `react-hot-toast` or `sonner` |
| `NotificationCenter.js` (notification history panel) | `src/ui/components/NotificationCenter.js` | React component with notification state |
| `ThemeManager.js` (theme toggle with DOMCleanup) | `src/app/ThemeManager.js` | React Context + `useEffect` for `data-theme` attribute |
| `TitlebarController.js` (imperative DOM updates for titlebar) | `src/app/TitlebarController.js` | React component consuming character context |
| `UIHandlersInitializer.js` (manual DOM button binding) | `src/app/UIHandlersInitializer.js` | React event handlers (`onClick`, `onChange`) |
| `BaseSelectorModal.js` + `ModalCleanupUtility.js` | `src/ui/components/selection/`, `src/lib/ModalCleanupUtility.js` | React modal components (portals or headless UI) |
| `CollapsibleSection.js` (manual accordion behavior) | `src/ui/components/CollapsibleSection.js` | React controlled accordion component |
| `AppInitializer.js` (boot sequence orchestration) | `src/app/AppInitializer.js` | React `<Suspense>`, custom hooks, `useEffect` initialization |

### 1.3 Systems That Exist Only to Support the Non-React Architecture

These systems would be **entirely eliminated** by React adoption:

1. **`DOMCleanup.js`** — The entire class exists because vanilla JS has no component lifecycle. React's `useEffect` cleanup and automatic unmounting replace it completely.
2. **`ModalCleanupUtility.js`** — Functions like `resetModalBodyState()` and `cleanupOrphanedBackdrops()` exist because Bootstrap modals are manually managed. React-based modals don't need this.
3. **`PageHandler.js`** — Exists solely to create/destroy page controllers when routes change. React Router does this automatically.
4. **`UIHandlersInitializer.js`** — Exists solely to wire DOM event listeners to buttons. React's JSX event binding replaces it.
5. **EventBus debug infrastructure** — `_history`, `_metrics`, `_checkForListenerLeaks()`, `enableDebugMode()` — all exist because manual subscription management is error-prone. React DevTools replaces this debugging need.
6. **`BasePageController.js`** — A base class providing `DOMCleanup.create()` per page. Unnecessary when pages are React components.
7. **Template HTML files** (`src/ui/pages/*.html`) — 8 HTML templates fetched and injected via `innerHTML`. React components replace these.

---

## 2. Migration Strategy

### 2.1 High-Level Approach: Incremental React Islands → Full React SPA

The migration follows a **strangler fig pattern**: introduce React into the existing app as isolated "islands," then progressively expand React's scope until vanilla JS is fully replaced.

```
Phase 0: Infrastructure Setup (React + build tooling)
Phase 1: React Islands (simple leaf components)
Phase 2: Page-Level Migration (one page at a time)
Phase 3: Core System Replacement (state, routing, notifications)
Phase 4: Full React SPA (remove all vanilla JS infrastructure)
Phase 5: Cleanup and Optimization
```

### 2.2 Recommended Libraries

| Concern | Library | Justification |
|---|---|---|
| **UI Framework** | React 19 + ReactDOM | Current standard; Electron supports it natively. |
| **Build Tool** | Vite | Already uses Vitest (Vite-based test runner). Minimal config for Electron + React. |
| **Routing** | React Router v7 (`react-router-dom`) | Declarative routing; maps directly to existing 8-page navigation. |
| **Global State** | Zustand | Minimal API, no boilerplate, works outside React (services can read/write), supports subscriptions — ideal bridge during incremental migration. |
| **Component State** | React `useState` / `useReducer` | For local UI state (form inputs, toggle states, filter selections). |
| **Notifications** | `sonner` or `react-hot-toast` | Drop-in toast system; replaces custom `Notifications.js`. |
| **Modals** | Headless UI (`@headlessui/react`) or Radix Primitives | Accessible, unstyled modal primitives; replaces `BaseSelectorModal` + Bootstrap modals. |
| **CSS** | Keep existing CSS modules + CSS variables | No need to change the styling approach; existing CSS can be imported directly. |
| **Data Fetching** | TanStack Query (React Query) | Caching, deduplication, loading/error states — replaces manual `DataLoader` caching and `BaseDataService._initPromise` patterns. |
| **Testing** | Vitest + React Testing Library | Vitest already configured; add `@testing-library/react` for component tests. |

### 2.3 Recommended Project Structure

```
src/
├── main/                          # UNCHANGED — Electron main process
│   ├── Main.js
│   ├── Preload.cjs
│   ├── Window.js
│   ├── Settings.js
│   ├── Logger.js
│   ├── Data.js
│   ├── pdf/
│   └── ipc/
├── renderer/                      # NEW — React renderer entry
│   ├── main.jsx                   # ReactDOM.createRoot entry point
│   ├── App.jsx                    # Root component (providers, router)
│   ├── routes.jsx                 # Route definitions
│   ├── components/                # Shared UI components
│   │   ├── layout/
│   │   │   ├── Sidebar.jsx
│   │   │   ├── Titlebar.jsx
│   │   │   └── Layout.jsx
│   │   ├── modals/
│   │   │   ├── BaseSelectorModal.jsx
│   │   │   ├── CharacterCreationModal.jsx
│   │   │   ├── LevelUpModal.jsx
│   │   │   └── ConfirmModal.jsx
│   │   ├── character/
│   │   │   ├── CharacterCard.jsx
│   │   │   └── CharacterList.jsx
│   │   ├── abilities/
│   │   ├── class/
│   │   ├── race/
│   │   ├── background/
│   │   ├── proficiencies/
│   │   ├── equipment/
│   │   ├── feats/
│   │   ├── spells/
│   │   ├── notifications/
│   │   │   ├── NotificationCenter.jsx
│   │   │   └── useNotifications.js
│   │   └── common/
│   │       ├── CollapsibleSection.jsx
│   │       ├── EditionFilter.jsx
│   │       └── FilterBuilder.jsx
│   ├── pages/                     # One component per route
│   │   ├── HomePage.jsx
│   │   ├── BuildPage.jsx
│   │   ├── FeatsPage.jsx
│   │   ├── SpellsPage.jsx
│   │   ├── EquipmentPage.jsx
│   │   ├── DetailsPage.jsx
│   │   ├── PreviewPage.jsx
│   │   └── SettingsPage.jsx
│   ├── hooks/                     # Custom React hooks
│   │   ├── useCharacter.js
│   │   ├── useServices.js
│   │   ├── useNavigation.js
│   │   ├── useTheme.js
│   │   └── useIPC.js
│   ├── stores/                    # Zustand stores
│   │   ├── characterStore.js
│   │   ├── appStore.js
│   │   └── notificationStore.js
│   └── providers/                 # React Context providers
│       ├── ServiceProvider.jsx
│       └── ThemeProvider.jsx
├── services/                      # MOSTLY UNCHANGED — data/business logic
│   ├── BaseDataService.js         # Remove EventBus emissions; return data directly
│   ├── SpellService.js
│   ├── ClassService.js
│   └── ... (all other services)
├── domain/                        # RENAMED from app/ — pure domain logic
│   ├── Character.js               # UNCHANGED
│   ├── CharacterManager.js        # Remove EventBus; call store actions directly
│   └── CharacterSerializer.js     # UNCHANGED
├── lib/                           # Keep pure utilities, remove UI infrastructure
│   ├── 5eToolsParser.js           # KEEP
│   ├── 5eToolsRenderer.js         # KEEP
│   ├── CharacterSchema.js         # KEEP
│   ├── Errors.js                  # KEEP
│   ├── GameRules.js               # KEEP
│   ├── ValidationSchemas.js       # KEEP
│   ├── TextProcessor.js           # KEEP
│   ├── AbilityScoreUtils.js       # KEEP
│   ├── PrerequisiteValidator.js   # KEEP
│   ├── DataLoader.js              # KEEP (used by services; TanStack Query wraps it)
│   ├── EventBus.js                # REMOVE after Phase 4
│   ├── DOMCleanup.js              # REMOVE after Phase 4
│   ├── Notifications.js           # REMOVE after Phase 3
│   └── ModalCleanupUtility.js     # REMOVE after Phase 3
├── data/                          # UNCHANGED — JSON data files
└── ui/                            # DEPRECATED progressively
    ├── index.html                 # Modified: becomes React mount point
    ├── styles/                    # KEEP — imported by React components
    ├── assets/                    # KEEP
    ├── pages/                     # REMOVE after Phase 2 (replaced by React pages)
    ├── rendering/                 # KEEP initially; migrate to React components later
    └── components/                # REMOVE progressively as React replaces each
```

---

## 3. Mapping Existing Systems to React Concepts

### 3.1 EventBus → React State Propagation + Zustand

**Current role**: `EventBus.js` is a global publish/subscribe system built on `eventemitter3`. It defines 77 event constants and is used for:
- Cross-component communication (e.g., `CHARACTER_UPDATED` triggers titlebar, save button, and page controller updates)
- Service lifecycle signals (e.g., `SPELLS_LOADED`, `DATA_INVALIDATED`)
- Navigation events (e.g., `PAGE_CHANGED`, `PAGE_LOADED`)
- UI state coordination (e.g., `MODAL_OPENED`, `MODAL_CLOSED`)

**How React replaces it**: React's unidirectional data flow eliminates most EventBus use cases:

| EventBus Pattern | React Replacement |
|---|---|
| `CHARACTER_UPDATED` → multiple listeners update | Zustand store update → all subscribed components re-render automatically |
| `PAGE_CHANGED` → titlebar/sidebar update | React Router `useLocation()` → components read current route |
| `SPELLS_LOADED` → UI populates | TanStack Query `useQuery()` → loading/success states drive UI |
| `ABILITY_SCORES_CHANGED` → proficiency recalc | Derived state via `useMemo()` or Zustand selectors |
| `MODAL_OPENED/CLOSED` | React state: `const [isOpen, setIsOpen] = useState(false)` |
| Parent → child coordination | Props and callbacks |
| Sibling → sibling coordination | Lift state to shared parent, or Zustand store |

**Migration steps**:

1. Create a Zustand store that mirrors `AppState` properties:
   ```js
   // src/renderer/stores/characterStore.js
   import { create } from 'zustand';
   
   export const useCharacterStore = create((set, get) => ({
     currentCharacter: null,
     characters: [],
     hasUnsavedChanges: false,
     
     setCurrentCharacter: (character) => set({ currentCharacter: character }),
     setHasUnsavedChanges: (v) => set({ hasUnsavedChanges: v }),
     updateCharacter: (updates) => {
       const current = get().currentCharacter;
       if (!current) return;
       Object.assign(current, updates);
       set({ currentCharacter: current, hasUnsavedChanges: true });
     },
   }));
   ```

2. For each EventBus event, identify whether it represents:
   - **State change** → Replace with Zustand store mutation (components auto-re-render)
   - **Side effect trigger** → Replace with `useEffect` reacting to state change
   - **Service signal** → Replace with TanStack Query cache invalidation
   - **Navigation** → Replace with React Router's `useNavigate()`

3. During the bridge period, create a shim that subscribes EventBus to Zustand changes:
   ```js
   // Bridge: emit EventBus events when Zustand state changes (temporary)
   useCharacterStore.subscribe((state, prevState) => {
     if (state.currentCharacter !== prevState.currentCharacter) {
       eventBus.emit(EVENTS.CHARACTER_UPDATED, state.currentCharacter);
     }
   });
   ```

4. Remove EventBus subscriptions from each component as it is migrated to React.

5. After all components are migrated, remove `EventBus.js` entirely.

### 3.2 AppState → Zustand Store

**Current role**: `AppState.js` is a singleton class holding renderer-wide state: `isLoading`, `currentPage`, `isLoadingCharacter`, `isNavigating`, `failedServices`, `currentCharacter`, `characters`, `hasUnsavedChanges`. On every `setState()` call, it emits `STATE_CHANGED` and per-property `state:*:changed` events.

**How React replaces it**: Zustand stores (or React Context + useReducer for simpler cases) provide reactive state that automatically triggers re-renders in consuming components.

**Migration steps**:

1. Create two Zustand stores to separate concerns:

   ```js
   // src/renderer/stores/appStore.js
   export const useAppStore = create((set) => ({
     isLoading: false,
     currentPage: 'home',
     isNavigating: false,
     failedServices: [],
     setLoading: (v) => set({ isLoading: v }),
     setFailedServices: (s) => set({ failedServices: s }),
   }));
   
   // src/renderer/stores/characterStore.js
   export const useCharacterStore = create((set, get) => ({
     currentCharacter: null,
     characters: [],
     hasUnsavedChanges: false,
     isLoadingCharacter: false,
     // ... actions
   }));
   ```

2. Replace `AppState.getCurrentCharacter()` calls in React components with:
   ```js
   const character = useCharacterStore((s) => s.currentCharacter);
   ```

3. Replace `AppState.setState({ hasUnsavedChanges: true })` with:
   ```js
   useCharacterStore.getState().setHasUnsavedChanges(true);
   ```

4. During bridge period, keep `AppState` alive and sync bidirectionally with Zustand (see Phase 1 in Section 5).

### 3.3 DOMCleanup → React useEffect Cleanup

**Current role**: `DOMCleanup.js` is a utility class that tracks:
- DOM event listeners (`this._cleanup.on(element, 'click', handler)`)
- EventBus subscriptions (`this._cleanup.onEvent(event, handler)`)
- Timers (`this._cleanup.setTimeout()`)
- Bootstrap modal instances (`this._cleanup.registerBootstrapModal()`)

Every component creates `this._cleanup = DOMCleanup.create()` in its constructor and calls `this._cleanup.cleanup()` on teardown. Forgetting this causes memory leaks.

**How React replaces it**: React's `useEffect` hook returns a cleanup function that runs automatically on unmount or dependency change:

```jsx
useEffect(() => {
  const handler = () => { /* ... */ };
  window.addEventListener('resize', handler);
  return () => window.removeEventListener('resize', handler); // Automatic cleanup
}, []);
```

**Migration steps**:

1. When converting a component class to a React function component, replace each `this._cleanup.on(element, event, handler)` with a `useEffect` that adds and removes the listener.
2. Replace `this._cleanup.onEvent(EVENT, handler)` with either:
   - A Zustand subscription (if the event represents state change).
   - A `useEffect` subscribing to a remaining EventBus event (during bridge period).
3. Replace `this._cleanup.setTimeout()` with `useEffect` + `setTimeout` + cleanup.
4. Replace `this._cleanup.registerBootstrapModal()` with React-managed modal state.
5. After all components using DOMCleanup are migrated, delete `DOMCleanup.js`.

### 3.4 Navigation (Router + PageLoader + PageHandler) → React Router

**Current role**: Three classes cooperate to implement SPA navigation:
- `Router` registers 8 routes with metadata (template, requiresCharacter, title, sections).
- `PageLoader` fetches HTML template files, caches them, and injects via `innerHTML`.
- `PageHandler` listens for `PAGE_LOADED` events, instantiates the matching page controller, and calls `cleanup()` on the previous one.

**How React replaces it**: React Router provides declarative route definitions and automatic component mounting/unmounting:

```jsx
// src/renderer/routes.jsx
import { createHashRouter } from 'react-router-dom';

export const router = createHashRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'build', element: <RequireCharacter><BuildPage /></RequireCharacter> },
      { path: 'feats', element: <RequireCharacter><FeatsPage /></RequireCharacter> },
      { path: 'spells', element: <RequireCharacter><SpellsPage /></RequireCharacter> },
      { path: 'equipment', element: <RequireCharacter><EquipmentPage /></RequireCharacter> },
      { path: 'details', element: <RequireCharacter><DetailsPage /></RequireCharacter> },
      { path: 'preview', element: <RequireCharacter><PreviewPage /></RequireCharacter> },
      { path: 'settings', element: <SettingsPage /> },
    ],
  },
]);
```

**Migration steps**:

1. Install `react-router-dom`.
2. Create route definitions that map the 8 existing routes.
3. Create a `<RequireCharacter>` wrapper component that redirects to `/` if no character is loaded (replaces `route.requiresCharacter` logic).
4. Create a `<Layout>` component that renders the sidebar + titlebar + `<Outlet />`.
5. Replace `NavigationController.navigateTo(page)` calls with React Router's `useNavigate()`.
6. Delete `NavigationController.js`, `PageHandler.js`, `BasePageController.js`, and all page controllers after their React equivalents are created.
7. Delete all `src/ui/pages/*.html` template files.

### 3.5 Page Controllers → React Page Components

**Current role**: Each page controller (e.g., `BuildPageController`) extends `BasePageController`, creates `DOMCleanup`, instantiates card sub-components, wires up cross-card coordination via callbacks, and calls `cleanup()` on teardown.

**How React replaces it**: Each page becomes a React function component. Sub-components are composed via JSX. Cross-component coordination happens through shared state (Zustand or lifted state).

**Migration example** (BuildPage):

```jsx
// src/renderer/pages/BuildPage.jsx
export function BuildPage() {
  const character = useCharacterStore(s => s.currentCharacter);
  
  return (
    <div className="build-page">
      <RaceCard character={character} />
      <ClassCard character={character} />
      <BackgroundCard character={character} />
      <AbilityScoreCard character={character} />
      <ProficiencyCard character={character} />
    </div>
  );
}
```

The previous `_coordinateUpdate(source)` method that manually refreshes sibling components becomes unnecessary — when `character` state changes in the store, all components consuming it re-render automatically.

### 3.6 Notifications → sonner/react-hot-toast + Zustand

**Current role**: `Notifications.js` provides `showNotification(message, severity)` — a global function that creates DOM toast elements, manages debouncing, auto-close timers, history, badge counts, and suppression patterns. `NotificationCenter.js` renders the notification history panel.

**How React replaces it**:

1. Install `sonner` (or `react-hot-toast`).
2. Add `<Toaster />` to the root `App.jsx`.
3. Replace all `showNotification(msg, type)` calls with `toast.success(msg)`, `toast.error(msg)`, etc.
4. For notification history, create a Zustand store:
   ```js
   export const useNotificationStore = create((set, get) => ({
     history: [],
     unreadCount: 0,
     addNotification: (msg, type) => {
       const n = { id: Date.now(), message: msg, type, read: false, timestamp: new Date() };
       set(s => ({ history: [n, ...s.history].slice(0, 50), unreadCount: s.unreadCount + 1 }));
     },
     markAllRead: () => set(s => ({
       history: s.history.map(n => ({ ...n, read: true })),
       unreadCount: 0,
     })),
   }));
   ```
5. Delete `Notifications.js`, `NotificationCenter.js`, and related CSS after migration.

### 3.7 Modal System → React Portals + Headless UI

**Current role**: `BaseSelectorModal` dynamically creates modal DOM elements, initializes Bootstrap modals, tracks state (items, filters, search, pagination), handles keyboard/mouse events, and disposes everything via `DOMCleanup`. `ModalCleanupUtility.js` provides helper functions for orphaned backdrop cleanup.

**How React replaces it**:

```jsx
// Conceptual BaseSelectorModal in React
function SelectorModal({ isOpen, onClose, items, onSelect, title }) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(new Set());
  const filtered = useMemo(() => items.filter(matchesSearch(search)), [items, search]);

  if (!isOpen) return null;

  return createPortal(
    <div className="modal-overlay">
      <div className="modal-content">
        <h2>{title}</h2>
        <input value={search} onChange={e => setSearch(e.target.value)} />
        <ItemList items={filtered} selected={selected} onToggle={id => toggleSelection(id)} />
        <button onClick={() => onSelect(selected)}>Confirm</button>
        <button onClick={onClose}>Cancel</button>
      </div>
    </div>,
    document.body
  );
}
```

No `DOMCleanup`, no `disposeBootstrapModal`, no `cleanupOrphanedBackdrops`. React handles all of it.

### 3.8 ThemeManager → React Context + useEffect

**Current role**: `ThemeManager.js` reads theme from `localStorage`, sets `data-theme` on `<html>`, and wires up a toggle button via `DOMCleanup`.

**React replacement**:

```jsx
// src/renderer/providers/ThemeProvider.jsx
const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggle = () => setTheme(t => t === 'dark' ? 'light' : 'dark');

  return <ThemeContext.Provider value={{ theme, toggle }}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
```

### 3.9 TitlebarController → React Component

**Current role**: `TitlebarController.js` imperatively updates DOM elements (`#titlebarCharacterName`, save button disabled state, level-up button tooltip) by subscribing to 5 EventBus events.

**React replacement**:

```jsx
function Titlebar() {
  const character = useCharacterStore(s => s.currentCharacter);
  const hasUnsaved = useCharacterStore(s => s.hasUnsavedChanges);
  const hasClasses = character?.progression?.classes?.length > 0;

  return (
    <div className="app-titlebar">
      <span>{character?.name || 'No Character Loaded'}</span>
      <button disabled={!hasClasses} title={!character ? 'No character loaded' : 'Level Up'}>
        Level Up
      </button>
      <button disabled={!hasUnsaved} className={hasUnsaved ? 'unsaved' : ''}>
        Save
      </button>
    </div>
  );
}
```

Zero event subscriptions. Zero manual DOM updates. Zero cleanup.

### 3.10 Services Layer

**Current role**: Services (30 files in `src/services/`) handle data loading, caching, and business logic. They are largely independent of the UI and communicate via EventBus emissions (`SPELLS_LOADED`, `DATA_INVALIDATED`, etc.) and `BaseDataService` patterns (`initWithLoader`, `resetData`).

**React integration approach**: Services are **mostly preserved as-is**. They are wrapped with React hooks or TanStack Query:

```js
// src/renderer/hooks/useSpells.js
import { useQuery } from '@tanstack/react-query';
import { spellService } from '../../services/SpellService.js';

export function useSpells() {
  return useQuery({
    queryKey: ['spells'],
    queryFn: () => spellService.initialize().then(() => spellService.getAllSpells()),
    staleTime: Infinity, // Data doesn't change during session
  });
}
```

**Migration steps for services**:
1. Keep all service files in `src/services/`.
2. Remove EventBus emissions from services (e.g., `SPELLS_LOADED`). These are now replaced by TanStack Query's `isSuccess` state.
3. Remove `DATA_INVALIDATED` listener from `BaseDataService`. Instead, call `queryClient.invalidateQueries()` when the data source changes.
4. Service methods remain synchronous data accessors after initialization; TanStack Query handles async lifecycle.

---

## 4. State and Data Flow

### 4.1 Current State Architecture

```
┌─────────────────────────────────────────────────────┐
│                    AppState (singleton)              │
│  isLoading, currentPage, currentCharacter,          │
│  characters, hasUnsavedChanges, failedServices      │
│                                                     │
│  setState() ──► EventBus.emit('state:*:changed')    │
│              ──► EventBus.emit('STATE_CHANGED')     │
└─────────────────┬───────────────────────────────────┘
                  │
         ┌────────┴────────┐
         │    EventBus     │
         │  (77 events)    │
         └────────┬────────┘
                  │
    ┌─────────────┼─────────────────┐
    │             │                 │
┌───┴───┐   ┌────┴─────┐   ┌──────┴──────┐
│Titlebar│   │Page Ctrl │   │Services     │
│   .js  │   │  .js     │   │(emit events)│
└────────┘   └──────────┘   └─────────────┘
```

**Problems**:
- Any component can emit any event; no ownership model.
- Circular dependencies possible (component listens to event, mutates state, state emits event, component listens...).
- `Character` is a mutable object mutated in-place; consumers must remember to call `AppState.setCurrentCharacter()` and `eventBus.emit(EVENTS.CHARACTER_UPDATED)` after mutation.

### 4.2 Target React State Architecture

```
┌────────────────────────────────────────────────────────────┐
│                    Zustand Stores                          │
│                                                            │
│  useCharacterStore    useAppStore    useNotificationStore   │
│  ┌──────────────┐    ┌───────────┐  ┌──────────────────┐  │
│  │character     │    │isLoading  │  │history           │  │
│  │characters    │    │failedSvc  │  │unreadCount       │  │
│  │hasUnsaved    │    └───────────┘  └──────────────────┘  │
│  │actions...    │                                          │
│  └──────────────┘                                          │
└────────────────────────────┬───────────────────────────────┘
                             │ Automatic re-render
              ┌──────────────┼──────────────────┐
              │              │                  │
        ┌─────┴─────┐  ┌────┴─────┐   ┌───────┴───────┐
        │<Titlebar/> │  │<BuildPage│   │ TanStack Query│
        │  reads:    │  │  reads:  │   │  wraps:       │
        │ character  │  │character │   │ services      │
        │ hasUnsaved │  │          │   │               │
        └────────────┘  └──────────┘   └───────────────┘
```

### 4.3 When to Use Each State Pattern

| State Type | Pattern | Examples |
|---|---|---|
| **Global domain state** (shared across pages) | Zustand store | `currentCharacter`, `characters`, `hasUnsavedChanges` |
| **Global app state** (loading, errors) | Zustand store | `isLoading`, `failedServices` |
| **Server/cached data** (5etools JSON) | TanStack Query | Spells list, class data, race data, feats, items |
| **Page-local UI state** (filters, search, selection) | `useState` / `useReducer` | Search term in spell selector, filter toggles, selected items |
| **Cross-cutting UI concerns** (theme, notifications) | React Context (theme) + Zustand (notifications) | Theme preference, notification history |
| **Derived/computed values** | `useMemo` / Zustand selectors | Total ability score with bonuses, spell slot calculations, proficiency bonus |

### 4.4 Handling the Mutable Character Object

The current `Character` class is a **mutable domain object** with behavioral methods (`addAbilityBonus()`, `addProficiency()`, `clearRacialBenefits()`). React expects immutable state updates. Two options:

**Option A: Immutable updates with spread operator (Recommended)**

```js
// In Zustand store
updateCharacterRace: (race) => set(state => {
  const char = state.currentCharacter;
  if (!char) return state;
  const updated = new Character({ ...char.toJSON(), race });
  return { currentCharacter: updated, hasUnsavedChanges: true };
}),
```

**Option B: Keep mutable Character, use Zustand's `immer` middleware**

```js
import { immer } from 'zustand/middleware/immer';

const useCharacterStore = create(immer((set) => ({
  currentCharacter: null,
  updateRace: (race) => set(state => {
    state.currentCharacter.race = race;
    state.hasUnsavedChanges = true;
  }),
})));
```

**Recommended**: Option A — reconstruct Character from serialized data. This ensures React detects changes (new object reference) and avoids subtle bugs from in-place mutation.

### 4.5 Replacing Event-Driven Communication

For each category of EventBus events, here is the React-friendly replacement:

**Character lifecycle events** (`CHARACTER_CREATED`, `CHARACTER_UPDATED`, `CHARACTER_SAVED`, `CHARACTER_DELETED`, `CHARACTER_LOADED`):
- Replace with Zustand store actions. Components subscribe to store slices and re-render automatically.
- `CHARACTER_SAVED` side effect (e.g., clear unsaved indicator) → handled inside the store action itself.

**Navigation events** (`PAGE_CHANGED`, `PAGE_LOADED`):
- Eliminated entirely. React Router handles navigation. Use `useLocation()` where route awareness is needed.

**Data loading events** (`SPELLS_LOADED`, `ITEMS_LOADED`, `DATA_LOADED`, `DATA_INVALIDATED`):
- Replaced by TanStack Query's built-in states (`isLoading`, `isSuccess`, `isError`).
- `DATA_INVALIDATED` → `queryClient.invalidateQueries()`.

**Domain events** (`ABILITY_SCORES_CHANGED`, `PROFICIENCY_ADDED`, `SPELL_ADDED`, `ITEM_ADDED`, etc.):
- These mostly represent character state mutations. Replace with Zustand store actions that update the character and cause automatic re-renders.

**Modal events** (`MODAL_OPENED`, `MODAL_CLOSED`):
- Replace with React state: `const [isOpen, setIsOpen] = useState(false)`.

---

## 5. Incremental Migration Plan

### Phase 0: Infrastructure Setup

**Goal**: Add React and Vite to the project without changing any existing functionality.

**Steps**:

1. **Install dependencies**:
   ```
   npm install react react-dom react-router-dom zustand @tanstack/react-query
   npm install -D @vitejs/plugin-react vite @testing-library/react @testing-library/jest-dom
   ```

2. **Create Vite config for Electron renderer**:
   Create `vite.renderer.config.js`:
   ```js
   import { defineConfig } from 'vite';
   import react from '@vitejs/plugin-react';
   import path from 'path';

   export default defineConfig({
     plugins: [react()],
     root: path.resolve(__dirname, 'src/renderer'),
     base: './',
     build: {
       outDir: path.resolve(__dirname, 'dist/renderer'),
       emptyOutDir: true,
     },
     resolve: {
       alias: {
         '@services': path.resolve(__dirname, 'src/services'),
         '@lib': path.resolve(__dirname, 'src/lib'),
         '@domain': path.resolve(__dirname, 'src/domain'),
       },
     },
   });
   ```

3. **Create React entry point** (`src/renderer/main.jsx`):
   ```jsx
   import React from 'react';
   import ReactDOM from 'react-dom/client';
   import { App } from './App';

   const root = ReactDOM.createRoot(document.getElementById('react-root'));
   root.render(<React.StrictMode><App /></React.StrictMode>);
   ```

4. **Create minimal App component** (`src/renderer/App.jsx`):
   ```jsx
   export function App() {
     return <div id="react-app">React is active</div>;
   }
   ```

5. **Add a `#react-root` div to `index.html`** alongside existing content (hidden initially).

6. **Update Electron main process** to load the Vite dev server in development or the built output in production. Modify `Window.js` to handle both modes.

7. **Verify**: Run the app. Existing vanilla JS functionality works unchanged. The hidden `#react-root` div renders "React is active" (verify via DevTools).

### Phase 1: Bridge Layer + Zustand Stores

**Goal**: Create Zustand stores that mirror AppState and sync bidirectionally, so React components and vanilla JS can coexist.

**Steps**:

1. **Create `src/renderer/stores/characterStore.js`**:
   ```js
   import { create } from 'zustand';

   export const useCharacterStore = create((set) => ({
     currentCharacter: null,
     characters: [],
     hasUnsavedChanges: false,
     isLoadingCharacter: false,

     setCurrentCharacter: (c) => set({ currentCharacter: c }),
     setCharacters: (c) => set({ characters: c }),
     setHasUnsavedChanges: (v) => set({ hasUnsavedChanges: v }),
     setLoadingCharacter: (v) => set({ isLoadingCharacter: v }),
   }));
   ```

2. **Create `src/renderer/stores/appStore.js`**:
   ```js
   import { create } from 'zustand';

   export const useAppStore = create((set) => ({
     isLoading: false,
     failedServices: [],
     setLoading: (v) => set({ isLoading: v }),
     setFailedServices: (s) => set({ failedServices: s }),
   }));
   ```

3. **Create bridge module** (`src/renderer/bridge.js`) that syncs AppState ↔ Zustand:
   ```js
   import { eventBus, EVENTS } from '../lib/EventBus.js';
   import { AppState } from '../app/AppState.js';
   import { useCharacterStore } from './stores/characterStore.js';
   import { useAppStore } from './stores/appStore.js';

   export function initBridge() {
     // AppState → Zustand (for events from vanilla JS)
     eventBus.on(EVENTS.CHARACTER_SELECTED, (c) => useCharacterStore.getState().setCurrentCharacter(c));
     eventBus.on(EVENTS.CHARACTER_UPDATED, (c) => useCharacterStore.getState().setCurrentCharacter(c));
     eventBus.on('state:hasUnsavedChanges:changed', (v) => useCharacterStore.getState().setHasUnsavedChanges(v));
     eventBus.on('state:isLoading:changed', (v) => useAppStore.getState().setLoading(v));
     eventBus.on('state:failedServices:changed', (v) => useAppStore.getState().setFailedServices(v));

     // Zustand → AppState (for changes from React components)
     useCharacterStore.subscribe((state, prev) => {
       if (state.currentCharacter !== prev.currentCharacter) {
         AppState.setCurrentCharacter(state.currentCharacter, { skipEvent: true });
       }
       if (state.hasUnsavedChanges !== prev.hasUnsavedChanges) {
         AppState.setHasUnsavedChanges(state.hasUnsavedChanges);
       }
     });

     // Seed Zustand from current AppState
     useCharacterStore.getState().setCurrentCharacter(AppState.getCurrentCharacter());
     useCharacterStore.getState().setCharacters(AppState.getCharacters());
     useAppStore.getState().setFailedServices(AppState.getFailedServices());
   }
   ```

4. **Call `initBridge()`** in `AppInitializer.js` after services are initialized.

5. **Verify**: Change character in vanilla UI → Zustand store updates. Change character in React component (via DevTools) → AppState updates.

### Phase 2: Migrate Leaf Components (React Islands)

**Goal**: Replace simple, self-contained UI components with React versions rendered inside the existing vanilla DOM.

**Priority order** (simplest to most complex):

1. **Titlebar** — Pure display component, no interactive state beyond button disabled states.
2. **Sidebar** — Navigation links; replace `NavController.navigateTo()` with React Router's `useNavigate()` (after routing is set up).
3. **ThemeToggle** — Simple state (`dark`/`light`) with `localStorage`.
4. **NotificationCenter** — Notification history panel.
5. **CollapsibleSection** — Stateless accordion wrapper.
6. **ServiceFailureBanner** — Reads `failedServices` from store.

**How to embed React islands in existing vanilla DOM**:

```js
// In AppInitializer.js or a new bridge file
import { createRoot } from 'react-dom/client';
import { Titlebar } from './renderer/components/layout/Titlebar';

// Mount React Titlebar into existing DOM slot
const titlebarEl = document.getElementById('app-titlebar');
if (titlebarEl) {
  const root = createRoot(titlebarEl);
  root.render(<Titlebar />);
}
```

### Phase 3: Migrate Pages (One at a Time)

**Goal**: Replace each page controller + HTML template with a React page component.

**Order** (least coupled to most coupled):

1. **SettingsPage** — Self-contained; reads/writes settings via IPC. No character dependency on most sections.
2. **HomePage** — Character list + creation modal. Requires character store.
3. **DetailsPage** — Form fields for character description. Straightforward data binding.
4. **PreviewPage** — PDF render; isolated.
5. **FeatsPage** — Feat list + selector modal. Moderate complexity.
6. **EquipmentPage** — Inventory management. Moderate complexity.
7. **SpellsPage** — Spell browser + selection. High complexity (filters, pagination, spell slots).
8. **BuildPage** — Most complex; coordinates Race, Class, Background, Ability Score, and Proficiency cards with cross-card updates.

**For each page migration**:

1. Create `src/renderer/pages/[Page]Page.jsx`.
2. Move rendering logic from the old page controller into the React component.
3. Replace `innerHTML` templates with JSX.
4. Replace `this._cleanup.on()` with React event handlers or `useEffect`.
5. Replace `this._cleanup.onEvent()` with Zustand subscriptions or `useEffect`.
6. Replace service calls with TanStack Query hooks or direct service calls in `useEffect`.
7. Delete the old page controller from `src/app/pages/`.
8. Delete the corresponding HTML template from `src/ui/pages/`.
9. Update routing to render the new React page.
10. Run existing unit tests to verify service behavior is unchanged.

### Phase 4: Replace Core Systems

**Goal**: Remove EventBus, AppState, DOMCleanup, and vanilla navigation.

**Steps**:

1. **Install React Router** and create `routes.jsx` mapping all 8 pages.
2. **Replace NavigationController** — Update sidebar to use `<NavLink>` from React Router. Remove `NavigationController.js`, `Router` class, and `PageLoader` class.
3. **Remove PageHandler** — React Router now handles page component mounting/unmounting.
4. **Remove AppState** — All state now lives in Zustand stores.
5. **Remove EventBus** — All communication now flows through Zustand stores, React props, or TanStack Query.
6. **Remove DOMCleanup** — No longer needed.
7. **Remove Notifications.js** — Replaced by `sonner`/`react-hot-toast`.
8. **Remove ModalCleanupUtility.js** — Replaced by React portals.
9. **Remove UIHandlersInitializer.js** — Event handlers are now in JSX.
10. **Remove AppInitializer.js** — Boot sequence now handled by React providers and `useEffect` in `App.jsx`.

### Phase 5: Cleanup and Optimization

**Goal**: Remove all legacy code and optimize.

1. Delete `src/app/` directory (AppState, PageHandler, NavigationController, UIHandlersInitializer, etc.).
2. Delete `src/ui/pages/` directory (HTML templates).
3. Delete `src/ui/components/` directory (vanilla JS components, replaced by `src/renderer/components/`).
4. Delete `src/lib/DOMCleanup.js`, `src/lib/EventBus.js`, `src/lib/Notifications.js`, `src/lib/ModalCleanupUtility.js`.
5. Remove `eventemitter3` from `package.json` dependencies.
6. Update `index.html` to be a minimal React mount point.
7. Update Electron's `Window.js` to load the Vite-built React app.
8. Update all tests: Replace jsdom-based unit tests for vanilla components with React Testing Library tests.
9. Update E2E tests: Selectors may change; update Playwright tests to target new React component structure.
10. Update `CODEBASE_ARCHITECTURE.md` to reflect the new React architecture.

---

## 6. Refactoring and Cleanup

### 6.1 Categories of Custom Code to Remove After React Adoption

| Category | Files | Why Removable |
|---|---|---|
| **Memory management** | `DOMCleanup.js` | React auto-manages component lifecycle |
| **Event bus** | `EventBus.js` | Zustand + React state replace pub/sub |
| **Global state** | `AppState.js` | Zustand stores |
| **Notification system** | `Notifications.js`, `NotificationCenter.js` | `sonner` or `react-hot-toast` |
| **Modal infrastructure** | `ModalCleanupUtility.js` | React portals |
| **Navigation** | `NavigationController.js`, `PageHandler.js`, `BasePageController.js` | React Router |
| **Page controllers** | `src/app/pages/*.js` (8 files) | React page components |
| **UI handlers** | `UIHandlersInitializer.js` | JSX event handlers |
| **Boot orchestration** | `AppInitializer.js` | React providers + hooks |
| **Theme management** | `ThemeManager.js` | React Context |
| **Titlebar controller** | `TitlebarController.js` | React component |
| **HTML templates** | `src/ui/pages/*.html` (8 files) | JSX |
| **Vanilla components** | `src/ui/components/**/*.js` (~65 files) | React components |

### 6.2 Rules to Avoid Recreating Custom Infrastructure in React

1. **Never create a custom EventBus in React.** If you need cross-component communication:
   - Parent→child: Use props.
   - Child→parent: Use callback props.
   - Siblings: Lift state to shared parent.
   - Distant components: Use Zustand store.

2. **Never create a custom cleanup tracker.** Use `useEffect` cleanup returns. If you find yourself building a list of things to clean up, you're fighting React.

3. **Never manually call `forceUpdate()` or equivalent.** If the UI doesn't update, the state isn't changing correctly. Fix the state, not the render.

4. **Never use `innerHTML` in React.** Use JSX. If you must inject HTML (e.g., 5etools rendered content), use `dangerouslySetInnerHTML` with sanitized input.

5. **Never use `document.getElementById()` in React components.** Use `useRef()` for DOM access.

6. **Never create global singletons for UI state.** Use Zustand stores or React Context instead.

### 6.3 Detecting Obsolete Abstractions

An agent should flag any code that:
- Imports from `src/lib/DOMCleanup.js`
- Imports from `src/lib/EventBus.js` (after Phase 4)
- Imports from `src/app/AppState.js` (after Phase 4)
- Calls `this._cleanup = DOMCleanup.create()`
- Calls `eventBus.on()`, `eventBus.emit()`, or `eventBus.off()`
- Uses `document.getElementById()` for elements that should be React-managed
- Uses `innerHTML` for rendering (except 5etools HTML output)
- Creates `new bootstrap.Modal()` manually

---

## 7. Risks and Mitigation

### 7.1 Risk Matrix

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| **Character data corruption during migration** | Medium | Critical | Never change `Character.js`, `CharacterSerializer.js`, or `CharacterSchema.js` during migration. Test save/load roundtrip after every phase. |
| **IPC contract breakage** | Low | High | Main process and Preload are untouched. Only the renderer changes. |
| **Service layer regression** | Medium | High | Services are preserved as-is. Wrap with hooks/queries rather than refactoring internals. Run existing 1313 unit tests after every change. |
| **5etools parser/renderer breakage** | Low | High | `5eToolsParser.js` and `5eToolsRenderer.js` are utility libraries with no UI dependency. Keep unchanged. |
| **CSS/theming breakage** | Medium | Medium | Keep all existing CSS files. Import them identically in React. CSS variables + utility classes work the same. |
| **CSP violations** | Medium | Medium | React does not use inline styles by default. Avoid `style={}` props for layout (use className). Dynamic values via `style={{ backgroundImage }}` are technically CSSOM, which is CSP-safe. |
| **Bootstrap 5 integration issues** | High | Medium | Bootstrap CSS classes work in JSX. Bootstrap JS (modals, tooltips) must be replaced with React equivalents (Headless UI, Radix, or controlled components). Do not mix Bootstrap JS with React-managed DOM. |
| **E2E test breakage** | High | Medium | Update selectors incrementally as each page is migrated. Maintain `data-*` attributes for test targeting. |
| **Bidirectional sync complexity (bridge period)** | Medium | Medium | Keep the bridge simple: one-directional sync per property. Remove the bridge as soon as both sides are migrated. |
| **Performance regression from re-renders** | Low | Low | Use Zustand selectors (not full store subscription), `React.memo` for heavy components, and `useMemo` for expensive computations. |

### 7.2 Detection Strategies for Fragile/Tightly Coupled Modules

**Detecting tight coupling to EventBus**:
```bash
# Count EventBus imports per file
grep -rc "from.*EventBus" src/ --include="*.js" | sort -t: -k2 -rn | head -20
```
Files with many EventBus imports are the most tightly coupled and should be migrated carefully.

**Detecting circular dependencies**:
```bash
# Look for files that both import from and are imported by AppState
grep -rl "AppState" src/ --include="*.js"
```

**Detecting direct DOM manipulation in services** (should not exist, but verify):
```bash
grep -rn "document\.\|getElementById\|querySelector" src/services/ --include="*.js"
```

**Detecting shared mutable state**:
```bash
grep -rn "AppState.getCurrentCharacter()" src/ --include="*.js" | wc -l
```
Every callsite needs migration to Zustand.

---

## 8. Example Conversions

### 8.1 RaceCard: Vanilla → React

**Before** (vanilla JS class):
```js
// src/ui/components/race/RaceCard.js (simplified)
export class RaceCard {
  constructor() {
    this._cleanup = DOMCleanup.create();
    this._detailsView = new RaceDetailsView();
    this.onBuildChange = null; // callback from BuildPageController
  }

  async initialize() {
    this._setupEventListeners();
    this._populateRaceDropdown();
    this._loadCurrentRace();
  }

  _setupEventListeners() {
    const dropdown = document.getElementById('raceSelect');
    this._cleanup.on(dropdown, 'change', (e) => this._onRaceSelected(e.target.value));

    this._cleanup.onEvent(EVENTS.CHARACTER_SELECTED, () => this._loadCurrentRace());
    this._cleanup.onEvent(EVENTS.SOURCES_ALLOWED_CHANGED, () => this._populateRaceDropdown());
  }

  async _onRaceSelected(raceName) {
    const race = await raceService.getRaceByName(raceName);
    const character = AppState.getCurrentCharacter();
    character.race = { name: race.name, source: race.source };
    AppState.setCurrentCharacter(character);
    eventBus.emit(EVENTS.CHARACTER_UPDATED, character);
    eventBus.emit(EVENTS.RACE_SELECTED, race);
    this.onBuildChange?.('race');
    this._detailsView.render(race);
  }

  _cleanupEventListeners() {
    this._cleanup.cleanup();
  }
}
```

**After** (React component):
```jsx
// src/renderer/components/race/RaceCard.jsx
import { useState, useMemo } from 'react';
import { useCharacterStore } from '../../stores/characterStore';
import { useRaces } from '../../hooks/useRaces';
import { RaceDetailsView } from './RaceDetailsView';

export function RaceCard() {
  const character = useCharacterStore(s => s.currentCharacter);
  const updateCharacter = useCharacterStore(s => s.updateCharacterRace);
  const { data: races, isLoading } = useRaces();
  const [selectedRaceDetails, setSelectedRaceDetails] = useState(null);

  const allowedRaces = useMemo(() => {
    if (!races || !character) return [];
    return races.filter(r => character.allowedSources.has(r.source));
  }, [races, character?.allowedSources]);

  const handleRaceChange = async (e) => {
    const race = races.find(r => r.name === e.target.value);
    if (!race) return;
    updateCharacter(race);
    setSelectedRaceDetails(race);
  };

  if (isLoading) return <div className="spinner" />;

  return (
    <div className="race-card">
      <select value={character?.race?.name || ''} onChange={handleRaceChange}>
        <option value="">Select a race...</option>
        {allowedRaces.map(r => (
          <option key={`${r.name}-${r.source}`} value={r.name}>{r.name}</option>
        ))}
      </select>
      {selectedRaceDetails && <RaceDetailsView race={selectedRaceDetails} />}
    </div>
  );
}
```

**What was eliminated**:
- `DOMCleanup` instance and manual `cleanup()` call
- `EventBus` subscriptions (`CHARACTER_SELECTED`, `SOURCES_ALLOWED_CHANGED`)
- `document.getElementById('raceSelect')`
- Manual `AppState.setCurrentCharacter()` + `eventBus.emit(CHARACTER_UPDATED)`
- `onBuildChange` callback wiring from `BuildPageController`
- `_cleanupEventListeners()` method

### 8.2 HomePage Character List: Vanilla → React

**Before**:
```js
// Simplified from HomePageController + CharacterCard
async _loadCharacters() {
  const result = await window.characterStorage.listCharacters();
  const container = document.getElementById('characterList');
  container.innerHTML = '';
  for (const char of result.characters) {
    const card = document.createElement('div');
    card.className = 'character-card';
    card.innerHTML = `<h3>${escapeHtml(char.name)}</h3><p>${escapeHtml(char.class)}</p>`;
    this._cleanup.on(card, 'click', () => this._selectCharacter(char.id));
    container.appendChild(card);
  }
}
```

**After**:
```jsx
function CharacterList() {
  const [characters, setCharacters] = useState([]);
  const selectCharacter = useCharacterStore(s => s.selectCharacter);

  useEffect(() => {
    window.characterStorage.listCharacters().then(r => setCharacters(r.characters || []));
  }, []);

  return (
    <div className="character-list">
      {characters.map(char => (
        <div key={char.id} className="character-card" onClick={() => selectCharacter(char.id)}>
          <h3>{char.name}</h3>
          <p>{char.class}</p>
        </div>
      ))}
    </div>
  );
}
```

### 8.3 AppInitializer Boot Sequence: Vanilla → React

**Before** (`AppInitializer.js` — orchestrates 13 services + 7 core components):
```js
export async function initializeApp() {
  const loadingModal = new LoadingModal();
  loadingModal.show();

  const dataFolder = await _checkDataFolder();
  const { failedServices } = await _loadAllGameData(loadingModal);
  await _initializeCoreComponents();
  _uiHandlersCleanup = setupUiEventHandlers();

  loadingModal.hide();
  eventBus.emit(EVENTS.APP_READY);
}
```

**After** (React providers + Suspense):
```jsx
// src/renderer/App.jsx
function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </ThemeProvider>
  );
}

// src/renderer/providers/ServiceProvider.jsx
function ServiceProvider({ children }) {
  const { isLoading, error } = useInitializeServices();

  if (isLoading) return <LoadingScreen />;
  if (error) return <DataConfigScreen error={error} />;

  return children;
}

// src/renderer/hooks/useInitializeServices.js
function useInitializeServices() {
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function init() {
      const valid = await validateDataSource();
      if (!valid.ok) { setError(valid.error); setLoading(false); return; }

      const results = await Promise.allSettled([
        spellService.initialize(),
        classService.initialize(),
        raceService.initialize(),
        // ... other services
      ]);

      const failures = results.filter(r => r.status === 'rejected');
      if (failures.length) useAppStore.getState().setFailedServices(failures.map(f => f.reason));

      setLoading(false);
    }
    init();
  }, []);

  return { isLoading, error };
}
```

---

## 9. AI-Agent Execution Guidance

### 9.1 General Execution Rules

1. **Never modify files in `src/main/`** — the Electron main process is not part of this migration.
2. **Never modify `Character.js`, `CharacterSerializer.js`, or `CharacterSchema.js`** — domain logic stays unchanged.
3. **Never modify service files in `src/services/`** during Phases 0–2. In Phase 3, only remove EventBus emissions; do not change business logic.
4. **Run `npm test` after every file change** to ensure no regressions.
5. **Run `npm start` after completing each phase** to verify the app launches and basic functionality works.
6. **Keep the bridge (`bridge.js`) active until Phase 4** — it ensures vanilla JS and React can coexist.

### 9.2 How to Identify Candidate Files for Migration

**To find all vanilla UI component files**:
```bash
find src/ui/components -name "*.js" -type f
```

**To find all page controllers**:
```bash
ls src/app/pages/
```

**To find all EventBus subscribers** (need migration during Phase 3–4):
```bash
grep -rn "eventBus.on\|_cleanup.onEvent\|EVENTS\." src/ui/ src/app/ --include="*.js"
```

**To find all AppState consumers** (need migration to Zustand):
```bash
grep -rn "AppState\." src/ui/ src/app/ --include="*.js"
```

**To find all DOMCleanup users** (need React lifecycle migration):
```bash
grep -rn "DOMCleanup\|this._cleanup" src/ui/ src/app/ --include="*.js"
```

**To find all `document.getElementById` calls** (need `useRef` or React state):
```bash
grep -rn "document.getElementById\|document.querySelector" src/ui/ src/app/ --include="*.js"
```

**To find all `innerHTML` assignments** (need JSX conversion):
```bash
grep -rn "\.innerHTML\s*=" src/ui/ src/app/ --include="*.js"
```

### 9.3 Per-File Migration Procedure

For each vanilla component file being migrated to React:

1. **Read the original file** thoroughly. Identify:
   - Constructor parameters and initial state.
   - EventBus subscriptions (`this._cleanup.onEvent()`).
   - DOM element references (`document.getElementById()`).
   - DOM manipulation (`innerHTML`, `createElement`, `classList`).
   - Service calls.
   - AppState reads/writes.
   - DOMCleanup registrations.
   - Inter-component callbacks (`onBuildChange`, etc.).

2. **Create the React component file** in `src/renderer/components/[category]/[Name].jsx`:
   - Convert constructor state to `useState` or `useReducer`.
   - Convert EventBus subscriptions to Zustand store subscriptions.
   - Convert DOM reads to `useRef` or store reads.
   - Convert DOM writes to JSX with state-driven rendering.
   - Convert service calls to TanStack Query hooks or `useEffect`.
   - Convert inter-component callbacks to Zustand actions or lifted state.

3. **Create or update the corresponding hook** in `src/renderer/hooks/` if the component needs reusable data-fetching or business logic.

4. **Mount the React component**:
   - During bridge period: Use `createRoot` to render into the existing DOM slot.
   - After React Router is active: Import into the page component.

5. **Delete the original vanilla file** once the React version is verified.

6. **Update imports** in any file that referenced the deleted vanilla component.

7. **Run tests** (`npm test`) to verify no regressions.

### 9.4 Phase Execution Checklist

**Phase 0 Completion Criteria**:
- [ ] `react`, `react-dom`, `vite`, `@vitejs/plugin-react` installed
- [ ] `vite.renderer.config.js` created
- [ ] `src/renderer/main.jsx` created
- [ ] `src/renderer/App.jsx` created
- [ ] `#react-root` div added to `index.html`
- [ ] App runs without errors; React renders in hidden div
- [ ] All 1313 unit tests pass

**Phase 1 Completion Criteria**:
- [ ] `src/renderer/stores/characterStore.js` created
- [ ] `src/renderer/stores/appStore.js` created
- [ ] `src/renderer/bridge.js` created and called during boot
- [ ] Bidirectional sync verified: vanilla change → Zustand updates; Zustand change → AppState updates
- [ ] All 1313 unit tests pass

**Phase 2 Completion Criteria**:
- [ ] Titlebar rendered by React (reads from Zustand store)
- [ ] Theme toggle rendered by React (ThemeProvider)
- [ ] ServiceFailureBanner rendered by React (reads from appStore)
- [ ] Sidebar rendered by React (navigation links work)
- [ ] NotificationCenter rendered by React
- [ ] App runs without errors; migrated components display correctly
- [ ] All unit tests pass

**Phase 3 Completion Criteria** (per page):
- [ ] React page component created in `src/renderer/pages/`
- [ ] All sub-components created in `src/renderer/components/`
- [ ] Page renders correctly with all interactive features
- [ ] Old page controller deleted from `src/app/pages/`
- [ ] Old HTML template deleted from `src/ui/pages/`
- [ ] Character save/load roundtrip works correctly
- [ ] All unit tests pass

**Phase 4 Completion Criteria**:
- [ ] React Router handles all navigation
- [ ] `NavigationController.js` deleted
- [ ] `PageHandler.js` deleted
- [ ] `BasePageController.js` deleted
- [ ] `AppState.js` deleted
- [ ] `EventBus.js` deleted (or reduced to only service-internal use if any remain)
- [ ] `DOMCleanup.js` deleted
- [ ] `Notifications.js` deleted
- [ ] `ModalCleanupUtility.js` deleted
- [ ] `UIHandlersInitializer.js` deleted
- [ ] `bridge.js` deleted
- [ ] All unit tests pass (with updated service tests)
- [ ] E2E tests updated and passing

**Phase 5 Completion Criteria**:
- [ ] `src/app/` directory deleted (or reduced to `Character.js`, `CharacterSerializer.js`, `CharacterManager.js` moved to `src/domain/`)
- [ ] `src/ui/components/` directory deleted
- [ ] `src/ui/pages/` directory deleted
- [ ] `eventemitter3` removed from `package.json`
- [ ] No imports from deleted files exist in the codebase
- [ ] `CODEBASE_ARCHITECTURE.md` updated
- [ ] All tests pass
- [ ] App runs correctly end-to-end

### 9.5 Files That Must Not Be Modified During Migration

| File | Reason |
|---|---|
| `src/main/Main.js` | Electron main process; out of scope |
| `src/main/Preload.cjs` | IPC bridge; must remain stable |
| `src/main/Window.js` | Window lifecycle (modify only to load Vite output in Phase 0) |
| `src/main/ipc/*.js` | IPC handlers; out of scope |
| `src/main/Settings.js` | Preferences; out of scope |
| `src/app/Character.js` | Domain model; preserve exactly |
| `src/app/CharacterSerializer.js` | Serialization; preserve exactly |
| `src/lib/CharacterSchema.js` | Validation schema; preserve exactly |
| `src/lib/5eToolsParser.js` | Parser utilities; preserve exactly |
| `src/lib/5eToolsRenderer.js` | Rendering utilities; preserve exactly |
| `src/lib/Errors.js` | Error classes; preserve exactly |
| `src/lib/GameRules.js` | Game rules constants; preserve exactly |
| `src/lib/ValidationSchemas.js` | Input validation; preserve exactly |
| `src/data/*.json` | Data files; never modified |

### 9.6 CSS Migration Notes

All existing CSS files in `src/ui/styles/` are imported via `main.css`. In React:

1. Import `src/ui/styles/main.css` in `src/renderer/main.jsx` (or Vite entry point).
2. Use `className` instead of `class` in JSX.
3. Use existing utility classes (`u-hidden`, `u-block`, etc.) directly in `className`.
4. Bootstrap CSS classes work identically in JSX.
5. Do not use `style={{}}` props for layout — follow existing CSP rules. Use existing CSS classes or add new ones to `src/ui/styles/`.
6. CSS variable theming (`data-theme` attribute) works unchanged.

### 9.7 Testing Migration Notes

1. **Service unit tests** (`tests/unit/services/`) — These test pure business logic and should pass unchanged throughout the migration. Run them after every change.
2. **Library unit tests** (`tests/unit/lib/`) — Tests for `EventBus`, `DOMCleanup`, etc. will be deleted when the corresponding modules are removed.
3. **Component tests** — Current vanilla component tests (if any) will be replaced with React Testing Library tests.
4. **New React component tests** — Write using `@testing-library/react`:
   ```js
   import { render, screen, fireEvent } from '@testing-library/react';
   import { Titlebar } from '../src/renderer/components/layout/Titlebar';

   test('shows character name', () => {
     useCharacterStore.setState({ currentCharacter: { name: 'Gandalf' } });
     render(<Titlebar />);
     expect(screen.getByText('Gandalf')).toBeInTheDocument();
   });
   ```
5. **E2E tests** — Update Playwright selectors as components are migrated. Maintain `data-testid` attributes on React components for test targeting.
