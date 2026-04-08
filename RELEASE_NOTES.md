# 0.1.9 — Default-organization picker

## Features

- **Default-organization picker**. Star button per row in `UI.orgPicker` persists a user-level default via the new `/api/me/preferences` endpoint, independent of the active-org switch. Star state lives alongside the active-row highlight so users can set a default on an org whose plugin token isn't connected yet.
- **Picker UI rebuilt** to match the Companion app-launcher glassmorphism — pill trigger with building icon, backdrop-blur dropdown, uppercase "Organizations" caption, accent-ghost active row with checkmark slot, "Default" pill badge, "Connect" badge for no-token orgs, hover-reveal stars. Dropdown is right-anchored to match the header's `justify-content: space-between` layout.
- **Single-org users now see the picker** (the `orgs.length <= 1` guard was removed) so they can still set a persistent default.
- **New API client methods** `API.getUserPreferences()`, `API.setDefaultOrg(orgId)`, `API.clearDefaultOrg()` bound to `/api/me/preferences`, plus a new `API.resolveAndBindTargetOrg({ pushedOrgId })` helper that renderers use as a one-call preflight (fetches orgs/tokens/prefs, annotates `tokenStatus`, resolves `pushed > default-with-token`, switches if needed, and is idempotent across refetches).

## Fixes

- **Default-org honored on fresh mount**. Dashboard and graph renderers now run `API.resolveAndBindTargetOrg` before their data `Promise.all`, so the main fetches execute against the correct org's token instead of whatever `withReady` bound first. Previously the preference was silently ignored and users saw an empty dashboard until they manually clicked a row.
- **Graph refetches don't loop back to the default**. The preflight only runs its routing logic when no org is currently bound, so explicit user-clicked switches survive `_fetchGraphData` re-runs.
- **`API.autoInit` propagates Tauri "No stored token" rejections** for explicitly targeted orgs instead of silently resolving with an empty token and triggering a 401 cascade. The `window.__decidrToken` fallback is preserved for non-targeted boots.
- **Picker row markup** restructured into sibling buttons (option + star) to eliminate invalid nested-button markup and event bubbling.
- **Stray `;` in `theme.js`** that terminated the picker CSS string mid-assignment has been removed — prior builds were shipping the picker with no styles applied to the lower half of the rules.

## Refactor

- Preflight org-resolution policy hoisted from dashboard + graph renderers into `API.resolveAndBindTargetOrg` (resolved MED-006).
- New picker SVG icons (`ICON_BUILDING`, `ICON_CHEVRON_SMALL`, `ICON_STAR_FILLED`, `ICON_STAR_OUTLINE`, `ICON_CHECK_BOLD`) hoisted to module-level constants alongside the existing `ICON_*` set in `02-components.js` (resolved LOW-007).
- `UI.orgPicker` row markup now runs all backend-sourced strings (org name, id, title, aria-label, display label) through `UI.escapeHtml` at the component boundary (resolved LOW-008).
