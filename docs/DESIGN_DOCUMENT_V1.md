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

Adding a juggler creates a new juggler section with empty left and right hand rows. Removing a juggler who is referenced by existing notation requires confirmation. If confirmed, the juggler and their notation are removed, while notation elsewhere that refers to that juggler is retained and marked invalid.

Adding a position makes it immediately available as a target wherever that position is valid. Removing a position that is still referenced by notation is allowed, but affected notation is retained and marked invalid. Renaming a position updates all existing references to that position automatically. The initial state editor should reuse the same components and interaction patterns as other relevant position editing controls wherever possible.

Changing the sequence type does not automatically rewrite or delete incompatible notation. Existing notation that is incompatible with the newly selected type is retained and marked invalid. Changing the time signature preserves the existing beat and notation positions. Only the bar boundaries and their labels change according to the new time signature.

Changing a setting must update the sequence editor and renderer to reflect the new sequence structure.

The complete set of supported sequence properties and their valid values must be derived from the POINTS notation specification in `docs/POINTS_NOTATION.md`. The design must not silently omit a notation feature.

### 1.2 Notation table structure

The notation table appears below the general settings.

Each juggler has a clearly separated section with an individual row for the left hand and an individual row for the right hand, following the Godot prototype. Juggler labels initially use simple identifiers such as Juggler 1 and Juggler 2. Each juggler can have additional positions beyond the standard positions, and position definitions and names are editable.

The table contains a time column structure shared by the juggler hand rows. Each cell represents the action of one hand at one point in time. Clicking a beat or subdivision label selects that time position across all juggler hand rows.

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

Users can remove beats and subdivisions, move individual time positions, and select multiple positions to move them together. Multiple selection can include nonadjacent positions. When a beat or subdivision is moved, all notation within that time position moves with it across every juggler hand row. A beat and its subdivisions are treated as one group when the beat is moved.

Clicking a beat label selects the complete beat, including all of its subdivisions, across every juggler hand row. Clicking a subdivision label selects that subdivision across every juggler hand row.

Moving a subdivision is also supported, provided it is placed in a logically valid position within the timeline. The visual distinction between main beats and subdivision columns remains to be designed.

Reducing the total beat count removes beats only from the end of the sequence. A beat can be removed by reducing the count only when all its cells are empty. Nonempty beats at the end must not be silently discarded. Increasing the beat count adds empty beats at the end.

### 1.5 Editing interactions

Notation elements can be entered and modified through a combination of:
- Direct manipulation, including the drag interaction from the Godot prototype.
- Keyboard input.
- Contextual menus.
- Keyboard shortcuts.

Keyboard shortcuts are a core part of the editor. A dedicated help section must explain them. A permanent shortcut overlay is not required. Undo and redo apply to changes made in the Sequence Editor only. They do not undo renderer settings or generator settings.

The Godot interaction model is the starting point for the web editor, subject to usability testing. Retain the existing click, drag, modifier key, and right click interactions where practical. Dragging must construct the ball rectangle notation, including LIFT, HOLD, LEAVE, and ZIP actions, rather than merely stamping the same symbol into every traversed cell.

The default interaction should minimise friction. Clicking an existing notation cell opens its properties for editing rather than immediately replacing the action. The exact presentation of the editing controls remains to be designed. Selecting multiple cells and applying one action to all selected cells is supported. Arrow keys move the selection between cells, and Shift plus arrow keys extends the selection. Clicking an empty area of the editor clears the selection. The behaviour of double click and Enter remains undecided.

Dragging notation starts with a LIFT at the starting cell and ends with a LEAVE at the ending cell. The drag can and must cross hand lanes when needed to construct linked actions such as ZIP. The editor previews the notation during the drag. Drawing over existing notation must not overwrite it. If the proposed drawing conflicts with existing notation, the existing notation is preserved and the new operation is prevented. A complete drag operation is one undoable edit, including any linked symbols it creates. Existing notation can also be dragged to a different position in the timeline. Users can move an individual symbol, an entire ball rectangle, or multiple selected rectangles together.

Action menus show only actions that are valid for the current state. All available valid actions should be directly accessible rather than hidden in submenus. Menus close after an action is chosen. They do not remember the last used action or target. The exact menu placement remains undecided.

Keyboard input is a primary editing method. Actions should have single key shortcuts where practical. After choosing an action, the user can type its target immediately to complete the entry. Typing a new target while an existing action is selected replaces that action's target. Escape cancels the current operation and clears the selection. Backspace deletes the selected notation. Arrow key navigation and Shift selection extension are supported. Ctrl+C and Ctrl+V copy and paste selected notation, including multiple cells and linked actions. Copying a ZIP or linked SPECIAL action preserves the internal relationship in the copied content while creating a new, independent pair. Pasting is rejected without changing anything if it conflicts with existing notation. The exact shortcut mapping remains to be documented.

