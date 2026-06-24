# DecidR Plugin UX Audit Notes

Date: 2026-06-24
Branch: `ui-design-overhaul-decidr-plugin`
Repo: `/Users/daenonjanis/projects/tribe-x/decidr-plugin`

## Scope

Audited the current in-progress DecidR MCPViews plugin renderer branch using a local harness at `dev/ux-audit/index.html`.

Surfaces tested:

1. Dashboard overview
2. Organization picker
3. Active Decisions expansion
4. Initiative expansion
5. Project slideout
6. List renderer
7. Timeline renderer
8. Mobile dashboard
9. Mobile timeline
10. GitHub auth form and validation

The harness uses local branch source plus mocked read APIs. No production DecidR, GitHub, or Ludflow writes were performed.

## Evidence

Screenshots:

- `screenshots/01-dashboard-overview.png`
- `screenshots/02-dashboard-org-picker.png`
- `screenshots/03-dashboard-active-decisions.png`
- `screenshots/04-dashboard-initiative-expanded.png`
- `screenshots/05-dashboard-project-slideout.png`
- `screenshots/06-list-projects.png`
- `screenshots/07-timeline-desktop.png`
- `screenshots/08-mobile-dashboard.png`
- `screenshots/09-mobile-timeline.png`
- `screenshots/10-github-auth.png`
- `screenshots/11-github-auth-validation.png`

Checks run:

- `node -c dev/ux-audit/mock-api.js`
- `node -c renderers/dashboard.js`
- `node -c renderers/list.js`
- `node -c renderers/timeline.js`
- `node -c renderers/shared/01-theme.js`
- `node -c renderers/shared/02-components.js`
- `npm run lane:status` in `/Users/daenonjanis/projects/tribe-x/mcpviews`

MCPViews lane status at audit time:

- Production lane: `~/.mcpviews`, port `4200`, production plugin channel
- Staging lane: `~/.mcpviews-staging`, port `4201`, staging plugin channel

## Strengths

The overhaul is directionally strong. It moves away from glassy decoration toward a denser, clearer governance workspace. The theme now has better dark/light tokens, flatter surfaces, visible `focus-visible`, reduced-motion handling, and stable hover states in `renderers/shared/01-theme.js`.

The dashboard now explains itself as a governance workspace instead of a generic dashboard. Next Steps are grouped, status signals are visible, and initiative expansion makes project ownership and GitHub state scannable.

The timeline is the best experience in the set. The `Now / Next / Risk` panels translate governance into action, which is easier to scan than a raw timeline alone.

The list renderer is calmer than the dashboard and works well as a browse surface.

The GitHub auth screen has useful trust copy: it clearly explains where the PAT goes and why DecidR sign-in matters.

## UX Risks

1. Mobile dashboard overflows horizontally.

Evidence: `screenshots/08-mobile-dashboard.png`.

The page leaves a large blank right gutter at 375px and several rows truncate or overlap. Recent-decision rows and long lifecycle pills are most affected. Current mobile override only covers dashboard root/header/stats in `renderers/shared/01-theme.js:4090-4094`; cards, row headers, copy buttons, and lifecycle pills still need narrow-width behavior.

Recommendation: add a mobile row system for DecidR cards: `min-width: 0`, `overflow-wrap: anywhere` for long action labels, card body stacked below badges, copy actions in a trailing menu or hover/focus action strip, and one-column stats under about 420px.

2. Timeline mobile grid is technically responsive but not usable.

Evidence: `screenshots/09-mobile-timeline.png`.

The timeline avoids horizontal overflow, but the board compresses into dense vertical stripes. The useful pieces on mobile are the stats and `Now / Next / Risk` lists, not the compressed board.

Recommendation: below tablet width, make timeline default to agenda mode: stats, date range, `Now / Next / Risk`, then grouped day cards. Put the grid behind an explicit `Inspect timeline grid` control with horizontal scroll.

3. Initiative collapse is mouse-only.

Evidence: DOM check on expanded initiative returned `tagName: DIV`, `role: null`, `tabindex: null`.

Source: `renderers/dashboard.js:1218-1238`.

Recommendation: render the initiative header as a real `<button>` or apply `UI.prepareInteractiveEntity`, add `aria-expanded`, `aria-controls`, and Enter/Space activation.

4. Slideout back/close button has no accessible name.

Evidence: slideout button inspection showed `.decidr-so-btn-back` with empty text and no `aria-label`.

Source: `renderers/shared/02-components.js:2911-2929`.

