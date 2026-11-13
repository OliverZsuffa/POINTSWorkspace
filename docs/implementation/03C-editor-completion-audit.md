# Implementation Plan 03C: Editor Completion and Feature Verification

## Status

Approved by Oliver on 12 November 2026. The first implementation pass merged through PR #9. The final correction and verification pass merged through PR #10. Automated verification passes, and six viewport screenshots have been visually reviewed. The matrix retains Partial for requirements whose full edge case coverage is not yet established.

## Goal

Make the existing sequence editor genuinely complete and usable, not merely buildable. Verify every feature promised by Packages 03 and 03B against the design documents and the running application. Correct omissions, defects and visual inconsistencies, and leave an explicit evidence based status for every requirement.

This is a completion and verification package. It must not silently narrow the original scope or mark a feature complete merely because a component, button or function exists.

## Scope

### 1. Full feature audit

Create a traceable verification matrix covering every included requirement in:

- `docs/implementation/03-sequence-editor.md`
- `docs/implementation/03B-editor-corrections.md`
- Relevant editor requirements in `docs/DESIGN_DOCUMENT_V1.md`
- POINTS notation semantics and symbol geometry in `docs/POINTS_NOTATION.md`
- Relevant SVG reference assets under `docs/images/`

For every individual requirement, record:

- Requirement and source section.
- Current implementation location, if any.
- Verification method and evidence.
- Result: Pass, Fail, Partial, Not implemented, Blocked or Not applicable.
- Required correction and test, if any.

A feature is not Pass merely because a control is visible. Verify its actual interaction and resulting sequence state. Where practical, test the feature through the UI and assert the resulting domain data. Where automated verification cannot establish visual correctness, require manual review and record it separately.

Audit all of the following, including requirements that appear to be implemented already:

1. Sequence settings: type, time signature, BPM, beat count, performers, names, identifiers and position layout.
2. Performer sections and left and right hand rows.
3. Shared and performer owned positions, adding, renaming and removing positions.
4. Initial ball count, stable ball identities, initial distribution and direct placement editing, including hand held and hand back positions.
5. Main beat timeline, bar boundaries, binary subdivisions, labels, beat insertion, deletion and movement.
6. All notation actions: HOLD, LIFT, LEAVE, BOUNCE, TAP, EMPTY, ZIP, individual passing, circle passing and SPECIAL.
7. Target creation and editing for every applicable action and passing mode.
8. Cell, beat, subdivision and multi selection.
9. Arrow navigation, Shift plus arrow selection, Escape and Backspace.
10. Action menu opening, closing and editing existing actions.
11. Typing targets after action selection, including replacing an existing target.
12. Drag drawing of complete ball rectangles and atomic undo.
13. Moving complete rectangles, linked actions and multiple selected rectangles.
14. Shift drag drawing and Ctrl click additive multi selection.
15. ZIP pairing, reciprocal symbols and paired deletion.
16. Linked SPECIAL text, visual connection, movement and deletion behaviour.
17. Copy and paste, including linked actions, multi selection, conflict rejection and atomicity.
18. Undo and redo, including complete multi step editing workflows.
19. Validation markings, error list and navigation from an error to the relevant notation.
20. Object state overview, selected beat state, invalid beat handling and simulator derived results.
21. Mobile Select, Draw and Move modes, with deletion through the Delete control.
22. Responsive behaviour and preservation of all editing functionality on desktop, tablet and phone.
23. Correct notation symbols, labels, subscripts, rectangle geometry and legibility.
24. All correction requirements from Package 03B, including its default initial distribution and target controls.

The audit must explicitly distinguish a UI control existing from its feature working correctly.

### 2. Notation grid and visual model

Review the rendered grid at realistic desktop, tablet and phone viewport sizes. Do not infer visual correctness from CSS declarations alone.

