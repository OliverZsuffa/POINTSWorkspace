import { describe, expect, it } from 'vitest';
import { createSequenceShareUrl, getSequenceCodeFromUrl } from './share-link';

describe('sequence share URLs', () => {
  it('reads a code from the URL fragment', () => {
    expect(getSequenceCodeFromUrl('https://example.com/POINTSWorkspace/#code=P4StD12044E'))
      .toBe('P4StD12044E');
  });

  it('returns null when the URL has no code parameter', () => {
    expect(getSequenceCodeFromUrl('https://example.com/POINTSWorkspace/')).toBeNull();
    expect(getSequenceCodeFromUrl('https://example.com/POINTSWorkspace/#settings')).toBeNull();
  });

  it('preserves an explicitly empty code so the decoder can report it as invalid', () => {
    expect(getSequenceCodeFromUrl('https://example.com/POINTSWorkspace/#code=')).toBe('');
  });

  it('creates a share URL while preserving the application path and query', () => {
    const result = createSequenceShareUrl(
      'https://example.com/POINTSWorkspace/?source=copy',
      'P4StD12044E',
    );
    expect(result).toBe('https://example.com/POINTSWorkspace/?source=copy#code=P4StD12044E');
  });

  it('encodes code characters safely and round trips them', () => {
    const code = 'P4StD12044E~20.ABC';
    const shareUrl = createSequenceShareUrl('https://example.com/POINTSWorkspace/', code);
    expect(getSequenceCodeFromUrl(shareUrl)).toBe(code);
  });

  it('replaces an existing fragment rather than creating ambiguous parameters', () => {
    const shareUrl = createSequenceShareUrl('https://example.com/#old=fragment', 'P4ABC');
    expect(new URL(shareUrl).hash).toBe('#code=P4ABC');
    expect(getSequenceCodeFromUrl(shareUrl)).toBe('P4ABC');
  });

  it('returns null for an invalid URL', () => {
    expect(getSequenceCodeFromUrl('not a URL')).toBeNull();
  });
});
