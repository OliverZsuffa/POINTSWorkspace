# Implementation Plan 07: Workspace, Visual Refinement and PWA

## Status

Awaiting approval.

This revision expands the original Package 07 into the integration and visual refinement milestone for the existing Sequence Editor and Sequence Renderer. It covers the complete user facing workspace, not only the application shell.

Implementation must not begin until Oliver has reviewed and explicitly approved this plan.

## Goal

Deliver a coherent, polished POINTS Workspace in which the editor, renderer and generator area feel like parts of one application. Establish a consistent visual system, resolve the remaining editor and renderer presentation issues, make the complete workspace usable across desktop, tablet and phone, and deliver reliable installable offline behaviour.

The result must remain notation focused, compact and intuitive. The visual system should make the important actions and information easier to understand without adding decorative content or unnecessary controls.

This package is an integration and presentation milestone. It must not silently change POINTS notation, simulator behaviour, validation rules, sequence data contracts or generator search semantics.

## Product sources and precedence

Use these documents as the source material:

1. `docs/DESIGN_DOCUMENT_V1.md` for the overall product and interaction vision.
2. `docs/POINTS_NOTATION.md` for notation meaning and domain rules.
3. `docs/implementation/03-sequence-editor.md` for the implemented editor behaviour and its known limitations.
4. `docs/implementation/04-sequence-renderer.md` and `docs/implementation/04B-renderer-corrections.md` for renderer behaviour and outstanding verification.
5. The POINTS Godot prototype, Bone008's Juggling Interactive Framework and Juggling Lab as visual and interaction references, not templates to copy.

If an implementation detail conflicts with a domain rule or an already approved package decision, the domain rule and approved decision take precedence. Record any genuine conflict as an open decision rather than resolving it implicitly.

## Scope

### Included

1. Complete workspace shell and integration of the existing editor and renderer.
2. Desktop panel layout, resizing, swapping, hiding and restoring.
3. Generator panel placement and shell integration. Generator functionality remains owned by Package 05.
4. A shared visual design system for typography, spacing, colour, surfaces, borders, controls, menus, focus, selection and feedback.
5. Visual and interaction refinement of the existing Sequence Editor.
6. Visual and interaction refinement of the existing 3D Sequence Renderer.
7. Consistent controls and interaction conventions across all workspace areas.
8. Phone and tablet navigation using Editor and Renderer tabs, with all existing functionality retained.
9. Responsive layouts, touch interaction and keyboard accessibility.
10. PWA manifest, installability, service worker, offline application loading and safe update behaviour.
11. Automated, browser based and manual visual verification across representative screen sizes.
12. Documentation of final design decisions, known limitations and verification results.

### Excluded

1. Changes to POINTS notation semantics, simulator rules or validator rules.
2. New editor capabilities or changes to editing behaviour beyond presentation and usability corrections. Any necessary functional change must be identified and approved explicitly.
3. New renderer animation semantics, subdivision simulation or changes to the simulator snapshot contract.
4. Generator search engine, constraints, deduplication and result generation. These belong to Package 05.
5. Sequence serialization, import, export, presets and local sequence persistence. These belong to Package 06.
6. Cloud accounts, synchronisation or cross tab collaboration.
7. Detached windows, pop out panels or additional predefined workspace layouts.
8. Custom 3D performer modelling, realistic anatomy or custom trajectory editing.

## Product and interaction principles

The following principles apply to every screen and feature:

1. The notation and work area remain the visual focus.
2. Frequently used controls are immediately visible. Advanced controls use progressive disclosure.
3. Avoid decorative descriptions, filler labels, generic placeholder text and unnecessary explanatory copy.
4. Controls that look alike must behave alike.
5. Selection, focus, hover, disabled, invalid, active and pressed states must be visually distinguishable.
6. Colour must not be the only way to communicate state. Use shape, position, text or another visual cue where needed.
7. Controls must have practical touch targets without making the interface unnecessarily large.
8. Preserve information density where it helps editing, but never sacrifice legibility to fit more content.
9. Use the existing POINTS notation symbols and established domain language consistently.
10. Prefer direct manipulation and visible outcomes over additional dialogs and configuration steps.
11. Do not add a permanent tutorial or shortcut overlay. Contextual help may be available where an interaction is otherwise difficult to discover.
12. Light and dark themes must both be deliberate, readable and complete. If theme switching already exists, verify that every feature respects it. Do not introduce a new theme preference workflow without approval.

