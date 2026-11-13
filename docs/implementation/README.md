# Implementation Work Packages

## Purpose

The implementation is divided into bounded work packages so separate agents can work on separate application areas without conflicting assumptions or overlapping ownership. Each package requires explicit approval before implementation.

## Work package order

| ID | Work package | Responsibility | Depends on | Status |
|---|---|---|---|
| 01 | Foundation and domain model | Project scaffold, shared types, sequence model and interfaces | None | Implemented and merged to main |
| 02 | Object state and validation | Simultaneous beat processing, state transitions and validity checks | 01 | Implemented and merged to main |
| 03 | Sequence editor | Notation grid, editing interactions, settings and undo | 01, 02 | Implemented and merged to main via PR #6 |
| 03B | Editor corrections and visual refinement | Correct initial ball setup, notation visuals, beat state and target editing | 03 | Implemented and merged into main via PR #5 |
| 03C | Editor completion and feature verification | Full audit of Packages 03 and 03B, complete missing interactions, notation grid and usability corrections | 03, 03B | Implemented and merged through PR #9; manual visual verification remains |
| 04 | Sequence renderer | 3D scene, animation, playback and editor synchronisation | 01, 02 | Implemented in PR #7; correction pass 04B merged through PR #11; manual visual review remains |
| 05 | Sequence generator | Constraint search and candidate generation | 01, 02 | Awaiting approval |
| 06 | Data, persistence and export | Sequence codes, import, local persistence, presets and image export | 01, 02 | Awaiting approval |
| 07 | Workspace shell and PWA | Application layout, responsive shell, panel management and offline support | 01 | Implemented and merged through PR #15; CI and Chromium offline verification passed |
| 07C | Circle passing and renderer playback corrections | Separate the authored pattern from visual participants, correct triangular geometry, preserve object state across loops and align beat navigation | 07 | Implemented and merged through PR #16; CI and browser checks passed |
| 08 | Integration and quality assurance | Cross package integration, end to end tests and release readiness | 01 to 07 | Awaiting approval |

The Package 03C requirement by requirement audit is tracked in [`03C-feature-verification.md`](03C-feature-verification.md). Its current statuses distinguish automated evidence from manual visual verification.

## Parallel execution strategy

Work package 01 must establish and document the shared domain model and public interfaces before feature agents begin implementation. Work package 02 then implements the state simulation and validation contract. Once those interfaces are stable, work packages 03, 04, 05, 06 and 07 can proceed in parallel.

Agents must not independently redefine shared sequence types, action semantics, time calculations, object identity, validation results or sequence code formats. Proposed interface changes must be coordinated with the foundation owner.

Each agent should work in its own branch and limit changes to its assigned files. Shared files should have one designated owner. Do not merge work until integration checks pass.

## Shared engineering rules

- TypeScript strict mode.
- Reuse shared domain types instead of defining duplicate feature specific types.
- Keep notation semantics independent from React components and rendering code.
- Keep renderer appearance settings separate from sequence data.
- Keep generator search logic independent from its user interface.
- Keep persistence and sequence encoding independent from the editor interface.
- Use deterministic behaviour wherever the specification requires it.
- Write unit tests alongside domain logic and component tests alongside UI work.
- Keep the interface minimal. Avoid decorative descriptions, filler text and unnecessary labels.
- Do not implement unresolved behaviour by guessing. Record the question and request a decision.
- Every package must pass its own verification checklist before integration.

## Current cross package blockers

1. Compound meter subdivision representation. Conventional 6/8 grouping must be represented, but the current editor subdivision model only splits intervals in half.
2. Persistence across multiple browser tabs. Tabs are independent, but restoration and saving behaviour is undecided.
3. Exact generator result limit, page size and continuation mechanics.
4. Renderer playhead fallback when an edit removes the previous timeline position.
5. Exact manual seat reassignment interaction.
6. Image export details, including file format, segment boundaries and oversized performer sections.
7. Remaining cell editing gestures and manual responsive visual verification.

Agents may implement unrelated parts while a blocker remains open, but must not make an irreversible architectural decision for it.

## Approval

Packages 01, 02, 03 and 03B are implemented and merged. Package 03C first pass is merged through PR #9. Its final correction and verification pass merged through PR #10. Automated checks and six viewport screenshot reviews pass. Remaining Partial requirements are documented in the 03C verification matrix. Package 04 was implemented and merged through PR #7. Renderer correction pass 04B was merged through PR #11. Manual visual review of the actual 3D renderer remains outstanding. Package 07 was approved by Oliver on 12 November 2026 and merged through PR #15 on 13 November 2026. Package 07C was approved by Oliver on 13 November 2026 and merged through PR #16. Its checks passed formatting, lint, TypeScript, unit tests, production build and browser tests for three and ten visual circle participants. The remaining manual visual review is tracked in [07-visual-audit.md](07-visual-audit.md). GitHub Pages deployment confirmation remains pending. Packages 05 and 06 remain awaiting approval. Package 08 has a detailed implementation plan and remains awaiting approval.
