# P3 Sequence Code Specification

## Status

P3 is the only supported sequence code format. It replaces P2 completely. P1, P2 and any other superseded formats are not accepted. There is no legacy decoder or migration path unless Oliver explicitly requests one.

This specification is normative. An independent implementation must be able to decode P3 using this document alone. It must not depend on POINTS source code, application settings, defaults, network services or sidecar data.

## 1. Design goals

P3 is a compact, self contained and technically human readable notation language.

Common actions retain their visible initials:

| Token | Action |
|---|---|
| `H` | HOLD |
| `L` | LIFT |
| `V` | LEAVE |
| `B` | BOUNCE |
| `T` | TAP |
| `E` | EMPTY |
| `Z` | ZIP |
| `S` | SPECIAL |

The current domain model does not define CLAP as a separate action type. A CLAP notation must therefore be represented using the existing SPECIAL action until the domain model explicitly adds a CLAP action.

P3 does not use Base64, JSON, encryption or lossy compression. It uses explicit sections, compact local references, grouped performer and hand streams, and reversible text escaping.

## 2. Document structure

A P3 document consists of exactly fourteen semicolon separated parts. The first part is the version marker. The remaining thirteen values appear in a fixed order. Section labels are deliberately omitted because their positions are defined by this specification.

```text
P3;<sequence-type>;<bpm>;<time-signature>;<beat-count>;<performers>;<positions>;<object-count>;<placements>;<subdivisions>;<action-streams>;<individual-layout>;<table-layout>;<seats>
```

No whitespace is permitted outside encoded text values. The entire code is one line. A decoder may trim whitespace surrounding the complete pasted code, but must not trim or normalise data inside fields.

Every value is mandatory, including values whose content is empty. Empty lists are represented by an empty value between semicolons. Empty values are not defaults.

A missing value, extra value or reordered value makes the document malformed.

## 3. Character and separator rules

The structural separators are:

| Character | Meaning |
|---|---|
| `;` | Separates document sections |
| `:` | Separates a section name from its value, and separates action stream header fields |
| `.` | Separates fields within a record |
| `,` | Separates records within a list |
| `+` | Separates multiple events within one beat cell, and groups within a time signature |
| `|` | Separates successive beat cells within an action stream |
| `_` | Separates components of circle targets and rectangle dimensions |
| `~` | Begins an encoded text value |
| `-` | Represents an absent optional value or one empty beat cell where explicitly allowed |
| `-N` | Represents a run of N consecutive empty beat cells, where N is at least two |

Text escaping ensures that structural separators never occur literally inside a text atom.

## 4. Primitive values

### 4.1 Numbers

Numbers use their canonical ECMAScript decimal string representation. Exponents are permitted. Negative values are permitted where the domain type is numeric, even if the value makes the sequence semantically invalid. Negative zero is written as `-0`.

A decoder must reject NaN, positive infinity and negative infinity.

### 4.2 Integers and references

Indices and counts are zero based where they refer to an item in an ordered collection. They use decimal integers without leading zeroes, except for zero itself. Negative indices are invalid.

### 4.3 Rational numbers

Rational values use `numerator` when the denominator is one, otherwise `numerator/denominator`. Numerators and denominators are safe integers. The denominator must be positive and nonzero.

The decoder must preserve the exact numerator and denominator supplied. It must not convert a rational to floating point or reduce it as part of decoding.

### 4.4 Text atoms

Every arbitrary text value is encoded as:

```text
~<UTF8 byte length>:<percent encoded text>
```

The byte length is the number of UTF8 bytes in the decoded text. Percent encoding uses UTF8. Structural punctuation that could interfere with P3 parsing, including period and tilde, must be percent escaped. The percent sign itself must be escaped.

Examples:

| Original text | P3 atom |
|---|---|
| Empty string | `~0:` |
| `A` | `~1:A` |
| `Juggler 1` | `~9:Juggler%201` |
| `A.B` | `~3:A%2EB` |
| `100%` | `~4:100%25` |

