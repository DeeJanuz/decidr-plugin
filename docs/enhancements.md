# DecidR Plugin - Technical Debt & Enhancements Log

**Last Updated:** 2026-04-06
**Total Active Issues:** 1
**Resolved This Month:** 10

---

## Active Issues

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
