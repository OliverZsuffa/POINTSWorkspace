# Package 05: Sequence Generator Specification

## Purpose

Generate complete, executable POINTS sequences from explicit settings and constraints. The generator is a search engine over the shared sequence model. It does not own a second notation or validation model.

## Confirmed product requirements

### Generation modes

- Generate complete sequences from scratch.
- Complete a supplied base sequence by adding actions only.
- A supplied base is immutable. Every existing action, its performer, hand, action parameters and beat position must remain exactly unchanged.
- The generator may add actions only in available empty cells. It may not replace, move, edit or remove base actions.
- Do not implement variation generation.
- Support solo, circle passing and individual passing.
- Generate valid sequences only. A candidate is returned only when the shared validator accepts it.
- Generate over discrete sequence beats. A half beat is a beat in its own right, not a subdivision nested inside another beat.

### Beat and playback semantics

- Every beat is a separate sequence item and a separate notation column.
- A regular beat and a half beat have identical notation and validation semantics.
- All actions assigned to one beat are evaluated simultaneously, exactly as they are for any other beat.
- A half beat differs only in playback duration. Its duration is exactly half the duration of a regular beat at the same position in the time signature.
- The renderer advances through half beats as separate steps and plays each one twice as fast as the corresponding regular beat.
- Half beats do not create nested timeline offsets or subdivisions. Actions occur at the beginning of their beat.
- Beat grouping and time signature metadata remain explicit. The renderer derives each beat's playback duration from the time signature and that beat's duration kind.
- Remove the old binary subdivision UI and data model. Do not retain a second, partially implemented timeline representation.

### Structural settings

The request can constrain sequence type, beat count, performer count, object count, available positions, time signature, initial object distribution and whether the sequence must loop cleanly.

Beat count counts all beat items, including half beats. Initial object placement is part of candidate identity and must be validated. A generator must not silently repair invalid user supplied initial state.

### Action and fragment constraints

Support required, forbidden and exact count constraints for action types, including performer scoping.

Support exact counts for ZIP transfers and individual passing transfers.

Support required and forbidden notation fragments selected from an existing sequence or supplied as a sequence code. Fragment matching is structural. It preserves:
- Action type and action parameters.
- Source position and destination position.
- Performer hand.
- Performer identity and target identity where relevant.
- Linked action relationships, including ZIP and individual passing pairs.

A fragment must match a contiguous sequence of beats. Its relative beat positions and hand assignments are preserved. It is not sufficient for a candidate to contain the same action names in a different arrangement.

For completion mode, the supplied base sequence is treated as an immutable fragment spanning the complete supplied timeline. The generated result must preserve all of its beats and notation entries exactly. The generator may extend or fill only explicitly available empty cells without changing the base.

Advanced free text constraint syntax is out of scope.

### Results

- Results are unranked. Do not assign quality scores or claim that one candidate is better.
- Result ordering is deterministic for identical requests.
- Distinct sequences remain distinct when any meaningful sequence property differs.
- Remove only true duplicates and rotations that are equivalent under the defined looping semantics.
- Display a notation preview for each result. No 3D renderer preview in the gallery.
- The user explicitly starts a search with Generate.
- Deliver results progressively while search continues.
- Show how many results have been found and display them in pages.
- Provide a Load more action that continues the same search without repeating earlier results.
- Provide a Stop action that cancels ongoing search without discarding results already found.
- Search only as far as the configured result cap, then report that the cap was reached. If the search space is exhausted earlier, report that all matching results were found.

## Search engine architecture

The engine is independent of React and the UI. It consumes a typed request and yields validated candidates through the existing asynchronous SequenceGenerator contract.

Candidate construction must be deterministic. Candidate action combinations are explored in a documented stable order. The engine checks cheap structural constraints before invoking simulation and validation. The shared validator is the final authority.

The engine must support cancellation during candidate construction, constraint evaluation and validation. It must not yield a candidate after cancellation.

Continuation must preserve the exact search position and deduplication state. Loading another page must continue the existing search, not restart it from the beginning.

## Looping and duplicate semantics

A sequence marked as looping must be executable when the end transitions back to its initial state. The shared simulator currently evaluates a finite sequence from its initial state. Loop validation therefore needs an explicit end to start state comparison. A looping candidate is accepted only when every ball returns to its initial location and the required hand and position state is compatible.

For non-looping sequences, do not identify cyclic rotations as duplicates.

For looping sequences, cyclic rotations of the complete beat pattern are equivalent only when all sequence settings, initial state semantics, performer identities, positions, targets, hands, linked transfers, beat duration kinds and action ordering are equivalent after the same rotation. The canonical comparison must not use lossy string shortcuts.

## Constraints that must not be weakened

- Invalid candidates are never shown.
- Required and forbidden fragments are matched structurally, not by action names alone.
- Half beats are discrete beats, not subdivisions.
- A supplied base sequence is immutable.
- No variation generation.
- No ranking is introduced.
- A stopped search preserves all results already delivered.
- A continued search does not duplicate earlier results.

## Implementation stages

1. Finalize the request contract and immutable base sequence completion semantics.
2. Replace nested subdivisions with discrete beats carrying a regular or half duration kind. Update editor timeline, codec and renderer playback consistently.
3. Implement canonical fragment matching and constraint evaluation.
4. Implement deterministic candidate enumeration and shared validation.
5. Implement loop closure and time shifted duplicate detection.
6. Implement cancellation and resumable progressive search.
7. Build the settings interface and notation result gallery.
8. Integrate loading a selected result into the editor.
9. Add end to end tests and benchmark representative requests.

## Verification

- [ ] Formatting
- [ ] Lint
- [ ] TypeScript strict check
- [ ] Unit tests
- [ ] Production build
- [ ] Identical requests yield identical ordered results
- [ ] Every returned candidate passes shared validation
- [ ] Half beats validate exactly like regular beats
- [ ] Every beat has exactly one notation column
- [ ] Half beat playback duration is exactly half a regular beat
- [ ] No nested subdivisions remain in the editor timeline
- [ ] Immutable base entries and beat positions are preserved exactly
- [ ] Structural required and forbidden fragment tests
- [ ] Exact ZIP and pass count tests
- [ ] Loop closure tests
- [ ] Rotation equivalence and non equivalence tests
- [ ] Cancellation preserves prior results
- [ ] Continuation does not repeat results
- [ ] Search cap and exhaustion are reported accurately
- [ ] UI integration and responsive gallery tests
