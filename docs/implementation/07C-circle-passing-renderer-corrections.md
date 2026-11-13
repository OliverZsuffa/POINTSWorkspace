# Implementation Plan 07C: Circle Passing and Renderer Playback Corrections

## Status

Awaiting review and approval.

This plan captures Oliver's clarified circle passing model and the newly reported renderer and playback bugs. Implementation must not begin until Oliver has reviewed and explicitly approved this plan.

## Goal

Correct circle passing so one authored pattern can be performed by a configurable number of visual jugglers, then fix the reported renderer camera, table position, object colour, beat navigation and playback defaults.

This is a focused correction package. Preserve existing notation semantics and avoid changing unrelated editor or renderer behaviour.

## 1. Circle passing: separate pattern performer from visual participants

The current model incorrectly treats every circle participant as an actual sequence performer. That is not the intended workflow.

1. A new sequence starts with one actual pattern performer.
2. Circle passing must be selectable with that one performer.
3. Selecting Circle passing enables relative destinations for the left and right sides of the circle. These destinations describe where the representative performer's actions relate to neighbouring visual jugglers.
4. The editor contains only the one authored pattern. It must not create additional notation rows or independent patterns for visual participants.
5. The number of visual jugglers is a separate setting for the renderer, not a count of sequence performers.
6. The renderer places the configured number of visual jugglers around a regular polygonal table. Every visual juggler executes the same authored pattern, mapped consistently to their place in the circle.
7. Changing the visual juggler count must update the polygon side count and scene layout without creating or deleting pattern performers, notation entries, balls or independently editable sequence state.
8. Circle passing targets must be relative and consistent around the circle, including wraparound between the last and first visual juggler.
9. The UI must distinguish the single authored pattern from the visual participant count. Do not label visual participants as additional editable pattern performers.
10. Existing circle passing data and the current repeated-pattern implementation must be migrated or adapted safely. Do not silently lose the representative pattern.

### Relative destinations

1. In Circle passing mode, destination options must include the left and right relative positions.
2. The options must be available immediately after switching from Solo to Circle passing.
3. They must be usable while authoring the one representative pattern.
4. The same relative destination must map consistently for each visual juggler when the renderer repeats the pattern.
5. Switching away from Circle passing must restore the normal destination options without stale relative targets.

## 2. Renderer camera orbit direction

When rotating the camera by holding the left mouse button and moving the mouse vertically, reverse the current vertical orbit direction.

Horizontal camera movement must remain unchanged. Verify vertical movement in both directions and ensure zoom and panning are unaffected.

## 3. Circle table position spacing

With three visual jugglers, the current table positions overlap because position A on one participant's edge coincides with position C on another edge.

1. A three person circle must visibly form a triangular table with three distinct participant edges.
2. Each participant must have three distinct table positions, for nine distinct positions in total.
3. Position locations must be distributed along their owning edge so positions from neighbouring participants never occupy the same point.
4. The layout must work for three participants and larger circles.
5. Do not solve the problem by hiding duplicate labels or omitting positions. All nine positions must be spatially distinct in the three person case.
6. Add geometry tests for minimum separation and edge ownership, plus a visual check of the three person arrangement.

The visual participant model means these positions belong to visual participant instances in the renderer. They must not become separately authored pattern performers.

## 4. Preserve object colours across playback loops

Currently, after one complete cycle, the renderer resets object colours to their original positions. This is incorrect.

1. Object colours must follow the objects as they move between positions.
2. At the end of a loop, the next loop must begin from the actual final object state of the previous loop.
3. Do not reset colours to the initial arrangement at the loop boundary.
4. The same continuity must apply to object identity and location, not just the displayed colour.
5. Scrubbing, stepping and looping must agree on the state at each beat.
6. If a sequence is not state preserving after one cycle, show the actual continuing state rather than silently resetting it.
7. Add a regression test where two differently coloured objects exchange positions during one cycle and retain their exchanged positions and colours on the next cycle.

