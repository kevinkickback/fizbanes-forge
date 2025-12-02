**Fizbane's Forge: Architecture & Code Quality Audit**

- **Scope:** Electron main process, preload bridge, IPC handlers, preferences, window lifecycle, data loading, package config, assets and renderer exposure.
- **Status:** Refactored and modularized; feature work incomplete; renderer-side code not fully reviewed in this pass.

**Summary**
- **Overall:** The main-process architecture is cleanly modular (WindowManager, PreferencesManager, IPCRegistry, per-domain handlers). This is appropriate for an Electron app of medium complexity. However, the preload API exposes generic `invoke` bridges that weaken channel safety, and some handlers/channels are redundant or unused. Preferences use hand-rolled JSON but comments reference electron-store. Logging is verbose. There’s room to simplify, tighten security, and align with common Electron best practices.

**Findings**
- **Modular Main Process:**
  - Strength: Clear separation of concerns: window, preferences, IPC registry, domain handlers, logging.
  - Risk: Overhead if project remains small; but acceptable given planned features.

- **IPC Channels & Preload:**
  - `preload.js` exposes `electron.invoke(channel, ...args)` and `ipc.invoke`/`ipc.on`, which creates a generic bridge allowing any renderer code to reach any channel name. This reduces blast radius containment and type safety.
  - Dedicated APIs (e.g., `characterStorage.saveCharacter`) coexist with the generic bridge, leading to duplication and potential inconsistent usage.
  - `IPC_CHANNELS` includes many channels that are not currently registered (e.g., `FILE_SELECT`, `FILE_DELETE`, `DATA_LOAD_*` variants besides `DATA_LOAD_JSON`). Inconsistency can cause confusion and dead-code drift.

- **PreferencesManager:**
  - Uses a custom JSON in `userData` despite the comment about electron-store. Implementation is fine but lacks schema validation, migration, and atomic writes.
  - Logging every `get` and `set` is noisy. No debounce for frequent writes (e.g., window resize/move). Window bounds save happens on `close` only—good—but frequent logs remain.

