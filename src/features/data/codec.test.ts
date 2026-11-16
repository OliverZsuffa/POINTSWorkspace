import { describe, expect, it } from 'vitest';
import { sequenceCodec } from './codec';
import { rational } from '../../domain/time/rational';
import { asActionEntryId, asBallId } from '../../domain/ids';
import type { Sequence } from '../../domain/model';
import {
  invalidInitialStateSequence,
  representativeIndividualPassingSequence,
  representativeNotationExamples,
  representativeSoloSequence,
} from '../../fixtures/sequences';

function semanticShape(sequence: Sequence) {
  const performer = (id: string) => sequence.performers.findIndex((item) => item.id === id);
  const position = (id: string) => sequence.positions.findIndex((item) => item.id === id);
  const ball = (id: string) => sequence.balls.findIndex((item) => item.id === id);
  const beat = (id: string) => sequence.beats.findIndex((item) => item.id === id);
  const links = [...new Set(sequence.notation.flatMap(({ action }) =>
    'linkId' in action && action.linkId !== undefined ? [action.linkId] : [],
  ))];
  const target = (value: Extract<Sequence['notation'][number]['action'], { type: 'LIFT' | 'LEAVE' | 'BOUNCE' | 'TAP' }>['target']) => {
    if (value.kind === 'position') return { kind: value.kind, position: position(value.positionId) };
    if (value.kind === 'circle-position') return { ...value };
    if (value.kind === 'pass-source') return { kind: value.kind, performer: performer(value.performerId) };
    return { kind: value.kind, performer: performer(value.performerId), hand: value.hand };
  };
  const action = (value: Sequence['notation'][number]['action']) => {
    switch (value.type) {
      case 'HOLD':
      case 'EMPTY': return { type: value.type };
      case 'LIFT':
      case 'LEAVE': return { type: value.type, target: target(value.target), link: value.linkId === undefined ? undefined : links.indexOf(value.linkId) };
      case 'BOUNCE':
      case 'TAP': return { type: value.type, target: target(value.target) };
      case 'ZIP': return { type: value.type, role: value.role, link: links.indexOf(value.linkId) };
      case 'SPECIAL': return { type: value.type, text: value.text, link: value.linkId === undefined ? undefined : links.indexOf(value.linkId) };
    }
  };
  const location = (value: Sequence['initialState']['placements'][number]['location']) => {
    if (value.kind === 'position') return { kind: value.kind, position: position(value.positionId) };
    if (value.kind === 'hand-held') return { kind: value.kind, performer: performer(value.performerId), hand: value.hand };
    return { kind: value.kind, position: position(value.positionId), performer: performer(value.performerId), hand: value.hand };
  };
  return {
    sequenceType: sequence.sequenceType,
    bpm: sequence.bpm,
    timeSignature: sequence.timeSignature,
    performers: sequence.performers.map(({ name, identifier }) => ({ name, identifier })),
    positions: sequence.positions.map((item) => item.kind === 'table'
      ? { kind: item.kind, name: item.name, owner: item.owner.kind === 'shared' ? { kind: 'shared' } : { kind: 'performer', performer: performer(item.owner.performerId) } }
      : { kind: item.kind, name: item.name, performer: performer(item.performerId), hand: item.hand }),
    ballCount: sequence.balls.length,
    placements: sequence.initialState.placements.map((item) => ({ ball: ball(item.ballId), location: location(item.location) })),
    beats: sequence.beats.map((item) => item.durationKind ?? 'regular'),
    notation: sequence.notation.map((item) => ({
      performer: performer(item.performerId), hand: item.hand, beat: beat(item.time.beatId),
      offset: item.time.offset, action: action(item.action),
    })),
    individualPassingLayout: sequence.individualPassingLayout,
    tableLayout: sequence.tableLayout,
    seatAssignments: sequence.seatAssignments.map(({ performerId, seat }) => ({ performer: performer(performerId), seat })),
  };
}

