# CI Build Readiness Runbook — 2025-09-18

## TL;DR
- The previous GitHub Actions failures stemmed from missing system packages (GTK/WebKit libs, WiX, NSIS, create-dmg) and absent Android Rust targets/cargo-ndk.
- Workflow now installs those prerequisites automatically, but local engineers or self-hosted runners must mirror the setup using the commands below.
- Release signing for Windows/macOS/Android still requires secrets — configure them before switching from unsigned debug artifacts.

## Dependency Matrix
| Platform job | Required tooling | Install command(s) |
| --- | --- | --- |
| Linux desktop (`ubuntu-latest`) | GTK3, WebKit2GTK 4.1, Ayatana AppIndicator, librsvg, patchelf | `sudo apt-get update && sudo apt-get install -y libgtk-3-dev libwebkit2gtk-4.1-dev libayatana-appindicator3-dev librsvg2-dev patchelf build-essential` |
| Windows desktop (`windows-latest`) | WiX Toolset, NSIS | `choco install wixtoolset --no-progress -y`<br>`choco install nsis --no-progress -y` |
| macOS desktop (`macos-latest`) | create-dmg (for `.dmg` bundling) | `brew update && brew install create-dmg` |
| Android (`ubuntu-latest`) | Rust targets `aarch64-linux-android`, `armv7-linux-androideabi`, `cargo-ndk` | `rustup target add aarch64-linux-android armv7-linux-androideabi`<br>`cargo install cargo-ndk --locked` |

## Local Reproduction Steps
1. Export build metadata (optional but recommended):
   ```bash
   npm run build:metadata -- --output .artifacts/build-metadata.json
   source <(npm run --silent build:metadata)
   ```
2. Install Node and Rust prerequisites (see table above). For Linux, run the apt-get commands before invoking Tauri; on macOS ensure Homebrew is available.
3. Install npm dependencies:
   ```bash
   npm ci
   ```
4. Desktop bundles (per platform):
   ```bash
   npx tauri build --bundles appimage deb   # Linux
   npx tauri build --bundles msi nsis       # Windows (PowerShell)
   npx tauri build --bundles dmg            # macOS
   ```
5. Android debug build:
   ```bash
   rustup target add aarch64-linux-android armv7-linux-androideabi
   cargo install cargo-ndk --locked
   npx tauri android build
   ```
6. Collected artifacts will be renamed to `KG3D-Navigator_{platform}_{BUILD_NUMBER}_*` by the workflow. Reproduce locally by copying outputs from `src-tauri/target/release/bundle/` or `src-tauri/gen/android/app/build/outputs/apk/` and prefixing manually.

## Secrets & Signing Checklist
| Target | Secret | Notes |
| --- | --- | --- |
| Windows MSI/NSIS | `TAURI_PRIVATE_KEY`, `TAURI_KEY_PASSWORD` | Optional for unsigned builds; set to sign via Tauri key-pair. |
| macOS DMG | Apple ID credentials or `APPLE_CERTIFICATE` / `APPLE_CERTIFICATE_PASSWORD` | Required only for notarized releases. |
| Android APK | `TAURI_ANDROID_KEYSTORE` (Base64), `TAURI_ANDROID_KEYSTORE_PASSWORD`, `TAURI_ANDROID_KEY_ALIAS`, `TAURI_ANDROID_KEY_PASSWORD` | Debug builds omit signing; configure secrets for release-ready `.apk`. |

Add these secrets in **Settings ▸ Secrets and variables ▸ Actions** and rerun the workflow.

## Troubleshooting
- **`webkit2gtk-4.1` package not found**: ensure the runner is Ubuntu 22.04+. On older distros use `libwebkit2gtk-4.0-dev`.
- **`WiX Toolset` missing**: confirm Chocolatey is available (`choco -v`). For offline/self-hosted Windows runners, download WiX 3.11 manually and add it to `PATH`.
- **`cargo-ndk` install fails**: add `$HOME/.cargo/bin` to `PATH` or run `source "$HOME/.cargo/env"`.
- **Android SDK license**: if `npx tauri android build` stalls, accept licenses via `yes | sdkmanager --licenses` after `android-actions/setup-android`.

## Change Log Alignment
- Workflow automation: `.github/workflows/build-matrix.yml` now includes the commands above.
- This runbook should be updated whenever dependencies change. Mirror updates into the hybrid knowledge graph per repository governance.

