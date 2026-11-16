# P4 Compact Sequence Code: Grammar Design Proposal

## Status

Design proposal for review. This document is not implementation approval.

The redesign plan was approved. This proposal develops one concrete grammar and compares it with a more visibly delimited alternative. No production codec changes are included.

## 1. Design decision

The preferred candidate is a compact, mostly alphanumeric stream with one structural separator between metadata and action streams.

A representative code should look like this:

```text
P4StD12044E1111EBtJJuggler~2011aFTAPATBPATCPABLALBRARCCAPABPCEAAAANSA.BA0LpA0BB0HBC0HBD0VpA0eE
```

This is a complete encoding of the existing two ball, four beat solo example. It is 94 characters long.

The same sequence is 149 characters in P3. The candidate is therefore 55 characters shorter, a reduction of approximately 37 percent.

The code contains one structural period separating the header from the action streams. The tilde is used only to escape a non alphanumeric byte inside user supplied text. There are no spaces, brackets, commas, colons or repeated separators.

This is a design candidate, not a final normative format. The grammar and examples below are intended to make the next review concrete.

## 2. Candidate properties

- Version marker: `P4`.
- Main alphabet: ASCII letters and digits.
- Structural punctuation: one period between header and action streams.
- Text escape marker: tilde, followed by two hexadecimal digits for each escaped UTF8 byte.
- Action initials remain visible: `H L V B T E Z S`.
- Shared metadata is written once.
- Every performer has a left stream followed by a right stream.
- Every stream contains exactly the declared number of beat cells.
- Each beat cell begins with its event count.
- Empty beat runs use a compact run token.
- Local indices replace internal UUIDs and object IDs.
- No implicit defaults, encryption, lossy compression, JSON or Base64 payload.

## 3. Lexical rules

### 3.1 Version and tags

The first two characters are `P4`.

Single letter tags identify record kinds and value types. Parsing is contextual. For example, `B` can be a hand back position tag, an action token, or an integer digit depending on which grammar production is currently being read. This is unambiguous because every field has a known type and order.

Uppercase letters are used as terminal digits in the integer encoding. Lowercase letters are reserved for type tags and control tokens. Action tokens remain uppercase.

### 3.2 Compact unsigned integers

Unsigned integers use a compact self delimiting representation with a decimal continuation prefix and a base 26 terminal letter.

- Values 0 through 25 are represented by one uppercase letter: `A` is 0, `B` is 1, through `Z` for 25.
- For values 26 and above, subtract 26, divide by 26, write the quotient in ordinary decimal digits, then write the remainder as an uppercase letter using the same A equals zero mapping.
- The final uppercase letter terminates the integer. The following field can therefore begin immediately.

Examples:

| Decimal value | Code |
|---:|---|
| 0 | `A` |
| 1 | `B` |
| 4 | `E` |
| 9 | `J` |
| 25 | `Z` |
| 26 | `0A` |
| 27 | `0B` |
| 51 | `0Z` |
| 52 | `1A` |
| 120 | `3Q` |

The decimal prefix for extended values contains no leading zeroes. The terminal uppercase letter makes the token self delimiting. This is a custom compact integer code, not standard base 36 notation. Decoders must reject noncanonical representations.

The representation supports the full safe integer range. A decoder must still enforce the documented resource limits before allocating arrays.

### 3.3 Signed integers and rational values

A signed integer is `p` followed by an unsigned magnitude, or `n` followed by an unsigned magnitude. Zero is represented by the single character `0`.

A rational value is:
- `0` for exactly zero.
- Otherwise, a sign marker followed by the unsigned numerator magnitude and the positive denominator.

Examples:

| Rational value | Code |
|---|---|
| 0 | `0` |
| 1 | `pBB` |
| 1/2 | `pBC` |
| 3/2 | `pDC` |
| -1/2 | `nBC` |

The numerator and denominator are exact safe integers. Decoding must not use floating point conversion. The decoder preserves the exact stored numerator and denominator.

### 3.4 Text values

Text is UTF8 and length prefixed. A text value uses one of these forms:

- A single ASCII alphanumeric character other than lowercase `t` is represented directly.
- Every other text value begins with `t`, followed by the UTF8 byte length as an unsigned integer, followed by the encoded bytes.

