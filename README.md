# 3D Knowledge Graph Navigator (clean-room)

A clean-room Tauri + React (Vite) desktop/web app that visualizes knowledge graphs in 3D with:
- Sharded hKG search and data loading
- Sidebar entity list and filters
- AI navigation chat for keyword-based highlighting and navigation
- Multiple layouts (sphere, grid, concept-centric)

This repo targets both desktop (Tauri 2) and web (PWA). It preserves the aesthetic of the transitional Electron/Tauri build while adopting a fresh, maintainable architecture.

## Build info and version stamping

The app surfaces release metadata in multiple locations:
- Splash overlay: brand title plus `v{semver}` and `build {buildNumber}`.
- Help ▸ About dialog: `Version v{semver}`, `Build {buildNumber} (epoch minutes {epochMinutes})`, git commit, ISO timestamp.
- Bottom-right status capsule: `v{semver} • build {buildNumber}` on the first line and `sha {shortSha} • minutes {epochMinutes}` underneath.

Build number format:
- Canonical five-character identifier derived from the Unix epoch in minutes, encoded base36 and left-padded (e.g., `H1K9Z`).
- Corresponding epoch minutes remain available for long-term ordering.

Sources of truth:
- Web/PWA: Vite build-time defines exported in `vite.config.ts`.
- Desktop/mobile (Tauri): runtime command `get_build_info` backed by environment values emitted in `src-tauri/build.rs`.

Implementation details:
- `vite.config.ts` defines:
  - `__BUILD_MINUTES__` — epoch minutes at build time.
  - `__BUILD_NUMBER__` — canonical five-character base36 code.
  - `__BUILD_EPOCH__` — seconds (for compatibility).
  - `__BUILD_SEMVER__`, `__GIT_SHA__` — derived from environment.
- `src/config/buildInfo.ts`
  - `getBuildInfo()` synthesizes `BuildInfo { buildNumber, epochMinutes, semver, gitSha, builtAtIso }` with runtime fallbacks.
  - `fetchBuildInfo()` resolves the Tauri command (when available) and merges desktop/mobile overrides.
- `src-tauri/build.rs` emits `BUILD_MINUTES`, `BUILD_NUMBER`, `BUILD_EPOCH`, `GIT_SHA` at compile time.
- `src-tauri/src/main.rs` exposes `#[tauri::command] get_build_info` returning both camelCase and legacy fields for the UI bridge.

## Artifact naming

The GitHub Actions build matrix collects platform outputs and renames them with product, platform, and build number context:

```
KG3D-Navigator_{platform}_{buildNumber}_{originalFilename}
```

Examples:
- `KG3D-Navigator_linux_H1K9Z_KG3D Navigator_0.1.0_amd64.AppImage`
- `KG3D-Navigator_windows_H1K9Z_KG3D Navigator_0.1.0_x64_en-US.msi`
- `KG3D-Navigator_android_H1K9Z-app-release.apk`

## Prerequisites

- Node.js 20+
- Rust toolchain (stable) for Tauri 2
- System requirements for Tauri (OS-specific deps)

## Local development

- Install deps: `npm ci`
- Start dev server: `npm run dev`
- Build web (dist/): `npm run build`

## Desktop build (Tauri)

- Install Tauri CLI: `cargo install tauri-cli --locked`
- Build: `tauri build`

The desktop CI workflow runs the same steps across Ubuntu, Windows, and macOS.

## CI/CD

- `.github/workflows/build-matrix.yml` — cross-platform desktop/mobile builds with five-digit build numbering baked into artifact names.
- `.github/workflows/web.yml` — web/PWA build (legacy workflow retained for compatibility).
- See `docs/operations/ci-build-readiness-20250918.md` for platform dependency setup, signing secrets, and local reproduction guidance.

## Security and secrets

Do not commit secrets. CI and local builds may use environment variables such as `GITHUB_SHA`/`GIT_COMMIT` to stamp the build; these are not sensitive on their own. If you need API keys, source them via environment variables or secret managers.

## License

Proprietary — Copyright (C)2025 Robin L. M. Cheung, MBA. All Rights Reserved.
