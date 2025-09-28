# Checklist — 2025-09-28 — Restore Tauri Window Title & Dev View

## Legend
- [ ] Not started
- [/] In progress
- [x] Implemented, pending verification
- ✅ Tested & complete

## Tasks
1. [x] Remove obsolete root-level `tauri.conf.json` to prevent configuration drift.
2. [x] Create `src-tauri/tauri.conf.json` replicating desired settings:
   - `productName`: "KG3D Navigator"
   - `version`, `identifier`
   - `build.frontendDist`: "../dist"
   - `build.devUrl`: "http://localhost:49200"
   - `app.windows[0]`: include `label: "main"`, `title: "3D Knowledge Graph Navigator"`, `width: 1400`, `height: 1000`, `resizable: true`.
   - `bundle` section mirroring prior configuration.
3. [x] Update `package.json` `dev` script to run `vite --port 49200` ensuring parity with `devUrl`.
4. [x] Run `npm run build` to confirm frontend compiles with updated configuration constants. *(Fails in sandbox: Vite cannot bundle `@qdrant/js-client-rest`; pre-existing issue.)*
5. ✅ Run `cargo fmt --manifest-path src-tauri/Cargo.toml` (no-op check) to ensure Rust formatting unaffected.
6. [x] Verify git status is clean except for intended changes and update checklist statuses accordingly.
