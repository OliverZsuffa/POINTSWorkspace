# Plan 10: Three-stage generator redesign and renderer consolidation

## Status
Proposed plan. Implementation requires Oliver's approval.

## Problems motivating this work
- Generator visuals continue to drift from editor visuals.
- Generated patterns tend to contain repeated LIFT/HOLD structures and do not reliably generate LEAVE transitions.
- ZIP transfer constraints, including two-transfer requests, remain unreliable.
- Generator results take up too much space in the gallery.

## Goals
1. Use the editor's actual notation rendering implementation everywhere, without a second renderer or visual approximation.
2. Rework generation into three explicit sequential stages.
3. Make core movement executable and validated before embellishments are considered.
4. Fix ZIP and LEAVE generation and add targeted regression tests.
5. Make the results gallery more compact without changing notation visuals.

## Stage 0: Audit and shared editor rendering
- Audit the editor rendering components, generator previews, PNG export and any other notation render surfaces.
- Identify the editor's authoritative renderer and reuse its component and styles directly wherever notation is displayed.
- Remove duplicate or approximate generator/export symbol implementations where feasible.
- Keep interactions and editor state outside the shared visual component, but use the exact same symbol geometry, cell layout, edges, labels, subscripts, CLAP and ZIP visuals.
- Support output sizing through shared renderer props rather than separate rendering implementations.
- Audit PR #32 and later changes to determine why renderer consistency regressed or was bypassed. Avoid simply reapplying the prior patch without investigating.

## Stage 1: Abstract ball movement
- Generate abstract, valid ball movement structures without premature concrete table position assignment.
- Track object state, hands, transfers and balance consistently.
- Reject structurally impossible partial and complete candidates.
- Do not generate decorative flourishes in this stage.
- Keep existing sequence modes and immutable base sequence semantics.
- Ensure the structure is meaningful and does not produce trivial repeated or wholly unused patterns.

## Stage 2: Core action and location completion
- Complete the selected abstract movement structure with concrete target locations.
- Generate the required LIFT, LEAVE and linked passing actions so each core sequence is executable.
- Treat LEAVE as a first-class transition. Validate held state, destination occupancy and available object state correctly.
- Resolve target position conflicts, occupancy, capacity and same-beat collisions.
- Support both ZIP directions and mixed or opposing ZIP transfers where constraints permit.
- Count ZIP transfers as linked pairs consistently. Avoid confusing two ZIP notation entries with one transfer.
- Respect exact ZIP counts and prune impossible searches without excluding feasible configurations.
- Validate fully completed sequences using the shared simulator and all relevant constraints.
- Do not expose or accept a core result that has not passed validation.
- Report whether a search exhausted the space or hit a search limit, rather than treating both as proof of no solution.

## Stage 3: Flourish generation
- Only operate on valid completed core sequences.
- Flourishes are optional and cannot change the underlying ball movement.
- Support permitted substitutions such as HOLD to BOUNCE when object and hand state allows, EMPTY to TAP, and paired compatible EMPTY actions to linked CLAP.
- Respect position conflicts, hand occupancy, object state and linked action rules.
- Retain the unembellished core as a valid option.
- Provide configurable flourish behavior where practical, such as disabled or enabled flourishes.
- Track or retain the core action corresponding to each flourish so the result remains auditable.
- Validate embellished candidates again with the shared simulator.

## Compact result gallery
- Reduce padding, vertical gaps and redundant metadata.
- Fit more results on screen while preserving legibility.
- Keep symbol geometry, cell proportions, labels and styling identical to the editor.
- Keep controls concise and accessible.
- Do not create a separate compact symbol renderer.

## Regression coverage
### Rendering
- Editor, generator gallery, generated sequence view and PNG export use identical shared symbol rendering and cell styling.
- LIFT, LEAVE, HOLD, BOUNCE, TAP, EMPTY, CLAP, ZIP and passing notation are visually consistent.
- Desktop, tablet and phone visual checks.

### Stage 1
- Invalid held-state transitions are pruned.
- Candidate structures are nontrivial and meaningful.
- Existing base entries remain immutable.

### Stage 2
- Valid LIFT followed by LEAVE sequences are generated.
- LEAVE without held objects is rejected.
- Object pickup, release, position occupancy and same-beat conflicts are covered.
- ZIP source and receiver pairs work in both directions.
- Two ZIP transfers can be found when feasible, including opposing directions.
- Exact transfer counts count pairs, not individual symbols.
- Impossible requests and exhausted search limits are distinguished.
- Every returned concrete core candidate passes the shared simulator.

### Stage 3
- Flourish substitutions preserve the core movement.
- BOUNCE requires an object held in the relevant hand.
- TAP requires an empty hand and valid target.
- CLAP requires valid paired hand state and linked entries.
- Flourish-free candidates remain available.
- Every embellished candidate passes validation.

### Quality gates
- Formatting, lint, strict TypeScript, unit tests, production build and browser tests.
- Browser checks at desktop, tablet and phone sizes.
- Review screenshots for rendering parity and compact gallery layout.
- Do not merge until tests and visual checks pass.

## Proposed implementation sequence
1. Audit current implementation and identify renderer regression and generator failure causes.
2. Extract or reuse editor renderer directly and consolidate generator and export paths.
3. Refactor generator contracts and orchestration to expose three explicit stages.
4. Repair abstract movement and state validation.
5. Repair core action completion, location assignment, LEAVE and ZIP constraints.
6. Implement flourish generation as a separate optional stage.
7. Compact the result gallery.
8. Add regression tests and run full CI plus viewport screenshot review.

## Non-goals
- Altering notation semantics beyond what is necessary to correctly enforce existing rules.
- Changing or editing immutable base sequence entries.
- Ranking results or introducing quality scores.
- Adding unrelated editor or renderer features.
