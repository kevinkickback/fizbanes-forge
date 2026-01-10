# 5etools Comparative Audit

## Executive Summary
- Fizbane’s Forge reuses 5etools data formats but ships a slimmer renderer/service surface focused on character creation. Core loaders and renderers are simplified and omit many upstream guardrails (versioning, retries, decompression) while retaining a tooltip-style hover analog already present in the app.
- Data initialization is eager and parallelized but lacks resilience and cache/version checks; failures are mostly swallowed and the app proceeds with partial data [src/renderer/scripts/core/AppInitializer.js#L120-L169].
- Rendering is limited to basic tag substitution without the richer 5etools entry-render pipeline (tables, scaling dice, deep link behavior) [src/renderer/scripts/utils/Renderer5etools.js#L1-L140] and light-weight DOM processing [src/renderer/scripts/utils/TextProcessor.js#L63-L124].
- Services provide O(1) lookups but stop short of 5etools’ cross-indexed, source-aware, and variant-aware normalization (aliases, reprints, prerelease/homebrew merging) [src/renderer/scripts/services/SpellService.js#L28-L104] [src/renderer/scripts/services/RaceService.js#L66-L148].
- Data loading relies on in-memory caches and IPC fetches without offline bundles, compression handling, or persisted version metadata [src/renderer/scripts/utils/DataLoader.js#L1-L74], diverging from 5etools’ aggressive caching and delta-update flow.

## Key Differences (with examples)
- **Data loading resilience**: `_loadAllGameData` fires all service initializers in parallel and only logs warnings on failure, so one bad file yields silent partial state; no retry/backoff or source revalidation [src/renderer/scripts/core/AppInitializer.js#L120-L169]. 5etools’ `DataUtil` retries, memoizes, and guards with version hashes.
- **Lookup depth**: Spell and race services build flat lookup maps but do not normalize aliases, reprints, or variant sources the way 5etools’ `Renderer.spell`/`BrewUtil` pipelines do [src/renderer/scripts/services/SpellService.js#L28-L104] [src/renderer/scripts/services/RaceService.js#L66-L148].
- **Rendering stack**: Current renderer only expands simple {@tag} links and lacks entry parsing for tables, nested lists, dice roll buttons, or deep-link behaviors; tooltip-style hovers exist but are simpler than upstream `Renderer.hover` [src/renderer/scripts/utils/Renderer5etools.js#L1-L140].
- **Text post-processing**: MutationObserver processes DOM nodes but only swaps tags; there is no debounce or idempotence markers for large trees. Omnisearch-style highlighting is not needed for this app, but upstream still benefits from staged processing (entity resolution, inline rolls) [src/renderer/scripts/utils/TextProcessor.js#L63-L124].
- **Caching and persistence**: DataLoader caches per-process only and delegates to IPC/fetch without compressed source handling or storage of version stamps; 5etools stores gzipped/hashed payloads in localStorage/session and falls back to CDN mirrors [src/renderer/scripts/utils/DataLoader.js#L1-L74].
- **Feature scope**: Only backgrounds, races, spells, and items are wired; no bestiary, vehicles, traps/hazards, optional features, or homebrew ingestion despite data files being present.

## Missing or Superior 5etools Features
- Per-entity faceted filters (source/level/type) within each list view; global omnisearch is unnecessary for a character creator but scoped filters improve selection UX.
- Hover renderer depth: upstream shows compact statblocks and quick actions; current tooltips are lighter-weight.
- Homebrew and prerelease pipelines (`BrewUtil`, `PrereleaseUtil`) with validation, versioning, and conflict resolution.
- Offline/edge caching with compressed payloads, mirror fallback, and data version checks.
- EntryRenderer/Markdown-like rich entry parsing (tables, inline rolls, scaling dice, conditions), including adventure/book rendering and fluff pages.
- Export/print flows (PDF, plaintext) and shareable deep links.
- Accessibility and UX polish: focus management, ARIA labels on interactive links, keyboard shortcuts for filters and navigation.

## Recommended Changes and Rationale
- **Harden data loading**: Introduce versioned cache with checksum validation, retry/backoff, and clearer failure UI; mirror 5etools `DataUtil` patterns to support compressed payloads and fallbacks [src/renderer/scripts/utils/DataLoader.js#L1-L74].
- **Adopt structured normalization**: Extend services to respect aliases/reprints, and attach source+page metadata (similar to 5etools index builders) instead of single-map lookups [src/renderer/scripts/services/SpellService.js#L28-L104] [src/renderer/scripts/services/RaceService.js#L66-L148].
- **Upgrade rendering**: Port 5etools entry rendering for tables, lists, dice rolls, and hover content; ensure tooltip/hover attributes emitted in `Renderer5etools` are resolved via the existing hover controller [src/renderer/scripts/utils/Renderer5etools.js#L1-L140].
- **UI instrumentation (scoped)**: Add per-entity faceted filters (source, level, type) and lightweight search inside each list view; debounce DOM processing and add idempotent markers in `TextProcessor` [src/renderer/scripts/utils/TextProcessor.js#L63-L124].
- **Broaden feature coverage**: Wire remaining data types already present in `src/data/` (monsters, traps/hazards, vehicles, optional features, feats fluff) through services and UI endpoints.
- **Persisted state**: Layer a local disk cache (app data dir) for data bundles and character state snapshots; align with Electron environment to permit offline starts.

## Prioritized Action Plan
- **Short term (1-2 sprints)**
  - Add data-source validation, retry/backoff, and hard failure surfaced to the UI during `_loadAllGameData` [src/renderer/scripts/core/AppInitializer.js#L120-L169].
  - Implement persisted cache with version hash per JSON; reuse cached payloads before hitting IPC/fetch [src/renderer/scripts/utils/DataLoader.js#L1-L74].
  - Hook the existing tooltip/hover handler to tag outputs and add minimal dice-roll rendering in the renderer utilities [src/renderer/scripts/utils/Renderer5etools.js#L1-L140].
- **Medium term (3-6 sprints)**
  - Ship per-entity faceted filters (source/level/type) for spells/items/races/classes and index data with aliases/reprints for accurate filtering [src/renderer/scripts/services/SpellService.js#L28-L104] [src/renderer/scripts/services/RaceService.js#L66-L148].
  - Expand service coverage to monsters, traps/hazards, vehicles, optional features, and feats fluff (data already present in `src/data/`).
  - Enhance TextProcessor with idempotence markers and batched MutationObserver processing; keep scope to tooltip/roll rendering (no global omnisearch) [src/renderer/scripts/utils/TextProcessor.js#L63-L124].
- **Long term (6+ sprints)**
  - Introduce homebrew/prerelease ingestion with validation and conflict resolution; store homebrew separately and merge at runtime.
  - Adopt richer EntryRenderer parity (tables, scaling dice, print/export) and adventure/book page rendering pipelines.
  - Add offline/mirror-aware update channel with diffed data bundles and telemetry-free crash-safe startup.
