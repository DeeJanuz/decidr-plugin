# Unreleased

# 0.1.31

- **feat**: Extend planning decision governance so agents propose missing DecidR records through MCPViews review. Durable implementation choices should be proposed as decisions; lightweight work that did not require approval should be proposed as tasks under the relevant project or existing decision.

# 0.1.30

- **feat**: Add DecidR decision `STAGED` lifecycle guidance for commit governance. Installed plugin rules now tell agents committing code in any codebase to search authenticated DecidR organizations for matching existing decisions and move confident matches to `STAGED`, reserving `IMPLEMENTED` for deployment-codebase migration.

# 0.1.29

- **feat**: Render DecidR entity descriptions with a safe Markdown subset in list/detail and slideout views, including paragraphs, lists, emphasis, code, blockquotes, and safe links while keeping compact cards as plaintext previews.
- **fix**: Remove audit-event counts and the recent audit trail section from the main dashboard so audit review stays in the dedicated audit renderers and object slideouts.
