# Implementation Plan 07D: Circle Simulation Validation and Polygon Position Spacing

## Status

Implementation in progress.

## Reported problems

1. In Circle passing mode, a valid simple pattern such as `LIFT, HOLD, HOLD, LEAVE` is reported as invalid, with errors appearing across the repeated visual pattern.
2. Table positions overlap in smaller circle layouts, particularly with four participants. Larger layouts appear to work better, so visual screenshot review should focus on small participant counts.

## 1. Correct circle passing simulation projection

### Intended behaviour

Circle passing has one authored pattern performer. The renderer repeats that pattern for each visual participant. Every visual participant must have the object state needed to perform the pattern. These repeated objects are renderer simulation instances, not additional authored balls or editable sequence data.

### Implementation

1. Trace the current circle projection from authored sequence to simulation input and identify why cloned performers begin with no objects.
2. Project every authored ball and its initial placement to each visual participant, using deterministic unique simulation-only ball IDs for the additional instances.
3. Preserve the original authored ball IDs for the representative participant.
4. Ensure each cloned pattern operates on its own projected object instances, while relative circle destinations continue to transfer objects between the correct visual participants.
5. Preserve ZIP and other linked action semantics, including unique link IDs per visual participant.
6. Keep authored sequence data unchanged. Do not add persistent performers, balls, positions or notation entries to the user's sequence.
7. Ensure validation issues from projected entries still map back to the authored notation entry.

### Regression coverage

- A valid one performer pattern containing `LIFT, HOLD, HOLD, LEAVE` remains valid in Circle passing mode.
- Run the same check with at least 3, 4 and 20 visual participants.
- Verify a pattern that transfers an object to a relative circle position remains valid and object identity is preserved.
- Verify projected ball IDs are unique and authored sequence ball and performer counts remain unchanged.
- Retain tests for invalid patterns so projection does not hide genuine errors.

## 2. General polygon position spacing

### Intended behaviour

Every visual participant owns three table positions. For each circle size from 3 through 20, all positions must be spatially distinct and sufficiently separated. The layout must not rely on hiding labels or omitting positions.

### Implementation

1. Rework polygon table footprint sizing around the actual number of positions on each participant edge and the polygon side count.
2. Ensure the three positions on each edge fit within that edge with a deliberate minimum gap from positions on adjacent edges near shared vertices.
3. Avoid clamping multiple requested positions to the same coordinate.
4. Keep each position on its owning polygon edge and keep all positions inside the table footprint.
5. Keep performer seating outside the table and scale the table and performer radius together so the layout remains usable as participant count increases.
6. Add geometry tests that calculate every position coordinate for each participant count from 3 through 20 and assert a minimum pairwise separation, correct edge ownership and containment.
7. Capture updated renderer screenshots for 3 and 4 participants for visual review. Use automated geometry tests for counts 3 through 20 instead of spending time on large screenshots.

## 3. Constraints

- One authored pattern performer remains the source of truth in Circle passing mode.
- Renderer participant count must not add authored performers, notation rows, authored balls or independently editable patterns.
- Preserve Solo and Individual passing behaviour.
- Preserve stable object identity and correct relative left and right mapping around the circle.
- Do not weaken validation rules to make an invalid pattern appear valid.
- Keep the change focused on simulation projection and polygon geometry.

## 4. Verification checklist

- [ ] Valid `LIFT, HOLD, HOLD, LEAVE` pattern passes circle validation at 3, 4 and 20 participants.
- [ ] Relative circle transfer regression passes.
- [ ] Projected object identities are unique and stable.
- [ ] Authored sequence data remains unchanged by visual participant count.
- [ ] Invalid circle patterns remain invalid.
- [ ] All polygon positions for participant counts 3 through 20 are pairwise separated.
- [ ] Positions remain on the correct polygon edge and inside the tabletop footprint.
- [ ] Updated screenshots reviewed for 3 and 4 participants.
- [ ] Formatting, lint, strict TypeScript, unit tests, production build and browser tests pass.
- [ ] GitHub Pages deployment succeeds after merge.

## Approval

Implementation underway after approval.
