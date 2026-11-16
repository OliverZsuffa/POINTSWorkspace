# Implementation Plan 05B: Structural Generator and ZIP Constraint Corrections

## Status

Core implementation completed and merged through PR #30 on 16 November 2026. The implementation adds two stage structural and location generation, rejects wholly unused beats, generates CLAP through linked SPECIAL entries, and counts ZIP transfers by linked pair. The detailed implementation is recorded in PR #30. Search limit diagnostics and consolidation of the ZIP controls remain follow up verification items.

## Context

Package 05 is merged. Its current search engine enumerates complete notation candidates by assigning actions and concrete targets to hand and beat cells, then validates each completed candidate. This makes location permutations part of the main search tree, even when the user is initially interested only in the action structure.

The generator exposes two ways to constrain ZIPs:

- The generic action count control counts notation entries whose action type is ZIP.
- The dedicated Exact ZIP transfers control counts distinct ZIP link IDs.

A valid ZIP transfer consists of two notation entries, one source and one receiver, sharing one link ID. Therefore, two ZIP transfers consist of four ZIP notation entries. The generic ZIP exact count control can misleadingly ask for two ZIP entries, which represents only one complete transfer. The dedicated transfer count is the correct control for this purpose.

The current candidate builder already creates both source directions for a pair of hands. It tries both left to right and right to left. The current issue is therefore not a simple omission of the reverse direction in candidate construction. The tests do not establish that exact transfer constraints find valid candidates across both directions, and the exhaustive search can spend its node budget exploring irrelevant complete location assignments before finding the requested structure.

## Goals

1. Separate action structure generation from concrete target and location assignment.
2. Let the user inspect and select a structural pattern before generating its concrete location permutations.
3. Prevent the generator from creating ordinary SPECIAL actions. CLAP remains available through its existing representation.
4. Ensure requested beat counts produce patterns with no wholly unused beats.
5. Make ZIP constraints unambiguous and prove that both directions are searched.
6. Reduce wasted search by applying structural constraints before location expansion.

## Behavioural requirements

### 1. Beat usage

A requested N beat structural pattern must use all N beats. A beat is unused only when both hands of every authored performer contain EMPTY for that beat. In solo and circle passing, this reduces to both hands of the single authored pattern performer being EMPTY.

A beat with HOLD in one hand and EMPTY in the other is used. A beat with TAP, LIFT, LEAVE, BOUNCE or another permitted action in either hand is used. CLAP uses both hands and counts as activity.

The generator must not return a four beat pattern that is semantically just a shorter pattern padded with wholly empty beats. It should reject such a structure rather than silently trimming it after generation, because the requested beat count is part of the selected structure.

### 2. Generated action set and CLAP

The structural generator may use the existing ordinary actions, but must not generate standalone SPECIAL actions.

CLAP is not a new domain action type. Preserve the existing representation exactly:

- Two SPECIAL entries.
- Same performer and beat.
- One entry in each hand.
- Both texts exactly "Clap".
- Shared link ID.
- Existing simulator validation and renderer behaviour remain authoritative.

The structural search should model this as one atomic CLAP choice that occupies both hand cells. Concrete sequence materialization must emit the two linked SPECIAL entries in the existing format. Do not introduce a CLAP action type or change the domain model merely to support generation.

The generic SPECIAL action must not appear as an independent generator choice. The interface should expose CLAP as the available coordinated action, not expose arbitrary SPECIAL text.

### 3. Two stage generation

#### Stage A: Generate abstract structures

Generate action structures without assigning concrete table positions or other concrete location targets.

A structure records the information needed to define the movement pattern:

- Beat count and beat duration kinds.
- Performer and hand.
- Action type.
- Whether an action is single hand or a coordinated pair.
- For ZIP and CLAP, the paired relationship and source/receiver or left/right roles.
- For passing actions, the sender and receiver relationship where applicable.
- Required action counts, required fragments and forbidden fragments.
- Looping requirement and object count constraints that can be evaluated without concrete position selection.

Example abstract structure:

| Beat | Left hand | Right hand |
|---|---|---|
| 1 | TAP | EMPTY |
| 2 | HOLD | LIFT |
| 3 | CLAP | CLAP |
| 4 | EMPTY | LEAVE |

The structure preview should communicate action and hand placement clearly. It should not imply that a target position has already been selected.

Apply beat usage, action counts, paired action consistency and all other location independent constraints during this stage. Preserve deterministic ordering, cancellation, result limits and progressive delivery.

Do not run concrete location permutations while filling the Stage A result gallery.

#### Stage B: Expand a selected structure into concrete variants

When the user selects a structure, generate valid concrete assignments for its location dependent actions.

Examples include:

- TAP and BOUNCE targets.
- LIFT source positions.
- LEAVE destination positions.
- Circle passing relative position, direction and distance where relevant.
- Individual passing target references.
- Any other target data required by the existing action model.

Only enumerate targets compatible with the selected sequence type, performer ownership, available positions and current object state rules.

Use the shared simulator as the final authority. Reject invalid concrete variants. Deduplicate semantically identical variants. Allow the user to browse the concrete variants and load one into the editor.

Stage B must not alter the selected action structure. It only fills in the concrete target and location data required by that structure.

