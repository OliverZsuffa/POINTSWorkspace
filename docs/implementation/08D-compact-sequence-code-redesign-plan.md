# Compact Sequence Code Redesign Plan

## Status

Approved by Oliver on 16 November 2026. The approved grammar is implemented in the P4 branch and is undergoing verification.

P3 remains active on main until P4 is released. P4 will replace it completely. This proposal is for a complete replacement, provisionally named P4. P3 will not remain supported after the replacement unless Oliver explicitly changes the versioning rule.

## 1. Problem to solve

P3 is technically self contained, but its visible structure is still too verbose. It serialises many records with repeated punctuation and field separators. Its 149 character example is shorter than P2, but it does not resemble the compact continuous code Oliver requested.

The next format must look much closer to a compact sequence of letters and numbers, such as:

```text
VGUnhjUuinJBhUIhHJzuGUbBHHuioJIh
```

That string is a visual style reference only. It is not a valid example of the proposed grammar.

The goal is not merely to remove spaces or replace semicolons. The encoding model itself must be redesigned around compact tokens, shared context and recoverable compression.

## 2. Non negotiable requirements

1. The code is one continuous string. It contains no spaces or line breaks.
2. Letters and digits carry almost all information.
3. Punctuation is permitted, but used very sparingly. It should separate major blocks only where a decoder genuinely needs a boundary. It must not be used as the default separator between every field, record or action.
4. Common action tokens remain recognisable. In particular H means HOLD, L means LIFT, V means LEAVE, B means BOUNCE, T means TAP, E means EMPTY, Z means ZIP and S means SPECIAL.
5. The code is lossless. Decoding must recover every persisted semantic value and relationship exactly.
6. The code is self contained. A third party must be able to decode it from the published specification without POINTS source code, application defaults, network access or sidecar data.
7. There is no encryption and no lossy encoding.
8. Do not use JSON, UUIDs, internal object keys or a Base64 payload.
9. Do not rely on implicit defaults. Values such as BPM, time signature, sequence type, beat count, object count and layout must be represented explicitly, even when they equal common defaults.
10. The encoder is deterministic. The same semantic sequence produces the same canonical code.
11. Structurally complete but notation invalid sequences remain representable and importable so the existing validator can explain the errors.
12. Malformed codes must fail safely. A failed import must not alter the current sequence.
13. There is exactly one supported version at a time. When the replacement is released, remove the P3 encoder and decoder. Do not retain backwards compatibility or migration unless Oliver explicitly asks for it.

## 3. Proposed encoding architecture

The implementation should be a compact domain specific stream format, not a serialised copy of the internal object graph.

### 3.1 Compact version and header

Use a short version marker, provisionally P4, followed by a compact header.

The header stores shared sequence properties once:
- Sequence type.
- BPM.
- Time signature numerator and denominator.
- Beat grouping.
- Main beat count.
- Performer count and performer metadata.
- Position definitions and ownership.
- Object count and initial placements.
- Subdivision and timing information.
- Passing layout, table layout and seat assignments.

The header must not repeat a value inside every action when it can be referenced from this shared context.

### 3.2 Compact numeric representation

Evaluate base 36 for nonnegative integer counts and local indices. It uses digits and letters, keeps values compact and remains straightforward to implement independently.

Do not automatically convert every number to base 36. Decimal BPM values, rational offsets and other values should use the shortest unambiguous exact representation. The specification must define canonical forms, sign handling, range limits and exact parsing.

Rational values must remain exact. Do not convert them to floating point during decoding or silently reduce or approximate them.

### 3.3 Action streams sliced by beat count

The declared beat count is stored once. Each performer has a left hand stream and a right hand stream in a fixed documented order.

Each stream represents exactly that many beat cells. The decoder knows where one beat ends and the next begins from the grammar, not from repeated beat numbers.

Within a beat:
- Action initials are written directly where possible.
- Action parameters use compact references into the shared header.
- Multiple actions in one beat remain representable.
- Exact offsets within a beat are preserved.
- Original notation ordering is preserved wherever it has semantic significance.

