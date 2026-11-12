# POINTS Workspace: Design Document v1

## Purpose

POINTS Workspace is a browser based application for creating, exploring, visualising, and generating juggling patterns using POINTS notation.

The application is built around three main components:

1. Sequence Editor
2. Sequence Renderer
3. Sequence Generator

This document records the initial product vision. It describes the intended capabilities and user experience at a high level. It is not an implementation specification, and details that have not yet been decided are left open.

## 1. Sequence Editor

The Sequence Editor is a visual editor for creating a POINTS sequence manually.

### Creating a sequence

Before editing the pattern, the user defines the basic structure of the sequence. This includes elements such as:

- Time signature.
- Number of jugglers.
- Available spaces or positions for each juggler.
- Initial state, including which spaces are occupied by objects.

The editor then creates the notation table, with the relevant hand rows for each juggler. The user can build the sequence directly in this table, using the notation and editing concepts established by the existing Godot prototype.

### Editing

The user should be able to modify the timeline and its contents interactively. This includes:

- Adding and removing beats.
- Adding subdivisions or intermediate beats in accordance with the time signature.
- Placing and editing notation elements in the table.
- Extending or modifying the sequence as needed.

The editor should make sequence creation straightforward and primarily visual.

### Validation

The editor should continuously or on demand validate the sequence and identify illegal or inconsistent states.

Examples include:

- An action that is not valid in the current state.
- Attempting to hold two objects in the same hand.
- A sequence whose object transfers or hand states do not fit together.

Validation should help the user identify and understand problems while editing.

### Export and sharing

Once a sequence is complete, the user should be able to export it as an image.

The export should support both:

- One continuous image containing the entire sequence.
- An image split into multiple segments.

Each sequence should also have a compact textual code that encodes the complete pattern. The code should be short enough to share easily, for example in the style of compact icon or pattern codes used by games such as Shapez. Another user should be able to paste the code into POINTS Workspace and reconstruct the complete sequence.

The example string in this document is illustrative only. The actual encoding format has not been designed.

## 2. Sequence Renderer

The Sequence Renderer visualises a sequence as an animation in a three dimensional environment.

### Environment and visualisation

The environment should be pannable and show the jugglers sitting or standing around a table, performing the selected pattern. The intended visual style is comparable to the juggling visualisation in Juggling Lab.

Objects should be visually distinguishable through colour. The renderer should show the movement of the objects and the actions of the jugglers in a way that makes the sequence easy to understand.

### Playback controls

The user should be able to navigate and control playback of the sequence. This includes:

- Scrubbing through the sequence manually.
- Playing the sequence continuously.
- Playing exactly one cycle.
- Repeating the sequence indefinitely.

### Table and juggler arrangement

The table and the arrangement of jugglers depend on the type of sequence.

**Circle juggling and circle passing**

The user can specify the number of sides of a polygonal table. A juggler is positioned at each side of the table.

**Solo patterns**

A solo pattern is visualised with one juggler at a table.

**Individual passing patterns**

The user needs a way to arrange the jugglers individually and freely, rather than being restricted to a regular circle around the table.

## 3. Sequence Generator

The Sequence Generator creates legal POINTS patterns automatically based on conditions supplied by the user.

### Generation parameters

The user can specify important properties of the patterns to be generated, including:

- Number of beats.
- Number of jugglers.
- Types or categories of sequences to include.
- Types or categories of sequences to exclude.

The generator should then find or generate all legal patterns that satisfy the selected conditions.

### Pattern inclusion and exclusion

Users should be able to define which patterns are acceptable and which should be excluded.

One possible way to specify these conditions is through compact sequence codes. For example, a user could enter a code and ask the generator to find patterns that contain the corresponding pattern or element. The exact meaning and matching behaviour of such codes still needs to be defined.

## Status and scope

This is Design Document v1. It captures the three central areas of the planned application and their intended direction.

It deliberately does not settle detailed interaction design, algorithms, data structures, technical architecture, performance requirements, or the exact notation and encoding rules. These will be clarified through further discussion before implementation planning begins.
