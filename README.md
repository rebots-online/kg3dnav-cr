# 3D Knowledge Graph Navigator (clean-room)

A clean-room Tauri + React (Vite) desktop/web app that visualizes knowledge graphs in 3D with:
- Sharded hKG search and data loading
- Sidebar entity list and filters
- AI navigation chat for keyword-based highlighting and navigation
- Multiple layouts (sphere, grid, concept-centric)

This repo targets both desktop (Tauri 2) and web (PWA). It preserves the aesthetic of the transitional Electron/Tauri build while adopting a fresh, maintainable architecture.

## Build info and version stamping

The app displays version/build info in two places:
- Splash overlay: shows the build epoch
- Help > About: shows `v{semver} • build {epoch} • {gitSha}` and ISO timestamp

Sources of truth:
- Web/PWA: Vite build-time defines
- Desktop (Tauri): runtime command `get_build_info` with values provided via `src-tauri/build.rs`

Implementation details:
- `vite.config.ts` sets:
  - `__BUILD_EPOCH__` — seconds since epoch at build time
  - `__BUILD_SEMVER__` — `package.json` version
  - `__GIT_SHA__` — from env (`GITHUB_SHA`/`GIT_COMMIT`), otherwise `unknown`
- `src/config/buildInfo.ts`
  - `getBuildInfo()` returns the Vite-defined values (with safe fallbacks)
  - `fetchBuildInfo()` attempts to call Tauri’s `get_build_info` to refine values on desktop
- `src-tauri/build.rs` injects `BUILD_EPOCH` and `GIT_SHA`
- `src-tauri/src/main.rs` exposes `#[tauri::command] get_build_info`

## Artifact naming

Desktop workflow collects build outputs and renames them with epoch, OS, and arch:

```
kg3d-navigator_{epoch}_{os}_{arch}.{ext}
```

Examples:
- `kg3d-navigator_1724700000_ubuntu_amd64.AppImage`
- `kg3d-navigator_1724700000_macos_arm64.dmg`
- `kg3d-navigator_1724700000_windows_amd64.msi`

Web workflow uploads Vite build output as:

```
web_{epoch}
```

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

- `.github/workflows/desktop.yml` — matrix desktop builds; epoch-stamped artifact names with `{os}_{arch}`
- `.github/workflows/web.yml` — web PWA build with epoch-stamped artifact name

## Security and secrets

Do not commit secrets. CI and local builds may use environment variables such as `GITHUB_SHA`/`GIT_COMMIT` to stamp the build; these are not sensitive on their own. If you need API keys, source them via environment variables or secret managers.

## License

Apache-2.0