The stream grammar must make action boundaries unambiguous without surrounding every action with punctuation.

### 3.4 Recoverable compression

Implement compression that can be reversed exactly:
- Store shared values once and refer to them by compact local index.
- Use the declared beat count to frame action streams.
- Compress consecutive empty beats into a count.
- Use compact counts for repeated structures where the expansion is deterministic.
- Avoid repeating performer, hand, beat or position information when the surrounding stream or header already identifies it.
- Reuse a local reference for every occurrence of the same link relationship.
- Use compact dictionary references for repeated text only if this makes real examples shorter after dictionary overhead is included.

Compression must never discard information or depend on assumptions that are not encoded.

### 3.5 Text and arbitrary user supplied content

Names, identifiers and SPECIAL text can contain Unicode and punctuation. The format must preserve these values exactly.

Design a compact length prefixed text representation. Escape only characters that conflict with the grammar. Do not percent encode every ordinary character. The decoder must verify the declared UTF8 byte length and reject malformed or truncated text.

The grammar must distinguish an absent optional value from a present empty string.

### 3.6 Sparse punctuation

Use a small, explicitly reserved punctuation alphabet. Punctuation should be used for a small number of major boundaries or genuinely ambiguous cases, not for every nested field.

The design review must compare at least two grammars:
1. A mostly punctuation free stream with a minimal number of major separators.
2. A stream using a small number of punctuation delimiters where they materially improve clarity or decoder simplicity.

Choose the shorter format only when it remains unambiguous, robust and independently decodable. Do not force a punctuation free format if doing so makes the grammar fragile.

## 4. Design phase before implementation

Before writing the codec, produce a worked grammar proposal with actual encoded examples. Do not jump directly from this plan into implementation.

The design proposal must include:

1. A complete field coverage map from every persisted Sequence field to its encoded location.
2. The exact character alphabet and the reserved punctuation characters.
3. The version marker and header grammar.
4. The integer, decimal, rational and text encodings.
5. The performer and hand stream grammar.
6. The beat cell and empty run grammar.
7. The representation of every action and every action parameter.
8. The representation of all targets, passing relationships and ZIP links.
9. The representation of subdivisions, exact offsets and time signature grouping.
10. The representation of initial placements, positions, performer metadata, table layouts and seat assignments.
11. Error handling and maximum input limits.
12. A complete independent decoder algorithm.
13. Canonical encoding rules.
14. A clear explanation of how the grammar avoids ambiguous token boundaries.

The proposal must show the same semantic patterns in both P3 and the candidate format. At minimum:
- A short solo pattern.
- A pattern with empty beats and multiple actions in one beat.
- A pattern with multiple performers.
- A circle passing pattern.
- An individual passing pattern with linked throws and catches.
- A pattern with SPECIAL text containing Unicode and reserved punctuation.
- A pattern containing subdivisions and non integer rational offsets.
- A rectangle table layout with seat assignments.

For every example, show the decoded meaning and exact character count.

## 5. Compression and readability evaluation

The design must be evaluated against the existing P3 encoder using identical sequence data.

Required measurements:
- Total code character count.
- Punctuation character count.
- Number of distinct punctuation characters.
- Percentage of the code occupied by metadata.
- Percentage occupied by action streams.
- Length growth when adding performers, beats, positions and arbitrary text.

The four beat solo example currently has a P3 length of 149 characters. Use that same semantic example as the baseline.

Target for that example: 110 characters or fewer, provided every value remains explicit and lossless. If the target cannot be achieved without making the grammar fragile or violating another requirement, present the shortest safe result and explain the tradeoff before implementation.

The design should also be efficient for larger patterns. A format that optimises one tiny solo example but grows badly with more performers or passing metadata is not acceptable.

The code should be visually close to a compact alphanumeric string. A reviewer should not see repeated brackets, nested tuples, or a punctuation character between every value.

