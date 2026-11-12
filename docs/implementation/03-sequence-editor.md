# Implementation Plan 03: Sequence Editor

## Status

Prepared on 12 November 2026. Awaiting Oliver's approval. No application implementation has started.

## Goal

Deliver the first usable POINTS Workspace milestone: a working notation editor in which a user can create a sequence, configure its structure, enter and edit POINTS notation, and see validation feedback.

The editor uses the existing domain model and Package 02 simulator and validator. It must not duplicate or reinterpret juggling rules.

## Scope

### Included

1. Minimal responsive editor interface with the notation grid as its main focus.
2. Sequence settings for sequence type, time signature, BPM, beat count, performers, performer names and identifiers, and position layout.
3. Performer sections with separate left and right hand rows.
4. Position management, including shared positions and positions owned by individual performers where supported.
5. Initial object distribution across table positions, held hands and hand backs.
6. Timeline grid with main beats, bar boundaries and binary subdivisions supported by the current domain model.
7. Rendering and editing of HOLD, LIFT, LEAVE, BOUNCE, TAP, EMPTY, ZIP, individual passing, circle passing and SPECIAL.
8. Target entry for table positions, circle direction and distance, individual passing performers and recipient hands.
9. Individual cell selection, complete beat and subdivision selection across all rows, and multi selection.
10. Keyboard navigation and the already agreed keyboard interactions.
11. Contextual action menus. Empty cell first click selects and opens the action menu. Existing notation first click selects it. SPECIAL opens directly for text editing.
12. Drag drawing of complete ball rectangles, including LIFT, intermediate HOLD or BOUNCE, and LEAVE. A drag is one undoable operation.
13. Moving complete ball rectangles, including linked actions, and moving multiple selected rectangles together.
14. ZIP creation and paired deletion. Linked SPECIAL actions with shared text and a visible connection.
15. Copy, paste and deletion of notation, with conflict protection and atomic paste.
16. Undo and redo for editor changes.
17. Validation feedback from the shared validator. Invalid cells are marked red, errors are listed separately, and selecting an error navigates to its notation.
18. Hidden by default object state overview derived from simulator snapshots.
19. Responsive operation on desktop, tablet and phone. No editing feature may be intentionally removed on narrow screens.

### Excluded

- 3D renderer, animation, playback and camera controls. Package 04.
- Generator and candidate gallery. Package 05.
- Sequence code encoding, decoding, import, export and local persistence. Package 06.
- Curated preset library.
- Independent print or image export layout.
- Workspace panel rearrangement and full PWA or offline shell. Package 07.
- New simulation or validation rules already owned by Package 02.

## Interaction requirements

### Grid and timeline

- Each performer has a left hand row and a right hand row. Time columns are shared by all rows.
- Clicking a beat label selects that beat across all rows. Clicking a subdivision label selects that subdivision across all rows.
- The plus control between columns inserts a full beat by default.
- Subdivisions split the selected interval in half and may be subdivided recursively.
- Labels use conventional counting where supported: beat numbers, `&`, then `e` and `a`. Bar boundaries remain visible.
- Moving a beat moves its subdivisions and all notation at those positions across every row.
- Deleting a beat shifts later beats left. A trailing beat can be removed only when empty. Increasing beat count appends empty beats.
- Changing time signature preserves existing timeline positions and notation. Bar boundaries and labels are recalculated.
- Compound meter grouping must not be guessed. The current binary subdivision model cannot fully express every conventional compound grouping. Do not invent a representation or imply that the display is musically complete.

### Cell editing

- Empty cell first click selects it and opens the action menu. Existing notation first click selects without replacing it.
- Action menus show available actions directly, without submenus, and close after an action is chosen. Do not remember the last action or target.
- After choosing an action, the user can type its target. Typing a new target while an existing action is selected replaces that target.
- Escape cancels and clears selection. Backspace deletes selected notation. Arrow keys move selection. Shift plus arrow extends selection.
- Clicking empty editor space clears selection.
- Shift plus drag draws notation. Ctrl plus drag erases notation. Right click opens text input where applicable.
- Drawing over existing notation never overwrites it. Conflicting edits are rejected without partial changes.
- Dragging creates a complete ball rectangle rather than repeated symbols.
- Dragging any part of a rectangle moves the entire rectangle, including LIFT, HOLD or BOUNCE, and LEAVE. Linked ZIP notation moves with it. Multi selected rectangles move together.
- Copy and paste include linked actions. A conflicting paste is rejected in full.
- SPECIAL is free text. It may be assigned to one hand or linked across both hands. Linked cells share text and show a connection. Deleting one linked SPECIAL cell leaves the other as a standalone SPECIAL.
- Deleting either side of ZIP deletes the paired side.
- Deleting notation or beats does not require confirmation. Undo is the recovery mechanism.

### Action semantics

The source of truth is `docs/POINTS_NOTATION.md`.

- BOUNCE is a tap performed while holding an object with the fingers. The held object remains in the hand.
- TAP requires free fingers.
- A balanced object on a hand back does not occupy the fingers and does not prevent otherwise valid actions.
- SPECIAL requires free fingers. A coordinated clap can use linked SPECIAL entries.
- ZIP is a paired source and receiver action in the same beat.
- Individual passing uses paired sender LEAVE and receiver LIFT entries.
- Circle passing uses numeric distance and separately selected direction.
- Individual passing selects an existing performer and receiving hand.
- Invalid notation may be entered. The shared validator remains authoritative.

