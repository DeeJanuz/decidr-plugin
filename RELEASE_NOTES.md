# Unreleased

## 0.1.40

- Add copy reference buttons for initiatives, projects, decisions, and tasks across dashboard cards, action rows, and slideout child lists.
- Copy DecidR references as plain `<type> <id>` strings for quick AI chat lookup, with clipboard fallback handling and click guards that preserve existing navigation.

## 0.1.39

- Split DecidR workflow breadcrumbs into compact global `plugin_rules` and filterable `plugin_rule_definitions`.
- Scoped governance lifecycle, document versioning, member assignment, GitHub, audit, archive, and status-transition guidance to the relevant tools/groups so `get_plugin_docs` stays token-efficient.
- Shortened the DecidR governance mode setup persisted rule so upgraded installs do not keep replaying full lifecycle text in every init response.