- Use square notation cells as the fundamental grid unit.
- Keep cell width and height equal at every supported viewport size.
- Use the square SVG geometry in `docs/images/` as the reference for notation symbols and ball rectangles.
- Treat each cell as a square whose individual edges can be enabled or disabled according to the notation rectangle.
- Adjacent segments of one rectangle must join exactly at cell boundaries, without gaps or doubled internal edges.
- Preserve the distinct visual semantics of HOLD, LIFT, LEAVE, BOUNCE, TAP, EMPTY, ZIP, passing and SPECIAL.
- Keep action names and target notation legible at actual display size. Do not rely on tiny labels or hover only information.
- Keep performer and hand labels aligned with their rows.
- Keep the timeline and notation columns aligned through horizontal scrolling.
- Ensure selection and invalid state overlays do not distort symbol geometry.
- Do not replace the approved notation geometry with generic rounded cards or arbitrary rectangular tiles.

The target is a clear notation grid inspired by a spreadsheet: square cells, with the relevant sides drawn for each notation symbol. This does not mean every cell should be a fully enclosed box.

### 3. Editing controls and layout within the editor

Improve the editor's internal arrangement without implementing the separate desktop editor and renderer workspace shell owned by Package 07.

- Place action insertion controls adjacent to the notation grid, rather than in a distant unrelated strip.
- Keep target controls close to the selected action and its editing context.
- Avoid a layout where insertion controls, target settings and the notation grid compete across unrelated page regions.
- On desktop, prefer a compact side toolbar or contextual side panel next to the notation grid. The notation grid remains the primary work surface.
- On narrow screens, use a compact contextual arrangement that does not remove functionality or force controls into an unusable horizontal band.
- Keep sequence wide settings accessible but visually secondary.
- Remove redundant labels, filler and unnecessary whitespace.
- Preserve clear focus, selected, disabled and invalid states.

The full editor and renderer side by side layout, panel resizing and mobile editor/renderer tabs are Package 07, not this package.

### 4. Keyboard shortcuts and clipboard workflow

Implement and verify the promised keyboard interactions. Do not treat arrow navigation as sufficient keyboard support.

Already specified interactions that must remain working:

- Arrow keys navigate between cells.
- Shift plus arrow extends selection.
- Escape clears or cancels the current selection or interaction.
- Backspace deletes selected notation.
- Ctrl plus click adds a cell to the current selection. Deletion is performed only through the Delete control, Delete key or Backspace key.
- Shift plus drag draws.

Add and document a coherent shortcut set for:

- Copy selected notation.
- Paste copied notation.
- Undo.
- Redo.
- Opening the shortcut reference.
- Any action shortcuts approved during implementation.

Use conventional platform appropriate modifier behaviour. Avoid intercepting normal typing in text fields, inputs, selects, textareas or editable SPECIAL text. Clipboard operations must preserve linked actions and multi selection. A conflicting paste must fail atomically and must not partially alter the sequence.

The exact single key mappings for notation actions were not fixed in the original plan. Propose a compact mapping in the implementation notes and document it in the application. Do not bind ambiguous or destructive shortcuts without a visible discoverable reference.

Provide a concise keyboard shortcut help view accessible from the editor. It must list the actual implemented mappings, not planned ones.

### 5. Responsive and interaction verification

Verify at minimum:

- Desktop: 1440 by 900 and 1280 by 800.
- Tablet: 1024 by 768 and 768 by 1024.
- Phone: 390 by 844 and 320 by 700.

Use browser automation or component tests where available, plus manual visual inspection of the actual running application. Test touch equivalents on a touch capable device or a reliable touch emulation environment.

The grid may scroll horizontally when the sequence is wider than the viewport. Controls must remain reachable and must not overlap or cover the active editing area.

### 6. Defect correction

Correct every confirmed failure within this package's ownership. If the audit finds a defect owned by another package, record it with its owning package and do not duplicate or bypass that package's architecture.

Do not silently invent behaviour for unresolved requirements. Keep blocked items explicit and propose a decision where necessary.

### 7. POINTS colour direction

