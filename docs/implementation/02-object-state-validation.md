# Implementation Plan 02: Object State and Validation Engine

## Status

Approved by Oliver on 12 November 2026. CI passed and implementation was merged into main in commit 369fba88ff38268074ab0b3ce074925e699d602c.

## Goal

Implement canonical sequence simulation and validation. This package determines whether a sequence is physically and notationally valid and supplies state data to the editor and renderer.

## Scope

Included:

1. Initial object distribution, including table positions, finger held objects and hand back balanced objects.
2. Deterministic state evaluation at each main beat.
3. Simultaneous action processing against the state entering the beat.
4. Position occupancy and stable ball identity tracking.
5. Finger held and back balanced hand state.
6. HOLD, LIFT, LEAVE, BOUNCE, TAP, EMPTY, ZIP, individual passing, circle passing and SPECIAL rules.
7. Validation of action eligibility, object capacity, linked actions and transfer consistency.
8. Structured validation issues referencing affected entries, positions and times.
9. State snapshots immediately before and after each main beat.
10. Implementations of the shared SequenceSimulator and SequenceValidator contracts.
11. Unit tests for valid and invalid action combinations.

Excluded: React interface, visual animation, editing gestures, generator search and sequence code import or export.

## Simulation rules

All actions assigned to a main beat are evaluated together against the state entering that beat. No action can rely on another action in the same beat having happened first. The engine validates the complete batch before applying transfers. If a beat contains an error, none of its transfers are applied.

A position contains zero or one ball. Each hand can hold one object with its fingers and balance one separate object on its back. A back balanced object does not occupy the fingers and does not make the hand occupied for action eligibility.

TAP requires free fingers. BOUNCE requires an object held with the fingers and leaves that object in the hand. Both are allowed while an object is balanced on the back. LIFT, LEAVE and SPECIAL are also permitted with a back balanced object, subject to their other requirements. SPECIAL requires free fingers.

ZIP source and receiver are paired in the same beat. Individual passing sender LEAVE and receiver LIFT are paired in the same beat. A hand cannot receive and send an object in one beat. Transfers preserve ball identity and cannot create or destroy objects.

Circle passing resolves performer distance using the order of performers in the sequence because the current domain model has no separate circle order.

## Files

| File | Responsibility |
|---|---|
| src/domain/state/simulate.ts | Initial state, simultaneous transitions, snapshots and validation |
| src/domain/state/index.ts | State simulation exports |
| src/domain/validation/index.ts | Validation exports |
| src/domain/model.ts | Explicit before and after snapshot phase |
| src/domain/state/simulate.test.ts | State and validation unit tests |
| docs/architecture/DOMAIN_MODEL.md | Simulation timing and snapshot documentation |

## Verification

The CI workflow must pass formatting, linting, strict TypeScript checks, automated tests and production build.

The tests cover solo flow, individual passing, ZIP, circle passing and invalid circle distances, TAP versus BOUNCE, EMPTY eligibility, hand back LIFT and LEAVE, balanced objects during other actions, invalid initial distributions, atomic rejection of conflicting simultaneous actions and independence from notation array order.

## Remaining limitations

All actions in one main beat are simultaneous even when their notation offsets differ. This follows the current beat level action model. Warning severity is not introduced. Every validation issue is an error. Circle passing uses performer array order because no separate seating order is currently part of the sequence contract.
