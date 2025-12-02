**Copilot Development Instructions for Fizbane's Forge**

- **Purpose:** Guide AI-assisted coding to align with the architecture audit and best practices for this Electron-based D&D character creator.
- **Scope:** Preload API, IPC channels, preferences, schemas, security, testing, and tooling.

**Core Principles**
- **Whitelisted Preload API:** Do not expose generic `invoke`/`on` bridges. Only add explicit, domain-scoped methods in `preload.js` (e.g., `character.save`, `files.selectFolder`, `settings.getAll`, `data.loadCatalog`).
- **Channel Hygiene:** Every channel in `app/electron/ipc/channels.js` must have a corresponding handler and a documented payload/response. Remove or implement unused channels.
- **Schema-Driven:** Validate all persisted data and IPC payloads using a shared schema (JSON Schema or Zod). Avoid ad-hoc validation duplication across renderer and main.
- **Security First:** Maintain `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`. Add strict CSP in `index.html`. No remote content or inline scripts/styles unless hashed.
- **Least Privilege FS Access:** Renderer cannot pass arbitrary file paths. File operations should be user-driven (via dialogs) or limited to whitelisted app directories.
- **Explicit Versioning:** Pin `electron` and `electron-builder` versions; avoid `latest`.
- **Tests & CI:** Unit-test IPC handlers; e2e cover preload-exposed flows. Run lint/format/test in CI.

**Preload API Guidelines**
- Modify `app/preload.js` to export only these domains and methods:
  - `character`: `save(data)`, `list()`, `delete(id)`, `export(id)`, `import(userChoice)`, `generateUUID()`.
  - `files`: `selectFolder()`, `open(filePath)`; no arbitrary read/write exposed to renderer.
  - `settings`: `getAll()`, `get(key)`, `set(key, value)`, `getSavePath()`/`setSavePath(path)`.
  - `data`: `loadCatalog(name)` where `name` is from a validated set that maps to files under `app/data/`.
- Remove generic bridges: `electron.invoke`, `ipc.invoke`, and catch-all IPC exposure.
- Validate arguments in preload before invoking IPC.

**IPC & Handlers**
- Keep handlers in `app/electron/ipc/handlers/*` by domain. Update `IPCRegistry` to register only implemented channels.
- Align `ipc/channels.js` with handlers:
  - Remove unused: `FILE_SELECT`, `FILE_DELETE`, `DATA_LOAD_*` variants if not implemented.
  - Retain `DATA_LOAD_JSON` only if used via `data.loadCatalog` mapping.
- Document each channel’s expected request/response in JSDoc above the handler.

**Preferences**
- If staying custom JSON:
  - Add minimal schema validation for `preferences.json` (shape & types).
  - Implement atomic writes (write temp file then rename) in `PreferencesManager.savePreferences()`.
  - Reduce log verbosity: change routine `get`/`set` logs to `debug` unless `FF_DEBUG` is true.
- Or adopt `electron-store` with a schema and migrations; update code accordingly.

**Character Schema**
- Create `app/js/core/schemas/character.schema.json` (or Zod equivalent) as the single source of truth.
- Validate in both renderer and main before save/import. Reject invalid payloads with descriptive errors.

**Security & CSP**
- Add CSP in `app/index.html`, e.g.: `Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self';`.
- Avoid inline scripts/styles; move to external files under `app/js/` and `app/css/`.

**Tooling & CI**
- Pin versions in `package.json` for Electron-related dependencies.
- Add CI workflow to run: `biome format --write-check`, `biome lint`, Playwright tests, handler unit tests.

**Coding Style**
- Prefer small, clear modules. Avoid over-abstraction unless multiple consumers justify it.
- Use JSDoc or TypeScript types for IPC payloads and function signatures to improve clarity.
- Keep logs actionable; use `MainLogger.debug` for high-frequency events.

**Implementation Checklist (for Copilot suggestions)**
- Preload: remove generic bridges; add domain-scoped, validated methods.
- IPC: prune or implement missing channels; document payloads/responses.
- Preferences: add schema and atomic writes; tune logging.
- Character: introduce shared schema, validate on save/import.
- Security: add CSP; ensure no inline scripts/styles.
- Tooling: pin versions; add CI and unit tests for handlers.
