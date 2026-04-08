# DecidR Plugin - Technical Debt & Enhancements Log

**Last Updated:** 2026-04-07
**Total Active Issues:** 3
**Resolved This Month:** 11

---

## Active Issues

### [LOW-005] HTML injection sink in github-auth status element
- **Severity:** Low
- **Introduced:** 2026-04-07 (commit 8abb974)
- **File:** `renderers/github-auth.js` (line ~90, `showStatus`; lines ~97-148, `describeError`)
- **Description:** `showStatus` was changed from `statusEl.textContent = message` to `statusEl.innerHTML = message` so `describeError` can emit `<strong>` and `<br>` for richer formatting. Inputs in this commit are safe (hard-coded literals plus `err.bodyMessage`/`err.message` from the DecidR API), but `detail` is interpolated into the 400/422 and 5xx templates without escaping. If a future error path lets attacker-influenced text reach `bodyMessage`, the renderer would render it as HTML.
- **SOLID Impact:** None directly; security/encapsulation concern.
- **Suggested Fix:** Either (a) escape `detail` with a small `escapeHtml()` helper before interpolation, or (b) restructure `describeError` to return `{ variant, prefixHtml, detailText }` and have `showStatus` build the DOM with `textContent` for the detail portion and `innerHTML` only for the trusted prefix.
- **Priority:** Low — current inputs are trusted; fix opportunistically when touching this file.

### [LOW-006] Transitional dual API for token check (`hasToken()` vs `_hasToken`)
- **Severity:** Low
- **Introduced:** 2026-04-07 (commit 8abb974)
- **File:** `renderers/shared/00-api-client.js` (lines 127-129 public method, lines 592-595 legacy defineProperty), `renderers/github-auth.js` (line ~158 fallback shim)
- **Description:** A new public `API.hasToken()` was added as the preferred way to check token presence. The old non-enumerable `_hasToken` getter is kept for backward compatibility, and the github-auth renderer uses a `typeof` shim to prefer the new method but fall back to the legacy property. This is a transitional state, not a permanent design.
- **SOLID Impact:** Mild ISP — there are now two ways to express the same query, slightly fattening the API surface.
- **Suggested Fix:** Once the API client bundle ships everywhere, drop the `_hasToken` `defineProperty` block in 00-api-client.js and the `typeof API.hasToken === 'function'` shim in github-auth.js.
- **Priority:** Low — purely cleanup, no behavioral risk.

### [LOW-004] Cross-file private var leakage via UI._* aliases
- **Severity:** Low
- **Introduced:** 2026-04-06 (commit 8c7428a)
- **File:** `renderers/shared/02-components.js` (lines ~2707-2713), `renderers/shared/03-slideouts.js` (lines ~13-20)
- **Description:** To split slideout renderers into `03-slideouts.js`, module-private vars (`ENTITY_ICONS`, `ICON_TRASH`, `ICON_EDIT`, `ICON_CHEVRON_DOWN`, `ICON_CALENDAR`, `STATUS_LABELS`, `statusLabel`) are re-exposed as `UI._ENTITY_ICONS`, `UI._ICON_TRASH`, etc. This is a pragmatic workaround for the no-`import`/IIFE convention, but it leaks implementation details onto the shared `__decidrUI` global and creates load-order coupling (03 must run after 02, enforced only by filename ordering in `build.sh`).
- **SOLID Impact:** Mild DIP violation — 03-slideouts depends on concrete private state of 02-components rather than a stable abstraction. Encapsulation weakened.
- **Suggested Fix:** Promote truly shared constants (`ENTITY_ICONS`, `STATUS_LABELS`, icon SVGs, `statusLabel`) to a dedicated `renderers/shared/00b-constants.js` or similar, and reference them as public `UI.ENTITY_ICONS` etc. from both files. This removes the underscore-prefixed "private-but-public" pattern and makes the load-order contract explicit.
- **Priority:** Low — functional and acceptable given the IIFE constraint; revisit if a third file needs the same aliases.

