# Implementation Plan 07E: Circle Orientation, Two Person Layout and Notation Controls

## Status

Planning. Awaiting Oliver's approval.

## Goal

Correct the circle passing coordinate convention, support two visual participants seated opposite each other, make BPM editing reliable, and replace the written CLAP label with a vertical notation bar.

This package must preserve the one authored pattern performer model. Renderer visual participants must not become additional authored performers, notation rows, or persistent balls.

## 1. Circle passing left and right orientation

1. Trace the full coordinate mapping from editor relative targets (including AR and AL) through simulation projection to renderer participant positions and hand targets.
2. Establish one explicit viewpoint convention: left and right are named from the individual juggler's own perspective while standing behind them and facing the table.
3. Ensure AR resolves to that juggler's actual right side and AL to their actual left side. In particular, an AR action must not reach toward the left neighbour.
4. Establish table position order from the seated viewer's perspective. A, B and C must appear from left to right when viewed by a person sitting at the table in the intended orientation.
5. Keep the editor target labels, simulation destination mapping, renderer hands, performer facing direction and position labels consistent. Do not fix only the visible labels while leaving the physical targets mirrored.
6. Add focused tests for both relative destinations, neighbouring participants, wraparound and the displayed A/B/C ordering.

## 2. Circle passing with two visual participants

1. Permit a visual participant count of two in Circle passing mode.
2. Place the two participants opposite each other across the table, with a usable table footprint and non-overlapping seats, hands and positions.
3. Define a stable two participant mapping for left and right relative destinations. A destination must resolve to the opposite participant, not to the same participant or an absent neighbour.
4. Ensure all positions remain distinct and reachable in the two participant layout.
5. Keep the authored sequence at one performer and preserve the existing renderer-only participant count model.
6. Add geometry, mapping, rendering and editor regression tests for two participants, including an action targeting AR and AL.

## 3. BPM input

1. Allow the current BPM value to be selected and replaced directly with keyboard input.
2. Avoid clamping every intermediate keystroke. Empty or partially typed values must not immediately be replaced with the minimum.
3. Commit and validate the value on blur or Enter. Keep the supported final BPM range explicit and clamp or reject only the completed value.
4. Preserve the current default and ensure playback uses the committed BPM.
5. Add tests for selecting all and replacing the value with a lower valid BPM, clearing and retyping, keyboard arrow changes, invalid input and boundary values.

## 4. CLAP notation

1. Replace the text label CLAP with a vertical bar running through the horizontal centre of the notation cell.
2. The bar must be visually clear at normal editor zoom and remain centred in square cells at responsive sizes.
3. Preserve the underlying action semantics, validation and linked clap behaviour. This is a visual notation change only.
4. Add component or browser assertions that the CLAP label is absent and the vertical bar is rendered.

## 5. Regression and verification

1. Preserve Solo and Individual passing orientation and behaviour unless a shared coordinate correction is demonstrably required. Add regression tests for unaffected modes.
2. Run formatting, lint, strict TypeScript, all unit tests, production build and browser tests.
3. Capture focused screenshots for the two participant layout and circle notation cells, including the CLAP bar. Manually inspect the relevant small layouts.
4. Update implementation documentation and the visual audit with exact test evidence and any remaining manual checks.
5. Merge only after all automated checks pass and the changed behaviour is verified.

## Constraints

- Do not add actual sequence performers for visual circle participants.
- Do not duplicate authored notation or persist simulation-only data.
- Keep left and right definitions consistent across editor, simulation and renderer.
- Do not change action validation rules to conceal mapping errors.
- Keep the change focused on the four reported issues and necessary regressions.
