# Implementation 08C: Self Contained Human Readable Sequence Codes

## Status

Plan written for review. No implementation is included in this branch. Implementation requires Oliver's explicit approval.

## Goal

Replace the recently implemented P2 tuple code with a substantially more compact, self contained, domain specific sequence language.

The code must remain technically human readable. Common action characters must retain their recognisable meanings. For example, `H` means HOLD, `L` means LIFT, `V` means LEAVE, `B` means BOUNCE, `T` means TAP, `E` means EMPTY, `Z` means ZIP and `S` means SPECIAL. A person inspecting a code should be able to recognise common actions without first converting the code into another representation.

The code must not use Base64, a generic opaque binary payload, JSON, or encryption. It must not lose information. It must contain every value required to reconstruct the complete sequence independently of the POINTS application.

An independent developer must be able to implement a decoder using only the published format specification and a code. They must not need access to the POINTS source code, application defaults, an external settings file, a sidecar file, or a server.

## Non negotiable design principles

1. **Self contained.** Every property needed to reconstruct the sequence is present in the code. The decoder must not rely on application defaults or external context.
2. **No implicit defaults.** Values are encoded even when they equal the usual POINTS defaults. This includes the usual BPM, time signature, beat count, performer setup, initial object placement and table layout.
3. **Human readable action alphabet.** Common action tokens remain recognisable. The format is a notation language, not a binary serialization disguised as text.
4. **Lossless.** Every semantic field in the sequence model must survive encode and decode. No rounding, omission, normalisation that changes meaning, or lossy compression is allowed.
5. **Unambiguous grammar.** Every valid code has exactly one parse. Token boundaries, parameter types, lengths, references and escaping rules are specified.
6. **Compact by design.** Avoid repeating information that can be defined once and referenced. Use compact local references, compact numeric forms and repetition encoding where they produce a real saving.
7. **Deterministic canonical output.** Equivalent sequence models produce the same canonical code. Ordering rules must be specified.
8. **Versioned and independently implementable.** The format specification is normative. The implementation and tests must not be the only source of truth.
9. **Preserve structurally valid but semantically invalid sequences.** Encoding and decoding must not silently repair a pattern. The application validator remains responsible for reporting notation errors.
10. **No internal implementation leakage.** Do not encode UUIDs, React state, database keys, editor selection state, caches or other transient implementation details.

## Scope

This package redesigns the sequence code format and its codec. It does not change POINTS notation semantics, editor behaviour, validation rules, simulation, renderer behaviour, presets, persistence architecture or export appearance.

The encoder and decoder must operate on the shared domain model. UI components must not implement their own encoding rules.

## Proposed code architecture

The exact grammar must be finalised before implementation. The following structure is the required design direction, not permission to invent ambiguous syntax during coding.

### 1. Version and document framing

Every code begins with a recognisable version marker, proposed as `P3`. The grammar defines how the header ends and where each subsequent section begins. The framing must use a small, documented set of printable characters and must not depend on whitespace.

The framing identifies the format version and the presence and boundaries of all required sections. The decoder must reject truncated documents, unknown mandatory sections, duplicate singleton sections and malformed framing with clear errors.

### 2. Explicit sequence configuration

The code contains the complete sequence configuration, including values equal to POINTS defaults:

- Sequence type, including solo, circle passing and individual passing modes.
- Main beat count.
- BPM.
- Full time signature, including numerator, denominator and grouping.
- All subdivision definitions and timing information.
- Performer count, order, names and optional identifiers.
- Position definitions, names, types, ownership and associations.
- Object count and all initial object placements.
- Hand, position and table configuration.
- Circle participant and target configuration where applicable.
- Individual passing layout and recipient information where applicable.
- Table geometry, sides, seats and assignments.
- Any other persisted domain field that affects interpretation, editing, validation, simulation or rendering.

No decoder may infer any of these values from a POINTS default. A value can be compactly represented, but it must be present and recoverable from the code.

### 3. Action streams

Use compact streams organised around the domain structure. The leading candidate is one stream per performer and hand, with performer and hand ownership declared explicitly in the configuration.

Common actions use their recognisable action characters. A normal HOLD should not need a verbose tuple containing its performer, hand, beat and action name when those facts are already established by the stream position and structure.

The stream model must support:

- One action per hand per beat in the ordinary case.
- Multiple events in the same beat.
- Events at subdivisions or exact rational offsets.
- Actions that require targets or other parameters.
- Actions whose meaning depends on linked actions elsewhere in the sequence.
- Empty or explicitly unoccupied timeline positions.

A simple one character per beat model is not sufficient for every valid sequence. Define a compact event extension syntax for exceptional cases without making the common case verbose.

### 4. Relationships and references

Relationships must be represented explicitly and unambiguously:

- ZIP send and receive pairing.
- Passing sender and recipient relationships.
- Circle passing relative target direction, position and distance.
- Individual passing performer and hand targets.
- SPECIAL links where present.
- Any other cross event relationship in the domain model.

Use short local references assigned deterministically within the code. Never use internal UUIDs. The decoder must validate that every reference resolves, that paired relationships remain paired, and that relationship direction is preserved.