---

## Resolved Issues

#### [RESOLVED HIGH-001] MCP URL hardcoded to localhost in manifest.json
- **Resolved:** 2026-04-06 (already at production URL)
- **Description:** The `mcp.url` was previously changed to localhost during development. Found already reverted to production URL `https://app.decidrmcp.com/api/mcp`.

#### [RESOLVED HIGH-002 / MED-001] Positional array indexing in dashboard refresh
- **Resolved:** 2026-04-06 (already using named fetches object)
- **Description:** The `refreshDashboard` function previously used positional `results[N]` indexing. Found already refactored to use named `rf` object matching the initial load pattern.

#### [RESOLVED MED-002] Graph re-render on GitHub counts
- **Resolved:** 2026-04-06
- **Description:** GitHub counts were fetched fire-and-forget without triggering a re-render. Fixed by calling `renderGraphWithData(graphData)` after counts arrive.

#### [RESOLVED MED-003] Archive handler duplication across entity types
- **Resolved:** 2026-04-06
- **Description:** Five nearly identical archive handler blocks extracted into `UI.SlideOut._wireArchiveEvent(panel, btnSelector, entityType, id, archiveFn)`. Each wire function now uses a single-line call.

#### [RESOLVED MED-004] Slideout renderers for issue/PR/repo defined inline
- **Resolved:** 2026-04-06
- **Description:** Inline renderers extracted as `UI.slideOutIssue`, `UI.slideOutPR`, `UI.slideOutRepo` matching the pattern of existing entity slideouts.

#### [RESOLVED LOW-001] 02-components.js approaching unmanageable size
- **Resolved:** 2026-04-06
- **Description:** All slideout renderers (9 functions + githubSection helper) moved to new `renderers/shared/03-slideouts.js`. 02-components.js reduced from ~3735 to ~2753 lines. Build.sh updated to include the new file.

#### [RESOLVED LOW-002] _renderGithubSection not registered on UI object
- **Resolved:** 2026-04-06
- **Description:** Renamed to `UI.githubSection()` and updated all 3 call sites. Now accessible to any renderer.

#### [RESOLVED LOW-003] Label badge rendering logic inlined in issue slideout
- **Resolved:** 2026-04-06
- **Description:** Extracted as `UI.labelBadge(label)` helper handling color normalization, hex prefix, and translucent background styling. Issue slideout updated to use it.

#### [RESOLVED MED-005] Hand-rolled entity-link markup duplicated in issue/PR slideouts
- **Resolved:** 2026-04-06 (commit 304867c)
- **Description:** Issue and PR slideouts each hand-rolled `decidr-so-decision-item` markup for heterogeneous linked-entity lists, duplicating ~10 lines of markup and risking divergence from the canonical `decidr-so-list-item` card. Resolved by extending `UI.SlideOut._renderEntityList` with `opts.showTypeBadge` (OCP-friendly additive extension) so both slideouts can route through the shared helper. Also fixed PR status badge to always render with a `pr.status -> pr.githubState -> OPEN` fallback chain matching `githubPRsList` behavior.

#### [RESOLVED] Pre-existing meta rendering bug in issue/PR/repo slideouts
- **Resolved:** 2026-04-06 (commit b0f127a)
- **Description:** Issue, PR, and repo slideout meta sections were using `{ label, value }` format that did not render correctly. Fixed by switching to `{ html }` format with proper escaping and formatting.

---

## Scoring History

| Date | Commit | Score | Rating |
|------|--------|-------|--------|
| 2026-04-06 | PR #2 (feature/github-integration) | 62/100 | Acceptable |
| 2026-04-06 | b0f127a | 68/100 | Acceptable |
| 2026-04-06 | 05ad0fa | 72/100 | Good |
| 2026-04-06 | 8c7428a | 88/100 | Good |
| 2026-04-06 | 304867c | 90/100 | Excellent |
| 2026-04-07 | 8abb974 | 84/100 | Good |