Existing SPECIAL symbols can be opened directly for text editing.

Targets may be typed, but input must be restricted to legal targets for the selected action and context.

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

The editor does not prevent every invalid action from being entered. If an action is invalid in the current object state, the user may still enter it and the normal validation system marks the error. When an edit makes a linked action inconsistent, both affected cells are marked invalid rather than silently rewriting one side. ZIP symbols are a paired operation: deleting either side deletes the corresponding other side as well. Deleting one cell of a linked SPECIAL action does not automatically delete the other cell. The remaining cell is retained and treated as a standalone SPECIAL action.

Deleting selected notation, including multiple selected cells, is supported through Backspace. Linked notation follows the deletion rules above. Undo is sufficient protection against accidental destructive changes; confirmation dialogs are not required for editing operations such as deleting notation, beats, or jugglers.

### 1.7 Sequence codes, import, and persistence

Every sequence has a compact, machine oriented code represented as one continuous string. It does not need to be human readable. The code must encode everything required to reconstruct the complete sequence, including BPM, table layout, seat assignments, initial state, notation, and SPECIAL text.

The code is generated automatically and can be copied explicitly at any time. Pasting a code loads the sequence immediately when there is no existing sequence that would be overwritten. If a sequence is already present, the application asks the user to confirm before replacing it. Replacing a sequence can be undone through the editor's undo history.

There is one current working sequence rather than a collection of named sequences. Multiple saved sequences, editable sequence names, and a duplicate sequence management feature are not required. The most recent working sequence is restored when the application is reopened, including when it is incomplete or invalid.

A code that cannot be parsed or is otherwise invalid as an import must be rejected. The current sequence remains untouched. The application must not partially import an unreadable or unsupported code. A successfully parsed sequence is then checked by the normal notation validator. Import replaces the entire current sequence structure, including its beat count, jugglers, positions, and other settings. The import control is accessible from the main editor. Pasting a code initiates loading immediately; confirmation is required only when existing work would be overwritten. Sequence codes do not need an explicit format version.

### 1.8 Image export

The user can export the sequence as one continuous image or as multiple image segments. The user chooses where the image is split.

The export includes all sequence information by default. Before exporting, the user can open an options window to include or exclude individual parts of the output. The sequence code is an optional export element. If the object state overview is enabled for export, show the initial state and, only when it differs, the final state. Do not include intermediate object states.

The export uses a cleaner presentation than the live editor, while retaining meaningful notation colours such as red error markings and yellow linked SPECIAL markings. The user can choose black or white text and background, or a transparent background. Image resolution and scale are selected automatically to produce a good result. The notation keeps a fixed cell size, so long sequences produce wider images rather than shrinking all notation to fit a fixed width. Sequence settings and performer names are included by default. When an image is split into segments, performer sections must remain together and must not be split between segments. Segments must not overlap or duplicate content. The exact export options interface remains to be designed.


### 1.9 Curated sequence presets

The repository should contain a manually maintained curated collection of sequence presets. Each entry consists of a sequence code, a preset name, one or more authors, and optional categories or tags. The application presents the presets as a searchable list showing each preset's name and author or authors. Selecting an entry loads it into the current workspace without a separate notation preview. If existing work would be overwritten, the usual confirmation is required. The preset list is maintained by editing repository data, not through an in-app contribution or editing interface.

## 2. Sequence Renderer

The Sequence Renderer visualises the current sequence as an animation in a three dimensional environment.

### 2.1 Renderer presentation

The renderer occupies the main area of its panel. The scene itself is the primary content. Playback and scene controls are placed in a compact bar or sidebar within the panel.

The default camera is a top down view. The user can pan, zoom, and rotate the camera. Camera preset switching and automatic performer following are not required. Performers remain stationary in their assigned seats.

The interface should not cover the scene with unnecessary text or descriptions.

### 2.2 Scene and arrangement

The environment is pannable. With a mouse, the user can pan the scene.

The renderer shows jugglers sitting or standing around a table, performing the selected pattern. The intended visual style and level of character detail should follow Juggling Lab, including its simplified stick figure like performers. Realistic anatomy, fingers, and joints are not required. Hands may stretch or elongate when needed to communicate an action. The movement and state of the objects must remain clear.

The renderer must animate hand actions individually enough to communicate what is happening. LIFT, LEAVE, BOUNCE, and TAP must have visually distinct actions appropriate to their notation. BOUNCE means tapping a position while continuing to hold the object in the hand. The object remains in the hand and does not bounce or leave it. TAP shows an empty hand physically reaching and touching the specified position before returning. The renderer should make it clear when an object is held with the fingers and when it is balanced on top of a hand at L or R.

After completing an action, a hand returns to its standard resting position. During a transfer between hands, the source and receiving hands move towards a shared intermediate meeting point, where the transfer takes place. An object left at a table position remains visibly there until another hand picks it up.

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

