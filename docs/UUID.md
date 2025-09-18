# UUID Index — Clean-room KG3D Navigator

Origin UUID: 01928c5d-2000-8000-8000-000000000001

| UUID                                   | Entity            | File path(s)                                                                                              | Why this mapping |
|----------------------------------------|-------------------|-----------------------------------------------------------------------------------------------------------|------------------|
| d04ee192-2eb2-45f5-8375-55380eacbe52   | CodeProject       | /home/robin/CascadeProjects/hKG-ontologizer-KGB-mcp/kg3d-navigator-cleanroom                              | Clean-room project root entity |
| 15d95ff4-1f2a-4b73-b609-2ca8125bca3c   | AppShell          | src/components/AppShell.tsx                                                                               | Top-level shell renders all main UI components |
| ededba13-eb44-4053-98fa-b7a720bf5a29   | Canvas3D          | src/components/Canvas3D.tsx                                                                               | R3F Canvas entrypoint |
| 49e7035f-f8bc-42af-9ef7-220a78afd32e   | Scene3D           | src/components/Scene3D.tsx                                                                                | Scene contents and camera animations |
| 9aae0f71-ebc9-48fa-8207-6f229ae37d88   | Sidebar           | src/components/Sidebar.tsx                                                                                | Entity list and quick stats |
| f16858fa-c1be-4f8c-bb16-8d67d85b94de   | DataSourcePanel   | src/components/DataSourcePanel.tsx                                                                         | Data source selection and loaders UI |
| 173c5711-0bf8-41ea-aca0-b92be8f6d29f   | AINavigationChat  | src/components/AINavigationChat.tsx                                                                        | Assistive navigation chat |
| 761d25ac-6445-441c-b8ab-2773e82101e7   | AboutModal        | src/components/AboutModal.tsx                                                                              | Displays build info |
| 8b212933-1345-4ac2-b64c-beea71af99dd   | SplashScreen      | src/components/SplashScreen.tsx                                                                            | Splash with epoch build number |
| cb12d3b0-c110-43e6-a85f-7b02eb3f95af   | Store             | src/state/store.ts                                                                                        | Central state (Zustand) |
| 3bdae4a7-c18e-490d-997c-ba691ca78942   | Actions           | src/state/actions.ts                                                                                      | Pure functions mutating store |
| 0b41cb3b-c8ee-4fd1-8631-d208095b53f0   | LayoutEngine      | src/services/layoutEngine.ts                                                                              | Position generation for layouts |
| 69edc334-d5f7-4508-a340-e3a9e513c2c3   | HKGLoader         | src/services/hkgLoader.ts                                                                                 | MCP-backed data loaders |
| ce91bdaf-eb4d-4226-93e3-e8fbf3da2ebc   | EnvConfig         | src/config/env.ts                                                                                        | Centralized env with high-port defaults |
| b1e6e23a-1f59-4385-9166-35c8f38ce18f   | BuildInfo         | src/config/buildInfo.ts                                                                                   | Build epoch/semver/sha provider |
| d3845837-f9d6-4c2d-b983-af83522d6903   | TauriMain         | src-tauri/src/main.rs; src-tauri/build.rs; tauri.conf.json                                                | Desktop runtime and commands |
| 0f379cd6-26e8-4530-a54c-9fa6c8487773   | CI_Desktop        | .github/workflows/desktop.yml                                                                             | Multi-platform desktop builds |
| 40093f97-5caa-42d4-899d-ff6ee50c2ba2   | CI_WebPWA         | .github/workflows/web.yml                                                                                 | Web/PWA builds |

| d0280e75-0574-8145-b8d4-1668bc361548   | BuildMetadataScript | scripts/compute-build-metadata.mjs
                                         | CLI to emit epoch-minute build constants |
| b2adc83b-1f76-800f-acd8-ee503ec03f62   | CI_BuildMatrix    | .github/workflows/build-matrix.yml
                                         | Cross-platform desktop/mobile build & artifact automation |