### 5. Conditional event parameters

Actions with no additional parameters should consist of their action token alone wherever possible. Actions needing a target, position, timing value or other data carry only the required additional information.

The grammar must define parameter presence from explicit syntax, not from assumptions about defaults. For example, a targetless action and an action with a target must be distinguishable without guessing.

### 6. Text and uncommon values

Names, performer identifiers and SPECIAL text may contain arbitrary Unicode text. Define a reversible text escaping and length or delimiter rule. It must preserve exact text, including spaces, punctuation, line breaks and Unicode characters. Escaping must not make ordinary action streams ambiguous.

Do not use percent encoded JSON or Base64 as a shortcut. A narrowly scoped text escape mechanism is acceptable for actual text fields.

## Compression strategy

Compression must preserve the human readable character of the code. Apply the following techniques where measurements justify them:

1. **Define structure once.** Declare performer and hand streams once rather than repeating their identity on every action.
2. **Local references.** Assign compact deterministic indices to performers, positions, objects and linked events.
3. **Beat indexing by stream position.** Where a stream is explicitly defined as chronological, its event order determines the beat index. Encode beat count explicitly in the configuration. Do not repeat beat numbers for ordinary events.
4. **Run length encoding.** Repeated actions may use a compact repetition form, for example a defined representation of six consecutive HOLD actions. The grammar must reserve the repetition syntax and make it impossible to confuse a count with an action parameter or another token.
5. **Compact numeric grammar.** Define canonical integer and rational representations. Preserve exact rational values. Do not convert fractions to floating point.
6. **Compact enumerations.** Use documented short tokens for finite domain enumerations while keeping action initials recognisable.
7. **Avoid redundant relationships.** Store a relationship once when the domain model defines one authoritative link, then reconstruct both ends. If the model contains independent data on both ends, preserve both.
8. **Measure before adding complexity.** Do not add generic compression, obscure character substitutions or clever encodings without measured benefit across representative patterns.

The code may look like a compact jumble of letters and numbers, but every token must have a defined semantic role. Readability takes priority over tiny savings that make the grammar fragile or difficult to implement independently.

## Required semantic coverage

The codec must preserve every persisted field in the current sequence model. At minimum, tests must cover:

- Solo, circle passing and individual passing sequence types.
- BPM, beat count, full time signature and beat grouping, including nonstandard values.
- Subdivisions, subdivision depth, start and duration values.
- Performer order, names, optional identifier absent versus explicitly empty.
- Positions, position kinds, names, ownership and associations.
- Object count and initial placements in positions, hands, hand backs and table locations.
- Every action type: HOLD, LIFT, LEAVE, BOUNCE, TAP, EMPTY, ZIP, SPECIAL and CLAP.
- Every action target type and target parameter.
- Multiple actions in one beat and multiple events at rational offsets.
- ZIP source and receiver links.
- Individual passing sender, recipient, position and hand details.
- Circle passing target direction, relative position, distance and self targeting.
- Shared and per performer positions.
- Table geometry, polygon layouts, rectangular layouts, two participant layouts and seat counts including zero on a side.
- SPECIAL text containing Unicode, punctuation, whitespace and line breaks, plus optional links.
- Optional fields, empty collections and absent values.
- Structurally complete but semantically invalid patterns, so the normal validator can report the original errors after decoding.

The implementation must first audit the current domain types and enumerate every persisted field. This list is authoritative only after comparison with the actual model. If a field is added to the domain model later, the format specification and round trip tests must be updated.

## Decoder behaviour and validation

The decoder must have clearly separated stages:

1. Validate version and document framing.
2. Parse sections and tokens according to the formal grammar.
3. Validate field types, required fields, counts, numeric bounds and text escapes.
4. Build local symbol tables.
5. Resolve references and relationships.
6. Reconstruct the complete domain model.
7. Run structural integrity checks.
8. Return the reconstructed sequence without silently applying semantic repairs.

Structural errors include malformed tokens, truncated values, duplicate identifiers, impossible section lengths, invalid numeric syntax and dangling references. These must produce explicit decoding errors.

Semantic pattern errors, such as an invalid action transition or an otherwise invalid juggling pattern, must remain in the reconstructed sequence and be reported by the existing validator. The decoder must not reject a sequence merely because its juggling pattern is invalid.

Define reasonable parser limits for code length, nesting, counts, text size and numeric magnitude. These limits prevent accidental or malicious resource exhaustion and must be documented so independent implementations can apply compatible limits.

## Independent decoder specification

Publish a normative specification in the repository. It must be sufficient for a developer with no POINTS source access to implement an encoder or decoder.

The specification must include:

- Version marker and complete grammar.
- Character alphabet and reserved characters.
- Token and section boundary rules.
- Every field, its type, cardinality and whether it is required.
- Explicit representation of all defaults and empty values.
- Action token definitions and action parameter schemas.
- Stream ordering and event timing rules.
- Numeric and rational number syntax.
- Text escaping and Unicode handling.
- Local reference assignment and resolution.
- Relationship and pairing rules.
- Canonical ordering and deterministic encoding rules.
- Structural error conditions and decoder limits.
- Complete worked examples, including at least one simple solo pattern and one complex passing pattern.
- A field by field mapping to the public sequence semantics, not internal TypeScript implementation details.

