# DecidR Plugin

MCPViews plugin for [DecidR](https://app.decidrmcp.com) — a decision graph tool for solo builders.

## Renderers

- **decidr_list** — Universal entity list/detail view with slide-out panels
- **decidr_dashboard** — Initiative dashboard with health bars, project cards, and action items
- **decidr_graph** — Force-directed SVG graph of projects and bridges

## Build

```bash
bash build.sh
```

Produces `decidr-plugin.zip` ready for installation in MCPViews Companion.

## Install

1. Build the plugin zip
2. In Ludflow Companion, go to Settings > Plugins > Install
3. Select `decidr-plugin.zip`
