import { describe, expect, it } from 'vitest';
import { sequenceCodec } from './codec';
import {
  invalidInitialStateSequence,
  representativeIndividualPassingSequence,
  representativeNotationExamples,
  representativeSoloSequence,
} from '../../fixtures/sequences';

describe('readable sequence code', () => {
  it.each([representativeSoloSequence, representativeIndividualPassingSequence, invalidInitialStateSequence])(
    'round trips semantic sequence data',
    (sequence) => {
      const code = sequenceCodec.encode(sequence);
      expect(code.startsWith('P2.')).toBe(true);
      expect(code).not.toContain('{');
      expect(code).not.toContain('[');
      expect(code).not.toContain(']');
      expect(code).not.toContain('"');
      expect(code).not.toContain('sequence-solo-example');
      const result = sequenceCodec.decode(code);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.sequence.sequenceType).toBe(sequence.sequenceType);
        expect(result.sequence.bpm).toBe(sequence.bpm);
        expect(result.sequence.timeSignature).toEqual(sequence.timeSignature);
        expect(result.sequence.performers.map(({ name, identifier }) => ({ name, identifier })))
          .toEqual(sequence.performers.map(({ name, identifier }) => ({ name, identifier })));
        expect(result.sequence.notation.map(({ hand, time, action }) => ({
          hand,
          beat: result.sequence.beats.findIndex((beat) => beat.id === time.beatId),
          offset: time.offset,
          action: action.type,
        }))).toEqual(sequence.notation.map(({ hand, time, action }) => ({
          hand,
          beat: sequence.beats.findIndex((beat) => beat.id === time.beatId),
          offset: time.offset,
          action: action.type,
        })));
        expect(sequenceCodec.encode(result.sequence)).toBe(code);
      }
    },
  );

  it('keeps action initials visible in the code', () => {
    const sequence = { ...representativeSoloSequence, notation: [...representativeSoloSequence.notation, ...representativeNotationExamples] };
    const code = sequenceCodec.encode(sequence);
    expect(code).toContain('~L');
    expect(code).toContain('~H');
    expect(code).toContain('~V');
    expect(code).toContain('~T');
    expect(code).toContain('~B');
    expect(code).toContain('~E');
    expect(code).toContain('~Z');
    expect(code).toContain('~S');
    const decoded = sequenceCodec.decode(code);
    expect(decoded.ok).toBe(true);
    if (decoded.ok) expect(sequenceCodec.encode(decoded.sequence)).toBe(code);
    expect(sequenceCodec.decode(code.replace('~Z,~S,0', '~Z,~S,99')).ok).toBe(false);
  });

  it('round trips circle passing targets, including self targets', () => {
    const sequence = {
      ...representativeSoloSequence,
      sequenceType: 'circle-passing' as const,
      notation: [{
        ...representativeSoloSequence.notation[0]!,
        action: { type: 'LIFT' as const, target: { kind: 'circle-position' as const, position: 'A' as const } },
      }],
    };
    const code = sequenceCodec.encode(sequence);
    const decoded = sequenceCodec.decode(code);
    expect(decoded.ok).toBe(true);
    if (decoded.ok) {
      expect(decoded.sequence.notation[0]?.action).toEqual(sequence.notation[0]?.action);
      expect(sequenceCodec.encode(decoded.sequence)).toBe(code);
    }
  });

  it('rejects damaged codes without producing partial sequences', () => {
    expect(sequenceCodec.decode('P2.not-valid').ok).toBe(false);
    expect(sequenceCodec.decode('not a code')).toMatchObject({ ok: false, code: 'malformed' });
  });

  it('does not support the abandoned experimental P1 format', () => {
    expect(sequenceCodec.decode('P1.anything')).toMatchObject({ ok: false, code: 'unsupported-version' });
  });

  it('reports unknown formats separately', () => {
    expect(sequenceCodec.decode('P9.abc')).toMatchObject({ ok: false, code: 'unsupported-version' });
  });

  it('uses a deterministic representation', () => {
    expect(sequenceCodec.encode(representativeSoloSequence)).toBe(sequenceCodec.encode(representativeSoloSequence));
  });
});
