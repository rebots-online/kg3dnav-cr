# Checklist — Initial Load Experience Overlay (2025-09-29T04:03:48Z)

## Pre-Coding
- [x] Architecture document created (docs/ARCHITECTURE/20250929T040348Z-initial-load-overlay.md).
- [x] Confirm no additional AGENTS.md constraints (none found).

## Implementation Steps
1. [x] **Create component** `src/components/InitialLoadOverlay.tsx`
   - [x] Import React hooks (`useMemo`) if needed and zustand selectors: `useEntities`, `useIsFetching`, `useCaption` from `../state/store`.
   - [x] Compute `hasEntities`, `isBusy`, `message` (fallback message string when caption empty).
   - [x] Render `null` when `hasEntities` true.
   - [x] Otherwise render `div` overlay with inline styles:
     - [x] Position: `absolute`, `inset: 0`, display flex center, `zIndex: 900`, pointer events none for wrapper; inner card pointer events auto.
     - [x] Inner card: dark translucent background, border, blur (`backdropFilter`), padding, max width 420, text align center.
     - [x] Include heading (app name), subtext instructions, dynamic `message`, spinner indicator (CSS animation using inline keyframes or simple rotating border via inline `@keyframes` + style). Use `<div role="status" aria-live="polite">` semantics.
   - [x] Ensure TypeScript types correct.

2. [x] **Integrate overlay** in `src/components/AppShell.tsx`
   - [x] Import `InitialLoadOverlay` at top.
   - [x] Render `<InitialLoadOverlay />` inside `<main>`, after existing panels but before splash/about modals (to keep z-index layering) or adjust order according to architecture doc.

3. [x] **Optional store tweak** (only if needed) — ensure `useCaption` selector exported; confirm existing export, otherwise add in `src/state/store.ts`.
   - [x] If export missing, add `export const useCaption = () => useStore((s) => s.caption)`.

4. [x] **Styling verification**
   - [x] Ensure overlay pointer-events do not block interactions once hidden (conditionally render `null`).
   - [x] Spinner accessible fallback (aria-hidden, adds `Loading…` text for screen readers).

## Testing & Verification
- [x] Run `npm run build` to ensure TypeScript + bundler succeed. *(Fails due to existing Vite externalization error for `@bufbuild/connect-node` → `util.promisify`.)*
- [x] (Optional) `npm run lint` if available (check package.json scripts) — run if script exists. *(Fails with pre-existing lint violations across repository unrelated to current changes.)*
- [ ] Manual verification recommended (npm run dev) though not executed here.

## Post-Coding
- [ ] Update checklist statuses accordingly (mark ✅ after tests pass).
- [x] Commit changes with descriptive message.
- [x] Generate PR via `make_pr` with summary referencing overlay enhancement.

