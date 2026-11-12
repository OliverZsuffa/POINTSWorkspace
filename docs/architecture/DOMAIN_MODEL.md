# Shared Domain Model

## Purpose

The domain model is the canonical representation of a POINTS sequence. It is independent of React, the editor, the renderer and the generator interface.

Feature packages must consume these shared types. They must not create separate definitions of performers, positions, actions, time, object state or validation results.

## Sequence structure

A sequence contains:

- A sequence type: solo, circle passing or individual passing.
- A conventional time signature and its explicit main beat grouping.
- BPM measured in quarter notes per minute.
- An ordered list of main musical beats.
- Performers and their identifiers.
- Table and hand back positions.
- Balls with stable identities.
- Initial object placements.
- Notation entries assigned to performers, hands and timeline positions.
- Table layout and performer seat assignments.
- The shared or per performer position layout choice for individual passing.

The beat count is the number of main beats in the sequence. A time signature describes how those beats are grouped into bars. The time signature denominator determines the duration of its note unit. Compound meter grouping is explicit in the model. For example, 4/4 uses four groups of one quarter note, while 6/8 uses two groups of three eighth notes.

BPM always means quarter notes per minute. A quarter note therefore lasts 60 divided by BPM seconds. The duration of a main beat is derived from its group size and the time signature denominator. In 6/8, each main beat is three eighth notes, or one and a half quarter notes.

## Timeline representation

Each main beat has a stable ID. Subdivisions are intervals within a main beat, expressed as exact rational offsets and durations relative to that beat.

A notation entry identifies its performer, hand, action and timeline position. Timeline positions use exact rational offsets from the beginning of a main beat. This avoids using screen column numbers as time and supports repeated half subdivisions without floating point drift.

The editor may rearrange the visual presentation of the timeline, but it must preserve these musical positions. For state simulation, all actions assigned to one main beat are evaluated together against the state entering that beat. Subdivision offsets remain part of the notation timeline, but they do not establish an action order within the same main beat.

## Performers and positions

Performers have stable IDs and display names. Individual passing may additionally assign a lowercase performer identifier.

Table positions are either owned by one performer or shared. Position names must be unique within their owner namespace. This allows two performers to each have a position named A while preventing duplicate names within the same performer. Shared positions occupy one shared namespace.

Hand back positions are explicitly associated with a performer and a hand. L is the back of the left hand and R is the back of the right hand.

The individual passing layout is either shared positions or per performer positions.

## Object identity and capacity

Every ball has a stable identity. Initial state maps each ball to exactly one location.

Every position, including a table position and a hand back position, has a capacity of zero or one ball. Each hand can hold at most one ball with its fingers and can simultaneously balance one separate ball on its back. A back balanced ball is not held by the fingers and does not make the hand occupied for action eligibility. It does not prevent the hand from performing actions, subject to each action's normal requirements.

Object locations distinguish table positions, finger held hand locations and hand back positions. The simulation layer derives hand state from these locations.

## Notation actions

Notation entries use a discriminated action union:

- HOLD
- LIFT
- LEAVE
- BOUNCE
- TAP
- EMPTY
- ZIP
- SPECIAL

LIFT and LEAVE can target a table position, a hand back position, a circle passing relative position or the relevant individual passing hand reference. LIFT from a hand back moves the balanced object into the acting hand. LEAVE to a hand back moves the held object onto that hand back if it is free. TAP and BOUNCE target a defined position. ZIP entries carry a shared link ID and a source or receiver role. Linked SPECIAL entries may share a link ID and must use the same text. A standalone SPECIAL has no link ID.

The domain model records notation. The validation and simulation package determines whether the actions are legal in the current state. It provides a state snapshot immediately before and immediately after each main beat.

All actions assigned to the same main beat are simultaneous. A hand has one finger held object and one separate back balanced object. TAP and EMPTY require the fingers to be free. BOUNCE is the position tap performed while holding an object with the fingers. The held object remains in the hand. A balanced object on the back does not prevent TAP or BOUNCE. SPECIAL also requires free fingers, while allowing a balanced object on the back.

A ZIP source and receiver share a link ID and occur at the same timeline position. An individual pass is represented by a sender LEAVE targeting the receiving performer's hand and a receiver LIFT targeting the source performer. The validation layer checks that the two sides correspond. A hand cannot receive and send an object during the same beat.

## Shared contracts

The shared contracts define the interfaces consumed by downstream packages:

- SequenceSimulator
- SequenceValidator
- SequenceCodec
- SequenceGenerator
- SequenceRendererInput

The generator request includes the allowed sequence types, beat count, performer and object counts, available positions, time signature, initial state and constraints. Exact count action requirements require an explicit count at the type level.

The sequence code encoding itself is intentionally not specified here. The codec interface is stable enough for feature development while leaving the format decision for the data package.

## Deliberately unresolved

The following decisions are not frozen by this foundation:

- The final sequence code schema and versioning policy.
- The exact severity policy for validation warnings.
- The complete generator constraint search strategy and result limits.
- Multiple tab persistence behaviour.
- The remaining editing gestures and keyboard shortcut mapping.
- Renderer seat reassignment interaction.
- Export file format and segmentation details.

Changes to shared domain contracts must be proposed and reviewed before downstream packages rely on them.
