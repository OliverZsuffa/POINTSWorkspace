# Implementation 08B: P2 Sequence Codes

## Status

Superseded by P3. P2 was implemented and merged through PR #20, then completely replaced by P3. The current application does not support P2 codes and contains no P2 decoder. This document is retained only as a historical record of the earlier implementation.

The active format and normative independent decoder specification are documented in [08C: Self Contained Human Readable Sequence Codes](08C-self-contained-human-readable-codes.md).

## Replacement policy

There is one active sequence code format at a time. P3 replaces P2 completely. P2 codes are not imported or migrated. Future format revisions also replace the active format unless Oliver explicitly requests compatibility.

## Historical P2 implementation

P2 used a nested tuple grammar with readable action initials and local references. It was a transitional format and is no longer part of the supported application interface.
