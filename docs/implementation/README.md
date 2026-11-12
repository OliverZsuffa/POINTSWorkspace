# Implementation Work Packages

## Purpose

The implementation is divided into bounded work packages so separate agents can work on separate application areas without conflicting assumptions or overlapping ownership. Each package requires explicit approval before implementation.

## Work package order

| ID | Work package | Responsibility | Depends on | Status |
|---|---|---|---|
| 01 | Foundation and domain model | Project scaffold, shared types, sequence model and interfaces | None | Implemented and merged to main |
| 02 | Object state and validation | Simultaneous beat processing, state transitions and validity checks | 01 | Implemented, pending CI |
| 03 | Sequence editor | Notation grid, editing interactions, settings and undo | 01, 02 |
| 04 | Sequence renderer | 3D scene, animation, playback and editor synchronisation | 01, 02 |
| 05 | Sequence generator | Constraint search and candidate generation | 01, 02 |
| 06 | Data, persistence and export | Sequence codes, import, local persistence, presets and image export | 01, 02 |
| 07 | Workspace shell and PWA | Application layout, responsive shell, panel management and offline support | 01 |
| 08 | Integration and quality assurance | Cross package integration, end to end tests and release readiness | 01 to 07 |

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
7. Exact keyboard shortcut mapping and remaining cell editing gestures.

Agents may implement unrelated parts while a blocker remains open, but must not make an irreversible architectural decision for it.

## Approval

All work packages are awaiting review. No application implementation may begin until the relevant plan has been explicitly approved.