The decoder must percent decode the value and verify its UTF8 byte length. It must preserve Unicode exactly. It must distinguish an absent optional value from a present empty string.

## 5. Section definitions

### Field 1: Sequence type

Exactly one character:

| Value | Meaning |
|---|---|
| `s` | Solo |
| `c` | Circle passing |
| `i` | Individual passing |

### Field 2: Tempo

One finite number representing BPM. BPM always means quarter notes per minute.

### Field 3: Time signature

Three period separated fields:

```text
numerator.denominator.grouping
```

Grouping values are separated by plus signs. An empty grouping list is represented by `-`. Numerator, denominator and grouping values are all explicitly encoded. P3 never assumes the usual time signature.

Example: `4.4.1+1+1+1` represents 4/4 grouped into four quarter note beats. `6.8.3+3` represents 6/8 grouped into two dotted quarter note beats.

### Field 4: Main beat count

One nonnegative integer. This is the exact number of main beats in the sequence. Beat indices in other sections refer to this ordered beat collection.

### Field 5: Performers

A comma separated list of performer records. Each record has two period separated fields:

```text
<name text atom>.<identifier>
```

The name is always present, including when empty. The identifier is either `-` when absent or a text atom when present. Therefore, an absent identifier and an explicitly empty identifier are different values.

Performer indices are assigned by record order, starting at zero.

### Field 6: Positions

A comma separated list of position records.

A table position has three fields:

```text
T.<name text atom>.<owner>
```

The owner is `s` for a shared position or `p<performer index>` for a performer owned position.

A hand back position has four fields:

```text
B.<L or R>.<performer index>.<L or R>
```

The second field is the displayed hand back position name. The final field is the associated hand. Both values are explicitly encoded.

Position indices are assigned by record order, starting at zero.

### Field 7: Object count

One nonnegative integer. Ball identities are reconstructed as local indices from zero up to this count minus one. The count is explicit even when it is zero.

### Field 8: Initial placements

A comma separated list of placement records. Each record begins with the ball index.

Position placement:

```text
<ball index>.P.<position index>
```

Finger held hand placement:

```text
<ball index>.H.<performer index>.<L or R>
```

Hand back placement:

```text
<ball index>.B.<position index>.<performer index>.<L or R>
```

Every ball may have zero or one placement record in structurally valid data. The codec must preserve structurally complete but semantically invalid placements, including duplicate or missing placements, so the application validator can report them.

### Field 9: Subdivisions

A comma separated list of subdivision records. Each record has four fields:

```text
<beat index>.<start rational>.<duration rational>.<depth>
```

Records are ordered first by beat index and then by their original order within that beat. A beat with no subdivisions has no records in this section. The main beat count remains explicit in section B, so empty beats are retained.

Subdivision identifiers are internal implementation identifiers and are regenerated during decoding. Their order and semantic values are preserved.

### Field 10: Action streams

There are exactly two streams per performer, in canonical order: performer zero left hand, performer zero right hand, performer one left hand, performer one right hand, and so on.

Each stream has two colon separated fields:

```text
<L or R>:<beat cells>
```

Streams are separated by commas. The performer is determined by the stream's position in this ordered list. The hand is stated explicitly in the stream header.

Each stream expands to exactly the number of beat cells declared in Field 4. Beat cells are separated by vertical bars. The first cell represents beat zero, the second cell beat one, and so on. An empty beat cell is `-`. Two or more consecutive empty cells are compressed into `-N`, where N is the number of empty cells in that run. The count must be at least two and must not contain leading zeroes. A decoder expands the run before checking the total cell count. If the sequence has zero beats, the stream has no cell content after the colon.

Multiple events within one beat cell are separated by plus signs. Every event has this common prefix:

```text
<notation ordinal>.<offset rational>.<action token>
```

The notation ordinal is the zero based index of the entry in the original notation array. It preserves the original order of notation entries across streams. The beat index is represented by the beat cell position and is not repeated in each event. Offset is a rational position relative to the beginning of that main beat.

This is the main timeline compression rule: the beat count is stored once, and every performer hand stream is divided into exactly that many beat cells.

