## Implementation status

Implementation is complete on `fix/generator-state-and-shared-notation-renderer`.

- Added stateful abstract hand and object validation and prune invalid partial structures during stage one search.
- Preserve unresolved target locations during abstract generation and leave concrete occupancy and position conflicts to stage two.
- Added regression coverage for impossible HOLD and LEAVE transitions, valid HOLD after LIFT, valid linked CLAP, and generator search regressions.
- Extracted shared action symbol geometry into `src/features/notation/action-symbol.ts`.
- Added the standalone `NotationSymbol` component and reused it in the editor and generator previews.
- Generator preview cells now use the editor notation cell classes and grid sizing.
- PNG export uses the same action symbol geometry and square editor-style cell grid.
- CI run `43948954721` passed formatting, lint, TypeScript, all 180 unit tests, production build, and browser checks at six desktop, tablet, and phone viewports.
- Reviewed the generated viewport screenshots.

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
1. Extract action symbol geometry into a standalone rendering module independent of editor state.
2. Add a reusable `NotationSymbol` component for editor and generator preview rendering.
3. Preserve editor SVG geometry, labels, subscripts, CLAP bar, ZIP edges, and sizing.
4. Keep editor interactions outside the shared visual component.
5. Reuse the shared geometry in PNG export and match the editor's square cell grid.
6. Keep renderer inputs explicit and reusable.

## Phase 3: Verification
Run formatting, lint, TypeScript, unit tests, production build, and browser checks. Review desktop, tablet, and phone screenshots. Do not merge until checks pass and changes are reviewed.

## Acceptance criteria
- All-HOLD structures are excluded when the corresponding hands start empty.
- HOLD is accepted when an object is held.
- Invalid state transitions are rejected in stage one.
- Concrete location validity remains checked by the existing simulator.
- Editor and generator previews use the same standalone symbol component.
- PNG export uses the same symbol geometry and square cell dimensions as the editor.
- Generator preview cells use the editor's notation cell styling rather than a separate approximation.
