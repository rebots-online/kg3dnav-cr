# Checklist — HKG Endpoint Defaults & LLM Navigator Integration (2025-09-26 13:16 UTC)

## Pre-flight
- [x] Confirm inability to sync hybrid knowledge graph due to offline environment; note in commit message if needed.

## Settings Infrastructure
- [x] Create `src/state/settingsStore.ts` using Zustand + `persist` middleware storing:
  - [x] `mode` (`'unified' | 'perService'`) default `'unified'`.
  - [x] `unified.baseUrl` default `http://192.168.0.71:49160`.
  - [x] `services` object with keys `neo4j`, `qdrant`, `postgres`, `ollama`, `openRouter` each containing `baseUrl`, optional auth fields (`username`, `password`, `apiKey`, `model`).
  - [x] Selectors/helpers: `getState().getMCPBaseUrl()`, `getServiceConfig(name)`, `resetToDefaults()`.
  - [x] Export hook `useSettingsStore` mirroring existing `useStore.use` pattern for selectors needed by components.

## Connection Settings Drawer UI
- [x] Implement `src/components/ConnectionSettingsDrawer.tsx` featuring:
  - [x] Floating cog button toggling drawer open state (if not already in AppShell, export control callbacks).
  - [x] Tabbed interface (`Connections`, `LLM`).
  - [x] Unified/per-service toggle updating store.
  - [x] Inputs bound to store values with onChange wiring (text inputs for URLs, credentials; password field for API key with reveal toggle).
  - [x] Warning about localStorage persistence + Reset button (calls `resetToDefaults`).
  - [x] Callback prop `onClose` and optional external control via `isOpen` prop.

## AppShell Integration
- [x] Update `AppShell.tsx` to render `ConnectionSettingsDrawer` and manage open/close state.
  - [x] Add cog button near existing header or overlay accessible.
  - [x] Pass `onConnectionChanged` (if needed) or at least ensure DataSourcePanel can signal to open drawer (via context or event bus).

## Data Source Panel Enhancements
- [x] Inject settings quick-link (e.g., small cog icon) to open settings drawer via prop/callback from `AppShell`.
- [x] Implement JSON file upload flow when `DATA_SOURCES.FILE` active:
  - [x] Add drop zone & hidden `<input type="file" accept="application/json">`.
  - [x] On file selection call new helper `loadGraphFromJsonFile(file)`.
  - [x] Handle success by calling `loadKnowledgeGraphData` and updating `status['file']` to `'connected'` with `lastLoad` metadata.
  - [x] Handle validation errors with user-friendly message + `status['file']='error'`.
  - [x] Preserve existing auto-load logic for other sources.

## JSON Loader Service
- [x] Create `src/services/jsonGraphLoader.ts` exporting:
  - [x] `parseKnowledgeGraphJson(raw: unknown)` returning `KnowledgeGraphResult` (reuse type from `hkgLoader`).
  - [x] `loadGraphFromJsonFile(file: File)` reading text via `file.text()`, parsing JSON, calling validator.
  - [x] Validation rules: ensure `knowledge_graph.entities` array with objects containing `name`, `type`; `relationships` with `source`, `target`; fill defaults for optional fields; attach metadata timestamp + source `'file_upload'`.

## HKG Loader Updates
- [x] Modify `hkgLoader.ts`:
  - [x] Import `useSettingsStore.getState()` (without React hook) for base URLs.
  - [x] Update `findWorkingMCPServer` to prioritize `settingsStore.getMCPBaseUrl()` then fallback list (`192.168.0.71` variations, env, localhost`).
  - [x] When per-service mode active, direct each loader to use service-specific base URL if provided.
  - [x] Ensure fetch helper respects credentials (basic auth for neo4j/postgres, API key header for qdrant if present).
  - [x] Update return metadata to include `connection_mode` and `endpoint` info.

## Env Config Update
- [x] Change `src/config/env.ts` default `HKG_MCP_BASE_URL` to `http://192.168.0.71:49160` and expose new helper for fallback when settings absent.

## LLM Client Service
- [x] Implement `src/services/llmClient.ts` with:
  - [x] Types `LLMProviderResult`, `LLMError`.
  - [x] `buildPrompt(context)` summarizing up to 5 entities (name/type/description snippet).
  - [x] `callOllama(prompt, settings)` using fetch POST to `${ollama.baseUrl}/api/chat` with `model` default `'llama3.1'`, timeout handling.
  - [x] `callOpenRouter(prompt, settings)` hitting `${openRouter.baseUrl || 'https://openrouter.ai/api/v1/chat/completions'}` with `model` default `'openrouter/x-ai/grok-4-fast:free'`, API key header `Authorization: Bearer ${apiKey}`.
  - [x] `navigateWithLLM(prompt, context)` orchestrating fallback order (Ollama → OpenRouter) and returning provider + message.

## AI Navigator Update
- [x] Refactor `AINavigationChat.tsx`:
  - [x] Inject new prop or context to receive `openSettings` callback for quick access.
  - [x] Maintain existing keyword-based highlighting and layout suggestions.
  - [x] Around heuristics results, call `navigateWithLLM` asynchronously, push AI message with provider label and handle spinner state.
  - [x] On error, show fallback text but include instructions referencing settings.
  - [x] Display metadata (provider + timestamp) in message bubble.

## Wiring Between Components
- [x] Ensure `AppShell` passes `onOpenSettings` callback to `DataSourcePanel` and `AINavigationChat` for consistent cog access.
- [x] Confirm `settingsStore` selectors used without causing React hook misuse (call inside components using `.use` pattern or `useSettingsStore()` hook with selectors).

## Documentation
- [x] Update README or new doc section summarizing new defaults + settings drawer usage (if necessary).
- [x] Mention HKG sync limitation note referencing inability to reach remote graph in this environment.

## Post-Implementation
- [ ] Run `npm run lint` (or equivalent) if available; otherwise document unavailability.
- [ ] Update checklist item statuses (mark ✅ once tests run and pass).
- [ ] Prepare final summary referencing new architecture/checklist docs.