Within the payload, ASCII letters and digits are written directly. Every other byte is written as tilde followed by exactly two uppercase hexadecimal digits. This includes spaces, punctuation, percent signs, tilde itself and all bytes of non ASCII characters.

The length is the number of decoded UTF8 bytes, not the number of visible code characters. A decoder reads escaped bytes until exactly that many decoded bytes have been produced, then validates UTF8.

Examples:

| Original text | Code |
|---|---|
| `A` | `A` |
| `Juggler 1` | `tJJuggler~201` |
| `Clap, Ω` | `tIClap~2C~20~CE~A9` |
| Empty string | `tA` |
| Literal lowercase `t` | `tBt` |

This keeps ordinary names compact while preserving arbitrary Unicode and punctuation exactly.

Optional text uses an explicit presence marker. `0` means absent. `1` followed by a text value means present. Thus an absent identifier and a present empty identifier remain different.

### 3.5 Numeric decimals

Every persisted JavaScript number is represented using its canonical decimal text inside the text encoding, whether it is an integer or a fraction. This includes BPM, time signature values, grouping values, subdivision depth, circle distance and layout or seat dimensions. Collection counts and local indices use the compact integer encoding. This distinction is necessary because the current domain model can contain structurally complete but semantically invalid fractional values in several numeric fields. This avoids rounding and preserves the exact ECMAScript number representation used by the current domain model.

For example, BPM 120 is `tD120`. A decimal distance of 2.5 is `tC2~2E5`.

## 4. Header grammar

The header is a fixed order sequence of fields. It has no labels because the order is normative.

```text
P4
sequence type
BPM text
time signature numerator
time signature denominator
group count and group values
main beat count
performer count and performer records
position count and position records
ball count
placement count and placement records
subdivision data for each beat
individual passing layout
table layout
seat assignment count and seat records
```

The actual code contains no line breaks. The one period after the final header field separates the header from the action streams.

### 4.1 Sequence type

- `S`: solo.
- `C`: circle passing.
- `I`: individual passing.

### 4.2 Time signature

Write numerator, denominator, grouping count, then every grouping value.

For example, 4/4 grouped as four quarter note beats is `44E1111`.
6/8 grouped as two dotted quarter note beats is `68C33`.

The main beat count is stored separately. No default time signature or grouping is assumed.

### 4.3 Performers

Write performer count, then each performer in array order:

- Name text.
- Identifier presence marker.
- Identifier text if present.

Performer indices are assigned by record order, starting at zero.

### 4.4 Positions

Write position count, then each position in array order.

Table position:
- `T`
- Position name text.
- `S` for shared ownership, or `P` followed by performer index.

Hand back position:
- `B`
- Displayed hand back name, `L` or `R`.
- Performer index.
- Associated hand, `L` or `R`.

Position indices are assigned by record order.

### 4.5 Balls and initial placements

Write ball count. Ball identities are reconstructed as local indices in array order.

Then write placement count and each placement:
- Ball index.
- Location tag and its parameters.

Location tags:
- `P` plus position index.
- `H` plus performer index and hand for a finger held object.
- `B` plus position index, performer index and hand for a hand back placement.

The decoder preserves duplicate and missing placements when the structure is complete, allowing the normal validator to report semantic errors.

### 4.6 Subdivisions

For each main beat, write the subdivision count followed by its subdivision records in array order.

Each subdivision contains:
- Exact start rational.
- Exact duration rational.
- Depth numeric text.

There is one subdivision count for every main beat, including zero. This preserves empty beats and the exact beat association without repeating beat indices.

### 4.7 Passing and table layout

Individual passing layout:
- `N`: absent.
- `S`: shared positions.
- `P`: per performer positions.

Table layout:
- `S`: solo table.
- `P` followed by numeric side count: polygon.
- `R` followed by numeric long side seat count and numeric short side seat count: rectangle.

Then write seat assignment count and each assignment:
- Performer index.
- `P` plus numeric polygon edge index, or `R` plus rectangle side code and numeric seat index.
- Rectangle side codes are 0 long-a, 1 long-b, 2 short-a and 3 short-b.

## 5. Action stream grammar

After the single header separator period, action streams follow in this exact order:

