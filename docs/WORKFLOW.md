# Development Workflow

The project uses a plan first workflow.

## 1. Understand

Inspect the repository, existing implementation, relevant references, and the current requirements. Do not assume that an earlier implementation or plan is still current.

## 2. Plan

Write the proposed implementation plan into the repository before changing application code. Use `docs/IMPLEMENTATION_PLAN_TEMPLATE.md` as a starting point.

A plan should identify:

- Scope and intended outcome.
- Relevant files and architecture.
- Implementation steps.
- Dependencies or external requirements.
- Verification and test strategy.
- Open questions and risks.

## 3. Approval gate

Present the plan for review. Do not begin implementation until Oliver explicitly approves it. Incorporate requested changes into the plan first.

## 4. Implement

Implement only the approved scope. Keep changes reviewable and avoid unrelated refactoring.

## 5. Verify

Run the applicable checks, normally:

- Formatting check.
- Linting.
- Automated tests.
- Production build.

Report the exact commands and whether they passed. If a check cannot be run, state why.

## 6. Review and handover

Review the diff, summarise the changes, list verification results, and identify remaining issues. Update documentation where appropriate.

## 7. Git workflow

Keep work reviewable. Do not merge or push implementation work to `main` without explicit authorisation. Any release or merge step must be clearly separated from implementation and verification.