## Design review before implementation

Before changing styles or components, inspect the current application at desktop, tablet and phone sizes. Review the editor and renderer as they exist on the current main branch, including actual browser rendering rather than relying only on source code or automated tests.

Create a concise visual audit in the repository. It must identify:

1. Existing strengths that should be retained.
2. Visual inconsistencies between editor, renderer and shared controls.
3. Legibility problems, including notation size, labels, spacing and control density.
4. Layout problems, overflow, unnecessary scrolling and wasted space.
5. Interaction problems that are caused by unclear affordances or inconsistent feedback.
6. Renderer presentation problems involving scene scale, framing, performer spacing, table, hands, balls and playback controls.
7. Responsive problems specific to desktop, tablet or phone.
8. Accessibility problems involving contrast, focus, target size and keyboard operation.

The audit must distinguish visual defects from missing functionality and from limitations imposed by the current domain model.

## Workspace layout

### Desktop

1. Editor and Renderer appear side by side by default, each using approximately half of the available workspace.
2. The divider can be dragged to resize the two panels.
3. The panels can be swapped.
4. Either panel can be hidden and restored without losing its current working state.
5. Do not introduce detached or floating windows.
6. Keep one default layout. Do not add layout presets.
7. The Generator occupies a lower panel beneath the main panels. It can be pulled up when needed and collapsed again.
8. The main workspace must use available viewport space efficiently. Avoid nested scroll areas unless they are necessary for a specific content region.
9. Panel controls must remain discoverable without competing with the editor or renderer content.

### Phone and tablet

1. Use separate Editor and Renderer tabs.
2. Treat tablets using the same navigation model as phones, while adapting dimensions and spacing to the available viewport.
3. Preserve every existing editor and renderer capability. Do not remove advanced editing operations on touch devices.
4. Ensure switching tabs does not reset the sequence, selection unnecessarily, renderer camera or generator state.
5. Coordinate workspace gestures with editor gestures. A horizontal drag intended for notation editing must not accidentally resize or switch workspace panels.
6. Provide clear touch alternatives for actions that otherwise depend on hover, right click or keyboard modifiers.
7. Keep important controls reachable and prevent the virtual keyboard from obscuring active inputs.

### Layout persistence

Remembering panel arrangement and panel visibility between sessions was not decided in the product design. Do not introduce persistence for workspace layout without an explicit decision. Keep the default layout deterministic for this package unless Oliver approves a persistence behaviour.

## Shared visual system

Inspect and then define reusable design tokens and primitives before applying isolated styling fixes.

The visual system must cover:

1. Typography scale, weight, line height and notation specific sizing.
2. Spacing scale and alignment rules.
3. Surface hierarchy, borders, dividers, corner treatment and elevation.
4. Light and dark theme colours, including semantic colours for errors, warnings, selection and success.
5. Buttons, icon buttons, inputs, selectors, menus, tooltips, tabs and disclosure controls.
6. Focus rings, hover states, pressed states, disabled states and loading states.
7. Empty, invalid and unavailable states.
8. Responsive breakpoints and density rules.
9. Consistent icon sizing and alignment.
10. Accessible colour contrast and non colour state cues.

Avoid a broad visual redesign for its own sake. The purpose of the system is to create consistency and improve usability. Prefer a small set of reusable primitives over feature specific copies of the same control.

The exact colour palette, font choices and token values must be grounded in the visual audit and reference review. Document them in the repository before applying them widely.

## Sequence Editor visual refinement

Review the complete editor, including settings, performer sections, timeline, notation cells, action menus, target entry, initial state controls, selection, validation and error navigation.

The review must explicitly verify:

