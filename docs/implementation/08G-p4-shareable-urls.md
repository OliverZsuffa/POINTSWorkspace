# Implementation Plan: P4 Shareable URLs

## Goal

Allow a complete P4 sequence to be loaded automatically by opening a share URL, and let users copy a share URL for the sequence currently open in the workspace.

## Scope

### Included

- Read a P4 code from the URL fragment using the `#code=` parameter.
- Decode the code with the existing P4 codec before changing editor state.
- Give a valid shared code precedence over locally restored work on initial load.
- Preserve the fragment so reloading or sharing the URL continues to load the same sequence.
- Show a visible error for malformed or unsupported shared codes without overwriting saved local work.
- Add a Copy share link action beside the existing sequence code export actions.
- Provide a selectable URL fallback when clipboard access is unavailable.
- Test URL parsing, URL creation, and component behavior.

### Excluded

- Server storage, accounts, shortened URLs, or external URL services.
- Automatic rewriting of the address bar after every editor change.
- Legacy sequence code support.
- Replacing the existing plain code import workflow.

## Proposed approach

Use the URL fragment rather than a query parameter. The format is `https://oliverzsuffa.github.io/POINTSWorkspace/#code=P4...`. Fragments are not sent to the GitHub Pages server, need no routing configuration, and are available to client-side code. P4 characters are safely encoded through the URL API.

A small data-layer helper will parse the code from a URL and construct a share URL. App initialization will check for a shared code before restoring local persistence. It will decode first and only replace the initial sequence on successful decoding. Invalid links will display an error and will not be saved over local persistence.

The Sequence data tools panel will add a Copy share link action. If clipboard access fails, the generated URL will remain visible in a read-only selectable field.

## Files and components

| File or area | Planned change |
|---|---|
| `src/features/data/share-link.ts` | URL fragment parsing and share URL construction |
| `src/features/data/share-link.test.ts` | Unit tests for URL handling |
| `src/App.tsx` | Shared URL initialization, precedence, persistence protection, and error display |
| `src/features/export/SequenceDataTools.tsx` | Copy share link action and fallback URL field |
| `docs/implementation/08G-p4-shareable-urls.md` | Feature specification and behavior |
| `docs/implementation/README.md` | Work package status and reference |

## Steps

1. Add the URL helper and focused unit tests.
2. Integrate shared URL loading into startup without changing existing local persistence behavior when no shared code is present.
3. Add share link copying and a visible fallback field.
4. Document the URL format and failure behavior.
5. Run formatting, lint, TypeScript, unit tests, and production build.

## Verification

- [x] Formatting
- [x] Linting
- [x] Automated tests
- [x] Production build
- [x] Browser tests for valid share links, invalid links, and local persistence precedence

## Dependencies

None. Uses the existing P4 codec, browser URL APIs, and Clipboard API.

## Risks and open questions

- Very long P4 codes may exceed practical URL limits in some browsers or messaging platforms. No shortening service is introduced.
- The shared code remains in the URL after loading, so refreshing intentionally reloads the shared version. Later edits do not silently rewrite the URL.
- Clipboard access may be unavailable outside secure contexts or when browser permissions deny it. A selectable fallback field handles this.

## Approval

Status: Implemented in [PR #26](https://github.com/OliverZsuffa/POINTSWorkspace/pull/26). All CI checks passed on commit `45b0eacb0d4e9349f874b2787ceab30cc7f55aab` on 16 November 2026. Awaiting merge authorization.
