# DecidR Plugin - Technical Debt & Enhancements Log

**Last Updated:** 2026-04-06
**Total Active Issues:** 0
**Resolved This Month:** 10

---

## Active Issues

None. All identified issues have been resolved.

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
