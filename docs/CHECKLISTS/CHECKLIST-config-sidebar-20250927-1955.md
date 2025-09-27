# Checklist — Config Sidebar & LLM Defaults (2025-09-27 19:55 UTC)

## Legend
- [ ] Not started
- [/] In progress
- [x] Implemented, pending verification
- ✅ Tested & verified

## Tasks
1. [x] Update `scripts/compute-build-metadata.mjs` to compute and emit `version_build` using semver major/minor and timestamp bucket.
2. [x] Extend `src/config/buildInfo.ts` and `src/types/knowledge.ts` to surface `versionBuild` in the `BuildInfo` contract, computing it client-side when env vars missing.
3. [x] Update `src-tauri/src/main.rs` (and related build outputs if needed) to include `version_build` in the command payload using the new algorithm.
4. [x] Expand `src/state/settingsStore.ts` types and defaults with database/collection/dimension fields plus `llmProvider`, exposing helpers for bulk updates.
5. [x] Refactor `src/components/ConnectionSettingsDrawer.tsx` to use draft state, add combo-box model pickers, add SAVE/CANCEL flow, extend service cards with new fields, add provider radio, and fetch model tags from `/api/tags` endpoints.
6. [x] Adjust `src/services/llmClient.ts` to honor selected provider order, update defaults, and attach required headers for OpenAI-compatible requests.
7. [x] Add regression display updates (e.g., `src/components/AppShell.tsx`, `AboutModal.tsx`, `SplashScreen.tsx`) to show the new `versionBuild` string where version/build metadata is presented.
8. [ ] Run lint/build/test commands as available and update checklist status accordingly.

## Testing Plan
- [ ] `npm run lint` *(fails: repository has numerous pre-existing prettier/eslint violations outside current scope)*
- [x] `npm run build`