Action parameters follow the action token as additional period separated fields:

| Action | Complete event fields after the common prefix |
|---|---|
| HOLD | No parameters |
| EMPTY | No parameters |
| LIFT | Target, optional link |
| LEAVE | Target, optional link |
| BOUNCE | Target |
| TAP | Target |
| ZIP | Role, required link |
| SPECIAL | Text atom, optional link |

For LIFT and LEAVE, an absent link is `-`. For ZIP, a link is mandatory. For SPECIAL, an absent link is `-`.

#### Target tokens

Table position target:

```text
p<position index>
```

Circle position target:

```text
c<position>_<direction>_<distance>
```

Position is A, B or C. Direction is L, R or `-` when absent. Distance is a number or `-` when absent. The direction and distance are independently optional because the domain model permits either one to be present without the other. Self targeting is represented by both optional values being absent.

Individual passing source target:

```text
s<performer index>
```

Individual passing recipient hand target:

```text
r<performer index>_<L or R>
```

A target kind must be valid for its action. LIFT accepts position, circle position and pass source targets. LEAVE accepts position, circle position and pass recipient hand targets. BOUNCE and TAP accept position and circle position targets.

#### ZIP role

ZIP uses `S` for source and `R` for receiver, followed by its required local link reference.

#### Link references

Every distinct LinkId is assigned a local link index in order of its first occurrence while traversing the notation array. All occurrences of that LinkId use the same index. Link indices start at zero and are contiguous.

The decoder reconstructs local LinkIds from these indices. It must preserve one sided or otherwise semantically invalid links so the existing validator can report them.

### Field 11: Individual passing layout

Exactly one character:

| Value | Meaning |
|---|---|
| `n` | Property absent |
| `s` | Shared positions |
| `p` | Per performer positions |

Absence is explicitly represented and is not inferred from sequence type.

### Field 12: Table layout

Solo table:

```text
s
```

Polygon table:

```text
p<side count>
```

Rectangle table:

```text
r<long side seat count>_<short side seat count>
```

All dimensions are explicit, including zero seat counts.

### Field 13: Seat assignments

A comma separated list of seat assignment records.

Polygon edge:

```text
<performer index>.P.<edge index>
```

Rectangle side:

```text
<performer index>.R.<side>.<seat index>
```

Side is one of `long-a`, `long-b`, `short-a` or `short-b`.

## 6. Internal identifiers

Sequence, performer, position, ball, beat, subdivision, notation entry and link IDs are implementation identities, not portable semantic values.

P3 replaces them with deterministic local indices or local link references. A decoder may generate new internal IDs. It must preserve all relationships and ordering so that the reconstructed sequence is semantically equivalent.

No UUID, database key, React state, editor selection, cache value or other transient application detail is encoded.

## 7. Complete field coverage

The P3 sections encode every persisted field in the current Sequence model:

| Domain field | P3 section |
|---|---|
| sequenceType | Field 1 |
| bpm | Field 2 |
| timeSignature numerator, denominator and beatGrouping | Field 3 |
| beats and beat count | Field 4 |
| performer names and optional identifiers | Field 5 |
| positions, names, ownership and hand associations | Field 6 |
| balls | Field 7 |
| initialState placements | Field 8 |
| beat subdivisions and exact timing | Field 9 |
| notation performer, hand, beat, offset and action | Field 10 |
| action targets and parameters | Field 10 |
| action link relationships | Field 10 |
| individualPassingLayout | Field 11 |
| tableLayout | Field 12 |
| seatAssignments | Field 13 |

The sequence ID and entity IDs are intentionally regenerated because they are not semantic sequence content.

If the domain model gains a persisted field, this specification, codec and conformance fixtures must be updated before that field is considered supported by P3.

## 8. Decoder requirements

A conforming decoder must:

1. Identify the P3 marker and reject superseded or unknown versions.
2. Validate the exact section count and order.
3. Parse every section using the grammar above.
4. Validate UTF8 byte lengths and text escapes.
5. Validate numeric syntax and safe integer references.
6. Reconstruct performer, position, ball and beat local identities.
7. Reconstruct exactly two action streams per performer.
8. Restore notation array order using the notation ordinals.
9. Resolve all target and link references.
10. Reconstruct exact rational values without floating point conversion.
11. Preserve structurally complete but semantically invalid sequences.
12. Return no partial sequence when decoding fails.

The decoder must not apply POINTS defaults. It must not silently repair a sequence or run semantic notation validation as part of decoding.

Recommended safety limits for the current implementation are a maximum code length of 1,000,000 characters and a maximum of 100,000 main beats, performers or objects. Independent implementations should enforce at least these limits.

## 9. Canonical encoding

The encoder must be deterministic.

- Sections always use the order defined in section 2.
- Performers, positions, balls, beats, placements, subdivisions, notation entries and seats retain their source array order.
- Performer streams always use performer order, left then right.
- Events within each stream retain notation array order.
- Link indices are assigned by first occurrence in the notation array.
- Numeric values use canonical decimal text.
- Rational values use the exact numerator and denominator stored in the model.
- Text values use the specified UTF8 length and percent encoding.
- Empty lists and absent optional values use the exact representations specified above.

Encoding a decoded P3 sequence must reproduce the same canonical code.

## 10. Worked solo example

This example represents four beats, one performer, one ball, three table positions, two hand back positions, a 4/4 signature and four notation entries.

```text
P3;s;120;4.4.1+1+1+1;4;~9:Juggler%201.-;T.~1:A.p0,T.~1:B.p0,T.~1:C.p0,B.L.0.L,B.R.0.R;1;0.P.0;1.0.1/2.1,1.1/2.1/2.1;L:-3|3.0.T.p2,R:0.0.L.p0.-|1.0.H|2.0.V.p1.-|-;n;s;
```

The left hand stream uses `-3` to represent its first three empty beat cells, followed by the TAP on beat four. The right hand stream contains LIFT, HOLD and LEAVE on beats one, two and three, followed by an empty cell. The stream order establishes performer ownership, each stream header establishes its hand, and the cell position establishes the beat. Event ordinals preserve the original notation array order.

## 11. Format replacement policy

There is exactly one supported sequence code format at a time.

P3 replaces P2 completely. The P2 encoder and decoder are removed. P2 codes return an unsupported format result and are not migrated automatically.

A future format revision replaces P3 in the same way unless Oliver explicitly requests backward compatibility or a migration tool. A version marker remains mandatory so independent decoders can identify the active grammar. It does not imply support for older versions.

## 12. Compression comparison

The reviewed two ball, four beat solo example has been encoded in both the earlier P2 grammar and P3 with identical semantic content.

| Format | Character count |
|---|---:|
| P2 tuple code | 226 |
| P3 beat sliced code | 149 |
| Reduction | 34% |

The reduction comes from removing tuple punctuation and repeated field labels, defining performer and hand streams once, using beat cell positions instead of repeating beat indices, and run length encoding consecutive empty cells. All sequence values remain explicitly represented.

## 13. Conformance requirements

A conforming implementation must test:

- Every field in the coverage table.
- Solo, circle passing and individual passing.
- Empty collections and explicit default valued settings.
- All action types and target variants.
- Multiple events in one beat.
- Multiple performers and both hand streams.
- Exact rational offsets and subdivisions.
- Compound time signatures and grouping.
- Optional identifier absent versus present and empty.
- SPECIAL text with Unicode, punctuation, separators and line breaks.
- ZIP, pass and SPECIAL links.
- Rectangle and polygon layouts, including zero seat counts.
- Structurally complete invalid patterns.
- Malformed framing, missing sections, wrong section order and unsupported versions.
- Invalid references, invalid escapes, wrong UTF8 byte lengths and truncated records.
- Deterministic encode and decode canonical stability.
- Rejection of P1, P2 and unknown format versions.

A third party decoder must be able to decode the worked example and the shared conformance fixtures without reading the POINTS source code.