1. Notation symbols and text are comfortably legible at normal viewing distance and on phone screens.
2. Notation cells have consistent dimensions and alignment. Where the design calls for square cells, they must render square rather than being distorted by available space.
3. Notation text is not reduced to tiny labels to fit the grid. Use deliberate sizing and horizontal scrolling or other appropriate layout behaviour instead.
4. Hand rows, performer names, beat labels, bar boundaries and subdivisions are visually distinguishable.
5. The timeline remains aligned across every performer and hand row.
6. Settings appear above the notation table and remain compact.
7. Action menus expose available actions clearly without unnecessary nesting.
8. Target entry is easy to understand and edit.
9. Selection, multi selection, drag previews and invalid notation are visually distinct.
10. Linked ZIP and linked SPECIAL actions are recognisable without clutter.
11. Validation errors are easy to locate and selecting an error navigates to the correct notation.
12. The initial object state controls and state overview are consistent with the rest of the editor.
13. Touch modes and touch feedback are understandable without hover.
14. Long sequences and many performers remain usable without breaking alignment.
15. Advanced controls remain available through progressive disclosure.

Do not alter the meaning or spelling of notation symbols to make the interface look cleaner. In particular, do not render literal words such as HOLD or ZIP inside notation cells where the established notation uses a symbol. Use the correct notation assets and notation conventions.

The binary subdivision limitation remains a domain and simulator limitation. This package may improve how the limitation is communicated, but must not invent compound meter timing or imply unsupported simulation precision.

## Sequence Renderer visual refinement

Review the actual Three.js scene and its surrounding controls. Automated geometry tests do not replace visual review of the rendered scene.

The review must explicitly verify:

1. The scene is framed sensibly by default and makes effective use of the available panel area.
2. Performers are large enough to read clearly without crowding the table or one another.
3. Table geometry, seats and performer positions form a coherent arrangement for solo, circle and individual passing patterns.
4. The table surface, markers and table positions remain visually clear.
5. Hands are large and distinct enough to follow throughout an action.
6. Balls are consistently visible, distinguishable and correctly associated with their state.
7. Held objects and hand back balanced objects are visually distinguishable by position.
8. LIFT, LEAVE, BOUNCE, TAP, ZIP, individual passing and SPECIAL have understandable and distinct movement.
9. Passing hands meet at a shared transfer point and the ball remains visually continuous.
10. Objects at table positions remain visible until picked up.
11. Simultaneous actions are visually simultaneous.
12. Hands return to their resting positions after actions.
13. Camera pan, zoom and rotation feel predictable and do not make the scene difficult to recover.
14. Playback controls are compact, legible and usable on touch devices.
15. The scene remains performant at representative performer and object counts.
16. Invalid sequences disable rendering consistently with the approved renderer behaviour.

Keep the simulator as the sole source of object state. Do not infer or reconstruct object ownership from notation in the renderer. Do not add subdivision animation until the simulator provides the necessary snapshots.

Any visual correction must be covered by a test where practical. Geometry tests, timing tests and browser visual checks must be reported separately so that passing one category is not presented as proof of another.

## Generator area integration

The generator is not yet implemented and Package 05 remains a separate unapproved work package.

This package defines only its workspace placement and visual integration contract:

1. The generator panel sits below the main Editor and Renderer panels on desktop.
2. It can be pulled up and collapsed without disrupting the main workspace.
3. On phone and tablet, its access and presentation must remain usable without introducing a third competing primary tab unless explicitly approved.
4. Its future controls must use the shared visual system.
5. The shell must provide a clean integration point without implementing fake generator functionality or placeholder controls that imply features already exist.

The final generator interaction details remain subject to Package 05 approval.

## PWA and offline behaviour

1. Provide a valid web app manifest with application name, short name, icons, start URL, display mode, theme colour and background colour.
2. Provide the required installable assets in appropriate sizes and formats.
3. Configure a service worker to cache the application shell and required static assets.
4. The application must load and remain usable offline after one successful online load.
5. The editor, renderer and generator application code must be available offline. Generator computation itself must not depend on a network service.
6. Do not cache or overwrite user sequence data through the service worker. Sequence persistence belongs to Package 06.
7. Use an atomic asset update strategy. A user must not receive a mixed set of incompatible application assets.
8. An update must not unexpectedly discard or overwrite in memory work. A new service worker waits until all existing POINTS tabs are closed before activation. Show a compact update ready notice, but never force a reload or call skipWaiting while a tab is open.
9. Handle first installation, first successful load, offline reload, update available, update activation and failed asset retrieval.
10. Do not claim that the app is offline ready before the required assets have been cached successfully.
11. Verify installability and offline behaviour in supported Chromium based browsers and at least one additional supported browser where practical.

