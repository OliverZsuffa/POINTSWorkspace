# P5 Compact Sequence Code

## Status

Normative specification for the approved P5 implementation. P5 replaces P4 completely. P1, P2, P3 and P4 are unsupported by the P5 decoder.

## 1. Design

P5 is a self contained, lossless, deterministic stream. It uses a continuous alphanumeric code with one structural period separating metadata from action streams. The tilde is reserved for escaped UTF8 bytes inside text values.

P5 contains no JSON, Base64 payload, encryption, UUIDs, internal object keys, implicit defaults or lossy compression.

## 2. Character alphabet

The ordinary alphabet is ASCII letters and digits.

Reserved characters:

| Character | Meaning |
|---|---|
| `P5` | Version marker |
| `.` | Single boundary between metadata and action streams |
| `t` | Length prefixed text marker |
| `~` | Escaped UTF8 byte inside text |
| `e` | Empty beat run marker |
| `p`, `n` | Positive or negative rational marker |

The parser is contextual. A token is interpreted according to the field currently being read. The code does not use punctuation as a field separator.

## 3. Compact unsigned integers

Counts and local indices use a custom self delimiting integer representation.

* Values 0 through 25 are represented by uppercase letters A through Z, where A is zero.
* For values 26 and above, subtract 26, divide the result by 26, write the quotient as ordinary decimal digits, then write the remainder as an uppercase letter A through Z.
* The final uppercase letter terminates the integer.
* Extended forms have no leading zeroes.

Examples:

| Value | Code |
|---:|---|
| 0 | `A` |
| 1 | `B` |
| 4 | `E` |
| 25 | `Z` |
| 26 | `0A` |
| 27 | `0B` |
| 51 | `0Z` |
| 52 | `1A` |
| 120 | `3Q` |

This is not standard base 36. A decoder must reject noncanonical forms and values outside the safe integer range.

## 4. Text values

Text is UTF8 and length prefixed.

* A single ASCII letter or digit other than lowercase `t` is written directly.
* Every other value is written as lowercase `t`, followed by the UTF8 byte length as a compact unsigned integer, followed by the encoded bytes.
* ASCII letters and digits in the payload are written directly.
* Every other byte is written as `~` followed by exactly two uppercase hexadecimal digits.
* The byte length counts decoded UTF8 bytes, not visible code characters.

Examples:

| Text | Code |
|---|---|
| `A` | `A` |
| `Juggler 1` | `tJJuggler~201` |
| Empty string | `tA` |
| Literal lowercase `t` | `tBt` |
| `Clap, Ω` | `tIClap~2C~20~CE~A9` |

Optional text uses a presence marker. `0` means absent. `1` followed by a text value means present. An absent identifier and an explicitly empty identifier therefore remain distinct.

Malformed UTF8, invalid escapes, truncated payloads and incorrect byte lengths are rejected.

## 5. Numeric values

Persisted JavaScript numbers are represented as text containing the canonical ECMAScript decimal representation. This includes BPM, time signature values, grouping values, circle distance, table dimensions and seat indices.

The special numeric value negative zero is represented by the text `-0`. Nonfinite numbers are not encodable.

Collection counts, array indices and local references use compact unsigned integers instead.

## 6. Exact rational values

Rationals are represented without floating point conversion.

* Exact zero with denominator one is `0`.
* Every other rational is a sign marker, unsigned numerator magnitude and positive unsigned denominator.
* `p` indicates a nonnegative numerator. `n` indicates a negative numerator.
* A zero numerator with a denominator other than one uses `p` and retains its denominator.

Examples:

| Rational | Code |
|---|---|
| 0/1 | `0` |
| 1/1 | `pBB` |
| 1/2 | `pBC` |
| 3/2 | `pDC` |
| -1/2 | `nBC` |

Numerator and denominator must be safe integers. Denominator must be positive. Values are not reduced during decoding.

## 7. Header field order

The header begins with `P5` and one sequence type character:

* `S`: solo
* `C`: circle passing
* `I`: individual passing

Fields then appear in this exact order:

1. BPM as a numeric text value.
2. Time signature numerator as a numeric text value.
3. Time signature denominator as a numeric text value.
4. Beat grouping count as a compact integer, followed by each grouping value as numeric text.
5. Main beat count as a compact integer.
6. Performer count as a compact integer, followed by performer records.
7. Position count as a compact integer, followed by position records.
8. Ball count as a compact integer.
9. Initial placement count and placement records.
10. Subdivision records, grouped by main beat.
11. Individual passing layout code.
12. Table layout record.
13. Seat assignment count and seat records.
14. One period.
15. Action streams.

The header has no implicit defaults. Every field is present, including zero counts and absent optional values.

### 7.1 Performer records

Each performer record contains:

1. Name text.
2. Identifier presence marker.
3. Identifier text when the marker is `1`.

Performer indices are assigned by array order, starting at zero.

### 7.2 Position records

A table position is:

* `T`
* Position name text.
* `S` for shared ownership, or `P` followed by performer index.

A hand back position is:

* `B`
* Displayed hand back name, `L` or `R`.
* Performer index.
* Associated hand, `L` or `R`.

