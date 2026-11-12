# Implementation Plan 03: Sequence Editor

## Goal

Build the notation editor for creating, inspecting and modifying POINTS sequences.

## Scope

### Included

- Minimal notation focused interface.
- General sequence settings.
- Performer sections with left and right hand rows.
- Position management and initial object distribution.
- Beat and subdivision grid.
- Notation cells and all supported POINTS action types.
- Cell selection, multi selection and keyboard navigation.
- Contextual action menus and target entry.
- Drag drawing of ball rectangles and linked operations.
- Moving and copying notation.
- Undo and redo.
- Object state overview.
- Validation markings and error navigation.
- Import and copy code controls through the shared persistence interface.

### Excluded

- Renderer scene implementation.
- Generator algorithm and gallery.
- Sequence code encoding internals.
- Independent image export layout.

## Proposed approach

Consume the shared domain model and validation engine. Do not implement separate object state rules in the editor.

Keep the notation grid central. Use compact controls and progressive disclosure. Avoid decorative text, generic helper copy and unnecessary labels.

Separate the grid's visual columns from the underlying musical timeline. A beat or subdivision move must update the timeline and every performer row consistently.

Implement editing operations as domain commands grouped into undoable transactions. A drag operation that creates a LIFT, HOLD, LEAVE or linked ZIP is one transaction. Preserve existing notation when a proposed operation conflicts with it.

Support every action in the notation specification. Action menus expose contextually valid actions, while the validator remains authoritative and marks invalid user entered notation.

## Files and components

| File or area | Planned change |
|---|---|
| src/features/editor/ | Editor composition and feature components |
| src/features/editor/grid/ | Timeline grid, beat columns and hand rows |
| src/features/editor/cells/ | Cell rendering, selection and editing |
| src/features/editor/menus/ | Contextual action and target menus |
| src/features/editor/commands/ | Editing commands and undo transactions |
| src/features/editor/state/ | Selection and transient UI state |
| Editor tests | Component and interaction tests |

## Steps

1. Consume the domain model and validation interfaces.
2. Build settings and performer hand row structure.
3. Build timeline grid and shared column selection.
4. Implement notation rendering for all action types.
5. Implement single and multiple cell selection.
6. Implement keyboard navigation and editing commands.
7. Implement action menus, target entry and SPECIAL text editing.
8. Implement drag drawing, rectangle movement and linked ZIP behaviour.
9. Implement copy, paste, deletion, undo and redo.
10. Implement initial state editing and hidden object state overview.
11. Connect validation issues to cell markings and error navigation.
12. Connect import and copy actions to persistence interfaces.
13. Test desktop, tablet and phone interactions.

## Verification

- [ ] Formatting
- [ ] Linting
- [ ] TypeScript strict type check
- [ ] Automated tests
- [ ] Production build
- [ ] Tests for every notation action
- [ ] Tests for paired ZIP and linked SPECIAL
- [ ] Tests for drag conflict protection and atomic undo
- [ ] Tests for multi selection, copy and paste
- [ ] Tests for responsive and touch editing

## Dependencies

Packages 01 and 02. The time model must be sufficiently specified before subdivision layout and compound meter display are finalised.

## Risks and open questions

- Compound meter grouping and subdivision representation are unresolved.
- Double click and selected cell property opening gestures remain open.
- Keyboard shortcut mapping remains open.
- Touch equivalents for desktop drag and modifier key interactions require design.
- Advanced functionality must remain available on narrow screens.

## Approval

Status: Awaiting approval

Implementation must not begin until this plan is explicitly approved.