In step mode, moving from one beat state to the next is animated over 0.5 seconds, after which playback stops at the new beat. In continuous playback, the animation runs smoothly without pauses at beat boundaries. The duration of each beat is determined by the BPM, and subdivisions take proportionally less time. For example, a half beat takes half the duration of a full beat. Every action within the same beat or subdivision uses the same available time interval. Actions do not receive different durations based on their type or physical distance. The proposed default tempo is 120 BPM, subject to confirmation.

When continuous repetition is enabled, a sequence whose final object state matches its initial object state can loop seamlessly. If the states do not match, the renderer jumps back to the initial state between runs. The user can choose between one run through and continuous repetition.
- Camera rotation.
- Zoom.
- Panning with the mouse.
- Changing object colours.
- Changing juggler positioning.

Controls should also have keyboard shortcuts where appropriate. The exact shortcut assignments remain open.

Selecting a table position in the renderer should visibly mark that position. The position labels are otherwise hidden to keep the scene uncluttered.

The current playback position should be indicated in the Sequence Editor, so the user can see which point in the notation is currently being animated. A corresponding current beat or subdivision indicator inside the renderer is not required at this stage.

Both hands and objects are animated simultaneously when their actions occur at the same time. If the sequence contains any validation errors, rendering and playback are disabled. The renderer does not attempt to animate an invalid sequence. Only hands are selectable in the renderer. Selecting a hand highlights its corresponding notation cell in the editor. Balls are not selectable.

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

The user can require or forbid particular actions. Requirements can specify that an action occurs at least once or occurs an exact number of times. The generator must support both inclusion and exclusion conditions. Action requirements apply anywhere in the sequence; restricting them to particular beats or bars is not required. ZIP counts refer to complete transfers, not individual ZIP symbols. For example, two ZIP transfers correspond to four ZIP symbols. The generator should provide a dedicated field for the required number of passes in the generated sequence. A pass occurrence is counted when a performer receives an object from another performer, represented by the receiving action using X, or places an object into a position belonging to another performer. The user specifies an exact number of these occurrences. Passing patterns require at least two jugglers.

The user can require that every juggler performs at least one specified action.

The generator must also support short sequence codes as constraints. A supplied sequence code can require a particular subsequence to occur somewhere in the generated result, or forbid it.

### 3.3 Subsequence matching

A required or forbidden subsequence must match the same structure and actions. Matching includes the same source position, destination position, and hand. Merely using similar actions in a different arrangement does not count as a match.

The user can provide a subsequence by entering its compact sequence code or by selecting part of an existing sequence.

### 3.4 Results and ordering

Generated sequences appear in a visual gallery. Each result shows a notation preview. A separate renderer preview is not required.

Results are unranked. Their order must nevertheless be deterministic: identical inputs must produce the same result order every time. Duplicate detection treats time shifted versions of the same pattern as equivalent. Other differences in structure or notation continue to distinguish sequences.

Duplicate results must be removed.

Selecting a generated sequence replaces the current sequence in the Sequence Editor. The renderer then displays the selected sequence.

Comparing multiple candidates side by side is not required.

### 3.5 Generation process and result limits

The user explicitly starts generation by pressing a Generate control. Results appear progressively as they are found.

The generator should attempt to find all valid sequences up to a fixed application defined maximum result limit. It must communicate how many results are available and divide them into pages rather than displaying an unbounded gallery at once. The user can continue searching for additional results when more are available. The maximum result limit is fixed by the application rather than configurable by the user. When the generator reaches its limit, it must communicate that additional results may exist.

The user can stop generation while it is running. Results already found remain available after stopping, but a stopped search cannot be resumed. Changing any generation constraint clears the existing results. Generator settings persist when the generator panel is closed and reopened. Selecting a result does not remove the other results from the gallery and does not automatically stop an active generation run. The exact maximum result limit, page size, and behaviour when the search space is extremely large remain to be defined.

The generator should be able to indicate when it has exhausted the search space within the applicable limits.

### 3.6 Existing sequence fragments as constraints

A selected fragment of an existing sequence can be used as a required or forbidden pattern. It does not have to remain at its original beat positions. A required fragment may occur anywhere in the generated sequence.

The generated sequence must be longer than the selected fragment. A forbidden fragment must not occur anywhere in the generated sequence, including across bar boundaries.

The fragment must match the same structure and actions, including the same source position, destination position, and hand. Similar actions with different targets or hands do not count as a match. The user can select the fragment directly from the notation editor or provide its compact sequence code.

## Status and scope

This document records the product decisions made so far. It is not yet the final functional specification.

Detailed rules still need to be established for notation editing, keyboard shortcuts, validation, changing sequence structure after notation has been entered, renderer behaviour, generator conditions, data encoding, and many other interactions.

These details will be clarified through further discussion. Implementation planning must not begin until the functional specification is sufficiently complete and the user explicitly approves moving to that stage.
