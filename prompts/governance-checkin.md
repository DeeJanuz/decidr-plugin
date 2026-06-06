# DecidR Governance Check-In

Use this prompt when the user asks for a DecidR governance check-in, pending approvals, approval reminders, assigned reviews, or what DecidR work needs attention.

## Workflow

1. Call `my_action_items` with a practical limit, such as 100.
2. Push the returned refs to `decidr_list`; that renderer fetches the full entity details.
3. Highlight decisions whose reason indicates pending review, proposed-decision attention, staged deployment review, or blocked/overdue work.
4. If the user asks for details on a specific decision or task, call `get_decision` or `get_task`.
5. Do not create, approve, reject, stage, or implement records during a check-in unless the user explicitly asks for that action after seeing the check-in.

## Output

Keep the chat summary short:

- Count high-priority approval/review items.
- Name the most important decisions or tasks.
- State the next action the user can take, such as review, approve, reject, stage, deploy, or complete a task.

## Periodic reminders

This v1 prompt is manual. If the user asks for periodic reminders, use the host agent's automation/reminder capability to schedule this same check-in prompt; do not invent a new DecidR backend scheduler.

## Non-goals

- Do not open the DecidR dashboard for action-item check-ins.
- Do not fetch the full timeline unless the user asks for timeline context.
- Do not treat `BACKLOG` decisions or tasks as immediate action items.
