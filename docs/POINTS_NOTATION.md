# POINTS Notation

## 1. Basic Concept

POINTS is a notation system for table juggling. Its fundamental form describes a solo performer manipulating objects at defined locations over time. It can also describe patterns involving multiple performers and passing.

## 2. Locations and Positions

Each performer has three locations directly in front of them, arranged from left to right:

| Location | Position |
|---|---|
| A | Left |
| B | Middle |
| C | Right |

Each location can be either empty or occupied by a ball.

There are also two special positions:

| Position | Meaning |
|---|---|
| L | The back of the respective left hand |
| R | The back of the respective right hand |

## 3. Time and Hands

A pattern is organised into beats. Each performer has a sequence for the left hand and a sequence for the right hand. Each cell describes the action performed by that hand during the corresponding beat.

The rhythm follows standard musical notation. The time signature must be specified, for example 3/4 or 4/4.

Beats can be identified by their number, such as 1, 2 and 3. Subdivisions can be written using ampersands:

- Eighth-note subdivisions: `1 & 2 & 3 &`
- Sixteenth-note subdivisions: `1 & & & 2`

This allows actions to be placed on beats as well as between beats and between those subdivisions.

## 4. Actions

| Action | Description |
|---|---|
| HOLD | Keep holding the object in the hand it is in, without doing anything with it. |
| LIFT | Lift an object from the specified target position. |
| LEAVE | Leave an object at the specified target position. |
| BOUNCE | Tap a position while holding an object. |
| TAP | Tap a position with an empty hand. |
| EMPTY | No action. |
| SPECIAL | Perform an action instead of an empty action. |

SPECIAL can be used for actions that do not fit the other action types. A common example is a clap, which requires both hands to be free during that beat. Other actions can also be represented this way.

## 5. ZIP

ZIP represents a transfer of an object between the two hands. It consists of a source action and a receiving action at the same beat. The direction determines which hand sends and which hand receives the object.

## 6. Passing

POINTS can be extended from solo juggling to passing between performers. There are two ways to notate passing.

### 6.1 Circle Passing

Each performer has their own locations A, B and C. In circle passing, a location can refer to a neighbouring performer's space by using a subscript:

| Notation | Meaning |
|---|---|
| A | Location A of the acting performer |
| Aₗ or A₁ₗ | Location A of the performer one position to the left |
| Aᵣ or A₁ᵣ | Location A of the performer one position to the right |
| A₂ₗ | Location A of the performer two positions to the left |

The same notation applies to locations B and C. The letter identifies the location, while the subscript identifies the performer relative to the acting performer. A subscript can include a number to specify how many performers away the target is. L is equivalent to 1L.

This form is called **circle passing** because all performers use the same sequence and passes are specified through relative subscripts. The performers could, for example, sit in a circle, where everyone has a left and right neighbour.

### 6.2 Individual Passing

Another form of passing uses a LEAVE action directed into another performer's hand. A circled position indicates that the object is passed **into the hand**, rather than placed onto the top of the hand.

The receiving performer must have a LIFT action at the same beat, with the target position X. This indicates the hand that will receive the ball.

The destination performer is identified by a lowercase letter written as a superscript. Each performer is assigned a letter.

For example, a pass from performer a's right hand to performer b's left hand is represented by:

- A LEAVE action with the circled L position and superscript b in the right-hand row of performer a.
- A LIFT action with X and superscript a in the left-hand row of performer b.

This form of notation could also represent a ZIP between performers. However, when the transfer is between the two hands of the same performer, the ZIP shorthand is used.

## 7. Reading a Pattern

A pattern describes the actions of each hand across successive beats. Each action is interpreted in the context of the performer, hand, beat, target position and current distribution of objects.
