# LectrFlow Multi-Agent Development Rules

## Project
LectrFlow is an agentic AI university lecture platform.

## Source of truth
GitHub is the single source of truth for the project.

The repository documentation and existing code take precedence over assumptions.

## Multi-agent development

This project may be developed simultaneously by Codex and Claude Code.

Codex and Claude Code must assume that another agent may be working on the project at the same time.

NEVER:
- overwrite another agent's work
- reset or revert files that you did not create
- use git reset --hard
- use git checkout . to discard changes
- force push
- rewrite shared history
- delete another agent's branch
- modify unrelated files unnecessarily
- redesign the architecture without approval

Before making changes:
1. Inspect the current repository state.
2. Read the relevant documentation.
3. Check the current Git branch.
4. Check git status.
5. Understand existing interfaces and shared types.
6. Identify which files your task requires.

## Branch isolation

Each agent must work on its own Git branch.

Never work directly on main unless explicitly instructed.

Recommended branches:

main
foundation
student-ui
lecturer-ui
ai-agents

## Ownership

Codex is the primary engineering agent.

Claude Code is a secondary engineering agent focused primarily on isolated frontend/student features unless otherwise instructed.

### Codex generally owns:
- project foundation
- architecture
- Supabase/database
- backend
- API routes
- shared types
- AI agents
- integrations
- testing
- infrastructure

### Claude Code generally owns:
- student UI
- frontend components
- student lecture experience
- UI polish
- isolated frontend features

Neither agent should modify another agent's area unless explicitly instructed.

## Shared files

The following are considered sensitive shared files:

- package.json
- package-lock.json
- pnpm-lock.yaml
- yarn.lock
- tsconfig.json
- next.config.*
- middleware.*
- database migrations
- Supabase schema
- shared TypeScript types
- API contracts
- routing architecture
- environment configuration
- AGENTS.md

Do not modify these unnecessarily.

If modification is required, explain why before making the change.

## Dependencies

Do not install new packages unless:
1. The package is necessary for the assigned task.
2. The package does not duplicate existing functionality.
3. The change is communicated clearly.

Avoid changing package versions unless necessary.

## Database

Do not modify the database schema casually.

Database changes must be implemented through migrations and documented.

## API contracts

Do not silently change an API contract used by another part of the application.

If an interface must change:
1. Document the change.
2. Update the relevant types.
3. Update affected consumers.
4. Run checks.

## Code style

Follow the existing code style.

Prefer small, focused changes.

Do not refactor unrelated code.

Do not introduce abstractions without a clear need.

## Before committing

Run appropriate:
- lint
- type checking
- tests
- build

Do not commit broken code unless explicitly instructed.

## Commit messages

Use clear conventional-style commits, for example:

feat(student): add lecture join flow
feat(ai): add student tutor agent
fix(lecturer): correct confusion count
chore: configure Supabase

## Communication

At the end of every task report:

1. What you changed
2. Files changed
3. Dependencies added
4. Database changes
5. API/interface changes
6. Checks performed
7. Any assumptions
8. Anything another agent needs to know

## Priority

Correctness and compatibility are more important than speed.

Do not make architectural decisions simply to complete the assigned task faster.
