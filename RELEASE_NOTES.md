# Unreleased

- **feat**: Open attached Ludflow documents in a dedicated left slideout without closing the active DecidR decision slideout.
- **feat**: Render Ludflow document previews with richer markdown support, including tables, images, task lists, references, code blocks, and Mermaid diagram hooks.
- **feat**: Show selectable Ludflow document version history in the preview panel, backed by DecidR MCP version payloads.
- **fix**: Normalize Ludflow version metadata from camelCase and snake_case payloads and suppress invalid dates instead of rendering `undefined NaN, NaN`.
- **fix**: Treat the Ludflow document preview as the most recently opened slideout for outside-click dismissal while allowing clicks on other attached Ludflow document links to open the next document.
