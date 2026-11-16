# Implementation Plan 05: Sequence Generator

## Status

Work is active on branch `feature/05-sequence-generator`. The discrete half beat migration is implemented across the model, editor, simulator, renderer and P5 codec. The deterministic search engine, immutable base completion, action and transfer constraints, structural fragment matching, loop checks, advanced constraint controls and notation result panel are implemented. Variation generation is explicitly excluded. Progressive result delivery, cancellation and exact in-session continuation through Load more are implemented. The async search iterator remains paused between pages, so continuation does not restart or repeat the search. Continuation is intentionally session-local and is not persisted across reloads. Broader search space optimisation remains outstanding. Looping candidate deduplication canonicalizes cyclic beat rotations while retaining the initial state as part of semantic identity.

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

Support progressive results and cancellation. The current UI can stop a search while retaining delivered results. Resumable continuation and pagination remain outstanding. The result cap and search node limit are configurable in the request contract.

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
14. Benchmark representative search spaces and keep the interface responsive.

## Verification

- [ ] Formatting
- [ ] Linting
- [ ] TypeScript strict type check
- [ ] Automated tests
- [ ] Production build
- [ ] Identical inputs produce identical ordered results
- [ ] Invalid candidates are never returned
- [ ] Half beats and regular beats validate identically
- [ ] Half beat playback duration is exactly half of regular beat duration
- [ ] Exactly one notation column exists per beat
- [ ] No nested subdivision controls or data remain
- [ ] Existing base entries and beat positions remain unchanged
- [ ] Required and forbidden fragments match exact targets and hands
- [ ] Loop closure and cyclic duplicate behavior are correct
- [ ] Cancellation preserves existing results
- [ ] Continuation does not duplicate earlier results

## Dependencies

Packages 01 and 02, plus the current sequence code format from Package 06.

## Risks and open questions

- Search space size may make exhaustive search impractical.
- Result cap, page size and continuation mechanics need concrete defaults in the UI.
- Exact equivalence for cyclic rotations needs tests.
- Time signature grouping must remain musically coherent when a half duration beat occurs.
- The sequence code format must be updated in coordination with Package 06 work.

## Approval

Oliver confirmed on 16 November 2026 that a supplied base sequence is immutable and that variation generation is not wanted. He also clarified that a half beat is a discrete beat with the same notation and validation semantics as a regular beat, differing only in renderer playback duration.
