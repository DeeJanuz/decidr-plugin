# Unreleased

# 0.1.30

- **feat**: Add DecidR decision `STAGED` lifecycle guidance for commit governance. Installed plugin rules now tell agents committing code in any codebase to search authenticated DecidR organizations for matching existing decisions and move confident matches to `STAGED`, reserving `IMPLEMENTED` for deployment-codebase migration.

# 0.1.29

- **feat**: Render DecidR entity descriptions with a safe Markdown subset in list/detail and slideout views, including paragraphs, lists, emphasis, code, blockquotes, and safe links while keeping compact cards as plaintext previews.
- **fix**: Remove audit-event counts and the recent audit trail section from the main dashboard so audit review stays in the dedicated audit renderers and object slideouts.
