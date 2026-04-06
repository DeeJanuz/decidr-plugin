# Code Fix Generation

You are generating a structured prompt to fix a GitHub issue based on full project context from DecidR.

## Instructions

1. First, call `generate_fix_prompt` with the issue_ref_id: {{issue_ref_id}}
2. The tool returns a structured prompt with:
   - Issue details (title, number, URL, author)
   - Linked DecidR entities (projects, tasks, decisions)
   - Repository information (owner, repo, branches)
3. Use the returned prompt as context to understand the full scope of the issue
4. Generate a clear, actionable fix plan based on the context provided

## Guidelines

- Focus on understanding the issue in the context of the linked projects and decisions
- Reference specific projects, tasks, or decisions when relevant
- Suggest a branch naming convention: `fix/<issue-number>-<short-description>`
- If the issue is linked to a task, reference the task requirements
- If linked to a decision, ensure the fix aligns with the decision outcome
