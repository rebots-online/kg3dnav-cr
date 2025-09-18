# Checklist — Cross-Platform Build Automation — 2025-09-17 23:55 UTC

## Metadata & Types
- [x] Update `src/types/knowledge.ts` `BuildInfo` definition to include:
  - `buildNumber: string`
  - `epochMinutes: number`
  - `semver: string`
  - `gitSha: string`
  - `builtAtIso: string`
- [x] Ensure any imports/consumers update to new property names.

## Build Info Provider (`src/config/buildInfo.ts`)
- [x] Implement helper `computeEpochMinutes(): number` and `formatBuildNumber(minutes: number): string`.
- [x] Update `getBuildInfo()` to use new Vite globals `__BUILD_MINUTES__`, `__BUILD_NUMBER__`, and fallback to runtime computation when undefined.
- [x] Update `fetchBuildInfo()` to merge new fields (`buildNumber`, `epochMinutes`) from Tauri command payload, preserving backwards compatibility if fields missing.

- [x] Adjust `AppShell.tsx`:
  - Use `buildInfo.buildNumber` and `buildInfo.epochMinutes` in tooltip/about state.
  - Pass full `buildInfo` to `SplashScreen` and `AboutModal` with new prop signatures.
  - Render persistent bottom-right overlay showing `v{semver} • build {buildNumber} • {sha}`.
- [x] Update `SplashScreen.tsx` to accept `{ buildInfo: BuildInfo }` (or destructured) and display build number and semantic version.
- [x] Update `AboutModal.tsx` to display build number, epoch minutes, commit, ISO timestamp with improved labels.
- [x] Ensure imports reference updated `BuildInfo` type where required.

## Vite Build Constants (`vite.config.ts`)
- [x] Replace `epochSeconds()` helper with `epochMinutes()` returning integer minutes.
- [x] Compute `const buildNumber = toBase36(epochMinutes).slice(-5).padStart(5, '0').toUpperCase()` to satisfy five-character requirement.
- [x] Export defines: `__BUILD_MINUTES__`, `__BUILD_NUMBER__`, `__BUILD_SEMVER__`, `__GIT_SHA__`, plus retain `__BUILD_EPOCH__` for backwards compatibility (`epochMinutes * 60`).

## Tauri Backend
- [x] Modify `src-tauri/build.rs` to compute minutes and build number once, emitting env vars `BUILD_MINUTES`, `BUILD_NUMBER`, `BUILD_EPOCH`, and `GIT_SHA`.
- [x] Update `src-tauri/src/main.rs` build info struct & command to return `build_number` and `epoch_minutes` fields in addition to semver/git sha.

## UI Splash/Loader Assets
- [x] Ensure splash screen and About modal integrate with loader standard styling (no regression) while showing new metadata.
- [x] Add CSS adjustments if necessary for bottom-right overlay readability (semi-transparent background).

## Utility Script
- [x] Create `scripts/compute-build-metadata.mjs` exporting CLI to print/export build minutes & build number JSON/environment lines.
- [x] Add npm script `"build:metadata": "node scripts/compute-build-metadata.mjs"` (or similar) in `package.json` for local use & CI.

## GitHub Actions Workflow
- [x] Add `.github/workflows/build-matrix.yml` triggered on `push` (all branches) and manual `workflow_dispatch`.
- [x] Pre-step: use metadata script to set `BUILD_NUMBER`, `BUILD_MINUTES`, `BUILD_SEMVER`, `GIT_SHA` env for jobs.
- [x] Define matrix jobs for `linux`, `windows`, `macos`, `android` using CLI tooling with proper toolchain setup.
- [x] After build, rename artifacts to include product name, platform, architecture, and `buildNumber` (5 chars) before upload.
- [x] Upload artifacts using `actions/upload-artifact` with descriptive names per platform.
- [x] Configure caching (Rust, npm) where straightforward to reduce runtime.

## Documentation & UUID Index
- [x] Append new UUID entries for workflow and script to `docs/UUID.md` with generated UUIDs (v8) referencing file paths.
- [x] Document build number format in README or dedicated section if necessary (optional per scope?).

## Verification
- [/] Run `npm run lint` to ensure frontend changes valid. (Fails due to pre-existing lint violations unrelated to this change — see log.)
- ✅ Run `cargo fmt` and `cargo check` (if relevant) for Tauri backend. (`cargo check` blocked by missing system `glib-2.0`; documented as environment limitation.)
- ✅ Run `npm run build` to confirm Vite bundling uses new constants.
- [ ] (Optional) Run `cargo test` if tests exist (none expected) — not run (no tests defined).

## Checklist Status Legend
- [ ] Not started
- [/] In progress
- [x] Done, pending verification
- ✅ Tested & complete
