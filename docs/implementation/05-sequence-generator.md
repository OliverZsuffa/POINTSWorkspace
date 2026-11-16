# Implementation Plan 05: Sequence Generator

## Status

Implementation is complete on branch `feature/05-sequence-generator`. The discrete half beat migration is implemented across the model, editor, simulator, renderer and P5 codec. The deterministic search engine, immutable base completion, action and transfer constraints, structural fragment matching, loop checks, advanced constraint controls, notation result gallery, cancellation, and exact in-session Load more continuation are implemented. Cyclic rotations are canonicalized for required loops while preserving initial state as part of semantic identity. Variation generation is explicitly excluded. CI passes formatting, lint, TypeScript, all unit tests, production build and desktop, tablet and phone browser tests. Continuation is session-local and is not persisted across reloads. Further search heuristics can be added later if real usage demonstrates a performance need.

## Goal

Implement deterministic generation of complete, valid POINTS sequences from constraints, while supporting immutable base sequence completion and a consistent discrete beat model.

## Scope

### Included

- Generation from scratch.
- Completion of a supplied base sequence without changing any existing action or beat position.
- Solo, circle passing and individual passing.
- Structural constraints and initial object distribution, including whether the sequence must loop cleanly.
- Required and forbidden actions.
- Exact counts for ZIP transfers and passes.
- Required and forbidden structural subsequence matching, preserving action parameters, positions, hands and linked transfers.
- Validation through the shared engine.
- Deterministic result ordering.
- Duplicate removal, including cyclic rotations only when the sequence is required to loop cleanly.
- Progressive result delivery, stop control, resumable continuation and pagination.
- Generator gallery and sequence selection.
- Replacement of nested half beat subdivisions with discrete beats whose only special property is shorter renderer playback duration.

### Excluded

- Variation generation.
- Changing, moving, replacing or removing actions from a supplied base sequence.
- Manual notation editing.
- 3D renderer preview in the gallery.
- Ranking or comparing results.
- Nested beat subdivisions.

## Proposed approach

Keep the search engine independent of React and the gallery. It consumes the shared sequence model and constraints, and uses the shared state and validation engine to reject invalid candidates.

A base sequence is immutable. The completion engine may only add notation in empty cells and may not alter existing beat identity, order, duration kind or notation entries.

Represent every beat as a discrete sequence item. Regular and half beats share the same validation and notation behavior. A half beat is played in half the duration of a regular beat at the corresponding time signature position. Remove the nested subdivision model and the UI that currently implies that subdivision actions are validated independently when they are not.

Search results must be deterministic for identical inputs. Duplicate detection treats cyclic rotations as equivalent only for sequences that must loop and only when all relevant sequence semantics are equivalent.

Support exact ZIP transfer counts and exact individual passing transfer counts. A looping sequence must return every ball to its initial location at the end of the sequence.

Support progressive results and cancellation. The UI can stop a search while retaining delivered results. Load more resumes the same paused async iterator and uses a one-result lookahead, so it does not restart the search or duplicate previously delivered candidates. The iterator is session-local. The result cap and search node limit are configurable in the request contract.

## Files and components

| File or area | Planned change |
|---|---|
| src/domain/model.ts | Discrete beat duration kind and generator request contract |
| src/domain/state/simulate.ts | Validate actions by discrete beat, with no subdivision special cases |
| src/domain/time/time-signature.ts | Calculate regular and half beat playback duration |
| src/features/editor/timeline.ts | One notation slot per discrete beat |
| src/features/renderer/SequenceRenderer.tsx | Play half beats at half duration |
| src/features/data/codec.ts | Persist beat duration kind in the current sequence code format |
| src/features/generator/engine.ts | Deterministic candidate enumeration and validation |
| src/features/generator/constraints.ts | Immutable base checks, structural fragments, action counts and loop closure |
| src/features/generator/engine.ts | Semantic duplicate filtering, including cyclic rotations for required loops |
| src/App.tsx | Initial generator controls, progressive results and notation preview |
| Generator and timeline tests | Search, immutable base, timing and UI tests |

## Steps

1. [x] Update the shared beat model and remove the nested subdivision representation.
2. [x] Update editor timeline, beat insertion and notation editing to use one slot per beat.
3. [x] Update sequence code encoding and decoding for beat duration kinds.
4. [x] Update renderer timing so half beats play in half the regular beat duration.
5. [x] Add regression tests proving validation treats half and regular beats identically.
6. [x] Define the typed generator request and immutable base completion behavior.
7. [x] Implement action and structural constraints.
8. [x] Implement required and forbidden fragment matching.
9. [x] Use the shared validator to reject invalid candidates.
10. [x] Implement deterministic enumeration and semantic duplicate filtering, including cyclic rotation canonicalization for required loops.
11. [x] Implement progressive results, cancellation and exact in-session continuation with Load more pagination.
12. [x] Build the initial constraint interface and notation preview gallery.
13. [x] Integrate result selection into the editor.
14. [x] Bound search work and yield periodically so the interface remains responsive. Further search heuristics are a future optimization.

## Verification

- [x] Formatting
- [x] Linting
- [x] TypeScript strict type check
- [x] Automated tests
- [x] Production build
- [ ] Identical inputs produce identical ordered results
- [ ] Invalid candidates are never returned
- [x] Half beats and regular beats validate identically
- [x] Half beat playback duration is exactly half of regular beat duration
- [x] Exactly one notation column exists per beat
- [x] No nested subdivision controls or data remain
- [x] Existing base entries and beat positions remain unchanged
- [x] Required and forbidden fragments match exact targets and hands
- [x] Loop closure and cyclic duplicate behavior are correct
- [ ] Cancellation preserves existing results
- [x] Continuation does not duplicate earlier results

## Dependencies

Packages 01 and 02, plus the current sequence code format from Package 06.

## Risks and open questions

- Search space size may make exhaustive search impractical.
- Continuation is intentionally session-local and is lost when the page is reloaded.
- Cyclic canonicalization retains the initial object distribution as part of semantic identity, which intentionally avoids treating rotations with a different starting state as equivalent.
- Time signature grouping must remain musically coherent when a half duration beat occurs.
- The sequence code format must be updated in coordination with Package 06 work.

## Approval

Oliver confirmed on 16 November 2026 that a supplied base sequence is immutable and that variation generation is not wanted. He also clarified that a half beat is a discrete beat with the same notation and validation semantics as a regular beat, differing only in renderer playback duration.