1. Performer 0 left hand.
2. Performer 0 right hand.
3. Performer 1 left hand.
4. Performer 1 right hand.
5. Continue in performer order.

There are exactly two streams per performer. No stream labels or separators are needed.

Each stream expands to exactly the declared main beat count. Each beat cell starts with its event count. The decoder reads that many events before moving to the next beat cell.

A run of two or more consecutive empty beat cells is written as lowercase `e` followed by the run length. A single empty beat cell is written as an event count of zero, `A`.

This means the decoder can identify every beat boundary without a punctuation separator or a repeated beat number.

### 5.1 Event structure

Each event contains:
1. Original notation array ordinal.
2. Exact rational offset within the beat.
3. Action token.
4. Action parameters, where applicable.

The ordinal preserves the original notation array order across performers and hands. The decoder restores the original notation array by sorting events by this ordinal. Ordinals are unique and contiguous from zero.

### 5.2 Action tokens

| Token | Action | Parameters |
|---|---|---|
| `H` | HOLD | None |
| `L` | LIFT | Target, optional link |
| `V` | LEAVE | Target, optional link |
| `B` | BOUNCE | Target |
| `T` | TAP | Target |
| `E` | EMPTY | None |
| `Z` | ZIP | Role and required link |
| `S` | SPECIAL | Text and optional link |

An optional link is `0` when absent, or `1` followed by the local link index. ZIP always has a link index.

Link indices are assigned by first occurrence of each LinkId in original notation array order. The same index is used for every occurrence of that link.

### 5.3 Targets

- Table position: `p` plus position index.
- Circle position: `c`, position A/B/C, direction code, distance presence marker and distance text if present.
- Individual pass source: `s` plus performer index.
- Individual pass recipient hand: `r` plus performer index and hand L/R.

Circle direction codes are 0 absent, 1 left and 2 right. Distance presence is 0 absent or 1 followed by numeric text. Direction and distance remain independently optional.

### 5.4 ZIP

ZIP uses `Z`, then `S` for source or `R` for receiver, then the required local link index.

### 5.5 SPECIAL

SPECIAL uses `S`, then its text value, then its optional link marker and local link index if present.

## 6. Worked example: two ball solo

This is the same semantic sequence used for the P3 compression comparison: one performer named Juggler 1 with identifier a, four beats, 4/4, two balls initially in positions A and C, LIFT HOLD HOLD LEAVE in the left hand, and an empty right hand.

P4 candidate:

```text
P4StD120EEEBBBBEBtJJuggler~2011aFTAPATBPATCPABLALBRARCCAPABPCEAAAANSA.BA0LpA0BB0HBC0HBD0VpA0eE
```

<text color="secondary" size="sm">94 characters</text>

The P3 code for the identical sequence is 149 characters. P4 is 55 characters shorter, approximately 37 percent.

Reading the action portion after the period:
- `B A 0 L p A 0`: one event, ordinal 0, offset zero, LIFT from position 0, no link.
- `B B 0 H`: one event, ordinal 1, offset zero, HOLD.
- `B C 0 H`: one event, ordinal 2, offset zero, HOLD.
- `B D 0 V p A 0`: one event, ordinal 3, offset zero, LEAVE to position 0, no link.
- `e E`: four empty beat cells in the right hand stream.

The letters are shown separated here only to explain the parsing. They are contiguous in the actual code.

## 7. Worked example: individual passing

This example contains two performers, shared A/B/C positions, one ball held in performer 0's right hand, a rectangular table and two linked passing actions. Performer 0 leaves to performer 1's left hand. Performer 1 lifts from performer 0.

P4 candidate:

```text
P4ItD12044E1111BCtJJuggler~2011atJJuggler~2021bDTASTBSTCSBBAHARBASR11CARA0ABRB0.ABA0VrBLABB0LsAAA
```

<text color="secondary" size="sm">96 characters</text>

The four streams are performer 0 left, performer 0 right, performer 1 left, performer 1 right. Their one beat cells are respectively empty, LEAVE, LIFT and empty. Both passing actions reference the same local link index.

## 8. Additional grammar examples

These fragments illustrate the remaining variable length constructs. They are not standalone complete sequence codes.

