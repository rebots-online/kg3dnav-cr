# CHECKLIST — cleanroom-kg3d — 27aug2025-2009

Legend: [ ] Not started  [/] In progress  [X] Done, awaiting test  ✅ Tested & complete

Context
- Source of truth architecture is registered in hKG (AST) under project UUID d04ee192-2eb2-45f5-8375-55380eacbe52 (origin 01928c5d-2000-8000-8000-000000000001).
- All filenames and symbols are final, no placeholders. Coding must follow this checklist strictly.

Architecture and ERD
- [X] Register clean-room project and components/modules in hKG with UUID mappings
- [X] Author ERD (docs/architecture/ERD.md) reflecting components/modules/pipelines and relations
- [X] Create UUID index (docs/UUID.md) for traceability

Decisions (locked)
- [X] React 18.2.0, ReactDOM 18.2.0
- [X] R3F + Drei compatible with React 18
- [X] Tauri 2 runtime (desktop), Vite for web builds
- [X] High-port MCP default: 49160 (override via VITE_HKG_MCP_BASE_URL)
- [X] Single React instance enforced via Vite resolve.alias
- [X] Build epoch stamping: surfaced in artifact filenames, splash, Help > About

Repository structure (final)
- [X] Root: /home/robin/CascadeProjects/hKG-ontologizer-KGB-mcp/kg3d-navigator-cleanroom
- [X] Components: src/components/
- [X] State: src/state/
- [X] Services: src/services/
- [X] Config: src/config/
- [X] Tauri runtime: src-tauri/
- [X] CI: .github/workflows/

Type definitions
- [X] Create src/types/knowledge.ts with:
  - [ ] type Entity = { name: string; type: 'CONCEPT'|'PERSON'|'ORGANIZATION'|'LOCATION'|'EVENT'|'OTHER'; description?: string; uuid?: string; spatial_media?: { has_3d_scene?: boolean };
        searchRelevance?: 'uuid_coordinated'|'vector_semantic'|'audit_activity'|'text_search'; vectorMatch?: boolean; auditMatch?: boolean }
  - [ ] type Relationship = { source: string; target: string; relationship: string; uuid?: string }
  - [ ] type BuildInfo = { epoch: number; semver: string; gitSha: string; builtAtIso: string }
  - [ ] type Layout = 'sphere'|'grid'|'concept-centric'

State and actions
- [X] Implement src/state/store.ts exporting useStore with state:
  - [ ] entities: Entity[]
  - [ ] relationships: Relationship[]
  - [ ] entityPositions: Record<string,[number,number,number]>
  - [ ] layout: Layout; xRayMode: boolean; targetEntity: string|null
  - [ ] highlightEntities: string[]; selectedRelationships: Relationship[]
  - [ ] isSidebarOpen: boolean; caption: string; isFetching: boolean; resetCam: boolean
  - [ ] searchQuery: string; entityTypeFilter: 'all'|Entity['type']
  - [ ] richMediaMode: boolean; activeScene: unknown|null
  - [ ] knowledgeGraphId: string|null; processingMethod: 'single'|'sharded'
  - [ ] Methods: set* mutators, loadKnowledgeGraph(data), generateEntityPositions()
- [X] Implement src/state/actions.ts with pure functions:
  - [ ] setLayout(layout: Layout)
  - [ ] setTargetEntity(name: string|null)
  - [ ] sendQuery(query: string)
  - [ ] clearQuery()
  - [ ] setXRayMode(enabled: boolean)
  - [ ] toggleSidebar()
  - [ ] setEntityTypeFilter(type: 'all'|Entity['type'])
  - [ ] enterRichMediaMode(name: string)
  - [ ] exitRichMediaMode()
  - [ ] followRelationship(type: string, from: string, to: string)
  - [ ] loadKnowledgeGraphData(payload: { knowledge_graph: { entities: Entity[]; relationships: Relationship[] }; metadata: any })
  - [ ] resetCamera()
  - [ ] analyzeEntity(name: string)
  - [ ] highlightEntityType(type: Entity['type'])
  - [ ] clearAllHighlights()
  - [ ] highlightEntities(names: string[])

