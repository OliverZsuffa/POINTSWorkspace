# Implementation Plan: Share Link Import Confirmation

## Goal

Make opening a P4 share URL behave like importing a sequence code manually. A shared sequence must never silently replace the current tab's saved progress.

## Current issue

The current startup flow decodes a valid `#code=P4...` fragment and immediately installs that sequence. The persistence effect then saves it over the current tab's saved sequence. This means simply opening a shared link can overwrite existing work without an explicit decision.

Manual code import already asks for confirmation before replacing the current sequence. Share URL loading must use the same confirmation experience and replacement path.

## Required behaviour

1. On startup, restore the current tab's saved sequence first, exactly as when opening the app without a share code.
2. If the URL contains a valid P4 code, decode it without changing saved progress.
3. If the restored sequence contains one or more notation entries, present the same confirmation dialogue used by manual code import.
4. If the user accepts, replace the current sequence with the decoded shared sequence. The accepted sequence then becomes the sequence saved for the current tab.
5. If the user cancels or dismisses the dialogue, keep the restored sequence and its saved progress unchanged.
6. A saved sequence with zero notation entries is empty and does not count as saved progress. In this case, load a valid shared sequence directly without asking for confirmation. The same applies when there is no saved sequence.
7. Invalid or unsupported codes must not trigger an override dialogue and must continue to show the existing error while preserving saved progress.
8. A URL without a code must retain the existing local restoration behaviour.
9. Keep the share code in the URL. Reloading the same link asks for confirmation again only when nonempty saved progress exists.

## Implementation approach

- Refactor the manual import confirmation into one shared confirmation mechanism that can be invoked by both manual import and startup share loading.
- Prefer an application controlled confirmation dialogue over a browser native prompt if needed to support a reliable prompt during startup. Keep its wording and actions consistent for both entry points.
- Make startup restoration and share code handling an explicit sequence so persistence cannot save the shared sequence before the user accepts it.
- Do not call the normal replacement callback until the user accepts. Cancellation must not create an undo entry or alter the editor state.
- Keep the P4 codec and URL format unchanged.

## Files and areas

| File or area | Change |
|---|---|
| `src/App.tsx` | Restore saved progress first, stage a decoded share sequence, and show the shared confirmation dialogue |
| `src/features/export/SequenceDataTools.tsx` | Reuse the same confirmation mechanism for manual imports |
| Shared confirmation UI or state | Ensure both entry points display identical confirmation wording and choices |
| `src/features/data/share-link.ts` | Keep URL parsing and construction unchanged unless tests expose a required correction |
| `e2e/sequence-data.spec.ts` | Replace the old silent precedence expectation with accept, cancel, reload, and persistence regression tests |
| `docs/implementation/08G-p4-shareable-urls-specification.md` | Document confirmation and saved progress protection |
| `docs/implementation/README.md` | Reference this correction plan |

## Acceptance tests

- Opening a valid share URL with existing saved progress displays the confirmation dialogue and initially leaves the saved sequence active.
- Accepting the dialogue loads the shared sequence and persists it.
- Cancelling the dialogue keeps the previously saved sequence active and unchanged after reload.
- Opening a valid share URL with no prior saved sequence still asks before loading it. Cancelling leaves the normal default sequence active.
- Reloading a share URL asks again. The shared sequence is not applied unless accepted each time.
- Invalid share URLs show the existing error and do not overwrite saved progress.
- Manual code import still uses the same dialogue and continues to work.
- No share URL means existing per tab progress restoration is unchanged.

## Verification

Run formatting, lint, TypeScript, unit tests, production build, and the complete Playwright browser suite. Specifically verify the saved progress value before and after both confirmation outcomes.

## Approval

Status: Approved and implemented in PR #27. Automated verification pending.
