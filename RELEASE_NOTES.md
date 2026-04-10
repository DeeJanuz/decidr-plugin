# 0.1.14 — Session-Scoped Slideouts

## Fixes

- **Standalone dashboard slideouts now stay in the active tab.** DecidR's shared slideout manager now scopes its DOM and navigation stack to the current session container instead of reusing the first matching panel in the window.
- **Dashboard, list, and graph renderers now open details against their own host container.** Clicking a decision, project, bridge, or org settings panel in a newly opened standalone view no longer reopens the slideout in a previously used tab.
