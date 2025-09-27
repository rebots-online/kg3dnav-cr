# CHECKLIST — Vite Terminal Log Bridge & Neo4j Loader — 2025-09-27T22:13:52Z

## Preparation
- [x] Capture architecture plan in `docs/ARCHITECTURE/20250927T221352Z-vite-terminal-log-bridge.md`.
- [x] Re-attempt hybrid knowledge graph fetch (Neo4j HTTP 503 noted) and log failure via `logError('neo4j', ...)` during implementation if still unavailable.

## Implementation Steps
1. **Dynamic Neo4j Loader (`src/services/hkgLoader.ts`)**
   - ✅ Remove runtime `import neo4j from 'neo4j-driver'`; retain type-only imports `type { Driver, Session }`.
   - ✅ Add module-level cache `let cachedNeo4j: typeof import('neo4j-driver') | null = null`.
   - ✅ Implement `async function loadNeo4jDriver()` that attempts `await import(/* @vite-ignore */ 'neo4j-driver')` inside try/catch, logging `logDebug('neo4j', 'neo4j-driver dynamic import attempted', { endpoint })` and `logError` on failure with sanitized error message.
   - ✅ Update `createNeo4jDriver` to call `loadNeo4jDriver()` and handle null return by throwing a descriptive error after logging.
   - ✅ Ensure all direct references (`neo4j.auth.basic`, `neo4j.driver`) use the dynamically loaded module.
   - ✅ Enhance lifecycle logging: before verifying connectivity log `logInfo('neo4j', 'Verifying Neo4j connectivity', { endpoint, username })`; on success log `logInfo('neo4j', 'Neo4j connectivity verified', { endpoint })`; on failure log `logError('neo4j', 'Neo4j connectivity failed', { endpoint, code, message })`.
   - ✅ Guard session close/driver close with `if (driver)` checks from dynamic module.

2. **Log Store Console & Vite Bridge (`src/state/logStore.ts`)**
   - ✅ Introduce helper `function emitToConsole(entry: LogEntry)` mapping levels to `console.debug/info/warn/error` and ensure safe fallback when console methods missing.
   - ✅ Add helper `function emitToVite(entry: LogEntry)` that checks `import.meta.hot` existence and sends `import.meta.hot.send('hkg:log', { ...entry })`.
   - ✅ Modify `append` to invoke `emitToConsole` and `emitToVite` after state update.
   - ✅ Export `bridgeLogToDevServer` (alias of `emitToVite`) for potential reuse/tests.
   - ✅ Ensure helper functions are tree-shaken for production (guard with `if (import.meta.env.DEV)` around Vite send).

3. **Vite Plugin (`vite.config.ts`)**
   - ✅ Import `type Plugin` from `vite` and define `function agentLogBridgePlugin(): Plugin`.
   - ✅ Within `configureServer`, register `server.ws.on('hkg:log', (logEntry) => ...)` to print to terminal using `chalk`-less color codes (ANSI) based on level.
   - ✅ Format output as `[LEVEL] [source] message` and pretty-print `detail` when present via `console.dir`.
   - ✅ Append plugin to existing `plugins` array while preserving `react()` placement.
   - ✅ Guard plugin to only activate in dev mode (check `config.command === 'serve'`).

4. **Neo4j Fetch Error Handling**
   - ✅ In `hkgLoader.ts`, when catching dynamic import failure or driver instantiation errors, append log entry instructing fallback to MCP and propagate the error up for UI handling.
   - ✅ Update fallback path to ensure MCP fetch still runs if direct connection fails.

## Verification
- ✅ Run `npm run build` to confirm Rollup no longer fails on `neo4j-driver` import.
- [ ] Run `npm run lint` (fails on pre-existing prettier/react-three warnings; capture output for summary).
- [x] Document inability to connect to Neo4j HTTP endpoint (503) in final summary with references to logs.

## Post-Implementation
- [x] Update this checklist with final statuses, marking completed items as `✅` once tested.
- [x] Ensure architecture & checklist docs are referenced in PR summary.
