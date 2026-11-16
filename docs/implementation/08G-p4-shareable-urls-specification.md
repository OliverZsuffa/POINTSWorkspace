# P4 Shareable URLs

## URL format

A sequence can be shared by placing its complete P4 code in the URL fragment:

```text
https://oliverzsuffa.github.io/POINTSWorkspace/#code=P4...
```

The fragment is intentionally used instead of a query parameter. Browsers do not send URL fragments to the hosting server, so GitHub Pages needs no special routing or server handling. The browser URL API handles encoding and decoding.

## Loading behavior

On application startup:

1. If the URL contains a `code` fragment parameter, decode it with the P4 codec.
2. Restore the current tab's saved sequence before considering the shared sequence.
3. If the saved sequence contains notation entries, show the same confirmation dialogue as manual code import. Only replace the saved sequence if the user accepts. Cancelling leaves the saved sequence unchanged.
4. A saved sequence with no notation entries is empty and does not count as saved progress. A valid share link loads directly without asking for confirmation when there is no saved sequence or the saved sequence is empty.
5. If the code is invalid or unsupported, show an error and retain the current tab's locally saved sequence. Do not overwrite local persistence with the default sequence.
6. Keep the fragment in the address bar. Reloading or reopening the URL repeats the same decision, so a link is never silently reapplied over nonempty saved progress.

If the URL has no `code` parameter, the existing per tab local restoration behavior is unchanged.

## Creating a share link

The Sequence panel includes a **Copy share link** action. It encodes the currently open sequence using the existing P4 codec and copies a URL containing that code.

If clipboard access is unavailable or denied, the application displays the complete URL in a read only selectable field.

The URL is generated from the current sequence at the time the action is used. Editing the sequence later does not silently rewrite the address bar. Generate a new share link to share those later edits.

## Limitations

- The URL contains the complete sequence and requires no server storage or account.
- URL length limits vary by browser and by the messaging or website used to share the link. Very large patterns may not be practical to share this way.
- The URL fragment is not a security or privacy boundary. Anyone with the link can read and decode the sequence.
- Only the current P4 format is supported.
