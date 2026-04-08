# 0.1.11 — Organization settings + invite management

## Features

- **Organization settings slideout**. Dashboard and graph org pickers now reveal a left-side gear for orgs where the viewer is `OWNER` or `ADMIN`. Clicking it opens a dedicated org settings panel instead of forcing member management into a generic list view.
- **Member management UI in MCPViews**. The new slideout lets admins invite members, change roles, remove members, review pending invites, and cancel pending invites without leaving the renderer.
- **Cross-org settings navigation**. Clicking the gear for a non-active org now switches the active org first, refreshes the renderer data, and then opens the correct org’s settings panel in that context.
- **Dedicated org-admin API client methods** were added for settings payloads, invitations, role updates, removals, and invite cancellation so the renderers can manage org membership directly against DecidR MCP.

## Fixes

- **Manifest organization tools now match the live MCP contract**. The plugin advertises `list_member_invites`, and `manage_member` is documented as invitation-based rather than direct user creation.
- **Dashboard/graph refresh hooks now return promises**, which makes the org-switch-then-open-settings flow deterministic instead of racing the slideout open.
- **Settings control visibility follows org role context** so regular members don’t get a dead-end admin affordance in the org picker.

## Refactor

- Added a new `organization-settings` slideout entity type so org admin panels reuse the existing shared slideout stack, loading state, and mutation refresh pipeline instead of creating a second overlay system.
- Reused the shared org picker in both dashboard and graph with common settings-button semantics, keeping the interaction model consistent across renderers.
