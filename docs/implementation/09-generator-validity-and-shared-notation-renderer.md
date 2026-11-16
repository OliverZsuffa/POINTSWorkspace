## Implementation status

Implementation is in progress on `fix/generator-state-and-shared-notation-renderer`.

- Added abstract hand and object state validation before structure results are yielded.
- Added regression coverage for all-HOLD structures with empty hands, HOLD after LIFT, and LEAVE without a held object.
- Extracted shared action symbol geometry and reused it in the editor and PNG export.
- Updated generator preview cells to use the editor notation cell styling and grid sizing.
- Automated checks and browser review are pending.

# Generator validity and shared notation rendering

## Goals
Prevent impossible abstract action structures from appearing in generator stage one. Make the editor, generator previews, and PNG export use one shared notation rendering implementation.

## Phase 1: Abstract generator validity
1. Inspect the simulator and generator contracts before changing semantics.
2. Add stateful abstract validation for the first generator stage.
3. Track held objects per performer and hand, balanced objects, and available table objects without prematurely binding unresolved targets to concrete positions.
4. Enforce editor-equivalent hand state rules: HOLD and LEAVE require a held object; LIFT requires free fingers and an available object; TAP requires free fingers; BOUNCE requires a held object; EMPTY and SPECIAL require free fingers; ZIP and linked CLAP require valid paired hand states.
5. Keep concrete position conflicts, target occupancy, capacity, passing links, and full simulation validity in stage two.
6. Add regression tests for all-HOLD structures with empty hands, HOLD after LIFT, LEAVE without a held object, and valid and invalid linked actions.
7. Filter invalid structures before stage one displays them.

## Phase 2: Shared notation renderer
1. Extract action symbol rendering and beat cell geometry into a standalone component independent of editor state.
2. Preserve editor SVG geometry, labels, subscripts, CLAP bar, ZIP edges, and sizing.
3. Support static rendering for generator previews and export while keeping editor interactions outside the shared visual component.
4. Replace generator preview approximations with the shared renderer and editor grid treatment.
5. Route PNG export through the same rendering implementation.
6. Keep renderer inputs explicit and reusable.

## Phase 3: Verification
Run formatting, lint, TypeScript, unit tests, production build, and browser checks. Add visual regression coverage for editor, generator, and PNG consistency. Do not merge until checks pass and changes are reviewed.

## Acceptance criteria
- All-HOLD structures are excluded when the corresponding hands start empty.
- HOLD is accepted when an object is held.
- Invalid state transitions are rejected in stage one.
- Concrete location validity remains checked by the existing simulator.
- Editor, generator, and PNG export share action symbol and cell rendering.
- Grid edges, symbol geometry, and labels match between editor and exported PNG.
- Generator previews no longer use a separate visual approximation.
