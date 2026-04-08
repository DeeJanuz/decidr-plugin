# DecidR Plugin

MCPViews plugin for [DecidR](https://app.decidrmcp.com) — a decision graph tool for solo builders.

## Renderers

- **decidr_list** — Universal entity list/detail view with slide-out panels
- **decidr_dashboard** — Initiative dashboard with health bars, project cards, and action items
- **decidr_graph** — Force-directed SVG graph of projects and bridges
- **decidr_github_auth** — Secure GitHub PAT entry form

## Organization Picker

The dashboard and graph headers expose a glassmorphism organization picker. Click a row to switch the active org for the current session; click the star to persist that org as your default across sessions (backed by `/api/me/preferences`). Orgs whose plugin token is not yet connected show a "Connect" badge and can still be starred as the default.

## Build

```bash
bash build.sh
```

Produces `decidr-plugin.zip` ready for installation in MCPViews Companion.

## Install

1. Build the plugin zip
2. In Ludflow Companion, go to Settings > Plugins > Install
3. Select `decidr-plugin.zip`
