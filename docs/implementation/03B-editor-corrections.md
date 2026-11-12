# Implementation Plan 03B: Editor Corrections and Visual Refinement

## Status

Approved by Oliver on 12 November 2026. Implementation complete. All CI checks pass.

## Goal

Resolve the eight usability and notation issues reported after the first editor deployment. Keep the existing domain model and simulator authoritative, and make the notation grid compact, readable and faithful to `docs/POINTS_NOTATION.md`.

## Scope

### 1. Configurable ball count and initial distribution

- Add a visible ball count control to sequence settings.
- The default is two balls per performer.
- For each performer using performer-owned table positions, the default initial distribution places one ball at A and one at C. B and all hand positions start empty.
- The number of balls can be increased or decreased without recreating the sequence or losing unrelated notation.
- Adding a performer adds the corresponding default two balls and initial A/C placements. Removing a performer removes the balls assigned to that performer's initial setup.
- Keep ball IDs stable when changing the count. When reducing the count, remove only balls that are not currently referenced by notation state or a hand or position. If a reduction would discard a ball currently in use, explain the conflict and do not apply the change.
- Keep initial placement editing direct: the visible position controls remain clickable to add or remove a ball.
- Individual passing supports both shared and per-performer positions. The default setup must use per-performer positions so that every performer can start with a ball at their own A and C. If the user switches to shared positions, the initial distribution must be reconciled explicitly rather than silently stacking balls in positions that only hold one object.

### 2. Compact notation grid

- Reduce notation cells to compact square tiles, approximately 40 to 42 CSS pixels per side, close to the current 38 pixel placement icons.
- Reduce row heights, gaps, padding and oversized outer spacing accordingly.
- Keep performer and hand labels legible without reserving the current oversized 130 pixel label column.
- Preserve responsive horizontal scrolling when the sequence genuinely exceeds the available width.
- The grid should be the primary focus, not a large empty table.

### 3. Correct square cells and continuous ball rectangles

- Every notation cell must have a fixed 1:1 aspect ratio at every viewport size.
- The SVG used for a ball rectangle must also use square geometry and must not stretch to fill a non-square cell.
- Adjacent rectangle segments must meet exactly at cell boundaries. There must be no white gap or doubled internal border between neighbouring segments of the same rectangle.
- Keep the rectangle edges faithful to the geometry in `docs/POINTS_NOTATION.md`.
- Render an action label inside each applicable pattern cell. In particular, HOLD must visibly say HOLD. Keep target symbols and labels legible at the reduced size.
- EMPTY remains visually empty. TAP remains independent of a ball rectangle. SPECIAL retains its text.

### 4. Beat-specific object state

- The state panel must derive its displayed locations from the simulator snapshot for the currently selected beat, not always from the final snapshot.
- Display the state after the selected beat and identify the beat shown.
- With no selected cell, show the initial state before beat one.
- Continue to use simulator snapshots only. Do not calculate object movement separately in the UI.
- If a selected beat is invalid and the simulator rejects its transfers, display the resulting unchanged state and retain the validation feedback.

### 5. Complete ZIP tool icon

- The toolbar ZIP icon must communicate the complete paired transfer, not display only the source or receiver half.
- Keep the actual notation in the two hand rows as complementary source and receiver symbols.
- Verify that the source closes the rectangle at the correct edge and the receiver opens it at the corresponding edge, according to the notation document.
- Preserve paired creation and paired deletion.

### 6. Complete target editing for all notation modes

Use `docs/POINTS_NOTATION.md` as the source of truth.

- For ordinary solo and individual passing table actions, LIFT and LEAVE target controls must offer the available table positions and the acting performer's L and R hand-back positions.
- TAP and BOUNCE target controls must offer table positions only. They do not target hand backs.
- Circle passing must offer A, B and C, a separate left or right direction control, and a distance when targeting another performer. It must also allow the acting performer to target their own A, B or C position without a direction or distance subscript. The own performer is the default target. Render other performer direction and distance as a proper subscript.
- Individual passing must expose the two reciprocal targets:
  - Sender LEAVE targets the recipient's hand using a circled L or R and the recipient's performer identifier as a subscript.
  - Receiver LIFT targets X and identifies the source performer as a subscript.
