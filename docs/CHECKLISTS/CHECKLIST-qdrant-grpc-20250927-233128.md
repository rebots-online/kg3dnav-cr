# Checklist • Qdrant gRPC alignment (2025-09-27T23:31:28Z)
- Project UUIDv8: db0293b2-3e87-8f39-be73-960712bd9941
- Derived from: docs/ARCHITECTURE/ARCHITECTURE-qdrant-grpc-20250927-233128.md

## Preparation
- [x] Install/verify dependencies
- [x] Add `@qdrant/js-client-grpc@^1.15.1` to `package.json` dependencies.
- [x] Run `npm install` to materialize gRPC client in `node_modules/`.
- [x] Ensure existing `@qdrant/js-client-rest` remains for fallback.

## settingsStore updates (`src/state/settingsStore.ts`)
- [x] Extend `DEFAULT_SERVICE_ENDPOINTS.qdrant` to default to `http://mcp.robinsai.world:6333` if absent.
- [x] Within `DEFAULT_SERVICE_CONFIGS.qdrant`:
  - [x] Populate `apiKey` with `qsk_171/hJyYAGLXgxeBDOjLF9Eyrh908qW63xgfcpqDz+ZWUs=`.
  - [x] Ensure `embeddingModel` defaults to `'mxbai-embed-large'` and `dimension` to `1024` (already but confirm).
- [x] Add helper `deriveQdrantGrpcHost(baseUrl: string): { host: string; port: number }` to translate HTTP URL to gRPC host/port 6334.
- [x] Expose sanitized API key getter for loader usage if not already available.

## Qdrant loader updates (`src/services/hkgLoader.ts`)
- [x] Import `QdrantClient` from `@qdrant/js-client-grpc` (rename REST client import to `QdrantRestClient`).
- [x] Introduce types:
  - [x] `type QdrantGrpcClient = import('@qdrant/js-client-grpc').QdrantClient`
  - [x] `type QdrantSearchResult = Awaited<ReturnType<QdrantGrpcClient['search']>>`
- [x] Implement `createQdrantGrpcClient(config: { host: string; port: number; apiKey?: string }): QdrantGrpcClient` with API key metadata interceptor.
- [x] Add `async function ensureCollectionVectorParams(client, collection, vectorName, dimension)` verifying `vectors` schema matches `mxbai-embed-large` & `1024`.
- [x] Replace existing REST `scroll` block with:
  - [x] Acquire config snapshot → base URL → derive gRPC host/port.
  - [x] Initialize gRPC client and validate collection.
  - [x] Issue `client.search(collection, { vector: { name: vectorName, text: searchQuery }, with_payload: true, limit: 100 })`.
  - [x] Map `result.points` to `RawQdrantResult[]` using updated helper that accepts gRPC payload structure.
  - [x] When query empty, fall back to `client.retrieve` or `restScroll` to fetch sample.
- [x] Maintain fallback to REST `scroll` when gRPC errors occur; annotate metadata `connection_mode: 'qdrant-grpc-fallback-rest'`.
- [x] Ensure `apiKey` header is applied for both gRPC and REST fallback.
- [x] Update logging to reflect gRPC usage (`logInfo('qdrant', 'Qdrant gRPC search succeeded', {...})`).

## Auxiliary updates
- [x] Update `createQdrantClientInstance` to `createQdrantRestClientInstance` and adjust call sites.
- [x] Ensure new helpers exported? (keep internal).
- [x] Remove outdated MCP references from Qdrant workflow comments/logs.

## Testing & Verification
- [x] Run `npm run lint` (fails: existing Prettier/ESLint violations across legacy files).
- [ ] Execute manual smoke test: `loadFromQdrant('knowledge graph entities')` via REPL or log injection (document results / failures).
- [x] Attempt gRPC connection to `mcp.robinsai.world:6334`; capture logs even if refused (document). *(Result: ENETUNREACH from container.)*

## Post-task updates
- [ ] Update this checklist with real-time statuses (`[/]`, `[x]`, `✅`).
- [ ] Sync architecture + checklist metadata to hybrid knowledge graph (document attempt if network blocked).