## 6. Decoder independence and correctness

The specification must be sufficient for an independent implementation.

The decoder must:
- Identify the version before parsing the payload.
- Reject unknown or superseded versions.
- Parse all values without applying defaults.
- Preserve Unicode text exactly.
- Preserve exact rational values.
- Reconstruct all relationships and original ordering that affect sequence semantics.
- Reject malformed lengths, invalid digits, truncated streams, invalid references and trailing garbage.
- Distinguish malformed structure from a structurally valid but notation invalid sequence.
- Never return a partially decoded sequence.

Internal UUIDs and transient editor state are not semantic content. They may be regenerated deterministically or locally, provided all relationships and ordering are preserved.

## 7. Implementation scope after design approval

The grammar and examples were approved. Implementation replaces P3 completely.

Expected work:
1. Write the normative P4 specification.
2. Implement the encoder and decoder in the data feature, independently of React and editor UI.
3. Remove the P3 encoder and decoder. Do not add a P3 migration path.
4. Update code import and export controls to use P4.
5. Preserve the existing import confirmation and undoable replacement pathway.
6. Ensure failed imports leave the current sequence untouched.
7. Update the data persistence and export documentation.
8. Update all code examples, fixtures and tests.
9. Update the implementation package index and release notes.
10. Verify the live application generates P4 and no longer generates P3.

Local browser persistence stores sequence objects rather than sequence code. It should remain unchanged unless the implementation reveals a real dependency on the old codec.

## 8. Required test coverage

### Round trip coverage

For every supported sequence feature, verify:

`decode(encode(sequence))`

reconstructs a semantically equivalent sequence with every persisted field and relationship preserved.

Also verify canonical stability:

`encode(decode(code)) = code`

for every canonical fixture.

### Specific cases

- Solo, circle passing and individual passing.
- One and many performers.
- Both hands for every performer.
- Zero beats and long sequences.
- Empty beats, repeated empty runs and multiple events in one beat.
- Every action type and every target type.
- Multiple events at the same beat and offset.
- Exact rational offsets and subdivisions.
- Compound time signatures and grouping.
- Initial ball placements in every supported location.
- Names and identifiers, including absent and explicitly empty values.
- Unicode and SPECIAL text containing every reserved character.
- ZIP, pass and SPECIAL link relationships.
- Shared and per performer positions.
- Solo, polygon and rectangle table layouts.
- Every seat assignment form.
- Structurally complete but notation invalid sequences.
- Truncated data, invalid characters, invalid counts, invalid references and trailing garbage.
- Maximum permitted input sizes and protection against excessive allocation.

### Independent decoder check

Create a small reference decoder or conformance harness that uses only the published specification and shared fixtures, not the production encoder implementation. At least one fixture must be decoded independently and compared with the expected semantic sequence.

## 9. Acceptance criteria

The redesign is complete only when all of the following are true:

- The user facing code is visibly a compact alphanumeric stream.
- Punctuation is sparse and justified by the grammar.
- The four beat solo baseline is 110 characters or fewer, unless a documented correctness tradeoff is approved.
- All sequence data is explicitly represented.
- All compression is exactly reversible.
- All action initials remain recognisable.
- Every supported sequence feature round trips without semantic loss.
- An independent decoder can reconstruct the sequence from the specification alone.
- P3 support is fully removed.
- Import, export and existing editor workflows continue to work.
- Formatting, lint, strict TypeScript, unit tests, production build and browser tests pass.
- The deployed application is verified to generate the new format.

## 10. Version policy

P4 is a provisional name for the replacement. The released format must have an explicit version marker.

There is one active version only. Replacing P3 means removing P3 support rather than keeping multiple decoders. Do not implement backwards compatibility, migration or fallback parsing unless Oliver explicitly requests it.

## 11. Approval boundary

This plan was approved. The grammar proposal was reviewed and approved, and P4 implementation is now underway.

The approved concrete grammar is documented in 08F. Implementation and verification are tracked in Package 06.
