# Instructions for coding agents

## Project direction

- Read `README.md`, `docs/DESIGN_DIRECTION.md`, and `docs/WORKFLOW.md` before making changes.
- The target application is a React and TypeScript web application built with Vite.
- Follow the visual direction documented in `docs/DESIGN_DIRECTION.md`.
- Do not introduce a different framework or UI design system without discussing it first.

## Required working process

1. Inspect the current repository and relevant existing project files.
2. For any substantial change, write a concrete implementation plan into the repository.
3. Stop and wait for Oliver's explicit approval of that plan.
4. Only after approval, implement the plan.
5. Run the relevant tests, linting, formatting checks, and production build. Report commands and results accurately.
6. Review the final diff and explain what changed, what was tested, and any remaining limitations.
7. Do not merge or push implementation work to `main` unless explicitly authorised.

## Planning constraints

- Keep plans focused on the requested scope.
- Do not invent product requirements or expand functionality beyond the supplied specification.
- When a requirement is unclear and materially affects the implementation, ask before deciding.
- Keep project documentation current when an approved implementation changes the architecture or development process.
- Do not replace or rewrite user work without inspecting it first.

## Code quality

- Prefer clear, maintainable TypeScript and small, focused React components.
- Keep presentation separate from domain logic where practical.
- Use the repository's established conventions once they exist.
- Avoid unnecessary dependencies.
- Never claim that a command or test was run unless it was actually run.