The service worker must be compatible with the eventual local persistence implementation in Package 06. It must not make assumptions about the final sequence storage schema.

## Architecture and implementation boundaries

1. Preserve the existing feature ownership under the editor and renderer feature areas.
2. Keep workspace layout and panel state separate from sequence domain state.
3. Keep renderer appearance settings separate from sequence data.
4. Keep shared UI primitives independent of POINTS simulation rules.
5. Avoid a large rewrite of the existing editor or renderer solely to achieve styling consistency.
6. Refactor only where it reduces duplication, resolves a real integration problem or enables a necessary responsive behaviour.
7. Keep feature state intact when panels are hidden, restored or switched on mobile.
8. Keep the application usable if the generator feature is not yet present.
9. Do not add dependencies without a concrete technical reason.
10. Document any unavoidable coupling between workspace shell and feature components.

## Implementation phases

### Phase 1: Current state audit

1. Inspect the current main branch and the actual rendered application.
2. Review desktop, tablet and phone layouts.
3. Review the editor and renderer against their approved plans.
4. Record visual defects, interaction inconsistencies and responsive issues.
5. Identify existing reusable components and duplicated styling.
6. Record baseline screenshots or equivalent reproducible visual evidence for key views.
7. Create a visual audit document under `docs/implementation/`.

### Phase 2: Design system

1. Define shared tokens for typography, spacing, surfaces, borders, colours and semantic states.
2. Define responsive layout rules and breakpoints based on the audit.
3. Define reusable controls and interaction states.
4. Verify contrast and legibility in light and dark themes.
5. Document the visual system and its usage.
6. Agree any unresolved visual choices with Oliver before broad application.

### Phase 3: Workspace shell

1. Implement the desktop application shell.
2. Integrate the existing editor and renderer without changing their domain behaviour.
3. Implement panel resizing, swapping, hiding and restoring.
4. Implement the lower generator panel integration point.
5. Implement phone and tablet Editor and Renderer tabs.
6. Preserve feature state across panel and tab changes.
7. Add keyboard and touch support for workspace controls.

### Phase 4: Editor refinement

1. Apply shared design tokens and primitives.
2. Correct notation sizing, cell geometry, typography and alignment.
3. Refine settings, performer labels, timeline and section hierarchy.
4. Refine menus, target entry, selection and feedback.
5. Refine validation and initial state presentation.
6. Verify long sequences, many performers and narrow screens.
7. Add or update focused tests for any changed interactions.

### Phase 5: Renderer refinement

1. Review default scene framing and scale.
2. Refine performer, hand, table and ball presentation.
3. Refine action readability and transfer continuity.
4. Refine playback controls and camera interactions.
5. Verify solo, circle and rectangular table arrangements.
6. Verify representative larger scenes and performance.
7. Add or update geometry, timing and interaction tests where needed.

### Phase 6: Responsive and accessibility pass

1. Verify every editor and renderer capability on desktop, tablet and phone.
2. Verify touch alternatives for mouse and keyboard interactions.
3. Verify keyboard navigation and visible focus.
4. Verify contrast, target sizes, text scaling and reduced motion behaviour where applicable.
5. Resolve overflow, clipped controls, inaccessible menus and virtual keyboard conflicts.
6. Verify that changing viewport size does not unexpectedly discard active work.

### Phase 7: PWA and offline support

1. Configure manifest and install assets.
2. Implement service worker and application shell caching.
3. Implement safe update lifecycle.
4. Verify first load and offline reload.
5. Verify that a failed or interrupted update leaves the previous working version usable.
6. Verify that no user sequence data is accidentally cached or deleted.

### Phase 8: Integration and release verification

1. Run formatting, linting, strict TypeScript checks, unit tests and production build.
2. Run editor and renderer regression suites.
3. Run responsive browser tests at defined viewport sizes.
4. Perform manual visual review of the actual deployed build.
5. Verify desktop panel interactions and mobile tab navigation.
6. Verify PWA installation and offline behaviour.
7. Record any remaining limitations with exact reproduction steps.
8. Update implementation documentation and package status.
9. Deploy and verify the live GitHub Pages application.

## Verification matrix

### Automated checks

