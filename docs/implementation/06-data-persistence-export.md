# Implementation Plan 06: Sequence Data, Persistence and Export

## Goal

Implement sequence code encoding and decoding, import and copy workflows, local persistence, curated presets and notation image export.

## Scope

### Included

- Compact sequence code format.
- Full sequence serialization and deserialization.
- Parse and validation failure handling.
- Copy sequence code.
- Paste and import sequence code.
- Undoable replacement of the current sequence.
- Automatic local persistence and restoration.
- Curated preset data and searchable preset list.
- Image export in one image or user selected segments.
- Export options for settings, performer names, code and object state overview.

### Excluded

- Editor grid implementation.
- Renderer animation.
- Generator search.
- Cloud storage or account based synchronisation.
- Additional recovery after local storage is cleared.

## Proposed approach

Serialization covers the complete sequence structure, including BPM, time signature, table layout, seat assignments, positions, initial state, notation and SPECIAL text. Renderer appearance settings are not encoded.

Use a compact machine oriented format. Include a format version unless a deliberate compatibility decision rejects it. Reject unreadable or unsupported imports without modifying the current sequence. A successfully parsed sequence may still contain invalid notation and must then load and be reported by the shared validator.

Persist the last working sequence locally, including incomplete or invalid work. Undo history need not survive browser restarts. Multiple tabs are independent, but their restore and save behaviour is undecided. Do not invent cross tab synchronisation.

Curated presets are maintained as repository data. The application provides search and selection, but no in app contribution workflow.

Image export uses a separate print oriented layout rather than copying the live editor appearance. Keep fixed notation cell dimensions, preserve meaningful colours and keep performer sections intact across segments. Export remains available for invalid sequences, with errors visibly marked.

## Files and components

| File or area | Planned change |
|---|---|
| src/domain/serialization/ | Sequence encoding and decoding |
| src/services/persistence/ | Local storage adapter |
| src/features/import/ | Import and replacement workflow |
| src/data/presets/ | Curated preset data |
| src/features/presets/ | Preset search and selection |
| src/features/export/ | Export options and image generation |
| src/features/export/layout/ | Print layout and segmentation |

## Steps

1. Consume the canonical sequence model and decide the final serialization schema.
2. Define format versioning and compatibility behaviour.
3. Implement deterministic encode and decode functions.
4. Test round trips for every supported notation and sequence property.
5. Implement safe import and replacement confirmation.
6. Connect replacement to editor undo.
7. Implement local persistence and restoration.
8. Resolve and implement independent tab persistence behaviour.
9. Implement curated preset data and search.
10. Implement print layout and image generation.
11. Implement segmentation and export options.
12. Test invalid sequences, long sequences and large performer sections.

## Verification

- [ ] Formatting
- [ ] Linting
- [ ] TypeScript strict type check
- [ ] Automated tests
- [ ] Production build
- [ ] Encode and decode round trips
- [ ] Unsupported import leaves current sequence untouched
- [ ] Parseable but notation invalid sequence loads and is marked invalid
- [ ] Local restoration retains incomplete and invalid work
- [ ] Presets load complete sequence data
- [ ] Export segments do not overlap or duplicate content
- [ ] Performer sections are not split

## Dependencies

Packages 01 and 02. Package 03 consumes import and copy interfaces. The tab persistence decision is required before persistence can be finalised.

## Risks and open questions

- Sequence code format and versioning must be agreed before public use.
- Multiple tab persistence is undecided.
- Image file format and segment boundary rules remain open.
- A performer section taller than the export area needs a defined handling rule.

## Approval

Status: Awaiting approval

Implementation must not begin until this plan is explicitly approved.
