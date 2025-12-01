**Codebase Style & Consistency Audit**

Date: 2025-11-30

Summary
-------
- The repository is well organized into `app/js/{core,infrastructure,services,utils,modules}`, `app/electron/*` (main process), and `app/data/*`.
- Renderer code uses ES modules (`import`/`export`); Electron main/preload use CommonJS (`require`/`module.exports`). This is intentional and consistent with Electron best practices.
- JSDoc and optional chaining are widely used in core and utils. Arrow functions are common for callbacks.

Key Findings
------------
- Module system split: ESM in renderer vs CommonJS in main — consistent and appropriate, but worth documenting explicitly for new contributors.
- Naming patterns mostly consistent: PascalCase for classes and files representing classes, camelCase for instances and functions.
- Optional chaining (`?.`) is used extensively for defensive access — good.
- JSDoc is present in many core and util files, but less consistently applied in many UI/module files (several `modules/*` and `pages/*` lack formal JSDoc for public API methods).
- Logging: `Logger` / `MainLogger` are used, but some modules still use `console.log`/`console.error`. Standardize on `Logger` in renderer and `MainLogger` in main process.
- Export style inconsistencies: some modules expose singletons with `export const X = new XClass()` while others attach helpers to function objects (e.g., `DataLoader.loadJSON = ...`). Prefer explicit `export function` or `export class` + exported instance pattern.
- Serialization: `Character` contains Sets/Maps and a `toJSON()` pattern; callers defensively check `toJSON ? toJSON() : obj`. Centralize serialization/deserialization to avoid repetition.

Recommendations
---------------
1. Adopt Biome for linting/formatting (instead of ESLint + Prettier)
   - A `biome.json` is already present in the repo root. Biome can lint, format, and fix many style issues and is a single tool replacement for ESLint + Prettier.
   - Recommended NPM scripts to add to `package.json` (optional):
     - `"format": "biome format"`
     - `"lint": "biome check"`
   - Common commands (PowerShell):
     ```powershell
     npx biome check
     npx biome format
     ```

2. Enforce environment-aware rules via Biome configuration
   - Keep `app/js/**` as ESM (enable `sourceType: module`) and allow `import`/`export`.
   - Keep `app/electron/**` as CommonJS (allow `require`/`module.exports`) via overrides in `biome.json`.
   - Example override (conceptual):
     ```json
     {
       "files": ["app/electron/**"],
       "language": { "sourceType": "script" }
     }
     ```

3. Logging policy
   - Replace `console.log` / `console.error` in renderer files with the `Logger` utility.
   - Reserve `MainLogger` for main process files.

4. API style and exports
   - Choose a single export style for public modules:
     - For stateful services: `export class X {}` + `export const x = new X()`
     - For stateless helpers: `export function helper() {}`
   - Refactor patterns like `DataLoader.loadJSON = ...` into `static` methods or explicit exported functions.

5. JSDoc coverage
   - Add JSDoc to public methods in `modules/*` and `pages/*` to improve discoverability and maintainability.

6. Serialization utilities
   - Centralize `serializeCharacter` and `deserializeCharacter` (handle Sets/Maps) in `CharacterSchema` or `Character` and use consistently across `CharacterManager`, IPC handlers, and save/load paths.

Suggested small first steps (I can implement these if you want)
-------------------------------------------------------
- Add/standardize `biome.json` overrides for `app/electron/**` and `app/js/**`.
- Add `format` and `lint` scripts to `package.json`.
- Run `npx biome format` then `npx biome check` and fix autofixable issues.
- Replace `console.*` in renderer `app/js/**` with `Logger.*` (small PR).

If you'd like, I can:
- scaffold a Biome configuration override and `package.json` scripts and run autofixes, or
- implement targeted refactors (centralize serialization, replace `console` calls, convert `DataLoader` helpers to `static` methods).

Notes & rationale
-----------------
- The existing split between ESM (renderer) and CommonJS (main) should be preserved for Electron security and initialization patterns. Biome supports configuring rules per-folder so this can be enforced automatically.
- Using Biome reduces toolchain complexity (one tool for both formatting and linting) and integrates well with modern JS/TS workflows.

End of audit.
