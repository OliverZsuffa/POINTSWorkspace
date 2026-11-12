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
- Time signature.
- Number of beats.
- Number of jugglers.
- Number and names of positions available to each juggler.
- Initial state, including which positions are occupied by objects.
- Sequence type, including solo, circle passing, and individual passing.
- Other structural and notation properties defined by POINTS notation.

Changing a setting must update the sequence editor and renderer to reflect the new sequence structure. The exact behaviour when a change would invalidate existing notation remains to be specified.

The complete set of supported sequence properties and their valid values must be derived from the POINTS notation specification in `docs/POINTS_NOTATION.md`. The design must not silently omit a notation feature.

### 1.2 Notation table structure

The notation table appears below the general settings.

Each juggler has a clearly separated section. Each juggler has an individual row for the left hand and an individual row for the right hand. This follows the structure of the Godot prototype.

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

### 1.3 Beats, subdivisions, and bars

When a sequence is created with a given beat count, the table initially displays those beats as separate columns. For example, a sequence with eight beats initially displays beats 1 through 8.

The user can add a subdivision between any two existing columns. A small plus control appears between adjacent columns. Activating it inserts an intermediate time position at that location, following the interaction model of inserting a column in a spreadsheet.

Subdivisions are not restricted to a single predefined level. The user can add further subdivisions wherever needed.

The time signature determines bar boundaries. The table must make the end of each bar visually distinct, using a thicker border or equivalent clear visual separator. For example, in 3/4 time, the boundary after every third quarter note must be visually identifiable. The exact visual treatment of subdivisions within a bar remains to be specified.

### 1.4 Editing interactions

Notation elements can be entered and modified through a combination of:
- Direct manipulation, including the drag interaction from the Godot prototype.
- Keyboard input.
- Contextual menus.
- Keyboard shortcuts.

Keyboard shortcuts are a core part of the editor. A tutorial or help reference must explain the available shortcuts. The exact shortcut assignments and the complete interaction rules are still open.

The editing interaction for selecting an existing notation element and changing its properties has not yet been decided. It should be chosen to integrate naturally with creating notation, without adding unnecessary interface complexity.

### 1.5 Validation and errors

The editor must identify illegal or inconsistent notation.

Invalid cells should be visually marked, for example with a red shaded background. General sequence errors that cannot be attributed to a single cell should also be shown in a separate error area or panel.

Validation must cover the rules defined by POINTS notation. Examples include:
- An action that is invalid in the current state.
- Two objects being held by the same hand at the same time.
- A transfer whose source and receiving actions do not match.
- Inconsistent object states across time or between hands.

The exact validation rules, severity levels, and error presentation are still to be specified.

### 1.6 Export and sharing

Once a sequence is complete, the user should be able to export it as an image.

The export should support both:
- One continuous image containing the entire sequence.
- An image split into multiple segments.

Each sequence should also have a compact textual code that encodes the complete pattern. The code should be short enough to share easily. Another user should be able to paste the code into POINTS Workspace and reconstruct the complete sequence.

The actual encoding format and import interaction have not yet been designed.

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
