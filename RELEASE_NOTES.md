# 0.1.12 — Resend pending invites

## Features

- **Pending invite resend action**. Organization settings now include a `Resend` button for each pending invite so admins can re-send the invitation email without canceling and recreating it.
- **Clearer invite entry point**. The member form action now reads `Send New Invite`, which makes the difference between creating a fresh invite and resending an existing one much more obvious.

## Fixes

- **Plugin API client now supports resend_invite** against the DecidR MCP org-members endpoint, keeping the renderer aligned with the latest backend contract.
- **Manifest tool guidance reflects the resend action** so MCPViews has the current member-management semantics for pending invites.