The specification must not refer readers to implementation code for missing rules. If the code and specification disagree, the specification is the contract and the implementation must be corrected.

## Compatibility and migration

P3 is a new format version. The implementation plan must explicitly settle how existing P2 codes are handled before implementation:

- Whether P2 import remains supported as a legacy input format.
- Whether all newly generated and copied codes use P3.
- Whether P2 codes can be converted to P3 through the normal import and copy workflow.
- Whether P2 support can be removed later and under what condition.

Do not silently reinterpret a P2 code as P3. Unknown versions must produce an unsupported version error. No compatibility behaviour should be introduced without tests and documentation.

## Implementation stages

### Stage A: Domain model audit and format specification

- Inspect the current shared domain model and existing P2 codec.
- Enumerate every persisted semantic field and every reference relationship.
- Identify fields not covered by the current P2 codec or not represented independently.
- Define the complete P3 grammar and canonical form.
- Define the action alphabet, event stream structure, repetition syntax, parameter syntax, reference rules and text escaping.
- Decide P2 import and migration policy.
- Produce worked examples and a conformance fixture format.
- Review the specification for ambiguity before writing the encoder.

**Exit criteria:** The specification is complete enough for two independent developers to implement compatible decoders without asking the original author questions.

### Stage B: Encoder and decoder

- Implement a pure domain level P3 encoder and decoder.
- Keep parsing, validation and reconstruction separate.
- Implement deterministic local symbol tables and canonical ordering.
- Implement explicit configuration encoding with no implicit defaults.
- Implement action streams and exceptional event extensions.
- Implement exact numeric and text handling.
- Implement all relationship references and structural checks.
- Keep the codec independent of React and UI state.

**Exit criteria:** Full round trip tests preserve every audited domain field and all relationships.

### Stage C: Conformance and interoperability tests

- Create a comprehensive shared fixture set with expected canonical codes and decoded semantic models.
- Test encode then decode and decode then encode canonical stability.
- Test that every fixture can be decoded using a separately implemented reference decoder or an independently written grammar based test harness.
- Test malformed, truncated, unsupported version, unknown mandatory section, invalid escape, duplicate reference and dangling reference cases.
- Test semantically invalid patterns remain intact after round trip.
- Test that the decoder does not consult application defaults or external state.
- Document the fixtures so third party implementations can use them.

**Exit criteria:** An independent decoder can reconstruct every conformance fixture and produces equivalent semantic output.

### Stage D: Application integration

- Switch new code generation and copy actions to P3.
- Integrate P3 import and clear unsupported version errors.
- Implement the approved P2 compatibility and migration policy.
- Preserve existing persistence, presets and PNG export behaviour.
- Update relevant UI labels and documentation.
- Ensure importing a code does not silently overwrite an existing sequence without the existing confirmation workflow.

**Exit criteria:** P3 works through all application import, copy, share and persistence workflows.

### Stage E: Verification and optimisation

- Measure P3 code length against P2 for simple, medium and complex representative patterns.
- Report raw character counts and percentage changes.
- Confirm no UUIDs, JSON syntax, Base64 payloads or hidden sidecar data appear in P3 codes.
- Confirm action initials remain visible and recognisable.
- Optimise only where measurements show a worthwhile reduction without compromising the specification.
- Run formatting, lint, strict TypeScript, unit tests, browser tests and production build.
- Verify GitHub Pages deployment and manually test copy and import in desktop and mobile layouts.

**Exit criteria:** All automated checks pass, interoperability fixtures pass, code length measurements are documented and the deployed application can round trip representative sequences.

## Acceptance criteria

P3 is complete only when all of the following are true:

1. A P3 code contains every value needed to reconstruct the complete sequence.
2. No value is inferred from POINTS defaults or external state.
3. Common action tokens are recognisable, with `H` representing HOLD and equivalent direct tokens for the other common actions.
4. The format does not use Base64, encryption, JSON or lossy compression.
5. The grammar is unambiguous and fully documented.
6. Every current persisted domain field and relationship round trips exactly in meaning.
7. Exact rational timing and arbitrary supported text survive unchanged.
8. Structurally complete invalid patterns remain available to the validator.
9. Output is deterministic and canonical.
10. A third party can implement a decoder from the specification alone.
11. P2 compatibility behaviour is explicitly decided and tested.
12. All application workflows and CI checks pass.

## Explicit non goals

- Changing the meaning of any POINTS action.
- Changing the editor, renderer, generator or simulator.
- Encoding transient UI state or internal UUIDs.
- Encrypting or hiding sequence contents.
- Using Base64 or an opaque binary payload.
- Omitting values because they match a default.
- Lossy compression, rounding or approximate reconstruction.
- Promising a fixed maximum code length regardless of sequence complexity.

## Review checkpoint

This package is a design proposal only. Oliver must approve the grammar direction, complete specification, compatibility policy and acceptance criteria before implementation begins.
