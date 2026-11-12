# Implementation Plan 04: Sequence Renderer

## Goal

Build an interactive three dimensional scene for valid POINTS sequences, with coordinated hand and ball movement, playback controls and editor selection.

## Scope

### Included

- Three.js based 3D scene with a perspective camera.
- Simplified performers, hands, table, seats and ball objects.
- Automatic seat placement using the sequence layout, with local scene layout overrides.
- Object positions derived exclusively from simulator snapshots.
- Beat transitions for LIFT, LEAVE, BOUNCE, TAP, ZIP, individual passing and SPECIAL.
- Beat based playback, pause, previous and next step, scrubbing, tempo and repeat controls.
- Camera orbit, pan and zoom.
- Selectable hands that highlight the corresponding editor cell.
- Immediate renderer refresh after sequence edits.
- Disable rendering when validation errors exist.
- Ball colour settings kept local to the renderer.

### Excluded

- Notation editing.
- Validation rule implementation.
- Generator.
- Sequence code encoding.
- Custom trajectory or performer appearance editors.
- Subdivision level simulation until the simulator exposes subdivision snapshots.

## Decisions

- Use Three.js directly. Do not add a React rendering wrapper.
- Use the existing `getMainBeatDurationSeconds` function. It already accounts for the time signature's beat grouping and quarter note BPM.
- Animate main beat transitions only. The current simulator produces main beat snapshots, so the renderer must not invent subdivision state.
- On sequence edits, stop playback. Preserve the current beat ID if it remains. If it was deleted, select the beat at the same index, clamped to the new sequence bounds.
- Use existing seat assignments when available. Otherwise distribute performers automatically around the selected table layout. Layout overrides remain local renderer settings and never modify sequence data.
- Hand selection reports the performer, hand and current beat to the editor.

## Proposed approach

Consume the canonical sequence model and state snapshots from packages 01 and 02. Do not independently infer object ownership from notation symbols.

Use a single Three.js scene with reusable performer, hand, table position and ball meshes. Derive world coordinates from performer seats and position ownership. Animate ball meshes between the before and after snapshots of the active beat. Animate the relevant hands towards their action targets during the same interval. All actions at a beat share the same progress value so they remain simultaneous.

Keep renderer appearance settings separate from sequence data. Ball colours, camera state and local layout overrides must not alter sequence code.

## Files and components

| File or area | Planned change |
|---|---|
| src/features/renderer/SequenceRenderer.tsx | Scene lifecycle, rendering, playback and controls |
| src/features/renderer/geometry.ts | Deterministic scene coordinates and timing helpers |
| src/features/renderer/geometry.test.ts | Layout and coordinate tests |
| src/App.tsx | Renderer entry point and editor hand selection |
| src/styles/main.scss | Responsive renderer layout and controls |
| package.json | Three.js runtime and type dependencies |
| docs/implementation/README.md | Package status |

## Steps

1. Add Three.js and define deterministic scene geometry.
2. Build table, seats, performers, hands and balls.
3. Map simulator snapshots to world coordinates.
4. Animate hand actions and object movement on a shared beat timeline.
5. Add playback, stepping, scrubbing, tempo and repeat controls.
6. Add camera orbit, pan, zoom and local layout controls.
7. Connect hand selection to the editor.
8. Stop playback and preserve the playhead after sequence edits.
9. Disable rendering for invalid sequences.
10. Add focused geometry and timing tests.

## Verification

- [x] Formatting
- [x] Linting
- [x] TypeScript strict type check
- [x] Automated tests
- [x] Production build
- [ ] Simultaneous actions
- [ ] Object continuity across transfers
- [ ] Tempo and time signature timing
- [ ] Playback stop and playhead preservation after edits
- [ ] Manual visual review of all action types on desktop and mobile

## Renderer correction pass 04B

The correction pass is tracked in [`04B-renderer-corrections.md`](04B-renderer-corrections.md). It corrects camera local panning, automatic performer spacing, table position geometry, hand reach distance and pickup or placement contact timing. The simulator remains the sole source of object state. Subdivision animation remains unsupported.

## Dependencies

Packages 01 and 02. The existing simulator and time signature model are the source of truth.

## Risks and boundaries

- Subdivision animation is not supported until the simulator exposes subdivision snapshots.
- Manual visual review is required to validate the 3D scene, camera controls and mobile performance.
- The simplified performer model prioritises clear hand and ball positions over realistic human anatomy.

## Approval

Approved by Oliver on 12 November 2026. Implementation is complete in PR #7. Formatting, linting, strict TypeScript checking, automated tests and production build pass. Manual visual review remains.