The interface should make the two stages explicit: first select an action structure, then expand that structure into concrete variants. Returning to Stage A or selecting another structure must not silently overwrite the current editor sequence.

### 4. ZIP direction and transfer count

A ZIP transfer is one linked source and receiver pair, not two independent ZIP actions.

The dedicated Exact ZIP transfers constraint must count distinct valid ZIP link IDs. A requested count of two means exactly two complete pairs, or four ZIP notation entries.

Both directions must be considered:

- Left hand is source and right hand is receiver.
- Right hand is source and left hand is receiver.

The search must not assume that all ZIPs in a sequence use the same direction. It must permit mixed directions across beats when the other sequence constraints and simulator allow them.

Remove ZIP from the generic per action exact count control, or otherwise prevent that control from presenting an entry count as though it were a transfer count. The dedicated Exact ZIP transfers control is the sole user facing ZIP count constraint. Keep internal validation capable of rejecting malformed ZIP links.

The search must validate the pair shape before counting a transfer: exactly one source and one receiver with the same link ID, in the same beat, on opposite hands of the same performer. The shared simulator remains authoritative for the full validity rules.

### 5. Search efficiency

Stage A should avoid location permutations entirely. Use structural constraints to prune partial structures as soon as their counts or paired relationships make completion impossible.

Stage B should expand only the selected structure. Apply early pruning when a partial target assignment cannot possibly satisfy the remaining object state, loop or target constraints.

Keep deterministic result order. Keep the existing stop and continuation behaviour where applicable, but define continuation separately for Stage A and Stage B so loading more structural patterns does not accidentally continue a concrete expansion, and vice versa.

Search limits must be visible and diagnosable. If no result is found, distinguish at least:
- No structure satisfies the structural constraints.
- Structures exist, but the selected structure has no valid concrete location assignment.
- Search limit reached before the search was exhaustive.

Do not report "no possible pattern" when the search simply exhausted its node budget.

## Implementation areas

| Area | Planned work |
|---|---|
| src/features/generator/engine.ts | Split abstract structure enumeration from concrete target expansion. Add structure and expansion search contracts. |
| src/features/generator/constraints.ts | Add structural constraint checks, explicit beat usage checks and validated ZIP transfer counting. |
| src/domain/model.ts | Add the minimum typed structure representation needed by both stages. Avoid changing notation action semantics. |
| src/App.tsx | Replace the single complete candidate gallery with a structure gallery and a selected structure expansion view. Clarify ZIP count UI. |
| Generator styles | Add compact structural previews and concrete variant previews consistent with the existing generator panel. |
| Generator tests | Cover beat usage, CLAP, no ordinary SPECIAL generation, ZIP direction, ZIP transfer counts, structural selection and concrete expansion. |
| Documentation | Update Package 05 status and document the two stage generator contract. |

## Test plan

### Structural generation

- A requested four beat structure never contains a beat where both hands of every authored performer are EMPTY.
- HOLD plus EMPTY counts as a used beat.
- TAP plus EMPTY counts as a used beat.
- CLAP counts as a used beat and occupies both hands.
- No generated structure contains a standalone SPECIAL action.
- CLAP materializes as exactly two linked SPECIAL entries with text "Clap".
- Required and forbidden action counts are enforced before location expansion.
- Required and forbidden structural fragments retain their current exact hand, action and relationship semantics.
- Identical requests produce deterministic structural result ordering.

### ZIP correctness

- One left to right ZIP is represented by one valid pair and counts as one transfer.
- One right to left ZIP is represented by one valid pair and counts as one transfer.
- Two ZIP transfers in the same direction count as two transfers.
- Two ZIP transfers in opposite directions count as two transfers.
- Exact ZIP transfer count two requires four ZIP entries in two valid linked pairs.
- A generic exact ZIP entry count is no longer exposed as a confusing user facing alternative.
- Broken, duplicated, cross beat, same hand or incomplete ZIP links are rejected.
- A regression test demonstrates that a request for two transfers can return a candidate using both directions when valid under the rest of the constraints.

### Concrete expansion

- A selected structure is expanded without changing its beat, hand, performer or action layout.
- Every target permutation is checked by the shared simulator.
- Invalid target assignments are never returned.
- Concrete variants are deduplicated.
- Stage B never changes the selected structure.
- Stop and Load more operate on the active stage only.
- Search limit exhaustion is distinguished from a proven absence of results.

### General regression

- Existing immutable base completion remains unchanged unless a separate approved design explicitly extends it.
- Existing P5 serialization remains lossless for generated sequences.
- Existing CLAP editing, rendering and simulation tests continue to pass.
- Formatting, lint, strict TypeScript, all unit tests, production build and browser tests pass.

## Out of scope

- Variation generation.
- Changing existing base sequence actions or beat positions.
- Introducing a new CLAP domain action.
- Changing the notation semantics of ZIP, SPECIAL or any other action.
- Changing the P5 sequence code format.
- Ranking structures or concrete variants.
- Automatically selecting a structure or location assignment on the user's behalf.

## Approval

Core implementation approved by Oliver and merged through PR #30. Remaining follow up items are tracked in the current work package status.
