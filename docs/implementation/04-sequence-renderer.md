# Implementation Plan 04: Sequence Renderer

## Goal

Build the three dimensional juggling scene, animation system and playback controls for valid POINTS sequences.

## Scope

### Included

- 3D scene and camera.
- Simplified performers, hands, table and seats.
- Ball objects and colour settings.
- Automatic hand and ball trajectories.
- LIFT, LEAVE, BOUNCE, TAP, ZIP, individual passing and SPECIAL visual behaviour.
- Beat based playback and step mode.
- Tempo and repeat controls.
- Camera pan, zoom and rotation.
- Seat assignment and table layout controls.
- Hand selection and editor highlighting.
- Immediate renderer refresh after sequence edits.
- Disable rendering when validation errors exist.

### Excluded

- Notation editing.
- Validation rule implementation.
- Generator.
- Sequence code encoding.
- Custom trajectory or performer appearance editors.

## Proposed approach

Consume the canonical sequence model and state snapshots from packages 01 and 02. Do not independently infer object state from notation symbols.

Keep renderer appearance settings separate from sequence data. Ball colours, hand colours, camera state and scene arrangement overrides must not alter the sequence code.

Animate hands and objects as coordinated movements. A transfer between hands uses a shared meeting point. The source and receiving hands move to that point and the object changes ownership at the beat transition. A back balanced object remains separate from the finger held object.

All actions at a beat begin together. Animations between beat states must preserve that simultaneity. Step mode animates to the next beat over 0.5 seconds and then stops. Continuous playback uses tempo based timing. BPM is measured in quarter notes per minute, with note duration determined by the time signature. Compound meter grouping must be reflected correctly after the time model is resolved.

Any sequence edit stops playback. Preserve the current timeline position if it still exists in the updated sequence. If it no longer exists, use a defined fallback once that rule is decided.

Only hands are selectable. Selecting a hand highlights the corresponding editor cell. Balls and table positions are not independently selectable.

## Files and components

| File or area | Planned change |
|---|---|
| src/features/renderer/ | Renderer composition and controls |
| src/features/renderer/scene/ | Scene, performers, table and seats |
| src/features/renderer/animation/ | Hand and object animation |
| src/features/renderer/playback/ | Timeline playback and step controls |
| src/features/renderer/camera/ | Pan, zoom and rotation |
| Renderer tests | Renderer and playback tests |

## Steps

1. Consume domain and state snapshot contracts.
2. Select and integrate a suitable browser 3D rendering approach.
3. Build table, seats, performers, hands and balls.
4. Implement automatic seat assignment and supported table layouts.
5. Implement hand action animations and object movement.
6. Implement coordinated ZIP and individual passing transfers.
7. Implement playback timing, stepping, scrubbing and repeat modes.
8. Implement camera interaction and appearance settings.
9. Implement hand selection and editor synchronisation.
10. Stop playback and refresh state on every sequence edit.
11. Disable the renderer for invalid sequences.
12. Test representative solo and passing sequences.

## Verification

- [ ] Formatting
- [ ] Linting
- [ ] TypeScript strict type check
- [ ] Automated tests
- [ ] Production build
- [ ] Simultaneous actions
- [ ] Object continuity across transfers
- [ ] Tempo and time signature timing
- [ ] Playback stop and playhead preservation after edits
- [ ] Manual visual review of all action types

## Dependencies

Packages 01 and 02. Compound meter timing and seat reassignment interaction must be resolved for full completion.

## Risks and open questions

- 3D library and performance budget need selection.
- Compound meter and subdivision timing remain open.
- Fallback playhead position after a structural edit remains open.
- Manual seat reassignment interaction remains open.
- Mobile renderer performance needs testing.

## Approval

Status: Awaiting approval

Implementation must not begin until this plan is explicitly approved.