- Replace the current prompt-only individual passing workflow with explicit controls for choosing the other performer and the receiving hand. Creating a pass must create the reciprocal pair with one shared link ID at the same beat.
- Ensure the UI can edit these targets after creation and keeps both sides consistent.
- Do not offer X as an ordinary table position. X is specific to the receiving LIFT in individual passing.
- Keep the existing simulator responsible for validating reciprocal pass pairs.

### 7. Correct subscripts

- Render circle passing references using proper typographic subscripts. Examples: A with subscript L, A with subscript 2L, and A with subscript R.
- Render individual passing performer identifiers as true subscripts on X and on the circled receiving hand.
- Do not flatten subscripts into adjacent baseline text such as A2L.
- Keep the subscript readable in the compact cell size and in toolbar previews where applicable.

### 8. Stronger blue visual identity

- Replace the current pale cyan and teal emphasis with a clearly blue palette.
- Apply the blue palette consistently to the brand mark, active action tool, selected cell, selected initial position, focus indicators, interactive hover states and key borders.
- Preserve sufficient contrast for text, selected states and invalid notation.
- Keep the neutral background and restrained visual style. Do not turn every surface blue.

## Implementation approach

1. Update sequence creation and performer changes to establish the two-ball A/C default and stable configurable ball count.
2. Refactor target editing so the available controls depend on sequence type, action type and target kind.
3. Replace prompt-based individual pass creation with explicit performer and hand controls while retaining atomic paired entries.
4. Correct notation rendering, including square SVG geometry, action labels, ZIP toolbar preview and typographic subscripts.
5. Bind the object state panel to the selected beat's simulator snapshot.
6. Compact the grid and apply the blue design tokens.
7. Add or update focused tests for each behaviour. Avoid unrelated feature work.

## Verification

- [x] Default solo sequence contains two balls, initially at A and C.
- [x] Adding a performer creates two additional balls at that performer's A and C.
- [x] Ball count can be increased and decreased while preserving stable IDs and valid placements.
- [x] A reduction that would discard a ball in use is rejected safely.
- [x] Notation cells remain square at desktop and mobile widths.
- [x] Adjacent LIFT, HOLD or BOUNCE, and LEAVE segments connect without gaps.
- [x] HOLD is visibly labelled inside its notation cell.
- [x] Object state changes when selecting different beats and matches simulator snapshots.
- [x] ZIP toolbar icon shows the complete paired transfer.
- [x] LIFT and LEAVE can target L and R hand backs.
- [x] TAP and BOUNCE remain restricted to table positions.
- [x] Individual passing can select another performer and receiving hand, and creates reciprocal LEAVE and X-targeted LIFT entries.
- [x] Circle passing can target the acting performer's own A, B and C positions without a subscript.
- [x] Circle passing can target other performers using left or right direction and distance, displayed as subscripts.
- [x] Individual passing identifiers are displayed as subscripts.
- [x] Blue palette is applied consistently and maintains contrast.
- [x] Prettier, ESLint, strict TypeScript, Vitest and production build pass.

## Files expected to change

- `src/App.tsx`
- `src/styles/main.scss`
- `src/App.test.tsx`
- `src/domain/model.ts` and `src/domain/state/simulate.ts`, solely to represent own-performer circle targets
- `docs/architecture/DOMAIN_MODEL.md` to document the target semantics
- `src/domain/state/simulate.test.ts` for own-performer circle targets

The shared domain model and simulator should remain unchanged unless implementation reveals a genuine contract limitation. A confirmed limitation is that `CirclePassingTarget` currently requires a direction and positive distance, so it cannot represent the acting performer's own A, B or C position. Package 03B therefore also updates `src/domain/model.ts`, the simulator target resolver and their focused tests. The own performer target is represented explicitly by omitting direction and distance. No other domain semantics are changed.

## Approval

Approved by Oliver on 12 November 2026. Implementation completed and verified by GitHub Actions.
