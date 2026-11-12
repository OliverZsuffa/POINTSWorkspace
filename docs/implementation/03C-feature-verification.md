# Package 03C: Editor Feature Verification Matrix

## Status

Audit in progress on `work/03c-editor-completion`. This matrix distinguishes automated evidence from complete verification. A test passing does not automatically establish visual correctness or complete feature behaviour.

Status meanings:

- **Pass:** Requirement has direct automated evidence for the specified behaviour.
- **Partial:** Some behaviour is implemented or tested, but the full requirement is not established.
- **Not verified:** Implementation or tests exist, but there is not yet sufficient evidence to mark the requirement complete.
- **Fail:** A known discrepancy exists.
- **Blocked:** Verification depends on another package or an unresolved decision.
- **Not implemented:** The required functionality is absent.

## Verification matrix

| ID | Requirement | Evidence reviewed | Status | Remaining verification |
|---|---|---|---|---|
| 03.01 | Sequence type, time signature and BPM settings | Settings controls in `src/App.tsx` | Partial | Test every supported setting and confirm existing notation is preserved |
| 03.02 | Beat count and timeline structure | Timeline and beat controls; beat insertion test | Partial | Verify deletion, trailing beat restrictions and count changes |
| 03.03 | Performer names and identifiers | Performer settings and editing test | Pass | Manual layout review with long names and duplicate identifiers |
| 03.04 | Add and remove performers | Performer controls; adding performer test | Partial | Verify removal confirmation and retained invalid external references |
| 03.05 | Performer sections and separate hand rows | Grid rendering in `src/App.tsx` | Pass | Visual review at all target viewport sizes |
| 03.06 | Shared and performer owned positions | Position settings and individual passing layout controls | Partial | Verify add, remove, rename and all ownership transitions |
| 03.07 | Initial ball count and distribution | Initial state controls; default A/C and count tests | Pass | Verify edge cases with many performers and shared positions |
| 03.08 | Direct initial position editing | Clickable initial position controls; placement test | Pass | Verify all hand held and hand back placements |
| 03.09 | Main beat timeline and bar boundaries | Timeline rendering and beat selection tests | Partial | Verify all time signatures and bar boundary recalculation |
| 03.10 | Binary subdivisions and recursive subdivision | Timeline implementation and recursive subdivision tests | Pass | Confirm warning and behaviour for simulator main beat limitation |
| 03.11 | HOLD, LIFT, LEAVE, BOUNCE, TAP, EMPTY, ZIP and SPECIAL | Action rendering and menu implementation | Partial | Dedicated interaction and semantic tests for every action |
| 03.12 | Individual and circle passing | Passing creation, target controls and passing movement tests | Partial | Verify all target combinations, invalid combinations and paired atomicity |
| 03.13 | Table, hand back, circle and performer targets | Target controls and target editing tests | Partial | Verify keyboard entry and every target type |
| 03.14 | Cell selection and multi selection | Selection implementation; beat and multi selection tests | Pass | Verify mixed rows, subdivisions and selection cancellation |
| 03.15 | Keyboard navigation | Arrow and Shift plus arrow handling; navigation test | Pass | Verify boundary behaviour and focus restoration |
| 03.16 | Keyboard action insertion, target entry and help | Added numeric action and target shortcuts, help dialog and tests | Partial | CI verification and manual platform keyboard review |
| 03.17 | Contextual action menus | Menu implementation and open, choose and close test | Pass | Verify all menu modes and existing action replacement |
| 03.18 | Drag drawing of complete rectangles | Rectangle drawing implementation and test | Pass | Verify reverse direction, cross hand and subdivision cases |
| 03.19 | Moving complete rectangles and linked actions | Rectangle movement tests, including ZIP and individual pass | Pass | Verify edge conflicts and complex multi selection |
| 03.20 | ZIP pairing and paired deletion | ZIP implementation and paired deletion test | Pass | Verify all conflict and undo cases |
| 03.21 | Linked SPECIAL text and deletion | Linked SPECIAL tests | Pass | Verify all editing and movement combinations |
| 03.22 | Copy and paste with linked actions and atomic conflict rejection | Clipboard implementation and existing UI test | Partial | Expand keyboard tests and verify linked structures and conflict rollback |
| 03.23 | Undo and redo for editor transactions | History implementation and undo test | Partial | Verify redo, grouped gestures, linked edits and structural changes |
| 03.24 | Validation markings and error navigation | Shared simulator integration and validation panel | Partial | Verify each error type, affected cells and navigation |
| 03.25 | Object state overview from simulator snapshots | Snapshot derived state panel and selected beat test | Pass | Verify invalid beat and initial state edge cases |
| 03.26 | Responsive desktop, tablet and phone operation | Responsive styles and touch mode tests | Partial | Manual visual review at all six specified viewport sizes |
| 03.27 | Touch Select, Draw, Move and Erase | Touch mode implementation and interaction tests | Pass | Manual touch device verification |
| 03.28 | Square notation cells and SVG edge geometry | Existing icon SVG assets, inline SVG geometry and 42 pixel square grid tracks | Partial | Browser measurements and screenshot review at desktop, tablet and phone |
| 03.29 | Labels, targets, subscripts and symbol legibility | Existing rendering tests for HOLD, ZIP and duplicate position identifiers | Partial | Visual review at 42 pixel cells, including long targets |
| 03.30 | Editor controls arranged beside notation | New editor workspace layout and contextual toolbar styles | Partial | Verify actual layout, scrolling and usability at all target widths |
| 03.31 | POINTS turquoise page background | Updated global palette to `#90d0d5`, accent `#6bc3c5` | Partial | Confirm visual contrast and renderer surface separation |
| 03.32 | Preserve all editing features on narrow screens | Existing touch modes and responsive CSS | Partial | Full manual feature audit on phone and tablet |

## Current implementation changes

- Added Ctrl or Command plus C and V, Ctrl or Command plus Z, Shift plus Z and Y shortcuts.
- Added numeric action shortcuts: 1 LIFT, 2 HOLD, 3 LEAVE, 4 BOUNCE, 5 TAP, 6 EMPTY, 7 ZIP and 8 SPECIAL.
- Added target typing for A, B and C, hand back targets L and R, and performer identifiers for individual passing.
- Added a discoverable keyboard shortcut dialog, opened with the question mark key or the top bar help button.
- Moved editing tools and target controls into a side toolbar adjacent to the notation grid.
- Set notation timeline tracks and cells to 42 by 42 pixels.
- Applied the POINTS page background turquoise while retaining neutral work surfaces.
- Added automated tests for action shortcuts, target typing, keyboard help, keyboard copy and paste, and keyboard undo.

## Explicitly outside this package

- Side by side editor and 3D renderer panels, resizing and rearranging. Package 07.
- Renderer camera, performer spacing, table and animation corrections. Package 04 correction work.
- Compound meter and triplet subdivision semantics. Requires coordinated domain and simulator changes.
- Generator, persistence, sequence codes, presets and export. Packages 05 and 06.

## Final verification log

| Check | Result | Evidence |
|---|---|---|
| Prettier | Pending | CI |
| ESLint | Pending | CI |
| Strict TypeScript | Pending | CI |
| Unit and component tests | Pending | CI |
| Production build | Pending | CI |
| Desktop visual review | Pending | Manual browser review |
| Tablet visual review | Pending | Manual browser review |
| Phone visual review | Pending | Manual browser review |
