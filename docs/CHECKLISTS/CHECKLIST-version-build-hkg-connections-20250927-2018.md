# Checklist: Version Build Formatting & HKG Direct Source Normalization (2025-09-27 20:18 UTC)

## Pre-Coding
- [x] Review existing architecture docs and source layout for build info + hkg loader context.
- [x] Attempt hybrid knowledge graph sync check (document network refusal in architecture).
- [x] Confirm inability to update remote HKG recorded in operations log (append note after coding).

## Build Info Updates (`src/config/buildInfo.ts`, UI consumers)
- [x] Update `computeVersionBuild` to follow Python-derived formula using current epoch buckets when needed.
- [x] Add helper to derive dotted display string (e.g., `formatVersionBuildForDisplay`) and expose alongside canonical value.
- [x] Adjust `getBuildInfo` / `fetchBuildInfo` to include display string.
- [x] Update UI components (`AppShell.tsx`, `AboutModal.tsx`, `SplashScreen.tsx`) to render dotted format while preserving canonical string for tooltips/text where necessary.

## HKG Loader Normalization (`src/services/hkgLoader.ts`)
- [x] Implement helpers: `isPlainObject`, `normalizeEntities`, `normalizeRelationships`, `mergeMetadata`, `normalizeKnowledgeGraphResponse`.
- [x] Refactor Neo4j loader to leverage helpers (envelope detection, metadata merge, fallback mapping).
- [x] Refactor Qdrant loader to normalize both envelope and array payloads.
- [x] Refactor PostgreSQL loader similarly, ensuring audit metadata preserved.
- [x] Ensure metadata counts updated after normalization and connection mode/endpoint recorded.

## Validation
- [x] Run `npm run lint` to verify static analysis passes. *(Fails due to pre-existing repository formatting/type issues; logged for awareness.)*
- [x] Manually inspect generated build info string formatting via unitless sanity check (confirmed regex-based formatting yields `v1.03.8083` style display strings).
- [x] Document inability to sync architecture/checklist to hybrid graph due to network constraint.

## Post-Work
- [x] Update checklist statuses (mark completed/validated items with ✅ where applicable).
- [x] Summarize testing + outcomes in final report with citations.
