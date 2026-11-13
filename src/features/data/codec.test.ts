import { describe, expect, it } from 'vitest';
import { sequenceCodec } from './codec';
import {
  invalidInitialStateSequence,
  representativeIndividualPassingSequence,
  representativeSoloSequence,
} from '../../fixtures/sequences';

describe('sequence code', () => {
  it.each([representativeSoloSequence, representativeIndividualPassingSequence, invalidInitialStateSequence])(
    'round trips complete sequence data',
    (sequence) => {
      const code = sequenceCodec.encode(sequence);
      expect(code.startsWith('P1.')).toBe(true);
      expect(code).not.toContain('{');
      const result = sequenceCodec.decode(code);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.sequence).toEqual(sequence);
    },
  );

  it('rejects damaged codes without producing partial sequences', () => {
    expect(sequenceCodec.decode('P1.not-valid').ok).toBe(false);
    expect(sequenceCodec.decode('not a code')).toMatchObject({ ok: false, code: 'malformed' });
  });

  it('reports unsupported versions separately', () => {
    expect(sequenceCodec.decode('P2.abc')).toMatchObject({ ok: false, code: 'unsupported-version' });
  });

  it('uses a deterministic representation', () => {
    expect(sequenceCodec.encode(representativeSoloSequence)).toBe(sequenceCodec.encode(representativeSoloSequence));
  });
});
