# Checklist — HKG Defaults & LLM Navigator Reliability (2025-09-26 13:34 UTC)
- **Architecture Reference:** `docs/architecture/ARCHITECTURE-hkg-llm-defaults-20250926-1334.md`
- **Project UUID:** d04ee192-2eb2-45f5-8375-55380eacbe52
- **Legend:** [ ] Not started · [/] In progress · [x] Done (untested) · ✅ Tested & complete

## Preparatory Tasks
1. [x] Capture lint baseline (`npm run lint`) to list current violations affecting touched files.
2. [x] Inspect hybrid knowledge graph sync status (MCP at 192.168.0.71 unreachable from sandbox; noted for follow-up).

## Settings & Config Defaults
3. [x] Update `src/state/settingsStore.ts`
   - [x] Replace exported `.use` convenience with dedicated selector helpers (lint still flags hook naming on property assignments; consider refactor to standalone hooks later).
   - [x] Define `ConnectionMode`, `EndpointAuth`, `EndpointConfig`, `ServiceKey` types explicitly exported for reuse.
   - [x] Ensure all default base URLs point to `192.168.0.71` addresses (MCP:49160, Neo4j:7474, Qdrant:6333, Postgres:5432, Ollama:11434) and fallback for OpenRouter base `https://openrouter.ai/api/v1` with default model `openrouter/x-ai/grok-4-fast:free`.
   - [x] Export pure helper `getServiceConfigSnapshot(key)` for non-hook contexts (services) to avoid lint issues.
   - [x] Add unit-safe metadata (e.g., `DEFAULT_SERVICE_PORTS` constant) if needed for clarity.

4. [x] Revise `src/config/env.ts`
   - [x] Confirm fallback base remains `http://192.168.0.71:49160` and add docblock referencing settings store integration.

## Loader & Service Typing
5. [x] Update `src/services/hkgLoader.ts`
   - [x] Introduce shared TypeScript interfaces (`KnowledgeGraphMetadata`, `KnowledgeGraphResponse`, etc.) for loader returns.
   - [x] Replace `any` usage with typed helpers; ensure helper functions return typed Promises.
   - [x] Refactor base URL retrieval to call `getMCPBaseUrl()` from new settings helper (with env fallback) and ensure trailing slashes trimmed.
   - [x] Guarantee search + load functions respect connection defaults and propagate thrown errors with context string.

6. [x] Update `src/services/jsonGraphLoader.ts`
   - [x] Define type-safe coercion for JSON input/output.
   - [x] Validate JSON schema (entities/nodes/edges) gracefully; include file name + timestamp metadata in result.
   - [x] Remove `any` and ensure return type aligns with state loader expectations.

7. [x] Update `src/services/llmClient.ts`
   - [x] Use new settings helper to read service configs without violating hooks lint rules.
   - [x] Ensure fallback labeling returns `{ provider: 'openrouter' }` when OpenRouter responds and `{ provider: 'fallback' }` if heuristics/resolution occurs otherwise.
   - [x] Enforce default host `http://192.168.0.71:11434` for Ollama when settings missing.
   - [x] Improve error messages to guide connection troubleshooting.

## UI Components
8. [x] Update `src/components/DataSourcePanel.tsx`
   - [x] Import typed loader results; remove `any` by referencing new interfaces.
   - [x] Persist `lastLoad` metadata with explicit type and timestamp.
   - [x] Use selector hooks compliant with eslint (e.g., `const isSidebarOpen = useStore((s) => s.isSidebarOpen)` per project conventions).
   - [x] Display default IP addresses in tooltip/labels where applicable.
   - [x] Ensure JSON upload errors render user-friendly text.

9. [x] Update `src/components/AINavigationChat.tsx`
   - [x] Type `ChatMessage` & matched entity list using shared interfaces.
   - [x] Distinguish fallback provider text when OpenRouter triggered vs. both failed.
   - [x] Ensure `useEffect` dependency arrays are correct and `Math.random` usage isolated where necessary.
   - [x] Provide settings button when provider error occurs.

10. [ ] Update `src/components/AppShell.tsx`
    - [ ] Wire new selector helpers for settings store (existing usage unaffected; revisit if needed).
    - [ ] Ensure `ConnectionSettingsDrawer` open/close logic typed and lint-clean.

11. [x] Add/Update `src/components/ConnectionSettingsDrawer.tsx`
    - [x] Adopt new types from settings store, remove `any`, ensure handlers typed.
    - [x] Default form fields show `192.168.0.71` values.
    - [x] Provide inline validation for empty API key when provider selected.

## Documentation
12. [x] Update `README.md`
    - [x] Document default IP/port assignments.
    - [x] Provide instructions for configuring Ollama + OpenRouter credentials.
    - [x] Mention JSON graph upload workflow.

## Verification
13. [x] Run `npm run lint` (still failing due to legacy Scene3D/store formatting and hook-pattern violations; see log for follow-up).
14. [ ] Smoke test via `npm run build` or targeted script if faster (ensure passes).
15. [/] Summarize results & update checklist statuses accordingly.

## Checklist Sync
16. [/] Record updated checklist + results in hybrid knowledge graph (pending remote access).