### Settings and structural changes

- Settings remain editable while working on a sequence.
- Adding a performer creates empty left and right hand rows.
- Removing a performer referenced by notation requires confirmation. If confirmed, remove that performer's notation but retain external references so validation can mark them invalid.
- Adding a position makes it available as a target. Removing a referenced position is allowed and retains references for validation. Renaming a position updates all references.
- Changing sequence type does not rewrite or delete incompatible notation. Keep it and show validation errors.
- Position names are unique within a performer. Shared positions use a shared namespace.

## Proposed architecture

- Keep editor components under `src/features/editor/`.
- Separate grid and timeline rendering, notation cells, menus, editing commands, selection state, settings, validation and initial state controls.
- Keep domain operations independent of React components.
- Represent each user edit as a command or transaction. A complete drag, linked ZIP operation, linked SPECIAL edit, move or paste is atomic and produces one undo step.
- The sequence is the source of truth. Derive cell presentation, selection overlays, object state overview and validation markings from sequence state and existing domain services.
- Recompute validation and simulator snapshots after sequence changes. Do not implement a second set of action eligibility rules in the UI.
- Preserve stable entity IDs when moving or editing existing entities. Generate new IDs only for new entities.
- Keep renderer appearance and generator settings out of this package.

## Planned files and components

| File or area | Responsibility |
|---|---|
| `src/features/editor/Editor.tsx` | Editor composition and sequence state |
| `src/features/editor/settings/` | Sequence, performer and position settings |
| `src/features/editor/grid/` | Timeline, beat columns, subdivisions and hand rows |
| `src/features/editor/cells/` | Notation symbols, selection and cell interactions |
| `src/features/editor/menus/` | Contextual action menus and target entry |
| `src/features/editor/commands/` | Editing commands, transactions and undo history |
| `src/features/editor/state/` | Selection and transient interaction state |
| `src/features/editor/validation/` | Validation panel, cell markings and error navigation |
| `src/features/editor/initial-state/` | Initial object placement and state overview |
| Editor tests | Component and interaction tests |
| `src/App.tsx` and styles | Mount editor and establish minimal responsive layout |

The exact file split may be adjusted during implementation if responsibilities remain separated.

## Implementation sequence

1. Add editor feature structure and minimal application shell.
2. Add sequence creation defaults and settings controls.
3. Render performer sections, hand rows and shared timeline.
4. Render all notation types using the POINTS notation assets and consistent symbols.
5. Implement selection, multi selection and keyboard navigation.
6. Implement editing commands, contextual menus and target entry.
7. Implement ball rectangle drawing, moving and conflict protection.
8. Implement linked ZIP and linked SPECIAL behaviour.
9. Implement copy, paste, deletion and undo or redo.
10. Implement performer, position, beat and subdivision editing.
11. Implement initial object placement and derived state overview.
12. Connect validation results, red cell markings and error navigation.
13. Complete responsive interaction handling and automated tests.

## Verification

- [ ] Prettier formatting check
- [ ] ESLint
- [ ] Strict TypeScript check
- [ ] Vitest unit and component tests
- [ ] Production build
- [ ] Every notation action renders and can be edited
- [ ] Target editing for all passing modes
- [ ] ZIP pairing and paired deletion
- [ ] Linked SPECIAL editing, movement and deletion
- [ ] Rectangle drawing and movement are atomic undo steps
- [ ] Existing notation is never silently overwritten
- [ ] Multi selection, copy, paste and conflict rejection
- [ ] Beat insertion, deletion, movement and subdivision behaviour
- [ ] Performer and position changes preserve specified references
- [ ] Initial state editing agrees with simulator results
- [ ] Invalid notation is marked and errors navigate to the correct cell
- [ ] Keyboard interactions and touch equivalents
- [ ] Desktop, tablet and phone layout review

## Dependencies and boundaries

Packages 01 and 02 are complete and merged into `main`. Package 02 provides the canonical simulator and validator.

Package 06 has not been implemented. The editor therefore uses in memory sequence state in this package. It must not invent a temporary sequence code format or persistence contract.

Package 04 has not been implemented. The editor must work independently of the renderer.

## Risks and unresolved decisions

1. Compound meter grouping is not fully represented by the current binary subdivision model. Do not silently approximate its musical grouping.
2. Exact shortcut mappings beyond the already agreed arrow, Shift plus arrow, Escape, Backspace, Ctrl plus drag and Shift plus drag interactions remain to be finalised.
3. Double click behaviour and a separate gesture for opening selected notation properties remain undecided. Do not assign them a new meaning without review.
4. Mobile touch equivalents for modifier key drag interactions need deliberate implementation. Preserve full editing capability rather than dropping those operations.
5. The current simulator evaluates actions at main beat level. Subdivision entries must not imply a different simulation order or timing until the domain model supports it.
6. The precise visual presentation of the state overview can be refined during implementation, but it must remain hidden by default and derived from simulator snapshots.

## Approval

Status: Awaiting approval.

No application implementation may begin until Oliver explicitly approves this plan.
