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

### 1.7 Sequence codes, import, and persistence

Every sequence has a compact, machine oriented code represented as one continuous string. It does not need to be human readable. The code must encode everything required to reconstruct the complete sequence, including BPM, table layout, seat assignments, initial state, notation, and SPECIAL text.

The code is generated automatically and can be copied explicitly at any time. Pasting a code loads the sequence immediately when there is no existing sequence that would be overwritten. If a sequence is already present, the application asks the user to confirm before replacing it. Replacing a sequence can be undone through the editor's undo history.

There is one current working sequence rather than a collection of named sequences. Multiple saved sequences, editable sequence names, and a duplicate sequence management feature are not required. The most recent working sequence is restored when the application is reopened, including when it is incomplete or invalid.

The distinction between a code that cannot be parsed and a sequence that can be imported but fails notation validation still needs to be specified. A structurally invalid imported sequence should be made available in the editor and clearly marked as invalid, rather than silently treated as valid.

### 1.8 Image export

The user can export the sequence as one continuous image or as multiple image segments. The user chooses where the image is split.

The export includes all sequence information by default. Before exporting, the user can open an options window to include or exclude individual parts of the output. The object state at the start and end of the sequence can be included when selected.

The user can choose black or white for text and background, or choose a transparent background. The exact export options interface remains to be designed.

## 2. Sequence Renderer

The Sequence Renderer visualises the current sequence as an animation in a three dimensional environment.

### 2.1 Renderer presentation

The renderer occupies the main area of its panel. The scene itself is the primary content. Playback and scene controls are placed in a compact bar or sidebar within the panel.

The default camera is a top down view. The user can pan the camera, but camera preset switching and automatic performer following are not required. Performers remain stationary in their assigned seats.

The interface should not cover the scene with unnecessary text or descriptions.

### 2.2 Scene and arrangement

The environment is pannable. With a mouse, the user can pan the scene.

The renderer shows jugglers sitting or standing around a table, performing the selected pattern. The intended visual style and level of character detail should follow Juggling Lab, including its simplified stick figure like performers. Realistic anatomy, fingers, and joints are not required. Hands may stretch or elongate when needed to communicate an action. The movement and state of the objects must remain clear.

The renderer must animate hand actions individually enough to communicate what is happening. LIFT, LEAVE, BOUNCE, and TAP must have visually distinct actions appropriate to their notation. BOUNCE shows a hand tapping a position with an object it continues to hold. TAP shows an empty hand tapping a position. The renderer should make it clear when an object is held with the fingers and when it is balanced on top of a hand at L or R.

All objects use the same spherical shape. The renderer assigns distinguishable colours automatically, but the user can override the colour of individual objects. Objects do not need visible rotation. No additional visual indicator is required when an object is balanced on a hand.

Object trajectories are calculated automatically. A transfer between hands should be animated as a coordinated handoff: the source hand moves the ball toward the receiving hand, and the receiving hand moves to take it. It should not simply look like an unexplained teleport or an arbitrary thrown arc. Custom trajectory editing and manual trajectory height or shape controls are not required at this stage.

The table and juggler arrangement depend on the sequence type. The program initially assigns performers to seats automatically. The user can override these assignments by changing individual seat positions. A manual change takes precedence over automatic placement.

**Circle juggling and circle passing**

The user can choose a polygonal table. A juggler is seated at each edge. The number of edges determines the number of seats. Polygonal tables have one seat per edge.

**Solo patterns**

A solo pattern is visualised with one juggler at a small table represented as a 1 by 1 layout.

**Rectangular table and individual passing patterns**

The user can choose a rectangular table and specify the number of seats for each of its two side dimensions. Opposite sides use the corresponding configured seat count. Jugglers are assigned to individual seats. Seats may remain empty, but every juggler must be assigned a seat. This provides a structured alternative to the polygonal table for individual passing patterns. Free positioning and rotation of each juggler in the scene are not currently required.

### 2.3 Playback and scene controls

The renderer must support:
- Play and pause.
- Scrubbing through the sequence manually.
- Stepping forwards and backwards by exactly one beat.
- Playing one run through the sequence.
- Repeating the sequence continuously.
- Setting playback tempo in beats per minute (BPM), stored as part of the sequence.

In step mode, moving from one beat state to the next is animated over 0.5 seconds, after which playback stops at the new beat. In continuous playback, the animation runs smoothly without pauses at beat boundaries. The duration of each beat is determined by the BPM, and subdivisions take proportionally less time. For example, a half beat takes half the duration of a full beat. The proposed default tempo is 120 BPM, subject to confirmation.

