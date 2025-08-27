# WARP.md — Progress & Resume Log

Project: kg3d-navigator-cleanroom
Project UUID: d04ee192-2eb2-45f5-8375-55380eacbe52
Origin UUID: 01928c5d-2000-8000-8000-000000000001
Repo: https://github.com/rebots-online/kg3dnav-cr (target branch: master)

State (27 Aug 2025):
- Completed: types/knowledge.ts, services/layoutEngine.ts, state/store.ts, state/actions.ts, config/env.ts, services/hkgLoader.ts, config/buildInfo.ts
- Docs present: docs/architecture/ERD.md, docs/UUID.md, docs/CHECKLIST-cleanroom-kg3d-27aug2025-2009.md

Next (strict order):
1) Update checklist marks for completed items
2) Commit and push to GitHub (rename local branch to master if needed)
3) Implement components (AppShell, Canvas3D, Scene3D, Sidebar, DataSourcePanel, AINavigationChat, AboutModal, SplashScreen)
4) Tauri runtime (src-tauri/main.rs, build.rs, tauri.conf.json)
5) CI workflows (desktop.yml, web.yml)

Resume instructions:
- Read WARP.md top section and open docs/CHECKLIST*.md; continue next unchecked item.
- If build fails due to deps, run npm/yarn/pnpm install for zustand, @types/react, @types/node as needed.
- Keep hKG updated with file materialization notes.