describe('P5 compact sequence code', () => {
  it.each([representativeSoloSequence, representativeIndividualPassingSequence, invalidInitialStateSequence])(
    'round trips every persisted semantic field',
    (sequence) => {
      const code = sequenceCodec.encode(sequence);
      expect(code.startsWith('P5')).toBe(true);
      expect(code).not.toMatch(/\\s/);
      expect(code.split('.')).toHaveLength(2);
      const decoded = sequenceCodec.decode(code);
      expect(decoded.ok).toBe(true);
      if (decoded.ok) {
        expect(semanticShape(decoded.sequence)).toEqual(semanticShape(sequence));
        expect(sequenceCodec.encode(decoded.sequence)).toBe(code);
      }
    },
  );

  it('keeps the approved two ball four beat example compact', () => {
    const base = representativeSoloSequence;
    const performer = base.performers[0]!;
    const first = base.positions.find((item) => item.kind === 'table' && item.name === 'A')!;
    const last = base.positions.find((item) => item.kind === 'table' && item.name === 'C')!;
    const sequence: Sequence = {
      ...base,
      performers: [{ ...performer, identifier: 'a' }],
      positions: base.positions,
      balls: [{ id: asBallId('ball-one') }, { id: asBallId('ball-two') }],
      beats: base.beats.map((beat) => ({ ...beat, durationKind: 'regular' })),
      initialState: { placements: [
        { ballId: asBallId('ball-one'), location: { kind: 'position', positionId: first.id } },
        { ballId: asBallId('ball-two'), location: { kind: 'position', positionId: last.id } },
      ] },
      notation: [
        { id: asActionEntryId('p4-lift'), performerId: performer.id, hand: 'left', time: { beatId: base.beats[0]!.id, offset: rational(0) }, action: { type: 'LIFT', target: { kind: 'position', positionId: first.id } } },
        { id: asActionEntryId('p4-hold-one'), performerId: performer.id, hand: 'left', time: { beatId: base.beats[1]!.id, offset: rational(0) }, action: { type: 'HOLD' } },
        { id: asActionEntryId('p4-hold-two'), performerId: performer.id, hand: 'left', time: { beatId: base.beats[2]!.id, offset: rational(0) }, action: { type: 'HOLD' } },
        { id: asActionEntryId('p4-leave'), performerId: performer.id, hand: 'left', time: { beatId: base.beats[3]!.id, offset: rational(0) }, action: { type: 'LEAVE', target: { kind: 'position', positionId: first.id } } },
      ],
    };
    const code = sequenceCodec.encode(sequence);
    expect(code.length).toBeLessThanOrEqual(110);
    const decoded = sequenceCodec.decode(code);
    expect(decoded.ok).toBe(true);
    if (decoded.ok) expect(semanticShape(decoded.sequence)).toEqual(semanticShape(sequence));
  });

  it('encodes the recognisable action initials', () => {
    const sequence = { ...representativeSoloSequence, notation: [...representativeSoloSequence.notation, ...representativeNotationExamples] };
    const code = sequenceCodec.encode(sequence);
    for (const action of ['H', 'L', 'V', 'B', 'T', 'E', 'Z', 'S']) expect(code).toContain(action);
    const decoded = sequenceCodec.decode(code);
    expect(decoded.ok).toBe(true);
    if (decoded.ok) expect(semanticShape(decoded.sequence)).toEqual(semanticShape(sequence));
  });

  it('preserves unicode text, punctuation and explicit empty identifiers', () => {
    const sequence: Sequence = {
      ...representativeSoloSequence,
      performers: [{ ...representativeSoloSequence.performers[0]!, name: 'A, (B) ~ Ω 🥎', identifier: '' }],
      notation: [{ ...representativeSoloSequence.notation[0]!, action: { type: 'SPECIAL', text: 'Clap, Ω ~ (done)' } }],
    };
    const decoded = sequenceCodec.decode(sequenceCodec.encode(sequence));
    expect(decoded.ok).toBe(true);
    if (decoded.ok) {
      expect(decoded.sequence.performers[0]).toMatchObject({ name: 'A, (B) ~ Ω 🥎', identifier: '' });
      expect(decoded.sequence.notation[0]?.action).toEqual({ type: 'SPECIAL', text: 'Clap, Ω ~ (done)' });
    }
  });

  it('preserves exact rational offsets and half beat duration', () => {
    const sequence: Sequence = {
      ...representativeSoloSequence,
      beats: representativeSoloSequence.beats.map((beat, index) => index === 1 ? { ...beat, durationKind: 'half' as const } : beat),
      notation: [{ ...representativeSoloSequence.notation[0]!, time: { ...representativeSoloSequence.notation[0]!.time, offset: rational(1, 3) } }],
    };
    const decoded = sequenceCodec.decode(sequenceCodec.encode(sequence));
    expect(decoded.ok).toBe(true);
    if (decoded.ok) expect(semanticShape(decoded.sequence)).toEqual(semanticShape(sequence));
  });

  it('preserves fractional numeric values and invalid but complete values', () => {
    const sequence: Sequence = {
      ...representativeSoloSequence,
      bpm: -120,
      timeSignature: { numerator: 4.5, denominator: 4, beatGrouping: [1.5, 2.5] },
      tableLayout: { type: 'rectangle', longSideSeatCount: 1.5, shortSideSeatCount: 0 },
    };
    const decoded = sequenceCodec.decode(sequenceCodec.encode(sequence));
    expect(decoded.ok).toBe(true);
    if (decoded.ok) expect(semanticShape(decoded.sequence)).toEqual(semanticShape(sequence));
  });

  it('round trips an empty sequence without adding records', () => {
    const sequence: Sequence = {
      ...representativeSoloSequence, performers: [], positions: [], balls: [], beats: [],
      initialState: { placements: [] }, notation: [], seatAssignments: [],
    };
    const decoded = sequenceCodec.decode(sequenceCodec.encode(sequence));
    expect(decoded.ok).toBe(true);
    if (decoded.ok) expect(semanticShape(decoded.sequence)).toEqual(semanticShape(sequence));
  });

  it('rejects malformed, truncated and trailing data', () => {
    const code = sequenceCodec.encode(representativeSoloSequence);
    expect(sequenceCodec.decode('not a code')).toMatchObject({ ok: false, code: 'malformed' });
    expect(sequenceCodec.decode('P4anything')).toMatchObject({ ok: false, code: 'unsupported-version' });
    expect(sequenceCodec.decode(code.slice(0, -1)).ok).toBe(false);
    expect(sequenceCodec.decode(code + 'A').ok).toBe(false);
    expect(sequenceCodec.decode(code.replace('.', '..')).ok).toBe(false);
  });

  it('rejects unsupported versions and keeps decoding deterministic', () => {
    expect(sequenceCodec.decode('P9anything')).toMatchObject({ ok: false, code: 'unsupported-version' });
    const code = sequenceCodec.encode(representativeSoloSequence);
    expect(sequenceCodec.encode(representativeSoloSequence)).toBe(code);
    expect(sequenceCodec.decode(code)).toMatchObject({ ok: true });
  });

  it('keeps event ordinals stable across both hand streams', () => {
    const code = sequenceCodec.encode(representativeSoloSequence);
    const decoded = sequenceCodec.decode(code);
    expect(decoded.ok).toBe(true);
    if (decoded.ok) {
      expect(decoded.sequence.notation.map(({ action }) => action.type))
        .toEqual(representativeSoloSequence.notation.map(({ action }) => action.type));
    }
  });
});