- [ ] Formatting check
- [ ] Linting
- [ ] Strict TypeScript check
- [ ] Unit and component tests
- [ ] Production build
- [ ] Desktop workspace layout tests
- [ ] Panel resize, swap, hide and restore tests
- [ ] Generator panel shell tests
- [ ] Phone and tablet tab navigation tests
- [ ] Editor regression tests
- [ ] Renderer geometry and timing tests
- [ ] Touch interaction tests
- [ ] Keyboard navigation and focus tests
- [ ] PWA manifest validation
- [ ] Service worker cache and update tests
- [ ] Offline reload test

### Manual visual review

- [ ] Desktop editor and renderer side by side
- [ ] Desktop narrow and wide panel proportions
- [ ] Desktop panel resize, swap, hide and restore
- [ ] Desktop generator panel open and collapsed
- [ ] Phone editor
- [ ] Phone renderer
- [ ] Tablet editor
- [ ] Tablet renderer
- [ ] Editor notation legibility at realistic zoom
- [ ] Editor with many performers and a long sequence
- [ ] All notation action types
- [ ] Selection, drag preview and validation states
- [ ] Renderer solo arrangement
- [ ] Renderer circle arrangement
- [ ] Renderer rectangular arrangement
- [ ] Renderer all action types and object transfers
- [ ] Renderer playback and camera controls
- [ ] Light theme
- [ ] Dark theme
- [ ] Browser zoom and text scaling
- [ ] PWA installed launch
- [ ] Offline launch after successful caching
- [ ] Update available and update activation

A verification item may only be checked when the relevant test or manual review has actually been performed. Automated viewport tests do not count as manual visual approval. A successful production build does not prove that the application looks correct.

## Acceptance criteria

Package 07 is complete only when:

1. The editor, renderer and workspace shell share a consistent visual language.
2. The notation remains the primary focus and is legible on all supported screen sizes.
3. The editor and renderer have been visually reviewed and corrected against the explicit criteria in this plan.
4. Desktop panel interactions work without losing feature state.
5. Phone and tablet provide full editor and renderer functionality through the agreed tabs.
6. Touch and keyboard interaction are usable and accessible.
7. The generator has a clean integration point without fabricated functionality.
8. The PWA installs and reliably reloads offline after a successful first load.
9. Application updates cannot leave the user with a broken mixture of assets.
10. All automated checks pass.
11. Manual visual review is recorded for every required viewport and feature area.
12. The live deployment is verified after merge.
13. Remaining limitations are documented rather than silently treated as complete.

## Dependencies

1. Packages 01 and 02 provide the domain model, simulator and validator.
2. Package 03 provides the existing Sequence Editor.
3. Package 04 and correction pass 04B provide the existing Sequence Renderer.
4. Package 05 is not yet approved. Generator search and functionality are not a dependency for the shell integration point.
5. Package 06 is not yet approved. PWA caching must remain independent of its final persistence implementation.

## Resolved design decisions

1. Desktop uses side by side panels above 1100 px. Tablet and phone use Editor and Renderer tabs at 1100 px and below.
2. Phone notation cells are 44 px square, tablet cells are 52 px square and desktop cells are 56 px square.
3. The initial workspace palette uses a neutral background of #f3f5f8 and blue accent of #3569bd. Feature controls use shared panel headers and shared interaction styles.
4. Desktop panels can be resized, swapped, hidden and restored. The default split is equal. Layout choices are not persisted between sessions.
5. PWA updates use a waiting service worker. A compact notice informs the user that an update is ready. The current page is never reloaded automatically, and the update activates only after all existing POINTS tabs have closed.
6. The editor toolbar sits above the notation grid. Initial object distribution is collapsed by default.
7. Circle passing uses one authored pattern and a participant count. The renderer uses a regular polygon with one side per participant.

## Remaining open decisions

1. Generator access on phone and tablet will be finalised with Package 05. The current shell does not add a third primary tab or fake generator controls.
2. The full supported browser matrix for installation and offline operation still needs verification beyond the Chromium based CI browser.
3. Reduced motion behaviour for renderer animation remains to be decided. Any reduced motion treatment must preserve the ability to understand object movement.
4. Any further functional interaction change discovered during visual review must be presented separately for approval rather than silently included as a styling correction.



