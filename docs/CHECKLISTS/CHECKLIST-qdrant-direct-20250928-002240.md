# Checklist — Qdrant Direct Connection — 2025-09-28 00:22:40 UTC

Legend: [ ] Not started · [/] In progress · [x] Done, awaiting test · ✅ Tested & complete

## Preparation
- [x] Confirm inability to reach hybrid knowledge graph services is documented (retain TODO markers in architecture file).
- [x] Ensure package dependencies already include `@qdrant/js-client-rest` and `@qdrant/js-client-grpc` (no action expected, verify).

## settingsStore.ts updates
- [x] Modify `deriveQdrantGrpcAddress(raw: string | undefined)` to:
  - Strip protocols and default to host `mcp.robinsai.world` when missing.
  - Always return `useTLS: false` (explicit plaintext override) while keeping port inference (`6333` → `6334`).
  - Logically separate detection of custom gRPC ports while ignoring HTTPS scheme.
- [x] Add exported helper `getQdrantConnectionConfig()` returning `{ baseUrl, collection, apiKey, embeddingModel, dimension }` using sanitized defaults from settings state.
- [x] Update any call sites in `hkgLoader.ts` to consume `getQdrantConnectionConfig()` instead of duplicating logic.

-## hkgLoader.ts updates — direct loader
- [x] Import and use `getQdrantConnectionConfig()`.
- [x] Replace manual base URL/collection/api key extraction with helper output.
- [x] When constructing gRPC client, force `https: false` and add log metadata `insecure: true`.
- [x] Ensure `deriveQdrantGrpcAddress` output populates `transport_host`, `transport_port`, and `insecure` in log + metadata fields.
- [x] After successful gRPC or REST load, annotate `metadata` with:
  - `qdrant_endpoint` (base URL),
  - `qdrant_collection`,
  - `transport_insecure: true` when TLS disabled.
- [x] Confirm REST client creation uses sanitized base URL and API key; add explicit warning log if API key missing.

-## hkgLoader.ts updates — sharded search
- [x] Remove dependency on `findWorkingMCPServer()` for Qdrant shard queries; instead reuse direct Qdrant connection details.
- [x] Implement helper `performDirectQdrantSearch({ baseUrl, apiKey, collection, query, limit })` using `fetch` POST to `/collections/{collection}/points/query` with document vector payload and API key header.
- [x] Update sharded search to call new helper, maintain timeout control, and log using direct endpoint info.
- [x] Adjust error handling to indicate direct Qdrant failures and fallback behavior.

## Telemetry & Metadata
- [x] Ensure all log statements referencing MCP for Qdrant are removed or updated to mention direct endpoints.
- [x] Add TODO comment referencing deferred hybrid knowledge graph synchronization (`HKG_SYNC_QDRANT_20250928`).

## Validation
- [x] Run `npm run lint` and capture output (acknowledge existing issues if they persist).
- [x] Document inability to reach external Qdrant if connection fails during local testing.
- [x] Update checklist statuses to ✅ where applicable after testing.
