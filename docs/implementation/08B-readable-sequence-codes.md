# Implementation 08B: Readable, Domain-Specific Sequence Codes

## Status

Implementation and review corrections are complete in PR #20. The decoder now validates the full tuple structure and every reference before constructing a sequence. Full semantic round trip tests cover all sequence fields, including optional empty performer identifiers, compound meter and two participant polygon layouts. Final CI verification is running.

## Goal

Replace the current JSON plus LZW code with a domain-specific notation code inspired by Shapez shape codes. The code should be as short as practical while remaining visually readable and technically decipherable. A committed user should be able to recognise action initials and performer or position references without decoding a binary blob.

The code is a compact representation of the juggling sequence, not a compressed copy of the application's internal object graph.

## Design principles

1. **Action initials are visible.** Use readable action symbols based on the existing notation vocabulary: for example `H` for HOLD, `L` for LIFT, `V` for LEAVE, `B` for BOUNCE, `T` for TAP, `E` for EMPTY, `Z` for ZIP and `S` for SPECIAL. The exact grammar will be finalised against the full editor model before implementation.
2. **References are compact and stable within a code.** Performers, hands, balls, positions, beats and links are assigned small local indices. Never encode UUIDs or internal database identifiers.
3. **Structure is explicit but economical.** Main beats and simultaneous actions must remain unambiguous. Repeated defaults and derivable values should not be repeated.
4. **Human readable alphabet.** Prefer letters, digits and a small set of punctuation characters. Avoid Base64, opaque binary payloads and long encoded JSON.
5. **Lossless semantic round trip.** Decoding must reconstruct every sequence property that affects editing, validation, simulation, rendering or export. Internal IDs may be regenerated, provided all references and relationships remain consistent.
6. **Invalid but structurally complete sequences remain importable.** The decoder validates tuple structure and reference existence, not pattern validity. It preserves semantic errors such as invalid BPM values, incomplete circle target parameters, mismatched hand back placements and inconsistent beat grouping for the existing validator to report. It must not silently repair notation.
7. **Experimental format.** Use `P2.` for this redesign. No backward compatibility is required. Existing test codes and saved patterns may be discarded while the app is under development.

## Proposed code shape

Use a compact version prefix followed by nested tuples. Tuples use parentheses and comma separators. Single letter tokens are unquoted, so action initials appear directly as `H`, `L`, `V`, `B`, `T`, `E`, `Z` or `S`. Other strings use a `~` marker followed by percent escaped text. Numbers remain unquoted. There are no JSON brackets, quoted strings, field names, Base64 payloads or UUIDs. Action tuples begin directly with their action token, for example `(L,...)` or `(H)`. The rest of each tuple contains only the references and parameters needed by that action.

The current tuple layout stores the sequence settings explicitly. Performer identifier presence is encoded separately from its value, so an absent identifier remains distinct from an explicitly empty identifier. Internal entity IDs are omitted and rebuilt as local references. Names, settings, subdivisions, custom SPECIAL text, table geometry and initial object placements are preserved.

## Data that must round trip

- Sequence type.
- BPM and full time signature, including beat grouping.
- Main beat count and all subdivision start, duration and depth values.
- Performer order, names and optional individual-passing identifiers.
- Every position, its kind, name, owner, performer and hand where applicable.
- Ball count and initial placements, including held hands, hand backs and table positions.
- Every notation entry, performer, hand, beat, rational offset and action.
- All action targets, including table positions, circle position/direction/distance, individual pass source and recipient hand.
- ZIP source/receiver pairing and all other link relationships.
- SPECIAL text and optional link.
- Individual passing layout.
- Table layout and seat assignments.

## Encoding strategy

1. Build local symbol tables from the sequence arrays in their existing order.
2. Encode only semantic fields. Map each internal ID to a short local index.
3. Use action-specific compact tokens. Common actions and targets should be one or a few readable characters plus a small reference.
4. Encode rational numbers in a reduced compact form. Use integers without a denominator when possible. Preserve exact values.
5. Encode simultaneous actions with a shared beat/time grouping, rather than repeating the full timeline coordinates for every row.
6. Use compact defaults for common configurations, while providing explicit escape forms for uncommon values.
7. Do not introduce a generic compression stage unless measurements show a clear benefit without harming readability.

## Format replacement

- P2 is the only format emitted and recognised by the new codec.
- P1 is intentionally unsupported. No legacy decoder, migration or compatibility path is retained.
- `isSequenceCode` recognises P2 only.
- Unknown versions return the unsupported-version result.

## Implementation scope

- Replace the codec with a P2 domain-specific encoder and decoder.
- Add focused grammar helpers if this keeps the codec maintainable.
- Update import detection and any UI copy that assumes only P1.
- Update documentation to describe the readable grammar and intentional lack of backward compatibility.
- Do not change persistence, presets, PNG export or the domain model unless a narrowly scoped integration change is required.

## Verification and acceptance criteria

1. Round trip all existing representative fixtures, including solo, individual passing and structurally complete invalid notation.
2. Add fixtures or generated cases covering circle passing, per-performer and shared positions, two sided polygon layouts, rectangular tables with zero seats on one side, empty collections, subdivisions, compound meter, fractional offsets, ZIP, SPECIAL, hand-back placements and all target variants.
3. Verify all decoded IDs and references are internally consistent and all semantic fields are preserved.
4. Verify P1 is not treated as a supported format.
5. Verify malformed and unsupported versions are distinguished.
6. Verify deterministic output.
7. Add tests proving the code contains visible action initials and does not contain UUIDs, JSON syntax or Base64 payloads.
8. Measure code lengths for representative simple, medium and complex sequences. Compare P2 against current P1 and report the actual reduction. Optimise based on those measurements, not an arbitrary promise.
9. Run formatting, lint, strict TypeScript, unit tests, browser tests and production build. Verify GitHub Pages deployment after merge.

## Explicit non-goals

- No user-facing JSON export or import.
- No separate metadata sidecar.
- No lossy simplification of sequence information.
- No changes to the notation semantics or simulator.
- No promise that a very complex sequence can fit into a tiny code. Code length should scale with actual sequence complexity, not internal UUIDs and redundant object structure.

## Review checkpoint

The P2 grammar and implementation are complete in PR #20. Final automated verification is running after the decoder audit. No backward compatibility is included.
