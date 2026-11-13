# Implementation 06: Sequence Data, Persistence and Export

## Status

Implemented on branch `implementation/06-data-persistence-export`. Automated verification is in progress.

## User facing data format

The only sequence representation exposed to users is a compact POINTS code. Users do not need to see or edit JSON.

The current format uses the version prefix `P1.` followed by URL safe Base64 encoding of a compact LZW compressed UTF 8 payload. The payload preserves the complete canonical sequence object, including stable IDs and every sequence property. JSON is an internal serialization detail only. It is never presented as the user facing format.

The codec is deterministic. The same sequence produces the same code. Decoding distinguishes malformed input, unsupported format versions and structurally invalid data. The codec does not run notation validation during decoding. Structurally readable but notation invalid sequences are imported and reported by the existing validator.

The version prefix is reserved for compatibility. Future format changes must add a new version and retain decoders for previously released versions where practical. Never silently reinterpret a code from an unknown version.

## Implemented scope

### Sequence code and import

- Compact versioned sequence code.
- Deterministic encode and decode.
- Full sequence round trip, including BPM, time signature, beats and subdivisions, performers, positions, balls, initial placements, notation, passing layout, table layout and seat assignments.
- Import by pasting a code.
- Confirmation before replacing the current sequence.
- Failed imports leave the current sequence untouched.
- Successful imports use the editor's existing commit pathway and are undoable.
- Invalid notation remains importable when the data structure is complete.

### Local persistence

- Automatic save whenever the sequence changes.
- Save on page hide as a final safeguard.
- Restore the last saved sequence when the same tab is reopened or refreshed.
- Incomplete and notation invalid sequences are persisted without filtering.
- Each browser tab has its own storage key.
- A BroadcastChannel collision check assigns a new key if duplicated tabs inherit the same session identifier.
- No cloud storage or cross tab sequence synchronisation.
- Renderer camera and appearance settings are not part of the sequence.

### Presets

The curated preset registry is repository data and supports text search. Initial entries include Solo basics and Individual passing. Presets load complete sequence objects through the same undoable replacement pathway as imports. There is no in app contribution or editing workflow.

### PNG export

- Export uses a separate print layout rather than capturing the live editor.
- Output is PNG at 2x raster resolution.
- The print view includes sequence type, tempo, time signature, beat labels, performer names, hand rows, notation, initial object overview and the complete compact sequence code.
- Export controls allow users to include or omit settings, performer names, sequence code and initial object state.
- Invalid notation entries are highlighted in red, with a legend on the exported image.
- Export does not require a valid sequence. Existing notation and validation state are not changed.
- Long exports are segmented between complete performer sections. A performer section is never split between images.
- A single unusually tall performer section is kept intact rather than split.

## Files

| File | Responsibility |
|---|---|
| `src/features/data/codec.ts` | Compact versioned sequence code |
| `src/features/data/codec.test.ts` | Round trip and malformed input tests |
| `src/features/data/persistence.ts` | Per tab local save and restore |
| `src/features/data/persistence.test.ts` | Persistence tests |
| `src/features/presets/presets.ts` | Curated presets and search |
| `src/features/export/SequenceDataTools.tsx` | Code, import, preset and export controls |
| `src/features/export/png.ts` | Print layout and PNG segmentation |
| `src/App.tsx` | Workspace integration |
| `src/styles/main.scss` | Data tools styling |

## Verification

- [x] Deterministic compact code format defined.
- [x] Complete canonical sequence round trip covered by tests.
- [x] Unsupported versions and malformed codes distinguished.
- [x] Import uses undoable editor replacement.
- [x] Failed import does not mutate the current sequence.
- [x] Automatic per tab persistence integrated.
- [x] Curated presets and search integrated.
- [x] PNG export and performer based segmentation implemented.
- [x] Formatting check.
- [x] Lint.
- [x] Strict TypeScript check.
- [x] Full unit test suite: 147 tests passed.
- [x] Production build.
- [x] Browser tests: 16 passed, including import, undo, persistence, preset search and PNG download.
- [ ] Manual visual inspection of exported PNG at short and long sequence lengths.
- [ ] Live deployment verification after merge.

## Known limitations to review

1. The first compact code version is intentionally opaque rather than hand editable. Users copy and paste it.
2. PNG export currently prioritises a clear print summary and notation grid. A future visual pass may refine action geometry and support explicit export options.
3. Preset library starts with two canonical examples. Additional curated material can be added without changing the code format.
4. The tab collision mechanism depends on BroadcastChannel where available. Browsers without it still use per tab session identifiers and local storage.