| Meaning | Fragment |
|---|---|
| Circle target A, right, distance 2.5 | `cA21tC2~2E5` |
| SPECIAL text `Clap, Ω`, no link | `StIClap~2C~20~CE~A90` |
| Offset 1/2 | `pBC` |
| Subdivision start 1/2, duration 1/2, depth 1 | `pBCpBC1` |
| Polygon table with 5 sides | `P5` |
| Rectangle with 2 long side seats and 1 short side seat | `R21` |
| ZIP source with link index 0 | `ZSA` |
| ZIP receiver with link index 0 | `ZRA` |

## 9. Alternative considered: explicit beat delimiters

A more visually segmented variant could place a punctuation separator between every beat cell and between hand streams.

This is easier to inspect manually, but it repeats punctuation in proportion to the number of beats and performers. In the two ball example it would add at least four more separators to the 94 character candidate. Larger patterns would pay this cost repeatedly.

The preferred candidate instead uses the known beat count, one event count per cell and a fixed stream order. It has only one structural punctuation character in the ordinary case. The decoder remains deterministic because every integer, text value, event and beat cell is self delimiting or count framed.

## 10. Canonical ordering and reconstructed identifiers

- Performer, position, ball, beat, subdivision, placement and seat arrays retain their source order.
- Each performer has left then right stream.
- Beat cells are in ascending beat order.
- Events retain their original notation array ordinal.
- Link indices are assigned by first occurrence in notation array order.
- Internal UUIDs and entity IDs are regenerated.
- Relationships and semantic ordering are preserved.
- Encoding a decoded canonical sequence must reproduce the same code.

## 11. Field coverage

The grammar must represent every persisted Sequence field:

| Domain value | Representation |
|---|---|
| Sequence type | Header type code |
| BPM | Canonical numeric text |
| Time signature numerator and denominator | Header integers |
| Beat grouping | Header count and values |
| Main beat count | Header integer |
| Performer names and identifiers | Performer records |
| Position names, kinds, ownership and hand associations | Position records |
| Ball count | Header integer |
| Initial placements | Placement records |
| Subdivision start, duration and depth | Per beat subdivision records |
| Notation performer and hand | Stream ownership |
| Notation beat | Beat cell position |
| Notation offset and action | Event records |
| Original notation array order | Event ordinal |
| Targets and action parameters | Action payloads |
| Link relationships | Local link indices |
| Individual passing layout | Header code |
| Table layout | Header code |
| Seat assignments | Seat records |

## 12. Decoder and validation requirements

A conforming decoder must:
- Recognise P4 and reject unsupported versions.
- Parse the header in its exact fixed order.
- Validate canonical integer and text encodings.
- Enforce UTF8 byte lengths and reject malformed escapes.
- Reconstruct exactly two streams per performer and exactly the declared number of beat cells per stream.
- Expand empty beat runs without exceeding the declared beat count.
- Validate event ordinals and restore notation array order.
- Resolve every local reference.
- Preserve exact rational values.
- Preserve structurally complete but notation invalid sequences.
- Reject malformed structure, dangling references, truncation, excess trailing data and resource limit violations.
- Return no partial sequence after a decoding failure.
- Never apply application defaults or silently repair data.

Suggested limits remain 1,000,000 encoded characters and 100,000 beats, performers or objects.

## 13. Version replacement

P4 is the proposed replacement. On release, P3 will be removed completely. P3 codes will be unsupported. No compatibility decoder or migration is to be retained unless Oliver explicitly requests it.

The production encoder and decoder must not be changed until this proposal is approved.

## 14. Open review points

1. Is the one period between metadata and action streams acceptable?
2. Is the tilde escape acceptable when user supplied text contains spaces or punctuation?
3. Is the self delimiting integer alphabet understandable enough for independent implementations?
4. Is preserving original notation array order worth the per event ordinal?
5. Is the 94 character two ball example sufficiently compact, or should we prioritise further reduction even if the grammar becomes less readable?
6. Should the candidate keep the visible `P4` marker, or would a shorter marker be preferable?

## 15. Approval boundary

This proposal is for reviewing the grammar and examples only. No production code has been changed.

After review, any requested changes will be incorporated. Implementation starts only after the P4 grammar is explicitly approved.
