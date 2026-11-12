# POINTS Workspace: Design Document v1

## Purpose

POINTS Workspace is a browser based application for creating, exploring, visualising, and generating juggling patterns using POINTS notation.

The application is built around three main components:

1. Sequence Editor
2. Sequence Renderer
3. Sequence Generator

This document records the product vision and the decisions made so far. It is being expanded into a detailed functional specification. Any behaviour that has not yet been decided is identified as open rather than left to implementation assumptions.

## Overall workspace concept

The editor, renderer, and generator are integrated parts of one uniform workspace, with sequences moving naturally between them.

A sequence created or edited in the Sequence Editor is automatically reflected in the Sequence Renderer. The renderer updates immediately when the sequence changes, including while the animation is playing.

The Sequence Generator creates candidate sequences within the same workspace. When the user chooses a generated sequence, it replaces the current sequence in the Sequence Editor. The renderer then displays the selected sequence.

## Workspace layout

### Desktop

The default desktop layout places the Sequence Editor on the left and the Sequence Renderer on the right. Both panels initially occupy approximately half of the available workspace.

The divider between the panels is draggable. The panels can be rearranged, including swapping their positions. Panels can be hidden and shown again. They remain part of the workspace and must never detach into floating or pop out windows.

There is one predefined default layout. Additional predefined layout presets are not currently required.

The Sequence Generator is located below the two main panels in a panel that the user can pull up when needed.

Remembering the user's chosen layout between sessions is undecided.

### Mobile and tablet

The application must be fully usable on mobile devices and tablets as well as desktop computers. Mobile support is a core requirement, not a reduced or secondary version of the application.

On phones, the Editor and Renderer are accessed through separate tabs. Tablets use the phone layout model. All editing and rendering functionality must remain available on these devices, including advanced notation operations. The interface must adapt to the available screen size without removing functionality.

## Interface and visual design principles

The editor must be minimal. The notation and the work area are the focus.

The application must use progressive disclosure. Present basic and frequently used features first. Keep advanced options available but hidden until the user needs them or explicitly enables them. Do not confront users with every available option at once. This principle applies throughout the application, not only to the editor.

Consistency is a global interaction requirement. Reuse components wherever possible. Menus and controls should behave consistently across the application. If two components look alike, they should work alike. Users should not need to learn different interaction rules for visually equivalent controls.

Do not add decorative descriptions, unnecessary explanatory text, generic placeholder copy, filler labels, or AI generated sounding text. Controls should be compact and placed where they are needed. The interface should communicate through its structure, notation, icons, and direct interaction.

The visual and interaction design should take inspiration from:
- The POINTS Godot prototype, especially its notation grid, hand rows, cell editing, and drag interactions.
- Bone008's Juggling Interactive Framework web application, particularly its compact controls and visual presentation.
- Juggling Lab, particularly its direct manipulation of visual notation, animation view, and playback interaction.

These are references for design decisions, not interfaces to copy wholesale.

Tutorials may explain keyboard shortcuts and less obvious interactions. Such explanations should be available when needed and must not clutter the editor itself.

## 1. Sequence Editor

The Sequence Editor is the main workspace for creating and modifying a POINTS sequence manually.

### 1.1 Sequence properties and general settings

General sequence settings appear above the notation table. They remain editable after sequence creation. The user can change sequence properties at any point while editing.

The settings include, at minimum:
- Time signature, defaulting to 4/4.
- Number of beats.
- Number of jugglers.
- Number and names of positions available to each juggler.
- Initial state, including which positions are occupied by objects.
- Sequence type, including solo, circle passing, and individual passing.
- Other structural and notation properties defined by POINTS notation.

Adding a juggler creates a new juggler section with empty left and right hand rows. Removing a juggler does not silently delete or rewrite passing references to that juggler. Such references become invalid and are shown through the normal validation system.

Adding a position makes it immediately available as a target wherever that position is valid. The initial state editor should reuse the same components and interaction patterns as other relevant position editing controls wherever possible.

Changing a setting must update the sequence editor and renderer to reflect the new sequence structure. The exact behaviour for other changes that would invalidate existing notation remains to be specified.

The complete set of supported sequence properties and their valid values must be derived from the POINTS notation specification in `docs/POINTS_NOTATION.md`. The design must not silently omit a notation feature.

### 1.2 Notation table structure

The notation table appears below the general settings.

Each juggler has a clearly separated section with an individual row for the left hand and an individual row for the right hand, following the Godot prototype. Juggler labels initially use simple identifiers such as Juggler 1 and Juggler 2. Each juggler can have additional positions beyond the standard positions, and position definitions and names are editable.

