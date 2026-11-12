# Implementation Plan 02: Object State and Validation Engine

## Goal

Implement canonical sequence simulation and validation. This package determines whether a sequence is physically and notationally valid and supplies state data to the editor and renderer.

## Scope

### Included

- Initial object distribution.
- Deterministic state evaluation at each beat.
- Simultaneous action processing at the beginning of each beat.
- Position occupancy and object identity tracking.
- Finger held and back balanced hand state.
- HOLD, LIFT, LEAVE, BOUNCE, TAP, EMPTY, ZIP, individual passing and SPECIAL rules.
- Validation of action eligibility, object capacity and transfer consistency.
- Structured validation issues referencing affected performers, hands, positions and times.
- State snapshots for the editor overview and renderer.
- Unit tests for valid and invalid action combinations.

### Excluded

- React interface.
- Visual animation.
- Editing gestures.
- Generator search.
- Sequence code import and export.

## Proposed approach

Build a pure domain engine that takes a sequence and initial state and produces beat state snapshots plus validation issues. It must not depend on the UI or renderer.

All actions assigned to a beat take effect simultaneously at its beginning. Validate the combined set against the state entering the beat. Iteration order must never determine validity.

A position contains exactly zero or one ball. A hand can hold one object with its fingers and balance one separate object on its back. A back balanced object does not occupy the fingers and does not make the hand occupied for action eligibility.

TAP requires no object held with the fingers. BOUNCE is the corresponding position tapping action while holding one object with the fingers. That object remains in the hand. Both actions are allowed while an object is balanced on the back. LIFT, LEAVE and SPECIAL are also permitted with a back balanced object, subject to their other requirements. SPECIAL requires no finger held object.

ZIP sending and receiving occur simultaneously in the same beat. Individual passing sender LEAVE and receiver LIFT also occur simultaneously. A hand cannot receive and send an object in the same beat. Incompatible simultaneous operations on the same position are invalid. Transfers must preserve object identity and cannot create or destroy objects.

The engine reports invalid notation rather than silently repairing it. Where possible, issues identify all participating cells in a failed relationship.

## Files and components

| File or area | Planned change |
|---|---|
| src/domain/state/ | State representation and transition evaluation |
| src/domain/validation/ | Validation rules and issue generation |
| src/domain/actions/ | Action semantics and helpers |
| Tests for state | State transition tests |
| Tests for validation | Validation rule tests |

## Steps

1. Consume and verify the domain contracts from package 01.
2. Define the state snapshot entering and leaving each beat.
3. Implement simultaneous action validation and transition resolution.
4. Implement position occupancy and hand capacity checks.
5. Implement each action family and transfer relationship.
6. Implement structured validation issues with cell and time references.
7. Implement state snapshots for every beat.
8. Add tests for individual actions, simultaneous actions and invalid combinations.
9. Record any remaining ambiguous rule rather than inferring behaviour.

## Verification

- [ ] Formatting
- [ ] Linting
- [ ] TypeScript strict type check
- [ ] Automated tests
- [ ] Production build
- [ ] Action iteration order cannot change results
- [ ] One finger held object plus one back balanced object is supported
- [ ] Simultaneous ZIP and individual passing are tested
- [ ] Receiving and sending in the same hand and beat is rejected
- [ ] Every position has capacity for zero or one ball

## Dependencies

Package 01 must provide the shared sequence and action contracts.

## Risks and open questions

- State snapshot timing must be consistent across editor and renderer.
- Compound meter and subdivision interaction remains open.
- TAP and BOUNCE target occupancy requirements should be checked against the complete notation rules.
- Error versus warning severity still needs a final policy.

## Approval

Status: Awaiting approval

Implementation must not begin until this plan is explicitly approved.