Layout engine
- [X] Implement src/services/layoutEngine.ts:
  - [ ] export function generatePositions(state): Record<string,[number,number,number]> supporting sphere, grid, concept-centric

MCP-backed loaders
- [X] Implement src/config/env.ts exporting getEnvConfig(): { HKG_MCP_BASE_URL: string }
- [X] Implement src/services/hkgLoader.ts with:
  - [ ] findWorkingMCPServer(base: string): Promise<string|null>
  - [ ] loadFromNeo4j(opts)
  - [ ] loadFromQdrant(query: string)
  - [ ] loadFromPostgreSQL()
  - [ ] loadFromHKG(source: 'auto'|'neo4j'|'qdrant'|'postgresql')
  - [ ] loadCenteredSubgraph(center: string, maxDepth: number, maxNodes: number)
  - [ ] loadByEntityType(type: Entity['type'], limit: number, offset?: number)
  - [ ] loadSearchResults(query: string, limit: number)
  - [ ] searchShardedHKG(topic: string, options)
  - [ ] initializeHKG(options)

Build info and stamping
- [X] Implement src/config/buildInfo.ts exporting getBuildInfo(): BuildInfo
- [ ] Define Vite build-time constants: __BUILD_EPOCH__, __BUILD_SEMVER__, __GIT_SHA__
- [ ] Tauri src-tauri/build.rs: inject BUILD_EPOCH and GIT_SHA into env; expose via command

Components
- [ ] src/components/AppShell.tsx — renders Canvas3D, Sidebar, DataSourcePanel, AINavigationChat, AboutModal, SplashScreen
- [ ] src/components/Canvas3D.tsx — R3F Canvas with TrackballControls; onPointerMissed clears target
- [ ] src/components/Scene3D.tsx — lights, relationship lines, KnowledgeNode instances, camera/controls animations
- [ ] src/components/Sidebar.tsx — entity list, quick stats, sort/filter controls
- [ ] src/components/DataSourcePanel.tsx — radio source selector, options, status indicators, refresh
- [ ] src/components/AINavigationChat.tsx — keyword matching, highlight/navigation, layout suggestions
- [X] src/components/AboutModal.tsx — displays BuildInfo, product metadata
- [X] src/components/SplashScreen.tsx — shows product name + epoch build number
- [ ] src/components/KnowledgeNode.tsx — node visuals by type, indicators for vector/audit/uuid matches

Entry and routing
- [ ] src/main.tsx — ReactDOM.createRoot, ErrorBoundary, mount AppShell
- [ ] index.html — PWA-ready meta, root div, Vite module script

Tauri runtime
- [X] src-tauri/src/main.rs — setup, menu with About, command get_build_info, event emits (set-layout, toggle-xray, reset-camera, toggle-sidebar)
- [X] src-tauri/build.rs — compute epoch + git sha env
- [X] tauri.conf.json — productName, identifiers, bundle targets: deb, AppImage, nsis exe, msi, dmg

CI/CD
- [X] .github/workflows/desktop.yml — matrix (ubuntu, windows, macos), stamp epoch, build tauri, rename artifacts with epoch
- [X] .github/workflows/web.yml — build Vite web + PWA, name artifact with epoch

Quality gates
- [ ] ESLint with react-hooks (rules-of-hooks, exhaustive-deps)
- [ ] TypeScript strict mode; no implicit any
- [ ] Prettier config

Release naming (epoch)
- [ ] Artifact naming scheme: kg3d-navigator_${epoch}_${os}_${arch}.${ext}
- [ ] About modal shows: v{semver} • build {epoch} • {gitSha}
- [ ] Splash shows build {epoch}

HKG sync discipline
- [ ] After each file added, update hKG with entity and relation(s) (use UUID table)
- [ ] Append entry to docs/UUID.md per new symbol/file