- **WindowManager:**
  - Good defaults: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`.
  - DevTools open before load when `FF_DEBUG` is true; acceptable. Consider optional `webSecurity` flags and CSP in `index.html` if loading remote content (not seen here).
  - Bounds restored; writes on close. Minimal event handling; fine.

- **DataHandlers:**
  - Single `DATA_LOAD_JSON` handler that takes a file name. This is simple and fine. The presence of many `DATA_LOAD_*` channel constants without handlers is inconsistent.
  - Path join logic handles both `data/` prefix and bare filenames; good.

- **CharacterHandlers:**
  - Save/list/delete/export/import implemented with `.ffp` JSON files keyed by `id`. Pragmatic for local persistence.
  - Validation is partial and manually duplicated from renderer comment; better to centralize schema and share types.
  - Import duplicate-ID path returns a branching result for UI decisions; good. Uses `uuid` for keepBoth.

- **Logging (MainLogger):**
  - Simple adapter; `info` used extensively for routine operations, which may clutter logs. `debug` gated by `FF_DEBUG`.

- **Security & Best Practices:**
  - `contextIsolation: true` and `sandbox: true` are good.
  - Exposing generic `invoke` bridges increases attack surface if any XSS in renderer. A strict, whitelisted API is recommended.
  - No validation/whitelisting of file paths for FileHandlers; user-directed dialogs mitigate some risk, but direct `FILE_READ_JSON`/`FILE_WRITE_JSON` could be abused via generic invoke if misused.

- **Dependencies & Tooling:**
  - Uses `electron-builder`, Biome for lint/format, Playwright for tests; good foundation.
  - `electron`/`electron-builder` pinned to `latest` may cause breakages; prefer explicit versions.

- **Testing:**
  - Playwright tests exist; unclear coverage for IPC and preload bridges. No unit tests for handlers.

- **Renderer Exposure (preload):**
  - Duplicate UUID exposure (`generateUUID` in both `electron` and `characterStorage`).
  - Mixed responsibilities under `electron` vs `characterStorage`; could be consolidated for clarity.

**Recommendations**
- **Tighten Preload API (High Impact):**
  - Remove generic `electron.invoke`/`ipc.invoke` from `preload.js`. Expose only specific, well-typed methods per domain (character, files, data, settings).
  - Enforce argument validation at the preload boundary and in main handlers.

- **Align IPC Channels to Implementations:**
  - Prune unused constants in `ipc/channels.js` or implement the missing handlers. Keep the list as the single source of truth.
  - Add comments grouping channels by implemented status, or split into files per domain.

- **Preferences Management:**
  - Either adopt `electron-store` with a defined schema (and migrations) or keep custom JSON but add a simple schema validator and atomic write (write to temp then rename).
  - Reduce log verbosity: switch routine `get` logs to `debug` level; keep `error`/`warn` prominent.

- **Shared Schema & Types:**
  - Create a shared `schema` (JSON Schema or Zod) for `Character` and other data. Validate in both renderer and main to prevent divergence.
  - Consider TypeScript or JSDoc typedefs to standardize message payloads and channel contracts.

- **File Operations Safety:**
  - Restrict `FILE_READ_JSON` and `FILE_WRITE_JSON` to whitelisted directories or sanitize paths if they will be used beyond user-chosen dialogs.
  - Consider moving all file system interactions behind user-intent actions exposed in preload (no arbitrary path access from renderer).

- **Version Pinning:**
  - Pin `electron` and `electron-builder` to known-good versions, and set a cadence to upgrade.

- **Testing & CI:**
  - Add unit tests for IPC handlers (using `electron-mocha` or node-side tests with stubbed `ipcMain`).
  - Extend Playwright tests to cover preload-exposed APIs via UI flows.
  - Add a minimal CI workflow to run `biome lint`, `biome format --check`, and tests on PR.

- **Logging:**
  - Make `MainLogger.info` for routine events into `debug` when `FF_DEBUG` is false.
  - Add log levels to preferences to dynamically adjust verbosity.

- **Renderer Security:**
  - Add a strict Content Security Policy in `index.html` (no `unsafe-inline`; use hashed styles/scripts or external files).
  - Keep `nodeIntegration: false` and avoid remote content.

- **Simplify Where Useful:**
  - If project scope remains small, you can merge trivial handlers (e.g., file operations) under one module and keep only domain-specific APIs in preload.
  - Keep the main-process modularity but avoid over-abstraction in renderer unless needed.

- **UX/Data Loading:**
  - Since `data/` contains many JSONs, add a small data-access service in preload that only exposes `loadCatalog(name)` with a validated set of names, mapping to specific files. Avoid arbitrary path access.

**Concrete Next Steps**
- Preload hardening: remove generic `invoke`, define whitelisted methods for character, settings, files, and data.
- Channel hygiene: prune unused channels or implement them; document each channel’s payload and response.
- Add JSON Schema for `Character` persisted format; validate on save/import.
- Preferences: switch routine logs to debug; add atomic save and minimal schema.
- Pin electron/electron-builder versions; add CI with lint/format/test.
- Renderer CSP and audit for inline scripts/styles.

**Is it too complicated?**
- For a D&D character creator, the current main-process modularization is reasonable and not over-engineered. The complexity issue mainly stems from duplicated access patterns (generic invoke plus specific APIs), unused channels, and lack of shared schemas. Streamlining IPC and centralizing types will make it feel significantly simpler without losing structure.

**Best Practices Checklist**
- Context isolation, sandbox: enabled ✅
- No nodeIntegration in renderer: disabled ✅
- Strict preload API (no generic invoke): recommended ⛔
- Whitelisted data access: recommended ⛔
- Schema-driven validation: recommended ⛔
- Version pinning: recommended ⛔
- CI for lint/test/build: recommended ⛔
- CSP in renderer: recommended ⛔
