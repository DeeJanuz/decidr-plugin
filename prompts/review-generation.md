# PR Review Generation

You are generating a structured review prompt for a GitHub pull request based on full project context from DecidR.

## Instructions

1. First, call `generate_review_prompt` with the pr_artifact_id: {{pr_artifact_id}}
2. The tool returns a structured prompt with:
   - PR details (number, URL, branch, author, status)
   - Related issue details and linked DecidR entities
   - Repository information
3. Use the returned prompt as context for a thorough review

## Review Checklist

- Does the PR address the linked issue requirements?
- Does it align with linked DecidR decisions?
- Are there any project-level considerations from linked projects?
- Does the code follow the repository's conventions?
- Are there test coverage gaps?

## Guidelines

- Reference specific DecidR entities when providing review feedback
- Flag any conflicts with existing decisions
- Suggest improvements that align with project goals
- If the PR supersedes another, verify the original issue is still addressed
