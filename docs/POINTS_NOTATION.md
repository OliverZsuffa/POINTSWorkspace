# POINTS Notation

## 1. Basic Concept

POINTS is a notation system for table juggling. It describes the actions of one or more performers manipulating objects at defined positions over time. Its basic form is solo juggling. Passing extends the notation to multiple performers.

## 2. Positions

In solo juggling, the table has three positions directly in front of the performer, arranged from left to right:

| Position | Location |
|---|---|
| A | Left |
| B | Middle |
| C | Right |

Each position can be empty or occupied by a ball.

There are also two special hand positions:

| Position | Meaning |
|---|---|
| L | The back of the respective left hand |
| R | The back of the respective right hand |

In solo juggling, these positions belong to the performer. How positions are assigned in patterns with multiple performers depends on the passing system.

## 3. Time and Hands

A pattern is organised into beats. Each performer has a sequence for the left hand and a sequence for the right hand. Each cell describes the action performed by that hand at the corresponding point in time.

The time signature must be specified, for example 3/4 or 4/4.

Beats are identified by their number, such as 1, 2 and 3. They can be subdivided to place actions between the beats:

| Subdivision | Counting |
|---|---|
| Quarter notes | `1 2 3 4` |
| Eighth notes | `1 & 2 & 3 & 4 &` |
| Sixteenth notes | `1 e & a 2 e & a` |

These are conventional counting syllables. The ampersand marks the midpoint between two beats. The `e` and `a` mark the additional sixteenth-note positions. Finer subdivisions can be added when needed.

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

ZIP represents a transfer of an object between the two hands of the same performer. It consists of a source action and a receiving action at the same beat. The direction determines which hand sends and which hand receives the object.

## 6. Passing

Passing extends POINTS to patterns involving multiple performers. There are two ways to notate passing: circle passing and individual passing.

### 6.1 Circle Passing

In circle passing, every performer has their own A, B and C positions. All performers use the same sequence. A position can refer to another performer's area by adding a subscript to its letter:

| Notation | Meaning |
|---|---|
| A | Position A of the acting performer |
| A_L or A_1L | Position A of the performer one position to the left |
| A_R or A_1R | Position A of the performer one position to the right |
| A_2L | Position A of the performer two positions to the left |

The same notation applies to positions B and C. The letter identifies the position, while the subscript identifies the performer relative to the acting performer. A number specifies how many performers away the target is. L is equivalent to 1L, and R is equivalent to 1R.

This form is called circle passing because all performers use the same sequence and passing targets are specified relative to each performer. The performers could, for example, sit in a circle, where everyone has a left and right neighbour.

### 6.2 Individual Passing

In individual passing, performers have their own hand sequences and can interact directly with one another. Their table positions may remain separate, as in circle passing, or they may use a shared set of positions, such as A, B, C and D. A shared set is optional, not a requirement.

Each performer is assigned a lowercase letter, such as a, b or c. These letters identify performers and are written as subscripts to indicate the other performer involved in a pass.

A pass is written as a LEAVE action directed into another performer's hand. A circled hand position indicates that the object is passed into the hand, rather than placed onto the back of the hand. The receiving performer has a LIFT action at the same beat, with X as its target position. X indicates the hand that receives the ball.

- The LEAVE action uses the circled hand position with the receiving performer's identifier as a subscript.
- The receiving LIFT action uses X with the sending performer's identifier as a subscript.

For example, a pass from performer a's right hand to performer b's left hand is represented by:

- A LEAVE action with the circled L position and subscript b in the right-hand row of performer a.
- A LIFT action with X and subscript a in the left-hand row of performer b.

This notation can also represent a transfer between performers that functions like a ZIP. When the transfer is between the two hands of the same performer, the ZIP shorthand is used instead.

## 7. Reading a Pattern

A pattern describes the actions of each hand across successive beats and subdivisions. Each action is interpreted in the context of the performer, hand, point in time, target position and current distribution of objects.
