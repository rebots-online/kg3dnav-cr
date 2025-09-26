# Checklist — HKG Defaults & JSON Loader Verification (2025-09-26 13:56 UTC)

## Legend
- [ ] — Not started
- [/] — In progress
- [x] — Implemented, pending test
- ✅ — Tested & complete

## Tasks
1. **Hybrid Knowledge Graph Alignment**
   - [x] Attempt connectivity check to Neo4j/Qdrant/Postgres endpoints at `192.168.0.71`; document outcome (envoy 503 responses observed).
   - [ ] Queue sync of this architecture & checklist into hybrid Neo4j store once access to `192.168.0.71` is restored.

2. **Settings Store Hardening (`src/state/settingsStore.ts`)**
   - [x] Introduce `DEFAULT_SERVICE_CONFIGS` helper mirroring existing defaults to avoid mutation.
   - [x] Add `sanitizeBaseUrl` utility that trims, removes trailing slash, and returns `null` for empty inputs.
   - [x] Update `updateUnifiedBaseUrl` to apply sanitizer and fall back to `MCP_DEFAULT` when result is null.
   - [x] Update `updateService` so blank `baseUrl` reverts to default per service and other fields are trimmed when appropriate.
   - [x] Ensure `getServiceConfig` and `getMCPBaseUrl` always return a non-empty string (defaulting to 192.168.0.71 host values).

3. **Connection Settings Drawer (`src/components/ConnectionSettingsDrawer.tsx`)**
   - [x] Ensure UI reflects sanitized values immediately (e.g., by reading values from store after updates rather than stale local state).
   - [x] Add helper text confirming that clearing a field restores `192.168.0.71` defaults.

4. **JSON Graph Loader (`src/services/jsonGraphLoader.ts`)**
   - [x] Extend `parseKnowledgeGraphJson` result metadata with `connection_mode: 'file_upload'` and `endpoint` describing file origin.
   - [x] Include file-derived metadata fields (`source_file_*`) when loading to reinforce audit trail.

5. **Data Source Panel (`src/components/DataSourcePanel.tsx`)**
   - [x] Display endpoint metadata string (e.g., `endpoint` or `connection_mode`) within the “Last Load” summary.
   - [x] Confirm JSON upload path surfaces the enriched metadata.

6. **LLM Navigator Verification**
   - [x] Confirm `navigateWithLLM` still pulls Ollama/OpenRouter endpoints from sanitized settings (manual code inspection post-change).
   - [x] Update documentation/comments if default host logic changed.

7. **Testing**
   - [x] Run `npm run lint` to ensure no regressions introduced by changes. *(Fails on pre-existing formatting/type issues; see lint log for details.)*
   - [x] Document inability to reach external hosts if networking remains blocked. *(Envoy 503 responses recorded.)*
