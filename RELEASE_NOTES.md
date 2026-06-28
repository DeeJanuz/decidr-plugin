# Unreleased

## 0.1.56-rc.1

- **feat**: Add a visible `Org settings` button next to the dashboard organization picker so organization settings are discoverable without opening the picker menu.
- **fix**: Reuse the existing organization settings slideout flow for both the new dashboard button and per-organization menu settings actions, including organization switching and sign-in fallback handling.
- **fix**: Render the dashboard settings button when an active organization ID is available, even if the active organization object is not resolved in the picker list.
