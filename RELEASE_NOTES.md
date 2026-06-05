# 0.1.33-rc.8

- **feat**: Lazy-load DecidR timeline windows from `/timeline/window` instead of front-loading every page, with range cache reuse, cursor paging, stale-response protection, dense lane virtualization, and retry status for failed window loads.

- **feat**: Add DecidR timeline stage timestamp correction guidance for `update_decision_stage_time` and `update_task_stage_time`, and render timeline events by `occurredAt` when available.

# 0.1.33-rc.5

- **feat**: Rework the DecidR timeline renderer around actionable visibility: preset ranges, horizontal day panning, stacked decision bars, legend visibility toggles, decision span states, overflow indicators, and unified month/week/day rendering.
- **fix**: Keep decision actual-time indicators bounded to real event times so month views no longer project decision activity into the future.
