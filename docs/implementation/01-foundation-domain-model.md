# Implementation Plan 01: Foundation and Domain Model

## Goal

Establish the application scaffold and shared framework independent data model used by every feature.

## Scope

### Included

- React, TypeScript and Vite scaffold using the agreed repository stack.
- Strict TypeScript, Sass, ESLint, Prettier, Vitest and React Testing Library setup.
- Shared sequence, performer, hand, position, beat, subdivision, action and initial state types.
- Shared types for solo, circle passing and individual passing.
- Shared representation of ZIP pairs, linked SPECIAL actions and individual passing relationships.
- Stable identifiers and object identity model.
- Public interfaces for state simulation, validation, serialization, rendering and generation.
- Representative valid and invalid development fixtures.

### Excluded

- Full editor interface.
- 3D renderer.
- Generator algorithm.
- Final sequence code encoding.
- Final persistence behaviour.
- Production PWA behaviour.

## Proposed approach

Keep the domain model independent of React and visual rendering. It must represent the sequence itself, not the current appearance of the notation grid.

Represent time in a way that can express musical duration and subdivisions without relying on screen column indices. Preserve the distinction between main musical beats and subdivisions. Compound meter representation remains open until resolved.

Represent each ball as an identifiable object. Positions have a capacity of exactly zero or one ball. Each hand has capacity for one finger held object and one separate back balanced object. A back balanced object does not occupy the fingers.

Actions assigned to the same beat are simultaneous. The model must not encode an arbitrary processing order.

Define stable contracts for sequence settings, performers, hands, positions, beats, subdivisions, actions, object identity and location, linked actions, validation issues, renderer state, playback position, generator constraints and candidates.

Use immutable or safely copied domain updates so undo, redo and candidate generation cannot mutate shared sequence state unexpectedly. Document public interfaces before downstream agents begin.

## Files and components

| File or area | Planned change |
|---|---|
| src/domain/ | Framework independent sequence model and domain types |
| src/contracts/ | Public interfaces shared by feature packages |
| src/fixtures/ | Representative development sequences |
| src/ | Minimal application bootstrap |
| Project configuration | Tooling, scripts and strict type checking |
| docs/architecture/ | Domain model and interface decisions |

Exact file names may change to fit the scaffold, but ownership boundaries must remain clear.

## Steps

1. Inspect the agreed technology references and establish the minimal scaffold.
2. Define the canonical sequence model from the design document and notation specification.
3. Define time and object identity abstractions without prematurely fixing unresolved compound meter details.
4. Define action and relationship types, including paired ZIP and linked SPECIAL.
5. Define contracts for validation, rendering, generation and persistence.
6. Add fixtures covering all action families and important invalid states.
7. Add unit tests for model invariants.
8. Publish the contracts for dependent work packages.

## Verification

- [ ] Formatting
- [ ] Linting
- [ ] TypeScript strict type check
- [ ] Automated tests
- [ ] Production build
- [ ] Domain logic has no React or renderer dependency
- [ ] Downstream packages can consume the shared contracts

## Dependencies

None. This is the prerequisite package.

## Risks and open questions

- Compound meter grouping must be resolved before the time model is final.
- Stable ball identity and position ownership need careful design for passing.
- Sequence code format must not be frozen until the complete model is agreed.
- Shared contracts must be reviewed before downstream agents implement against them.

## Approval

Status: Awaiting approval

Implementation must not begin until this plan is explicitly approved.