The table contains a time column structure shared by the juggler hand rows. Each cell represents the action of one hand at one point in time.

The notation table must support the complete POINTS notation described in `docs/POINTS_NOTATION.md`, including:
- HOLD
- LIFT
- LEAVE
- BOUNCE
- TAP
- EMPTY
- ZIP source and receiving symbols
- Position targets and their subscripts
- Circle passing references to other performers
- Individual passing references to other performers and receiving hands
- SPECIAL actions, including actions such as clapping

The notation specification is the source of truth for the meaning and constraints of these elements. The detailed editing interface for each element still needs to be specified.

### 1.3 Initial state and object state overview

The initial object distribution is editable. Users can see the available positions for each juggler and indicate which positions initially contain an object. This includes table positions and hand positions.

The editor must also provide an overview of object state at every beat for every juggler. It must show which positions are occupied by balls and which hand holds each ball. It updates as the sequence changes. The overview is hidden by default to avoid clutter. It can be revealed in the context of a beat, for example by hovering over that beat. Clicking a beat in the overview moves the renderer to that exact beat.

Object state is evaluated at the beat itself. Movement and transfers happen between beats, so the overview must show the state at the selected beat rather than an intermediate point during movement.

A hand can simultaneously have an object balanced on top of it at its L or R position and another object held with its fingers after a LIFT action. Both object states must be represented. The L and R positions are distinct from an object held by the hand.

### 1.4 Beats, subdivisions, and bars

When a sequence is created with a given beat count, the table initially displays those beats as separate columns. For example, a sequence with eight beats initially displays beats 1 through 8.

The user can insert a new beat between existing columns. A small plus control appears between adjacent columns. Activating it inserts a full beat by default, following the interaction model of inserting a column in a spreadsheet. The inserted beat can then be subdivided when a shorter interval is needed.

Subdivisions are not restricted to a single predefined level. The user can add further subdivisions wherever needed. Each subdivision splits its selected interval in half.

The numerator of the time signature determines the number of beats in each bar. The denominator does not otherwise change the editor's beat structure. The default time signature is 4/4. The table must make each bar boundary visually distinct, using a thicker border or equivalent separator. For example, in 3/4 time, the boundary after every third beat must be identifiable.

A subdivision always splits an existing interval in half. Labels follow conventional musical counting: beat numbers for quarter note beats, `&` for eighth note subdivisions, and `e` and `a` for sixteenth note subdivisions. Labels beyond sixteenth notes remain to be defined.

Users can remove beats and subdivisions, move individual time positions, and select multiple positions to move them together. Multiple selection can include nonadjacent positions. When a time position is moved, the notation values in its column move with it across all juggler hand rows.

Moving a subdivision is also supported, provided it is placed in a logically valid position within the timeline. The visual distinction between main beats and subdivision columns remains to be designed.

Reducing the total beat count removes beats only from the end of the sequence. A beat can be removed by reducing the count only when all its cells are empty. Nonempty beats at the end must not be silently discarded. Increasing the beat count adds empty beats at the end.

### 1.5 Editing interactions

Notation elements can be entered and modified through a combination of:
- Direct manipulation, including the drag interaction from the Godot prototype.
- Keyboard input.
- Contextual menus.
- Keyboard shortcuts.

Keyboard shortcuts are a core part of the editor. A dedicated help section must explain them. A permanent shortcut overlay is not required. Undo and redo apply to changes made in the Sequence Editor only. They do not undo renderer settings or generator settings.

The Godot interaction model is the starting point for the web editor, subject to usability testing. Retain the existing click, drag, modifier key, and right click interactions where practical. Dragging must construct the ball rectangle notation, including LIFT, HOLD, LEAVE, and ZIP actions, rather than merely stamping the same symbol into every traversed cell. The exact web gestures require testing.

Action entry and target editing should prioritise speed and minimal interaction friction. The exact menu and input sequence remains open. Targets may be typed, but input must be restricted to legal targets for the selected action and context.

For circle passing, the relative performer distance should be entered numerically, with direction represented separately. For individual passing, the other performer must be selected from the existing juggler list.

ZIP is paired. Creating one side automatically creates the corresponding source or receiving symbol in the other hand row at the same beat. Both symbols remain linked and are validated as one transfer.

