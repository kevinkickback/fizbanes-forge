# PDF Export & Preview — Action Plan

> Implementation plan for filling form-fillable PDFs with character data and previewing results before export.

---

## Table of Contents

- [Executive Summary](#executive-summary)
- [Research Findings](#research-findings)
  - [Character Data Structure](#character-data-structure)
  - [PDF Library Evaluation](#pdf-library-evaluation)
  - [PDF Preview Options](#pdf-preview-options)
  - [CSP Constraints](#csp-constraints)
  - [Existing Infrastructure](#existing-infrastructure)
- [Architecture Decision: Preview Strategy](#architecture-decision-preview-strategy)
- [Implementation Phases](#implementation-phases)
  - [Phase 1 — Foundation](#phase-1--foundation-ipc-channels-dependencies-field-mapping)
  - [Phase 2 — PDF Generation](#phase-2--pdf-generation-main-process)
  - [Phase 3 — Preview Page](#phase-3--preview-page-renderer)
  - [Phase 4 — Template Management](#phase-4--template-management-settings-ui)
  - [Phase 5 — Polish & Testing](#phase-5--polish--testing)
- [File Manifest](#file-manifest)
- [Field Mapping Reference](#field-mapping-reference)
- [Risk Register](#risk-register)

---

## Executive Summary

Users want to fill their own form-fillable PDF character sheets with saved character data and preview the result before exporting. The implementation spans both the **main process** (PDF manipulation, file I/O) and the **renderer** (preview page, template settings), connected via IPC following the existing architecture. The preview page already has a registered route and stub controller — it needs to be built out.

**Key decisions:**
- **pdf-lib** for PDF form filling (pure JS, zero native deps, MIT license)
- **pdf.js (pdfjs-dist)** for rendering PDF preview as canvas images in the renderer
- **Canvas-based preview** (not iframe/embed) to comply with existing CSP
- Preview lives on the already-registered **`preview` page route**, not in a modal
- PDF generation and filling happen exclusively in the **main process**

---

## Research Findings

### Character Data Structure

The `Character` class ([src/app/Character.js](../src/app/Character.js)) and its serializer ([src/app/CharacterSerializer.js](../src/app/CharacterSerializer.js)) produce a JSON object with these mappable fields:

| Category | Fields | Notes |
|----------|--------|-------|
| **Identity** | `name`, `playerName`, `race.name`, `race.subrace`, `background.name`, `alignment`, `gender`, `deity` | All strings |
| **Ability Scores** | `abilityScores.{strength,dexterity,constitution,intelligence,wisdom,charisma}` | Base integers (8–20) |
| **Ability Bonuses** | `abilityBonuses.{ability}[]` | Array of `{value, source}` — must be summed for final score |
| **Class/Level** | `progression.classes[].{name, levels, subclass, hitDice}` | Multi-class array |
| **Hit Points** | `hitPoints.{current, max, temp}` | |
| **Proficiencies** | `proficiencies.{armor, weapons, tools, skills, languages, savingThrows}` | String arrays |
| **Feats** | `feats[].{name, source}` | |
| **Features/Traits** | `features.{darkvision, resistances, traits}` | traits is a Map→Object |
| **Physical** | `height`, `weight`, `size`, `speed.{walk, fly, swim, climb, burrow}` | |
| **Backstory** | `backstory` | Long text |
| **Portrait** | `portrait` | File path string |
| **Inventory** | `inventory.items[].{name, quantity, equipped, weight, ...}` | |
| **Spellcasting** | `spellcasting.classes`, `spellcasting.other.spellsKnown[]` | Complex nested |
| **Computed** | Ability modifiers, proficiency bonus, saving throws, skill modifiers | Must be calculated at export time |

### PDF Library Evaluation

| Library | Native Deps | Electron Safe | Form Fill | Image Embed | Status | Weekly DL |
|---------|-------------|---------------|-----------|-------------|--------|-----------|
| **pdf-lib** | None (pure JS) | Yes | Full AcroForm | PNG + JPEG | Stable (1.17.1) | ~3.1M |
| pdffiller | pdftk binary | Fragile | Via pdftk CLI | No | Abandoned (7yr) | ~3.3K |
| pdf-fill-form | C++ native | Build issues | Basic | No | Abandoned | N/A |
| hummus/muhammara | C++ native | Build issues | Yes | Yes | Fragile | N/A |

**Decision: `pdf-lib`** — zero native dependencies is critical for Electron packaging. It directly supports the exact use case (its own docs use a D&D character sheet as the form-filling example). MIT license.

Optional companion: **`@pdf-lib/fontkit`** — needed only if users have PDFs containing non-Latin text fields. Low priority.

### PDF Preview Options

| Approach | How | CSP OK? | Quality | Complexity |
|----------|-----|---------|---------|------------|
| **A. Canvas rendering via pdf.js** | `pdfjs-dist` renders each page to `<canvas>` | Yes | Excellent | Medium |
| B. `<iframe src="blob:...">` | Generate blob URL from PDF bytes | No — needs CSP `frame-src blob:` | Native | Low (but CSP change) |
| C. `<object>` / `<embed>` | Embed PDF viewer | No — `object-src 'none'` | Native | Low (but CSP change) |
| D. Temp file + `<webview>` | Write PDF to temp, load in webview | Possible | Native | High (security) |
| E. HTML-only preview (no actual PDF) | Render character data as styled HTML mimicking the sheet | Yes | Approximate | High (layout) |

**Decision: Option A — pdf.js canvas rendering.** It works within the current CSP, provides pixel-accurate preview of the actual filled PDF, and `pdfjs-dist` is the industry standard (8.8M weekly downloads, maintained by Mozilla). The filled PDF bytes are generated in main, sent to renderer via IPC, and rendered to canvas elements.

### CSP Constraints

Current CSP from [src/ui/index.html](../src/ui/index.html):

```
default-src 'self';
script-src 'self' 'sha256-...';
style-src 'self';
img-src 'self' data:;
font-src 'self' data:;
connect-src 'self';
object-src 'none';
base-uri 'self'
```

**Impact:**
- `object-src 'none'` blocks `<object>` and `<embed>` — cannot embed a PDF viewer directly
- `default-src 'self'` blocks `blob:` and `data:` URLs for frames
- `img-src 'self' data:` — canvas `toDataURL()` works for images
- **No CSP changes needed for the canvas approach** — pdf.js renders to `<canvas>` elements which are not restricted by CSP. The PDF bytes arrive via IPC (not network fetch), so `connect-src` is not involved.

### Existing Infrastructure

**What already exists and can be reused:**

| Asset | Location | Status |
|-------|----------|--------|
| `preview` route registration | [NavigationController.js](../src/app/NavigationController.js) L207–211 | Registered, expects `preview.html` |
| `PreviewPageController` | [src/app/pages/PreviewPageController.js](../src/app/pages/PreviewPageController.js) | Stub — needs implementation |
| `PageHandler` mapping | [src/app/PageHandler.js](../src/app/PageHandler.js) | Already maps `'preview'` → `PreviewPageController` |
| `BasePageController` | [src/app/pages/BasePageController.js](../src/app/pages/BasePageController.js) | Provides `_trackListener()` and auto-cleanup |
| `CHARACTER_EXPORT` handler pattern | [CharacterHandlers.js](../src/main/ipc/CharacterHandlers.js) L150–190 | Pattern to follow: validate ID → resolve path → dialog → write |
| `Preload.cjs` `characterStorage` namespace | [Preload.cjs](../src/main/Preload.cjs) L82–113 | Add new methods here |
| Sidebar nav (missing preview button) | [index.html](../src/ui/index.html) L76–161 | Needs a new `<li>` for preview |
| `preview.html` template | `src/ui/pages/` | **Does not exist yet** — must be created |
| `page-preview.css` | `src/ui/styles/` | **Does not exist yet** — must be created |
| PDF-related EventBus events | [EventBus.js](../src/lib/EventBus.js) | None exist — add if needed |

---

## Architecture Decision: Preview Strategy

The preview page operates in this flow:

```
┌─────────────────────────────────────┐
│           RENDERER                  │
│                                     │
│  User navigates to Preview page     │
│           │                         │
│           ▼                         │
│  PreviewPageController.initialize() │
│           │                         │
│           ▼                         │
│  Calls IPC: fillPdfPreview(         │
│    characterId, templatePath)       │
│           │                         │
└───────────┼─────────────────────────┘
            │ IPC
┌───────────┼─────────────────────────┐
│           ▼        MAIN PROCESS     │
│  PdfExporter.generateFilledPdf()    │
│    1. Read template PDF bytes       │
│    2. Read character .ffp JSON      │
│    3. Map fields → form fields      │
│    4. Fill via pdf-lib              │
│    5. Embed portrait if present     │
│    6. pdfDoc.save() → Uint8Array    │
│    7. Return bytes to renderer      │
└───────────┼─────────────────────────┘
            │ IPC response (Uint8Array)
┌───────────┼─────────────────────────┐
│           ▼        RENDERER         │
│  PdfPreviewRenderer                 │
│    1. Load bytes into pdfjs-dist    │
│    2. Render each page to <canvas>  │
│    3. Display in scrollable area    │
│    4. Show "Export PDF" button       │
│           │                         │
│           ▼ (user clicks Export)    │
│  Calls IPC: exportPdf(             │
│    characterId, templatePath)       │
│           │                         │
└───────────┼─────────────────────────┘
            │ IPC
┌───────────┼─────────────────────────┐
│           ▼        MAIN PROCESS     │
│  Same fill logic + Save dialog      │
│  Write filled PDF to user's path    │
│  Return { success, path }           │
└─────────────────────────────────────┘
```

---

## Implementation Phases

### Phase 1 — Foundation (IPC channels, dependencies, field mapping)

**Install dependencies:**

```bash
npm install pdf-lib pdfjs-dist
```

Optional (for non-Latin font support):
```bash
npm install @pdf-lib/fontkit
```

**1.1 — Add IPC channels** in [src/main/ipc/channels.js](../src/main/ipc/channels.js):

```js
// PDF export operations
CHARACTER_EXPORT_PDF: 'character:exportPdf',
CHARACTER_PDF_PREVIEW: 'character:pdfPreview',
CHARACTER_PDF_INSPECT: 'character:pdfInspect',
PDF_SELECT_TEMPLATE: 'pdf:selectTemplate',
```

| Channel | Purpose |
|---------|---------|
| `CHARACTER_PDF_PREVIEW` | Generate filled PDF bytes and return to renderer (no save dialog) |
| `CHARACTER_EXPORT_PDF` | Generate filled PDF bytes and save via native dialog |
| `CHARACTER_PDF_INSPECT` | Read a PDF template and return its form field names/types |
| `PDF_SELECT_TEMPLATE` | Open file picker filtered to `.pdf` files |

**1.2 — Mirror channels in [src/main/Preload.cjs](../src/main/Preload.cjs):**

Add to the `IPC_CHANNELS` object:
```js
CHARACTER_EXPORT_PDF: 'character:exportPdf',
CHARACTER_PDF_PREVIEW: 'character:pdfPreview',
CHARACTER_PDF_INSPECT: 'character:pdfInspect',
PDF_SELECT_TEMPLATE: 'pdf:selectTemplate',
```

Add to the `characterStorage` bridge:
```js
exportPdf: (id, templatePath) =>
    ipcRenderer.invoke(IPC_CHANNELS.CHARACTER_EXPORT_PDF, id, templatePath),
previewPdf: (id, templatePath) =>
    ipcRenderer.invoke(IPC_CHANNELS.CHARACTER_PDF_PREVIEW, id, templatePath),
inspectPdfTemplate: (templatePath) =>
    ipcRenderer.invoke(IPC_CHANNELS.CHARACTER_PDF_INSPECT, templatePath),
selectPdfTemplate: () =>
    ipcRenderer.invoke(IPC_CHANNELS.PDF_SELECT_TEMPLATE),
```

**1.3 — Create field mapping module** `src/main/pdf/FieldMapping.js`:

This module defines the translation from `Character` JSON → PDF form field names. It should ship with a **default mapping** for the standard WotC 5e character sheet and support **user-customizable mappings** stored in settings.

Core responsibilities:
- `buildFieldMap(characterData)` → `{ pdfFieldName: value }` dictionary
- Calculate derived values (ability modifiers, proficiency bonus, saving throws, skill bonuses, passive perception, initiative, AC)
- Format multi-value fields (class levels, proficiency lists, spell lists)
- Handle checkboxes (proficiency dots, death saves) vs text fields

**1.4 — Create PDF processor module** `src/main/pdf/PdfExporter.js`:

```
generateFilledPdf(characterData, templatePath) → Uint8Array
inspectTemplate(templatePath) → { fields: [{ name, type }] }
```

This module uses `pdf-lib` to:
1. Load the template PDF
2. Get the form via `pdfDoc.getForm()`
3. Iterate the field map and fill each field (text fields via `setText()`, checkboxes via `check()`/`uncheck()`, buttons/images via `setImage()`)
4. Optionally embed the portrait image
5. Return the filled PDF as bytes

---

### Phase 2 — PDF Generation (main process)

**2.1 — Register IPC handlers** in [src/main/ipc/CharacterHandlers.js](../src/main/ipc/CharacterHandlers.js) (or a new `PdfHandlers.js`):

**`CHARACTER_PDF_PREVIEW` handler:**
1. Receive `(characterId, templatePath)`
2. Read character JSON from `.ffp` file
3. Call `PdfExporter.generateFilledPdf(characterData, templatePath)`
4. Return `{ success: true, pdfBytes: Array.from(uint8Array) }` (IPC transfers arrays, not Uint8Array)

**`CHARACTER_EXPORT_PDF` handler:**
1. Same as preview but also shows a native Save dialog
2. Writes the PDF bytes to the user's chosen path
3. Returns `{ success: true, path }`

**`CHARACTER_PDF_INSPECT` handler:**
1. Receive `(templatePath)`
2. Load PDF, enumerate all form fields via `form.getFields()`
3. Return `{ success: true, fields: [{ name, type }] }`

**`PDF_SELECT_TEMPLATE` handler:**
1. Show native Open dialog filtered to `*.pdf`
2. Return `{ success: true, path }` or `{ success: false, canceled: true }`

**2.2 — Register the new handlers** in [src/main/Main.js](../src/main/Main.js) (import and call the registration function).

---

### Phase 3 — Preview Page (renderer)

**3.1 — Create `src/ui/pages/preview.html`:**

```html
<div class="preview-page">
    <!-- Toolbar -->
    <div class="preview-toolbar">
        <div class="preview-toolbar-left">
            <button class="btn btn-outline-secondary" id="previewSelectTemplate">
                <i class="fas fa-file-pdf"></i> Select Template
            </button>
            <span class="preview-template-name" id="previewTemplateName">
                No template selected
            </span>
        </div>
        <div class="preview-toolbar-right">
            <button class="btn btn-outline-secondary" id="previewRefresh">
                <i class="fas fa-sync-alt"></i> Refresh
            </button>
            <button class="btn btn-primary" id="previewExportBtn" disabled>
                <i class="fas fa-download"></i> Export PDF
            </button>
        </div>
    </div>

    <!-- Preview Area -->
    <div class="preview-canvas-container" id="previewCanvasContainer">
        <!-- Empty state -->
        <div class="preview-empty-state" id="previewEmptyState">
            <i class="fas fa-file-pdf fa-3x"></i>
            <h5>Select a PDF Template</h5>
            <p>Choose a form-fillable character sheet PDF to preview your character.</p>
            <button class="btn btn-primary" id="previewEmptySelectBtn">
                <i class="fas fa-folder-open"></i> Browse...
            </button>
        </div>

        <!-- Loading state -->
        <div class="preview-loading u-hidden" id="previewLoading">
            <div class="spinner"></div>
            <p>Generating preview...</p>
        </div>

        <!-- Canvas pages rendered here by PdfPreviewRenderer -->
    </div>

    <!-- Page indicator -->
    <div class="preview-page-indicator u-hidden" id="previewPageIndicator">
        Page <span id="previewCurrentPage">1</span> of <span id="previewTotalPages">1</span>
    </div>
</div>
```

**3.2 — Create `src/ui/styles/page-preview.css`:**

Styles for the preview toolbar, canvas container (scrollable, centered), loading/empty states, and page indicator. All values via CSS custom properties from `core-variables.css`.

Link it in `index.html` alongside other page CSS files.

**3.3 — Add sidebar nav button** in [src/ui/index.html](../src/ui/index.html):

Insert after the Details nav item, before Settings:

```html
<li class="nav-item">
    <button class="nav-link" data-page="preview">
        <i class="fas fa-file-pdf"></i>
        <span>Export</span>
    </button>
</li>
```

**3.4 — Implement `PreviewPageController`** in [src/app/pages/PreviewPageController.js](../src/app/pages/PreviewPageController.js):

Replace the stub with full implementation:

```
initialize():
  1. Get current character from AppState
  2. Check if a template path is stored in settings
  3. If template exists → call generatePreview()
  4. Bind button event listeners (select template, refresh, export)
  5. Track CHARACTER_UPDATED event to auto-refresh preview

generatePreview():
  1. Show loading state
  2. Call window.characterStorage.previewPdf(characterId, templatePath)
  3. Pass returned bytes to PdfPreviewRenderer.render()
  4. Enable Export button

handleExport():
  1. Call window.characterStorage.exportPdf(characterId, templatePath)
  2. Show success/error notification

handleSelectTemplate():
  1. Call window.characterStorage.selectPdfTemplate()
  2. Store selected path in settings
  3. Call generatePreview()

cleanup():
  1. Destroy PdfPreviewRenderer canvases
  2. Call super.cleanup() for EventBus listener removal
```

**3.5 — Create `src/ui/components/preview/PdfPreviewRenderer.js`:**

This renderer component uses `pdfjs-dist` to paint PDF pages onto `<canvas>` elements:

```
render(pdfBytes, containerElement):
  1. Clear previous canvases
  2. Load PDF: pdfjs.getDocument({ data: pdfBytes })
  3. For each page:
     a. page.getViewport({ scale })
     b. Create <canvas>, set dimensions
     c. page.render({ canvasContext, viewport })
     d. Append canvas to container
  4. Update page indicator

destroy():
  1. Remove all created canvas elements
  2. Destroy pdfjs document reference
```

**Important — pdfjs-dist worker setup:**
`pdfjs-dist` requires a web worker for parsing. In Electron, configure the worker source path:
```js
import * as pdfjsLib from 'pdfjs-dist';
pdfjsLib.GlobalWorkerOptions.workerSrc = '../../node_modules/pdfjs-dist/build/pdf.worker.mjs';
```

The import map in `index.html` will need an entry for `pdfjs-dist`:
```json
"pdfjs-dist": "../../node_modules/pdfjs-dist/build/pdf.mjs"
```

Add `pdfjs-dist` worker to CSP `script-src` if needed, or use the inline worker fallback.

---

### Phase 4 — Template Management (settings UI)

**4.1 — Add PDF template setting:**

Store in `electron-store` via existing settings IPC:
- `pdfTemplatePath` — last-used template file path
- `pdfFieldMapping` — (future) custom field name overrides

**4.2 — Template inspection UI (v2 feature):**

A "Configure Mapping" button on the preview page that:
1. Calls `inspectPdfTemplate(path)` to get all field names from the PDF
2. Displays a two-column mapping UI: left = app field labels, right = detected PDF field names
3. User matches them via dropdowns
4. Saves custom mapping to settings

This is a stretch goal — the default WotC 5e field mapping will cover the majority of use cases initially.

---

### Phase 5 — Polish & Testing

**5.1 — Unit tests** (`tests/unit/`):

| Test file | Coverage |
|-----------|----------|
| `PdfExporter.test.js` | Field mapping logic, modifier calculations, multi-class formatting |
| `FieldMapping.test.js` | Character data → field dictionary conversion, edge cases (empty fields, missing data) |

**5.2 — E2E tests** (`tests/e2e/`):

| Test | What it verifies |
|------|------------------|
| `pdf-export.spec.js` | Navigate to preview page, select template, verify canvas rendered, export triggers save dialog |

**5.3 — Error handling:**

| Error case | Handling |
|------------|----------|
| Template PDF is encrypted | Catch `EncryptedPDFError`, show notification "This PDF is encrypted and cannot be used as a template" |
| Template has no form fields | Detect via `form.getFields().length === 0`, show warning notification |
| Field name doesn't exist in template | `try/catch` per field, skip missing fields silently, log in debug mode |
| Character has no data for a field | Fill with empty string, don't crash |
| Portrait file missing/corrupt | Catch embed error, skip portrait, log warning |
| PDF generation fails | Return `{ success: false, error }`, show notification in renderer |
| IPC transfer size (large PDFs) | PDFs are typically 1–5MB — well within IPC limits. Monitor. |

**5.4 — Update documentation:**

- Add `CHARACTER_EXPORT_PDF`, `CHARACTER_PDF_PREVIEW`, `CHARACTER_PDF_INSPECT`, `PDF_SELECT_TEMPLATE` to [docs/IPC_CONTRACTS.md](../docs/IPC_CONTRACTS.md)
- Add PDF export section to [docs/CODEBASE_ARCHITECTURE.md](../docs/CODEBASE_ARCHITECTURE.md) feature crosswalk
- Update this action plan with any implementation deviations

---

## File Manifest

### New Files

| File | Layer | Purpose |
|------|-------|---------|
| `src/main/pdf/PdfExporter.js` | Main | pdf-lib integration — load template, fill fields, embed images, return bytes |
| `src/main/pdf/FieldMapping.js` | Main | Character JSON → PDF field name translation + computed values |
| `src/main/ipc/PdfHandlers.js` | Main | IPC handlers for PDF preview, export, inspect, template select |
| `src/ui/pages/preview.html` | Renderer | Preview page HTML template |
| `src/ui/styles/page-preview.css` | Renderer | Preview page styles |
| `src/ui/components/preview/PdfPreviewRenderer.js` | Renderer | pdf.js canvas rendering component |

### Modified Files

| File | Change |
|------|--------|
| `src/main/ipc/channels.js` | Add 4 new channel constants |
| `src/main/Preload.cjs` | Add channel constants + `characterStorage` bridge methods |
| `src/main/Main.js` | Import and register `PdfHandlers` |
| `src/ui/index.html` | Add preview nav button, link `page-preview.css`, add `pdfjs-dist` to import map |
| `src/app/pages/PreviewPageController.js` | Replace stub with full implementation |
| `package.json` | Add `pdf-lib` and `pdfjs-dist` dependencies |

### New Test Files

| File | Type |
|------|------|
| `tests/unit/PdfExporter.test.js` | Unit |
| `tests/unit/FieldMapping.test.js` | Unit |
| `tests/e2e/pdf-export.spec.js` | E2E |

---

## Field Mapping Reference

Default mapping for the standard WotC 5e character sheet. PDF field names vary by sheet — this covers the most common ones.

### Text Fields

| Character Data | PDF Field Name | Computation |
|---------------|----------------|-------------|
| `name` | `CharacterName` / `CharacterName 2` | Direct |
| `playerName` | `PlayerName` | Direct |
| `race.name` + `race.subrace` | `Race` | Concatenate with space |
| `progression.classes` | `ClassLevel` | Format: `"Fighter 5 / Wizard 3"` |
| `background.name` | `Background` | Direct |
| `alignment` | `Alignment` | Direct |
| `abilityScores.strength` + bonuses | `STR` | Sum base + all bonuses |
| Ability modifier | `STRmod` | `Math.floor((score - 10) / 2)`, with sign |
| (repeat for DEX, CON, INT, WIS, CHA) | `DEX`, `DEXmod`, etc. | Same pattern |
| Proficiency bonus | `ProfBonus` | `Math.floor((totalLevel - 1) / 4) + 2` |
| Hit point max | `HPMax` | Direct from `hitPoints.max` |
| Hit point current | `HPCurrent` | Direct from `hitPoints.current` |
| Hit dice | `HDTotal` / `HD` | From `progression.classes[].hitDice` |
| Speed | `Speed` | `speed.walk` + ft |
| Initiative | `Initiative` | DEX modifier (+ any bonuses) |
| Passive Perception | `Passive` | `10 + WIS mod + (proficient in Perception ? profBonus : 0)` |
| `height` | `Height` | Direct |
| `weight` | `Weight` | Direct |
| `backstory` | `Backstory` | Direct |
| Features/traits | `Features and Traits` / `Feat+Traits` | Join trait names with newlines |
| Proficiencies (all) | `ProficienciesLang` | Join all proficiency arrays with commas |
| Equipment list | `Equipment` | Join inventory item names with newlines |

### Skill Check Fields

Each skill has a modifier field and a proficiency checkbox:

| Skill | Modifier Field | Proficiency Checkbox | Base Ability |
|-------|---------------|---------------------|--------------|
| Acrobatics | `Acrobatics` | `Check Box 23` | DEX |
| Animal Handling | `Animal` | `Check Box 24` | WIS |
| Arcana | `Arcana` | `Check Box 25` | INT |
| Athletics | `Athletics` | `Check Box 26` | STR |
| Deception | `Deception` | `Check Box 27` | CHA |
| History | `History` | `Check Box 28` | INT |
| Insight | `Insight` | `Check Box 29` | WIS |
| Intimidation | `Intimidation` | `Check Box 30` | CHA |
| Investigation | `Investigation` | `Check Box 31` | INT |
| Medicine | `Medicine` | `Check Box 32` | WIS |
| Nature | `Nature` | `Check Box 33` | INT |
| Perception | `Perception` | `Check Box 34` | WIS |
| Performance | `Performance` | `Check Box 35` | CHA |
| Persuasion | `Persuasion` | `Check Box 36` | CHA |
| Religion | `Religion` | `Check Box 37` | INT |
| Sleight of Hand | `SleightofHand` | `Check Box 38` | DEX |
| Stealth | `Stealth` | `Check Box 39` | DEX |
| Survival | `Survival` | `Check Box 40` | WIS |

### Saving Throw Fields

| Save | Modifier Field | Proficiency Checkbox | 
|------|---------------|---------------------|
| STR | `ST Strength` | `Check Box 11` |
| DEX | `ST Dexterity` | `Check Box 18` |
| CON | `ST Constitution` | `Check Box 19` |
| INT | `ST Intelligence` | `Check Box 20` |
| WIS | `ST Wisdom` | `Check Box 21` |
| CHA | `ST Charisma` | `Check Box 22` |

### Image Fields

| Character Data | PDF Field Name | Type |
|---------------|----------------|------|
| `portrait` | `CHARACTER IMAGE` | Button (image) — use `setImage()` |

> **Note:** These field names are based on the WotC official 5e sheet and common community variants. The template inspection feature (`CHARACTER_PDF_INSPECT`) lets users discover actual field names and build custom mappings for non-standard sheets.

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| User's PDF has completely different field names | High | Medium | Ship template inspection + custom mapping (Phase 4). Default mapping handles WotC sheets. |
| `pdfjs-dist` worker doesn't load due to CSP or pathing | Medium | High | Test worker loading early. Fallback: disable worker (`workerSrc = ''`) which is slower but functional. |
| Large PDFs (50+ pages) slow down preview | Low | Low | Render only first N pages initially, lazy-render on scroll. |
| `pdf-lib` can't handle a specific PDF (corruption, unusual encoding) | Low | Medium | Wrap in try/catch, show helpful error message. |
| IPC transfer of large PDF bytes | Low | Low | Typical character sheets are 1–5MB. Electron IPC handles this fine. If needed, write to temp file and pass path instead. |
| `pdf-lib` 1.17.1 hasn't been updated in 4 years | Low | Low | It's stable and feature-complete for form filling. 3.1M weekly downloads. No known security issues. |