## Additional requirements from the visual and interaction review

These requirements are part of Package 07 and are explicitly approved for implementation.

### Renderer layout and circle table geometry

The existing three dimensional arrangement is not acceptable while table positions or performers overlap. The renderer must be corrected rather than merely documented as visually pending.

1. Table positions must never overlap one another when they represent distinct positions. The layout must account for the number of positions assigned to each performer, the number of performers sharing each table edge, and the actual usable tabletop area. This applies to polygonal and rectangular tables.
2. Performer bodies, arms and hands must not overlap neighbouring performers or table geometry in the resting pose. Increase the arrangement footprint as needed rather than compressing performers into an undersized circle.
3. Move performers closer to the table than in the current implementation, while retaining enough clearance for their bodies and arms.
4. For circle passing, render a true regular polygonal tabletop. Its number of sides must equal the number of people in the circle. Circle passing requires at least three participants. Do not render a circular disk with a polygonal outline or approximate the polygon with a high segment count.
5. Each circle participant occupies one polygon edge. Their owned table positions must be laid out on the corresponding edge and remain inside the polygon.
6. Add geometry tests for non overlap between distinct table positions, performer clearance, edge assignment and exact polygon side count. Manual review must include different participant counts, including larger circles.

### Circle passing pattern semantics

Circle passing defines one pattern, not a separate independently authored pattern for every participant.

1. The user authors the notation for one representative participant.
2. The circle participant count is a separate sequence property. For example, a pattern defined once can be instantiated for ten people arranged around the circle.
3. The renderer repeats the same authored pattern for every participant, rotated or mapped consistently around the circle.
4. Do not require duplicate performer notation rows or separate edits for each participant in circle passing mode.
5. The editor must make clear that the displayed notation is the representative pattern, label it Pattern, and provide a direct People count control that determines how many times it is instantiated.
6. Circle passing target distance and direction are interpreted relative to the participant's position in the circle. The same relative instruction applies consistently to every participant.
7. The number of sides in the rendered polygon must update whenever the participant count changes. The editor must not permit a circle passing configuration with fewer than three participants.
7. Circle passing validation must validate the representative pattern and its repeated interactions around the configured circle, including wraparound between the last and first participant.
8. The sequence data model and renderer integration must represent this distinction explicitly. Do not simulate circle passing by asking the user to manually duplicate identical patterns.

### Notation grid rendering: spreadsheet cell model

The notation grid must use a strict square cell model similar to a spreadsheet.

1. Every timeline cell is a square with fixed dimensions. The cell must not stretch horizontally or vertically to fit its contents.
2. The visual notation is constructed from the four edges of each square cell. Each action turns the relevant top, right, bottom or left edge on or off to create continuous ball rectangles and other notation structures.
3. Adjacent cells must join exactly at their shared boundaries. Shared internal edges must not become doubled, misaligned or separated by gaps.
4. Notation must be rendered as edge geometry, not as tiny action words placed inside cells. Action labels may exist in accessible names or contextual editing UI, but must not replace the graphical notation.
5. HOLD is represented by the continuation of the ball rectangle through the cell. It means the ball remains held and no new physical action occurs. HOLD must not animate a reach, pickup, release, tap or other movement in the renderer.
6. LIFT, LEAVE, BOUNCE, TAP, EMPTY, ZIP, passing and SPECIAL must retain their distinct notation semantics while using the same square cell geometry.
7. Linked and continuous edges must remain aligned across performers, hands, beats and subdivisions.
8. The selected cell, invalid cell and linked action states must be visible without obscuring the edge notation.
9. Add geometry and rendering tests that assert exact square dimensions and expected edge combinations for every action type, including sequences of adjacent cells. Add screenshot based visual verification at realistic zoom levels.

### Editor target and action entry corrections