Recommendation: add `aria-label` using the existing `backLabel`, e.g. `aria-label="Close"` or `aria-label="Back"`.

5. Slideout has too many competing focus targets.

Evidence: project slideout had `78` focusable controls in one panel state.

Recommendation: make slideout information architecture stricter: sticky entity summary, section jump nav, primary actions only in header, secondary actions inside kebab/actions menu, activity collapsed to latest 5 by default, and task/decision/add forms behind explicit section-level buttons.

6. GitHub auth form labels and validation are not announced strongly enough.

Evidence: labels returned `forAttr: null`; validation status returned `statusRole: null`, `statusAriaLive: null`.

Source: `renderers/github-auth.js:29-53` and `renderers/github-auth.js:86-95`.

Recommendation: connect labels with `for`, add `aria-describedby` for help/error text, set validation status to `role="alert"` or `aria-live="polite"`, and set `aria-invalid="true"` on the token field after validation fails.

7. Dashboard duplicates the same decision work across too many sections.

Evidence: dashboard shows Next Steps, Active Decisions, Recent Decisions, and Pending Approvals, with the same staged/in-progress decisions repeated.

Recommendation: collapse into one primary `Priority Inbox` section with grouped decision/task rows and clear reasons. Move `Recent Decisions` into a lower `Recently changed` section and keep `Pending Approvals` only when it contains items not already in the inbox, or merge it into inbox as a reason.

8. Copy buttons are too visually prominent at scale.

Evidence: list renderer state had `12` copy controls for `4` visible projects after stats hydration.

Recommendation: show copy controls on hover/focus or inside a row action cluster. Keep them keyboard reachable, but reduce always-visible repetition.

9. Organization picker semantics are too subtle.

Evidence: org menu text collapsed to `OrganizationsMock DecidR OrgDefaultStaging Ops OrgConnect`.

Recommendation: separate row action from default action visually. Use explicit `Active`, `Default`, and `Connect` labels, and make `Connect organization` a clear CTA rather than a passive badge.

10. Visual system is cohesive but close to one-note dark slate.

Evidence: all major surfaces use the same dark background, subtle borders, and blue accents. This is calm, but status and entity differences rely heavily on small pills.

Recommendation: keep the flatter system, but assign surface roles: Dashboard = action prioritization, List = entity browsing, Timeline = temporal/risk scan, Slideout = entity command center. Use spacing, section rhythm, and action placement to distinguish surfaces more than adding more colors.

## Proposed UX Modification Package

### 1. Governance Home

Replace the dashboard's repeated work sections with:

- `Command Bar`: org picker, create menu, search, saved filter
- `Priority Inbox`: all user-relevant decisions/tasks/issues with reason, owner, next action, age
- `Portfolio Health`: initiative/project cards with progress and blockers
- `Recently Changed`: compact audit trail

This keeps the first screen focused on what to do next.

### 2. Entity Drawer V2

Make the slideout a consistent command center:

- Sticky header: type, title, lifecycle state, owner, primary action
- Section nav: Overview, Tasks, Decisions, Documents, Activity
- Default visible content: overview + top 3 tasks + top 3 decisions
- Activity collapsed by default with filters retained
- Secondary actions moved into `More`

This reduces cognitive load and tab-stop count.

### 3. Mobile First Rules

- Dashboard cards become one-column rows with wrapped lifecycle labels.
- Copy buttons collapse into row action menu.
- Timeline switches to agenda/list mode under tablet width.
- Slideout becomes full-screen on mobile with sticky bottom primary action.

### 4. Accessibility Pass

Do a focused pass on:

- Real buttons for every expandable header
- `aria-expanded` / `aria-controls` on disclosure controls
- Accessible names for icon-only controls
- Form label association and validation announcement
- Keyboard activation for all `data-entity-type` navigation
- Visible skip/section navigation for long panels

### 5. Cohesion Rules

Codify a shared renderer contract:

- One entity row/card primitive across dashboard, list, slideout, and timeline side panels
- One lifecycle badge pattern with label + shape, not color alone
- One action cluster model: primary action visible, secondary actions hidden until hover/focus/menu
- One empty/loading/error state set with `role="status"` or `role="alert"` as appropriate

## Evidence Limits

This audit used mocked read APIs, not a live production DecidR data set. It validates renderer behavior, hierarchy, responsiveness, and accessibility signals visible in DOM/screenshots, but it does not prove backend data correctness or full WCAG compliance.

Computer Use was not needed because the in-app browser could run and capture the local harness. The `file://` URL was blocked by browser policy, so the same harness was served on localhost.
