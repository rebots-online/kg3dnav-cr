# Checklist — CI Build Readiness Hardening (2025-09-18 10:30 UTC)

## Legend
- [ ] Not started
- [/] In progress
- [x] Implemented, awaiting tests
- ✅ Tested & complete

## Tasks
1. [x] Update `.github/workflows/build-matrix.yml` to install OS-specific prerequisites before invoking `npx tauri build`.
   - [x] Linux: add apt-get update/install for GTK, webkit2gtk, appindicator, patchelf.
   - [x] Windows: add Chocolatey installation of WiX Toolset and NSIS.
   - [x] macOS: ensure Homebrew step installs `create-dmg` (and refresh brew).
   - [x] Android: add rustup target additions and cargo-ndk installation.
2. [x] Create `docs/operations/ci-build-readiness-20250918.md` outlining dependency steps, secrets, and local reproduction commands.
3. [x] Reference the new runbook from `README.md` CI/CD section.
4. [x] Run formatter/linting relevant commands if required. *(No formatter changes needed; verifying not required.)*
5. ✅ Execute `npm run build` to ensure JS build remains healthy.
6. ✅ Record test outcomes in this checklist (mark tasks ✅ when validated).

## Post-Work Validation
- [x] Verify `git status` clean except intended files.
- [x] Commit changes with descriptive message.
- [x] Capture summary & tests for PR body.