Position indices are assigned by array order.

### 7.3 Objects and initial placements

Ball identities are reconstructed as local indices in ball array order. The header stores ball count, placement count and each placement.

Each placement begins with ball index, followed by one location:

* `P` plus position index for an object on a position.
* `H` plus performer index and hand for a finger held object.
* `B` plus position index, performer index and hand for a hand back placement.

Placement order is preserved. Structurally complete but semantically invalid placements remain representable.

### 7.4 Beat duration kind

For every discrete beat in order, write exactly one character:

- `R`: regular beat.
- `H`: half beat.

There are no nested subdivision records or per beat counts. A half beat is a complete beat and retains the same notation and validation semantics as a regular beat.

### 7.5 Passing and table layout

Individual passing layout:

* `N`: absent.
* `S`: shared positions.
* `P`: per performer positions.

Table layout:

* `S`: solo.
* `P` followed by numeric side count: polygon.
* `R` followed by numeric long side seat count and numeric short side seat count: rectangle.

Each seat assignment contains performer index and one seat:

* `P` followed by numeric polygon edge index.
* `R` followed by rectangle side code and numeric seat index.

Rectangle side codes are 0 long-a, 1 long-b, 2 short-a and 3 short-b.

## 8. Action streams

After the one period, streams follow in fixed order:

1. Performer 0 left hand.
2. Performer 0 right hand.
3. Performer 1 left hand.
4. Performer 1 right hand.
5. Continue in performer order.

There are exactly two streams per performer. Each stream contains exactly the declared number of main beat cells.

A beat cell begins with its event count. A zero count is encoded as `A`. An empty run of two or more consecutive beats is encoded as lowercase `e` followed by its run length. The run must not exceed the remaining beat count.

A nonempty beat cell is its event count followed by that many events.

### 8.1 Event structure

Each event contains:

1. Original notation array ordinal as a compact integer.
2. Exact offset rational.
3. Action token.
4. Action parameters.

Ordinals are unique and contiguous from zero. They restore the original notation array ordering after events have been read from performer and hand streams.

### 8.2 Action tokens

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

An optional link is `0` when absent, or `1` followed by local link index. ZIP always contains a link index.

Link indices are assigned by first occurrence of each distinct LinkId in original notation array order. Every occurrence of one link uses the same index.

### 8.3 Targets

* Table position: `p` followed by position index.
* Circle position: `c`, position A/B/C, direction code, distance presence marker and optional distance numeric text.
* Individual pass source: `s` followed by performer index.
* Individual pass recipient hand: `r` followed by performer index and hand L/R.

Circle direction codes are 0 absent, 1 left and 2 right. Distance marker is 0 absent or 1 followed by numeric text. Direction and distance are independently optional.

### 8.4 ZIP and SPECIAL

ZIP is `Z`, followed by `S` for source or `R` for receiver, then the required local link index.

SPECIAL is `S`, followed by text, then its optional link marker and index.

## 9. Canonical encoding

A conforming encoder:

* Preserves performer, position, ball, beat, beat duration kind, placement and seat array order.
* Assigns local indices from the corresponding array order.
* Emits left then right stream for each performer.
* Emits beat cells in ascending beat order.
* Emits events in original notation array order.
* Assigns link indices by first occurrence in notation array order.
* Uses canonical compact integers and canonical text escaping.
* Preserves exact numeric and rational values.
* Emits exactly one structural period.

A conforming decoder rejects trailing data, invalid references, noncanonical forms, malformed text, invalid counts, truncated streams and resource limit violations. It never returns a partial sequence.

Internal IDs are regenerated locally. All semantic relationships and ordering are retained.

## 10. Resource limits

The decoder rejects codes longer than 1,000,000 characters. It rejects any collection count, beat count, performer count, position count, ball count, placement count, seat count or per beat event count greater than 100,000. Implementations should apply limits before allocating arrays.

## 11. Field coverage

| Sequence field | P5 representation |
|---|---|
| Sequence type | Header type character |
| BPM | Numeric text |
| Time signature numerator and denominator | Numeric text |
| Beat grouping | Count and numeric text values |
| Beats | Main beat count |
| Performers | Name and optional identifier records |
| Positions | Position records and owner references |
| Balls | Ball count |
| Initial state | Ordered placement records |
| Beat duration kind | One `R` or `H` marker per beat |
| Notation performer and hand | Stream order |
| Notation beat | Beat cell index |
| Notation offset | Exact rational |
| Notation action and parameters | Action token and payload |
| Original notation ordering | Event ordinal |
| Link relationships | Shared local link index |
| Individual passing layout | Header code |
| Table layout | Header record |
| Seat assignments | Ordered seat records |

## 12. Conformance

For every supported sequence, decoding its encoded code must reconstruct a semantically equivalent sequence. Encoding a decoded canonical code must reproduce the identical code.

P5 decoding is independent of the React interface and notation validator. A structurally complete sequence that violates notation rules is still decoded. The existing validator remains responsible for reporting notation errors.

P4 codes are not accepted by the P5 decoder. Failed imports do not mutate the current editor sequence.