Use the POINTS website turquoise `#90d0d5` as the application page background. Keep working panels and editing surfaces neutral and readable. Use `#6bc3c5` as the accent colour where appropriate. This supersedes the earlier blue page background in Package 03B.

## Explicit exclusions

- Side by side editor and renderer workspace, panel resizing, swapping and hiding. Package 07.
- Renderer camera, animation, performer spacing, table and seat geometry. Package 04 and its correction package.
- Sequence generation. Package 05.
- Sequence codes, import, persistence, presets and image export. Package 06.
- New simulation or validation semantics. Package 02.
- Compound meter and triplet subdivision semantics, which require a coordinated domain and simulator change.
- Full PWA and offline support. Package 07.

## Planned deliverables

1. `docs/implementation/03C-editor-completion-audit.md`: this approved plan, updated with implementation notes, verification results and unresolved items.
2. A feature verification matrix covering all requirements from Packages 03 and 03B.
3. Editor code and styles for confirmed corrections.
4. Automated unit, component and interaction tests for corrected behaviour.
5. Visual verification evidence for the required viewport sizes.
6. Updated editor help and keyboard shortcut reference.
7. Updated `docs/implementation/README.md` with accurate package status and links.

## Verification and acceptance criteria

- [x] Every included requirement from Packages 03 and 03B appears in the verification matrix.
- [x] Every requirement has a recorded result and evidence or an explicit blocker.
- [x] No requirement is marked Pass based only on the existence of a UI control or source function.
- [x] All confirmed in scope failures are corrected.
- [ ] Every notation action can be entered, edited and rendered correctly.
- [ ] All target editing workflows work for solo, circle passing and individual passing as applicable.
- [ ] Selection and multi selection work with mouse, keyboard and touch equivalents.
- [ ] Ball rectangle drawing and movement preserve complete structures and linked actions.
- [ ] Copy and paste preserve linked structures and reject conflicts atomically.
- [ ] Undo and redo correctly reverse and restore every supported edit transaction.
- [ ] Validation feedback and error navigation match simulator results.
- [ ] Object state overview always reflects simulator snapshots for the selected beat.
- [ ] Notation cells and symbols are square and visually correct at all required viewport sizes.
- [ ] Action names, targets and subscripts are legible without relying on hover.
- [x] Editing controls are grouped around the notation grid and remain usable on narrow screens.
- [x] Keyboard shortcuts are documented and the help view lists only working shortcuts.
- [ ] No editing capability is removed on tablet or phone.
- [x] Prettier, ESLint, strict TypeScript, all automated tests and production build pass.
- [x] Manual visual review is recorded for desktop, tablet and phone.

## Dependencies and ownership

Packages 01 and 02 are complete. Packages 03 and 03B are merged, and this package audits their delivered implementation.

Package 02 remains the authority for simulation and validation. This package must not implement duplicate action rules.

Package 07 owns the overall workspace shell. This package may reorganise the editor's own controls and grid but must not implement the editor and renderer panel system.

## Risks and unresolved decisions

1. Exact single key mappings for notation actions were not agreed. Propose them for review and document the final mappings.
2. Some visual requirements may need adjustment after inspecting the existing SVG assets at actual cell size.
3. Visual verification was completed using browser screenshots at six viewport sizes. Further physical device testing may reveal touch behaviour not represented by browser emulation.
4. Compound meter limitations remain outside this package.
5. The original plan includes some interactions whose detailed gesture behaviour may not be fully specified. Record gaps rather than guessing.

## Approval

Approved by Oliver on 12 November 2026. First implementation pass merged through PR #9. Final corrections and verification merged through PR #10. CI run #43282862600 passed formatting, lint, strict TypeScript, 90 unit and component tests, production build and six browser viewport checks. Screenshot review covered 1440x900, 1280x800, 1024x768, 768x1024, 390x844 and 320x700. The verification matrix retains Partial where exhaustive interaction coverage remains incomplete.
