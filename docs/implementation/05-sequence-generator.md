# Implementation Plan 05: Sequence Generator

## Goal

Implement deterministic generation of complete, valid POINTS sequences from constraints and existing sequence fragments.

## Scope

### Included

- Generation from scratch.
- Variations and completions of an existing sequence.
- Solo, circle passing and individual passing.
- Structural constraints and initial object distribution.
- Required and forbidden actions.
- Exact counts for ZIP transfers and passes.
- Required and forbidden subsequence matching.
- Validation through the shared engine.
- Deterministic result ordering.
- Duplicate removal, including time shifted equivalents.
- Progressive result delivery, stop control and pagination.
- Generator gallery and sequence selection.

### Excluded

- Manual notation editing.
- 3D renderer preview in the gallery.
- Ranking or comparing results.
- Generator creation or use of subdivisions.

## Proposed approach

Keep the search engine independent of React and the gallery. It consumes the shared sequence model and constraints, and uses the shared state and validation engine to reject invalid candidates.

The generator must never create or use subdivisions, including subdivisions present in a source sequence. Candidates use main beats only. The original sequence is excluded when generating variations.

Search results must be deterministic for identical inputs. Duplicate detection treats time shifted versions of the same pattern as equivalent while preserving other meaningful structural differences.

Support exact ZIP transfer counts and exact pass occurrence counts as defined in the design document. Required and forbidden fragments must match the specified actions, hands, sources and destinations.

Support progressive results and cancellation. Continuation must not repeat results. The result cap, page size and continuation policy remain open and must be decided before those limits are finalised.

## Files and components

| File or area | Planned change |
|---|---|
| src/features/generator/engine/ | Search and candidate construction |
| src/features/generator/constraints/ | Constraint model and matching |
| src/features/generator/deduplication/ | Pattern equivalence and duplicate detection |
| src/features/generator/ui/ | Settings and result gallery |
| Generator tests | Search and UI tests |

## Steps

1. Consume shared sequence and validation contracts.
2. Define a typed generator constraint model.
3. Implement candidate construction for main beat timelines.
4. Implement action and structural constraints.
5. Implement required and forbidden fragment matching.
6. Use the shared validator to reject invalid candidates.
7. Implement deterministic enumeration and duplicate detection.
8. Implement progressive results, cancellation and continuation.
9. Build the compact constraint interface and notation preview gallery.
10. Integrate result selection into the editor.
11. Benchmark representative search spaces and keep the interface responsive.

## Verification

- [ ] Formatting
- [ ] Linting
- [ ] TypeScript strict type check
- [ ] Automated tests
- [ ] Production build
- [ ] Identical inputs produce identical ordered results
- [ ] Invalid candidates are never returned
- [ ] Subdivisions are never created or used
- [ ] Required and forbidden fragments match exact targets and hands
- [ ] Time shifted duplicates are removed
- [ ] Cancellation preserves existing results
- [ ] Continuation does not duplicate earlier results

## Dependencies

Packages 01 and 02.

## Risks and open questions

- Search space size may make exhaustive search impractical.
- Result cap, page size and continuation policy remain open.
- Exact equivalence for time shifted patterns needs tests.
- Compound meter must be reconciled with the main beat only generator model.

## Approval

Status: Awaiting approval

Implementation must not begin until this plan is explicitly approved.
