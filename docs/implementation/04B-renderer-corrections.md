# Implementation Plan 04B: Renderer Corrections

## Goal

Correct the outstanding visual and interaction defects in the existing Package 04 renderer without changing notation semantics or the simulator contract.

## Included corrections

1. **Camera panning**
   - Pan in camera local right and up directions, not fixed world X and Z axes.
   - The rendered scene follows the pointer during right drag, including after camera rotation.
   - Keep orbit and wheel zoom behaviour unchanged.

2. **Automatic performer spacing**
   - Distribute automatically placed performers evenly around the circle.
   - Expand the circle according to performer count so adjacent performer anchors maintain at least 2.2 world units of separation.
   - Keep the existing line layout and explicit seat assignments intact.

3. **Table and position geometry**
   - Use a thin tabletop instead of a deep slab.
   - Place position markers on the tabletop surface.
   - Place performer owned table positions inside the actual table footprint, along the edge nearest their assigned performer.
   - Keep shared positions centred and retain their A, B and C lateral offsets.
   - Keep resting objects above the tabletop rather than intersecting it.

4. **Action reach and object contact**
   - Hands must reach the complete action target, not stop part way.
   - The hand reaches the target at the midpoint of the beat and returns to its resting position by the end.
   - For pickup transitions, the object remains at its source until hand contact, then follows the hand.
   - For placement transitions, the object follows the hand to the target and remains there while the hand returns.
   - For individual passing, sender and receiver hands converge on the same intermediate meeting point, and the object passes through that point.
   - TAP and BOUNCE hands therefore visibly reach their target positions. BOUNCE continues to hold its object.

5. **Regression coverage**
   - Test automatic circle spacing with a larger performer group.
   - Test table positions against the tabletop footprint.
   - Test full hand reach and return timing.
   - Test camera local panning direction.
   - Test that both passing hands share one intermediate meeting point.
   - Keep existing hand position and object ownership tests.

## Explicitly unchanged

- Simulator snapshots remain the only source of ball ownership and state.
- Notation and action definitions do not change.
- Main beat animation remains the supported timeline.
- Subdivision animation remains unsupported until the simulator exposes subdivision snapshots.
- Seat assignments and line layout remain unchanged.
- No custom trajectories or performer placement editor is introduced.

## Verification

- [x] Geometry regression tests added for spacing, table footprint, hand reach and camera pan direction.
- [ ] Formatting and linting.
- [ ] Strict TypeScript check.
- [ ] Full unit and component test suite.
- [ ] Production build.
- [ ] Manual visual review of rotated camera panning.
- [ ] Manual visual review with increasing performer counts.
- [ ] Manual visual review of table positions and resting objects.
- [ ] Manual visual review of LIFT, LEAVE, TAP, BOUNCE and individual passing contact.
- [ ] Desktop and mobile renderer review.

## Approval

Approved by Oliver on 12 November 2026.