SPECIAL actions support free text. They can be assigned to one hand or linked across both hands for coordinated actions such as a clap. A linked SPECIAL action uses identical text in both linked cells. Linked SPECIAL cells are visually connected and use a yellow highlight. Since coordinated clap cells occur in the same beat, no directional arrows are needed. A SPECIAL action can only be assigned when the relevant hand is empty. No additional object state effects are currently required beyond this condition.

### 1.6 Validation and errors

The editor must identify illegal or inconsistent notation.

Invalid cells should be visually marked, for example with a red shaded background. General sequence errors that cannot be attributed to a single cell should also be shown in a separate error area or panel.

Validation must cover the rules defined by POINTS notation. Examples include:
- An action that is invalid in the current state.
- Two objects being held by the same hand at the same time.
- A transfer whose source and receiving actions do not match.
- Inconsistent object states across time or between hands.

The exact validation rules and severity levels remain to be specified. Selecting a general error should navigate to the affected cell or time position where possible. SPECIAL actions must be rejected when the relevant hand is not empty.

### 1.7 Export and sharing

Once a sequence is complete, the user should be able to export it as an image.

The export should support both:
- One continuous image containing the entire sequence.
- An image split into multiple segments.

Each sequence should also have a compact textual code that encodes the complete pattern. The code should be short enough to share easily. Another user should be able to paste the code into POINTS Workspace and reconstruct the complete sequence.

The actual encoding format and import interaction have not yet been designed. The sequence code must be available to copy explicitly at any time, even though it is generated automatically. A conventional manual save action is not required for each sequence. The application must restore the most recent sequence when reopened, including sequences that are incomplete or currently invalid. The exact local storage and recovery mechanism remains open.

## 2. Sequence Renderer

The Sequence Renderer visualises the current sequence as an animation in a three dimensional environment.

### 2.1 Renderer presentation

The renderer occupies the main area of its panel. The scene itself is the primary content. Playback and scene controls are placed in a compact bar or sidebar within the panel.

The interface should not cover the scene with unnecessary text or descriptions.

### 2.2 Scene and arrangement

The environment is pannable. With a mouse, the user can pan the scene.

The renderer shows jugglers sitting or standing around a table, performing the selected pattern. The intended visual style is comparable to Juggling Lab.

Objects must be visually distinguishable through colour. The renderer should show the movement of objects and the actions of jugglers clearly.

The table and juggler arrangement depend on the sequence type.

**Circle juggling and circle passing**

The user can specify the number of sides of a polygonal table. A juggler is positioned at each side of the table.

**Solo patterns**

A solo pattern is visualised with one juggler at a table.

**Individual passing patterns**

The user can arrange jugglers individually and freely, rather than being restricted to a regular circle.

### 2.3 Playback and scene controls

The renderer must support:
- Play and pause.
- Scrubbing through the sequence manually.
- Playing exactly one cycle.
- Repeating the sequence indefinitely.
- Changing playback speed.
- Camera rotation.
- Zoom.
- Panning with the mouse.
- Changing object colours.
- Changing juggler positioning.

Controls should also have keyboard shortcuts where appropriate. The exact shortcut assignments remain open.

Changes made in the Sequence Editor update the renderer immediately, including during playback.

## 3. Sequence Generator

The Sequence Generator creates legal POINTS patterns automatically based on conditions supplied by the user.

### 3.1 Presentation and selection

Generated sequences are displayed in a visual gallery. Each result is represented visually so the user can inspect the pattern without opening it separately.

The user does not need a separate renderer preview for each candidate.

When the user chooses a generated sequence, it replaces the current sequence in the Sequence Editor. The renderer then displays the selected sequence.

### 3.2 Generation parameters

The user can specify important properties of the patterns to be generated, including:
- Number of beats.
- Number of jugglers.
- Types or categories of sequences to include.
- Types or categories of sequences to exclude.

The generator should find or generate all legal patterns that satisfy the selected conditions.

### 3.3 Pattern inclusion and exclusion

Users should be able to define which patterns are acceptable and which should be excluded.

One possible way to specify these conditions is through compact sequence codes. For example, a user could enter a code and ask the generator to find patterns that contain the corresponding pattern or element. The exact meaning and matching behaviour of such codes still needs to be defined.

## Status and scope

This document records the product decisions made so far. It is not yet the final functional specification.

Detailed rules still need to be established for notation editing, keyboard shortcuts, validation, changing sequence structure after notation has been entered, renderer behaviour, generator conditions, data encoding, and many other interactions.

These details will be clarified through further discussion. Implementation planning must not begin until the functional specification is sufficiently complete and the user explicitly approves moving to that stage.