When continuous repetition is enabled, a sequence whose final object state matches its initial object state can loop seamlessly. If the states do not match, the renderer jumps back to the initial state between runs. The user can choose between one run through and continuous repetition.
- Camera rotation.
- Zoom.
- Panning with the mouse.
- Changing object colours.
- Changing juggler positioning.

Controls should also have keyboard shortcuts where appropriate. The exact shortcut assignments remain open.

Selecting a table position in the renderer should visibly mark that position. The position labels are otherwise hidden to keep the scene uncluttered.

The current playback position should be indicated in the Sequence Editor, so the user can see which point in the notation is currently being animated. A corresponding current beat or subdivision indicator inside the renderer is not required at this stage.

Changes made in the Sequence Editor update the renderer immediately, including during playback. Selecting a notation cell should highlight the corresponding hand or object in the renderer. Selecting an object or hand in the renderer should highlight the corresponding notation cell in the editor. During playback, the editor indicates both the current beat and the exact subdivision.

Manual scrubbing snaps to beat or subdivision positions. Showing arbitrary intermediate animation frames while scrubbing is not required.

## 3. Sequence Generator

The Sequence Generator creates complete, valid POINTS sequences automatically based on conditions supplied by the user. It serves two equally important purposes: discovering new patterns and finding valid completions or variations that fit a pattern or part of a pattern the user already likes.

The generator supports solo, circle passing, and individual passing sequences. The user chooses which sequence type to generate.

### 3.1 Generation modes

The generator supports two main modes:

- Generate complete sequences from scratch.
- Generate variations or completions based on an existing sequence.

The user can also select a part of an existing sequence and use it as a required or forbidden subsequence.

Generated results must always be complete and valid sequences. The generator must not return incomplete or invalid candidates.

### 3.2 Generation parameters and constraints

The user can specify:
- Number of beats.
- Number of jugglers.
- Number of objects.
- Available positions.
- Time signature.
- Initial object distribution.
- Whether the sequence must loop cleanly, must not loop cleanly, or either is acceptable.
- Sequence type: solo, circle passing, or individual passing.

The user can require or forbid particular actions. Requirements can specify that an action occurs at least once or occurs an exact number of times. The generator must support both inclusion and exclusion conditions.

The generator must also support short sequence codes as constraints. A supplied sequence code can require a particular subsequence to occur somewhere in the generated result, or forbid it.

### 3.3 Subsequence matching

A required or forbidden subsequence must match the same structure and actions. Matching includes the same source position, destination position, and hand. Merely using similar actions in a different arrangement does not count as a match.

The user can provide a subsequence by entering its compact sequence code or by selecting part of an existing sequence.

### 3.4 Results and ordering

Generated sequences appear in a visual gallery. Each result shows a notation preview. A separate renderer preview is not required.

Results are unranked. Their order must nevertheless be deterministic: identical inputs must produce the same result order every time. If two sequences differ anywhere in their structure or notation, they count as different sequences.

Duplicate results must be removed.

Selecting a generated sequence replaces the current sequence in the Sequence Editor. The renderer then displays the selected sequence.

Comparing multiple candidates side by side is not required.

### 3.5 Generation process and result limits

The user explicitly starts generation by pressing a Generate control. Results appear progressively as they are found.

The generator should attempt to find all valid sequences up to a fixed application defined maximum result limit. It must communicate how many results are available and divide them into pages rather than displaying an unbounded gallery at once. The user can continue searching for additional results when more are available.

The user can stop generation while it is running. Results already found remain available after stopping. When the generator reaches its result limit, it must communicate that additional results may exist. The exact maximum result limit, page size, and behaviour when the search space is extremely large remain to be defined.

The generator should be able to indicate when it has exhausted the search space within the applicable limits.

### 3.6 Existing sequence fragments as constraints

A selected fragment of an existing sequence can be used as a required or forbidden pattern. It does not have to remain at its original beat positions. A required fragment may occur anywhere in the generated sequence.

The generated sequence must be longer than the selected fragment. A forbidden fragment must not occur anywhere in the generated sequence, including across bar boundaries.

The fragment must match the same structure and actions, including the same source position, destination position, and hand. Similar actions with different targets or hands do not count as a match. The user can select the fragment directly from the notation editor or provide its compact sequence code.

## Status and scope

This document records the product decisions made so far. It is not yet the final functional specification.

Detailed rules still need to be established for notation editing, keyboard shortcuts, validation, changing sequence structure after notation has been entered, renderer behaviour, generator conditions, data encoding, and many other interactions.

These details will be clarified through further discussion. Implementation planning must not begin until the functional specification is sufficiently complete and the user explicitly approves moving to that stage.