## 5. Default sequence length

New sequences must default to four beats rather than eight.

This changes the default only. It must not truncate or rewrite existing sequences when opened.

## 6. Beat slider and displayed state

The current beat slider uses an off by one state convention. Selecting beat 1 displays the state before beat 1 has happened.

Change the displayed state convention:

1. Slider value 0 represents the initial state before any beat has happened.
2. Slider value 1 represents the state after all actions in beat 1 have completed.
3. Slider value 2 represents the state after all actions in beat 2 have completed.
4. Continue consistently for every beat.
5. Playback, stepping, scrubbing and the displayed beat label must use the same convention.
6. Simultaneous actions within a beat must be applied together before the resulting state is shown.
7. Ensure the final beat state is visible and can transition into the next loop without resetting object state.

## 7. Looping default

Looping must be enabled by default for newly opened renderer sessions and new sequences.

The user must still be able to disable looping manually. The selected loop setting should remain stable while editing and playing the current sequence.

## 8. Interaction and architecture constraints

1. Keep the one authored circle pattern separate from the visual participant count.
2. Do not create extra sequence performers as a shortcut for rendering repeated visual participants.
3. Do not duplicate authored notation in persistent sequence data.
4. Keep the simulator as the source of truth for object identity, location and action validity. If the existing simulator cannot express repeated visual instances without duplicating sequence state, introduce a clear rendering or simulation projection that preserves one source pattern rather than changing the authoring model.
5. Keep visual participant count and renderer layout settings distinct from notation content.
6. Preserve the established simultaneous beat evaluation and atomic beat validation rules.
7. Do not reset object state at loop boundaries unless the sequence explicitly defines such a reset. No such reset is currently intended.

## 9. Verification plan

### Circle passing
- [ ] Circle passing can be selected with one actual pattern performer.
- [ ] Relative left and right destinations become available immediately.
- [ ] The editor still contains exactly one authored pattern.
- [ ] Visual participant count can be changed independently.
- [ ] Changing visual participant count creates no additional pattern performers, notation rows, balls or authored entries.
- [ ] Every visual juggler executes the same pattern.
- [ ] Three visual jugglers produce a triangular table with nine distinct table positions.
- [ ] Larger circles have correct polygon side counts and non overlapping positions.
- [ ] Relative destinations map correctly around the complete circle, including wraparound.

### Renderer and playback
- [ ] Vertical left drag orbit direction is reversed.
- [ ] Horizontal orbit remains unchanged.
- [ ] Three person table positions do not overlap.
- [ ] Object colours and identities remain continuous across loop boundaries.
- [ ] New sequences default to four beats.
- [ ] Existing sequences retain their existing beat counts.
- [ ] Slider value 0 shows the initial state.
- [ ] Slider value 1 shows the completed state after beat 1.
- [ ] Playback, stepping and scrubbing agree on beat state.
- [ ] Looping is enabled by default and can be disabled.
- [ ] Looping does not reset object state to the initial arrangement.

### General regression
- [ ] Formatting and lint checks pass.
- [ ] Strict TypeScript check passes.
- [ ] Unit and component tests pass.
- [ ] Production build passes.
- [ ] Browser tests cover solo and circle passing.
- [ ] Visual review covers three person and larger circle layouts.
- [ ] Existing solo and individual passing behaviour remains intact.

## 10. Superseded assumptions

The earlier Package 07 implementation treated the circle participant count as the number of actual sequence performers and expanded notation into additional performer entries for simulation. This is explicitly superseded by this plan.

The earlier minimum of three actual performers for selecting Circle passing is also superseded. The sequence has one authored pattern performer; the renderer has a separate visual participant count, which must be at least three for a valid circle layout.

The earlier request to create additional performer owned positions by adding actual jugglers does not apply to visual circle participants. Their positions are generated as part of the renderer's circle layout and do not become additional editable pattern performers.

## Approval

Awaiting Oliver's review and explicit approval.
