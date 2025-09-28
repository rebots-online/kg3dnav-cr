# Checklist — Direct Qdrant Connectivity (UTC 20250927-225853)

## Preparation
- [x] Confirm inability to reach MCP-based endpoints and document observed error context.
- [x] Inspect existing Qdrant loader path (`src/services/hkgLoader.ts`) to understand current MCP dependency.

## Implementation
- [x] Add `@qdrant/js-client-rest` dependency to `package.json`.
- [x] Implement Qdrant client factory in `src/services/hkgLoader.ts` (or helper) leveraging `serviceConfig.baseUrl` and `apiKey`.
- [x] Update `loadFromQdrant` to:
  - [x] Use sanitized base URL from `serviceConfig.baseUrl`.
  - [x] Initialize Qdrant REST client once per call.
  - [x] Issue direct request to configured collection (`serviceConfig.collection`).
  - [x] Pass API key if provided.
  - [x] Remove MCP fallback logic.
  - [x] Log direct connection attempts and outcomes.
- [x] Ensure Qdrant result mapping handles REST response shape (`points` array) before calling `mapQdrantResults`.

## Validation
- [x] Run relevant TypeScript type checks via `npm run lint` or targeted build to ensure no type errors. *(Fails due to pre-existing lint violations outside touched scope; see logs.)*
- [x] Document inability to connect to external Qdrant during local test if network blocked. (`curl http://mcp.robinsai.world:6333/collections` → connection refused.)
- ✅ Update checklist status marks accordingly.

