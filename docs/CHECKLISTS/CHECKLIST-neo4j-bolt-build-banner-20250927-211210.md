# Checklist: Neo4j Bolt Loader & Build Banner Cleanup (2025-09-27 21:12:10 UTC)

## Pre-Coding
- [x] Capture architecture details in `docs/architecture/ARCHITECTURE-neo4j-bolt-build-banner-20250927-211210.md`.
- [x] Attempt hybrid knowledge graph sync write-back (confirmed failure: `nc -z -w3 mcp.robinsai.world 7687` exited 1).

## Neo4j Bolt Integration (`package.json`, `src/state/settingsStore.ts`, `src/services/hkgLoader.ts`)
- [x] Add runtime dependency `"neo4j-driver"` to `package.json` under `dependencies`.
- [x] Update `DEFAULT_SERVICE_ENDPOINTS.neo4j` default from HTTP to Bolt (`bolt://192.168.0.71:7687`) in `settingsStore.ts`.
- [x] Adjust any derived defaults or sanitization logic so Bolt URIs persist without being coerced to HTTP.
- [x] Refresh Neo4j connection placeholders (e.g., `ConnectionSettingsDrawer`) to display the Bolt URI.
- [x] Import `neo4j-driver` utilities at top of `src/services/hkgLoader.ts`.
- [x] Implement helper to create/close a Neo4j driver per invocation (ensuring `disableLosslessIntegers: true`).
- [x] Replace HTTP fetch logic in `loadFromNeo4j` with Bolt session workflow:
  - [x] Derive connection params (uri, username, password, database) from service config.
  - [x] Normalize options (`limit`, `offset`, `entityTypes`, `searchQuery`, `centerEntity`, `maxConnections`).
  - [x] Execute Cypher query to fetch nodes using filters and pagination; return structured map with `elementId`, `name`, `entityType`, `uuid`, `description`, `observations`, `spatial_media`.
  - [x] Fetch relationships among selected nodes (respecting `maxConnections` fallback) and map to `{ from, to, relationType, uuid }`.
  - [x] Assemble raw graph payload and pass through `mapNeo4jGraph` to reuse normalization/metadata logic.
  - [x] Ensure session/driver closed via `finally` to prevent leaks; surface meaningful errors to console and return `null` on failure.
- [x] Update metadata to record Bolt endpoint in `mapNeo4jGraph` invocation.

## Build Banner Simplification (`src/components/AppShell.tsx`)
- [x] Remove redundant second `<div>` containing legacy `build ... sha ... minutes ...` line from footer badge while preserving top line.

## Post-Coding
- [x] Run `npm run lint` (fails due to existing repository lint errors; captured output).
- [x] Update this checklist with completion/test statuses (✅ for tested items).
- [x] Document hybrid knowledge graph sync attempt outcome (failure due to network) and mark corresponding task complete.