1. Position names shown in target selectors must include the owning performer identifier or name wherever positions are performer owned. Use the same owner naming convention as the rest of the editor. Do not show ambiguous bare names when multiple performers can each own a position named A or B.
2. When multiple performers are present, each performer must have their own L and R hand back positions available as targets wherever the selected action supports hand back positions. Do not expose only one global L and R pair.
3. Changing the sequence mode must immediately refresh all target options and mode specific controls. Switching to or from circle passing or individual passing must not leave stale or missing target options.
4. Target keyboard entry must work whenever a cell is selected, not only during LIFT and LEAVE creation. Typing a valid position letter or identifier updates the selected cell's target.
5. If the selected action does not support that target entry directly, convert the action to the corresponding target action and then apply the target. In particular, HOLD plus a valid table position key becomes BOUNCE, and EMPTY plus a valid table position key becomes TAP.
6. The same target key handling must support changing an existing LIFT, LEAVE, BOUNCE or TAP target without requiring the user to reopen a target field.
7. The resulting action may be invalid in the current object state. The editor must still allow the notation change and let the normal validator report the error. Keyboard entry must not silently block an action merely because it is currently invalid.
8. Target key handling must respect the active performer and position ownership. Duplicate position names belonging to different performers must remain unambiguous.

### Selection, deletion and keyboard controls

1. Ctrl plus clicking a cell adds that cell to the current selection. Further Ctrl clicks add further cells. This is additive multi selection and must not trigger the existing Ctrl drag erase behaviour.
2. A normal click without Ctrl replaces the selection with the clicked cell, subject to the existing empty cell action menu behaviour.
3. Shift plus arrow keyboard selection remains supported. Ctrl click selection must work consistently with touch and mouse selection modes without breaking drag drawing or moving.
4. Deleting selected notation is available only through the Delete button, Delete key or Backspace key. Remove other deletion shortcuts or gesture mappings that conflict with this rule.
5. Deleting multiple selected cells is one undoable operation. Existing linked action deletion rules remain intact.
6. Update the keyboard shortcut help and interaction tests to match the final controls.

### Workspace ergonomics

Workspace ergonomics are explicitly part of Package 07. Review and improve the placement, grouping, reachability, density and discoverability of the editor and renderer controls. The workspace should make the primary workflow obvious and keep secondary settings out of the way.

The ergonomics pass must include:
1. A clear hierarchy between workspace navigation, panel controls, sequence settings, notation editing controls and renderer playback controls.
2. Controls placed next to the content they affect.
3. Avoidance of excessive scrolling, redundant headers and repeated labels.
4. Comfortable notation editing at realistic desktop and phone sizes.
5. Consistent interaction patterns and control placement across editor and renderer.
6. A deliberate review of the complete workflow from changing sequence mode, to entering notation, to selecting targets, to inspecting the result in the renderer.
7. Any proposed workflow change that changes established behaviour must be documented and approved rather than silently introduced.

## Additional implementation and acceptance gates

The following must be treated as release blocking:

- No overlapping table positions or performer bodies in supported renderer layouts.
- Circle table is a true regular polygon with exactly one side per configured participant.
- Circle passing notation is authored once and instantiated consistently for the configured participant count.
- Notation cells are square and their four edge states produce the intended spreadsheet style notation.
- HOLD causes no hand or object movement and visually continues the held ball rectangle.
- Performer owned L and R targets are available for every performer where applicable.
- Target labels identify their owner.
- Changing sequence mode refreshes all mode specific target controls.
- Target keyboard entry works on selected cells and performs the specified action conversions.
- Ctrl click adds cells to the selection.
- Deletion is limited to the Delete button, Delete key and Backspace.
- Workspace ergonomics have been reviewed and the complete editing workflow is usable.



## Implementation progress

Status: Implemented and merged through PR #15 on 13 November 2026.

The implementation includes the circle geometry and one pattern model, square edge based notation cells, HOLD behaviour, target entry, performer specific hand back targets, Ctrl click selection, deletion controls, responsive workspace panels, panel resizing and swapping, collapsed initial state controls, larger responsive cells, and the PWA app shell. The final CI run `43393713807` passed formatting, lint, TypeScript, 109 unit tests, the production build and all 10 browser tests. The browser suite verified six viewport sizes, the ten person circle renderer, desktop panel interactions, phone tab switching and offline reload after first load. Screenshots from the CI run were reviewed. The remaining release check is confirmation that the merged build has finished publishing to GitHub Pages. Chromium was the browser used for automated offline verification; additional browser coverage remains a future compatibility check.

## Approval

Status: Approved for implementation by Oliver on 12 November 2026.

The additional renderer, notation grid, circle passing, target entry, selection and ergonomics requirements above are included in this approval.
