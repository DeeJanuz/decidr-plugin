# DecidR Plugin

MCPViews plugin for [DecidR](https://app.decidrmcp.com) — decision governance for solo builders and teams.

Current source line: `manifest.json` version `0.1.52`, MCP endpoint `https://app.decidrmcp.com/api/mcp`, OAuth/email-code auth through Ludflow, and release asset `release/decidr.zip`.

## Renderers

- **decidr_list** — Universal entity list/detail view with slide-out panels
- **decidr_dashboard** — User Dashboard with health bars, project cards, and action items
- **decidr_timeline** — Executive timeline of planned work and actual activity across initiatives
- **decidr_github_auth** — Secure GitHub PAT entry form for outbound GitHub write actions

The repository still contains source for graph and audit renderers, but the current manifest exposes the four renderer names above in this plugin line.

## Organization Picker

The User Dashboard and timeline headers expose a glassmorphism organization picker. Click a row to switch the active org for the current session; click the star to persist that org as your default across sessions (backed by `/api/me/preferences`). Orgs whose plugin token is not yet connected show a "Connect" badge and can still be starred as the default.

Audit dashboard, audit report, and graph renderer source remains in the repository, but those standalone surfaces are hidden from this plugin line while we evaluate future focused plugins.

## Build

```bash
bash build.sh
```

Produces `release/decidr.zip`. Production is the default build channel and
uses `https://app.decidrmcp.com` with Ludflow auth at `https://app.ludflow.com`.
For a staging package, run:

```bash
DECIDR_MCPVIEWS_BUILD_CHANNEL=staging bash build.sh
```

The source manifest remains production-default. The generated ZIP is guarded so
production artifacts cannot contain staging endpoints, and staging artifacts
cannot contain production endpoints.

## Install

1. Build the plugin zip
2. In MCPViews Companion, go to Settings > Plugins > Install
3. Select `release/decidr.zip`

For release verification, check the GitHub release asset and, when the user-facing runtime is a bundled MCPViews app, inspect the bundled plugin manifest rather than relying only on this repo.
