import { describe, expect, it } from 'vitest';
import { sequenceCodec } from './codec';
import { rational } from '../../domain/time/rational';
import { createTimeSignature } from '../../domain/time/time-signature';
import type { LeaveActionTarget, LiftActionTarget, Sequence, TableActionTarget } from '../../domain/model';
import {
  invalidInitialStateSequence,
  representativeIndividualPassingSequence,
  representativeNotationExamples,
  representativeSoloSequence,
} from '../../fixtures/sequences';


function semanticShape(sequence: Sequence) {
  const performerIndex = (id: string) => sequence.performers.findIndex((item) => item.id === id);
  const positionIndex = (id: string) => sequence.positions.findIndex((item) => item.id === id);
  const ballIndex = (id: string) => sequence.balls.findIndex((item) => item.id === id);
  const beatIndex = (id: string) => sequence.beats.findIndex((item) => item.id === id);
  const links = [...new Set(sequence.notation.flatMap(({ action }) => 'linkId' in action && action.linkId ? [action.linkId] : []))];
  const linkIndex = (id: (typeof links)[number] | undefined) => id === undefined ? undefined : links.indexOf(id);
  const target = (value: LiftActionTarget | LeaveActionTarget | TableActionTarget) => {
    if (value.kind === 'position') return { kind: value.kind, position: positionIndex(value.positionId as string) };
    if (value.kind === 'circle-position') return { ...value };
    if (value.kind === 'pass-source') return { kind: value.kind, performer: performerIndex(value.performerId as string) };
    if (value.kind === 'pass-recipient-hand') return { kind: value.kind, performer: performerIndex(value.performerId), hand: value.hand };
    throw new Error('Unknown target kind');
  };
  const action = (value: Sequence['notation'][number]['action']) => {
    switch (value.type) {
      case 'HOLD':
      case 'EMPTY':
        return { type: value.type };
      case 'LIFT':
      case 'LEAVE':
        return { type: value.type, target: target(value.target), link: linkIndex(value.linkId) };
      case 'BOUNCE':
      case 'TAP':
        return { type: value.type, target: target(value.target) };
      case 'ZIP':
        return { type: value.type, role: value.role, link: linkIndex(value.linkId) };
      case 'SPECIAL':
        return { type: value.type, text: value.text, link: linkIndex(value.linkId) };
    }
  };
  const location = (value: Sequence['initialState']['placements'][number]['location']) => {
    if (value.kind === 'position') return { kind: value.kind, position: positionIndex(value.positionId) };
    if (value.kind === 'hand-held') return { kind: value.kind, performer: performerIndex(value.performerId), hand: value.hand };
    return { kind: value.kind, position: positionIndex(value.positionId), performer: performerIndex(value.performerId), hand: value.hand };
  };
  return {
    sequenceType: sequence.sequenceType,
    timeSignature: sequence.timeSignature,
    bpm: sequence.bpm,
    performers: sequence.performers.map(({ name, identifier }) => ({ name, identifier })),
    positions: sequence.positions.map((value) => value.kind === 'table'
      ? { kind: value.kind, name: value.name, owner: value.owner.kind === 'shared' ? { kind: 'shared' } : { kind: 'performer', performer: performerIndex(value.owner.performerId) } }
      : { kind: value.kind, name: value.name, performer: performerIndex(value.performerId), hand: value.hand }),
    ballCount: sequence.balls.length,
    initialState: sequence.initialState.placements.map(({ ballId, location: value }) => ({ ball: ballIndex(ballId), location: location(value) })),
    beats: sequence.beats.map(({ subdivisions }) => subdivisions.map(({ start, duration, depth }) => ({ start, duration, depth }))),
    notation: sequence.notation.map(({ performerId, hand, time, action: value }) => ({
      performer: performerIndex(performerId), hand, beat: beatIndex(time.beatId), offset: time.offset, action: action(value),
    })),
    individualPassingLayout: sequence.individualPassingLayout,
    tableLayout: sequence.tableLayout,
    seatAssignments: sequence.seatAssignments.map(({ performerId, seat }) => ({ performer: performerIndex(performerId), seat })),
  };
}

describe('readable sequence code', () => {
  it.each([representativeSoloSequence, representativeIndividualPassingSequence, invalidInitialStateSequence])(
    'round trips semantic sequence data',
    (sequence) => {
      const code = sequenceCodec.encode(sequence);
      expect(code.startsWith('P3;')).toBe(true);
      expect(code).not.toContain('{');
      expect(code).not.toContain('[');
      expect(code).not.toContain(']');
      expect(code).not.toContain('"');
      expect(code).not.toContain('sequence-solo-example');
      const result = sequenceCodec.decode(code);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(semanticShape(result.sequence)).toEqual(semanticShape(sequence));
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


  it('encodes standard settings and both hands explicitly', () => {
    const code = sequenceCodec.encode(representativeSoloSequence);
    expect(code).toContain(';120;');
    expect(code).toContain(';4.4.1+1+1+1;');
    expect(code).toContain(';4;');
    expect(code).toContain(';n;s;');
    expect(code).toContain(';L:');
    expect(code).toContain(',R:');
  });

  it('matches the published canonical solo example', () => {
    expect(sequenceCodec.encode(representativeSoloSequence)).toBe(
      'P3;s;120;4.4.1+1+1+1;4;~9:Juggler%201.-;T.~1:A.p0,T.~1:B.p0,T.~1:C.p0,B.L.0.L,B.R.0.R;1;0.P.0;1.0.1/2.1,1.1/2.1/2.1;L:-3|3.0.T.p2,R:0.0.L.p0.-|1.0.H|2.0.V.p1.-|-;n;s;',
    );
  });

  it('keeps action initials visible in the code', () => {
    const sequence = { ...representativeSoloSequence, notation: [...representativeSoloSequence.notation, ...representativeNotationExamples] };
    const code = sequenceCodec.encode(sequence);
    for (const action of ['L', 'H', 'V', 'T', 'B', 'E', 'Z', 'S']) {
      expect(code).toMatch(new RegExp(`\\.${action}(?:\\.|\\+|,|;|\\|)`));
    }
    const decoded = sequenceCodec.decode(code);
    expect(decoded.ok).toBe(true);
    if (decoded.ok) expect(sequenceCodec.encode(decoded.sequence)).toBe(code);
    expect(sequenceCodec.decode(code.replace('.Z.S.l0', '.Z.S.l99')).ok).toBe(false);
  });

  it('round trips circle targets, polygon seats and relative distance', () => {
    const performer = representativeSoloSequence.performers[0]!;
    const sequence = {
      ...representativeSoloSequence,
      sequenceType: 'circle-passing' as const,
      tableLayout: { type: 'polygon' as const, sideCount: 2 },
      seatAssignments: [{ performerId: performer.id, seat: { kind: 'polygon-edge' as const, edgeIndex: 1 } }],
      notation: [
        {
          ...representativeSoloSequence.notation[0]!,
          action: { type: 'LIFT' as const, target: { kind: 'circle-position' as const, position: 'A' as const } },
        },
        {
          ...representativeSoloSequence.notation[1]!,
          action: {
            type: 'LEAVE' as const,
            target: { kind: 'circle-position' as const, position: 'C' as const, direction: 'right' as const, distance: 2 },
          },
        },
      ],
    };
    const code = sequenceCodec.encode(sequence);
    const decoded = sequenceCodec.decode(code);
    expect(decoded.ok).toBe(true);
    if (decoded.ok) {
      expect(decoded.sequence.notation.map(({ action }) => action)).toEqual(sequence.notation.map(({ action }) => action));
      expect(decoded.sequence.tableLayout).toEqual(sequence.tableLayout);
      expect(decoded.sequence.seatAssignments[0]?.seat).toEqual(sequence.seatAssignments[0]?.seat);
      expect(sequenceCodec.encode(decoded.sequence)).toBe(code);
    }
  });

  it('preserves rectangular layouts with no seats on the short sides', () => {
    const sequence = {
      ...representativeIndividualPassingSequence,
      tableLayout: { type: 'rectangle' as const, longSideSeatCount: 1, shortSideSeatCount: 0 },
    };
    const decoded = sequenceCodec.decode(sequenceCodec.encode(sequence));
    expect(decoded.ok).toBe(true);
    if (decoded.ok) expect(semanticShape(decoded.sequence)).toEqual(semanticShape(sequence));
  });

  it('preserves inconsistent but fully referenced hand back placements', () => {
    const position = representativeSoloSequence.positions.find((item) => item.kind === 'hand-back');
    if (!position || position.kind !== 'hand-back') throw new Error('Missing hand back fixture position');
    const sequence = {
      ...representativeSoloSequence,
      initialState: {
        placements: [{
          ballId: representativeSoloSequence.balls[0]!.id,
          location: {
            kind: 'hand-back' as const,
            positionId: position.id,
            performerId: position.performerId,
            hand: position.hand === 'left' ? 'right' as const : 'left' as const,
          },
        }],
      },
    };
    const decoded = sequenceCodec.decode(sequenceCodec.encode(sequence));
    expect(decoded.ok).toBe(true);
    if (decoded.ok) expect(semanticShape(decoded.sequence)).toEqual(semanticShape(sequence));
  });

  it('round trips empty sequence collections without inventing entries', () => {
    const sequence = {
      ...representativeSoloSequence,
      performers: [],
      positions: [],
      balls: [],
      beats: [],
      initialState: { placements: [] },
      notation: [],
      seatAssignments: [],
    };
    const decoded = sequenceCodec.decode(sequenceCodec.encode(sequence));
    expect(decoded.ok).toBe(true);
    if (decoded.ok) expect(semanticShape(decoded.sequence)).toEqual(semanticShape(sequence));
  });

  it('preserves structurally complete but invalid timing values', () => {
    const sequence = {
      ...representativeSoloSequence,
      bpm: -120,
      timeSignature: { numerator: 6, denominator: 8 as const, beatGrouping: [2, 2] },
    };
    const decoded = sequenceCodec.decode(sequenceCodec.encode(sequence));
    expect(decoded.ok).toBe(true);
    if (decoded.ok) expect(semanticShape(decoded.sequence)).toEqual(semanticShape(sequence));
  });

  it('preserves compound time signatures and beat grouping', () => {
    const sequence = {
      ...representativeSoloSequence,
      timeSignature: createTimeSignature(6, 8, [3, 3]),
    };
    const decoded = sequenceCodec.decode(sequenceCodec.encode(sequence));
    expect(decoded.ok).toBe(true);
    if (decoded.ok) {
      expect(decoded.sequence.timeSignature).toEqual({ numerator: 6, denominator: 8, beatGrouping: [3, 3] });
      expect(semanticShape(decoded.sequence)).toEqual(semanticShape(sequence));
    }
  });

  it('round trips hand back placements and fractional action offsets', () => {
    const handBackPosition = representativeSoloSequence.positions.find((position) => position.kind === 'hand-back');
    if (!handBackPosition || handBackPosition.kind !== 'hand-back') throw new Error('Missing hand back fixture position');
    const sequence = {
      ...representativeSoloSequence,
      initialState: {
        placements: [{
          ballId: representativeSoloSequence.balls[0]!.id,
          location: {
            kind: 'hand-back' as const,
            positionId: handBackPosition.id,
            performerId: handBackPosition.performerId,
            hand: handBackPosition.hand,
          },
        }],
      },
      notation: [{
        ...representativeSoloSequence.notation[0]!,
        time: { ...representativeSoloSequence.notation[0]!.time, offset: rational(1, 2) },
      }],
    };
    const code = sequenceCodec.encode(sequence);
    const decoded = sequenceCodec.decode(code);
    expect(decoded.ok).toBe(true);
    if (decoded.ok) {
      expect(decoded.sequence.initialState.placements[0]?.location).toMatchObject({
        kind: 'hand-back',
        hand: 'left',
      });
      expect(decoded.sequence.notation[0]?.time.offset).toEqual(rational(1, 2));
      expect(sequenceCodec.encode(decoded.sequence)).toBe(code);
    }
  });

  it('preserves an explicitly empty performer identifier', () => {
    const sequence = {
      ...representativeSoloSequence,
      performers: [{ ...representativeSoloSequence.performers[0]!, identifier: '' }],
    };
    const decoded = sequenceCodec.decode(sequenceCodec.encode(sequence));
    expect(decoded.ok).toBe(true);
    if (decoded.ok) expect(decoded.sequence.performers[0]).toHaveProperty('identifier', '');
  });

  it('escapes delimiters and reserved characters in user supplied text', () => {
    const sequence = {
      ...representativeSoloSequence,
      performers: [{ ...representativeSoloSequence.performers[0]!, name: 'A, (B) ~ 100% Ω 🥎\nSecond line' }],
      notation: [{
        ...representativeSoloSequence.notation[0]!,
        action: { type: 'SPECIAL' as const, text: 'Clap, (turn) ~ 100% Ω 🥎\nSecond line' },
      }],
    };
    const code = sequenceCodec.encode(sequence);
    const decoded = sequenceCodec.decode(code);
    expect(decoded.ok).toBe(true);
    if (decoded.ok) {
      expect(decoded.sequence.performers[0]?.name).toBe('A, (B) ~ 100% Ω 🥎\nSecond line');
      expect(decoded.sequence.notation[0]?.action).toEqual({ type: 'SPECIAL', text: 'Clap, (turn) ~ 100% Ω 🥎\nSecond line' });
    }
  });

  it('rejects damaged codes without producing partial sequences', () => {
    expect(sequenceCodec.decode('P3;not-valid').ok).toBe(false);
    expect(sequenceCodec.decode('not a code')).toMatchObject({ ok: false, code: 'malformed' });
  });

  it('rejects malformed action tuples, unknown actions and invalid references', () => {
    const code = sequenceCodec.encode(representativeSoloSequence);
    expect(sequenceCodec.decode(code.replace('.H', '.H.0')).ok).toBe(false);
    expect(sequenceCodec.decode(code.replace('.H', '.Q')).ok).toBe(false);
    expect(sequenceCodec.decode(code.replace('.p0.', '.p99.')).ok).toBe(false);
  });

  it('preserves structurally complete circle targets even when their optional fields are invalid', () => {
    const sequence = {
      ...representativeSoloSequence,
      sequenceType: 'circle-passing' as const,
      notation: [{
        ...representativeSoloSequence.notation[0]!,
        action: { type: 'LIFT' as const, target: { kind: 'circle-position' as const, position: 'A' as const } },
      }],
    };
    const code = sequenceCodec.encode(sequence);
    expect(code.includes('cA_-_-')).toBe(true);
    const directionOnlyCode = code.replace('cA_-_-', 'cA_R_-');
    const directionOnly = sequenceCodec.decode(directionOnlyCode);
    expect(directionOnly.ok).toBe(true);
    if (directionOnly.ok) {
      expect(directionOnly.sequence.notation[0]?.action).toMatchObject({
        type: 'LIFT',
        target: { kind: 'circle-position', position: 'A', direction: 'right' },
      });
    }
    const distanceOnlyCode = code.replace('cA_-_-', 'cA_-_2');
    const distanceOnly = sequenceCodec.decode(distanceOnlyCode);
    expect(distanceOnly.ok).toBe(true);
    if (distanceOnly.ok) {
      expect(distanceOnly.sequence.notation[0]?.action).toMatchObject({
        type: 'LIFT',
        target: { kind: 'circle-position', position: 'A', distance: 2 },
      });
    }
  });

  it('does not support superseded P1 or P2 formats', () => {
    expect(sequenceCodec.decode('P1.anything')).toMatchObject({ ok: false, code: 'unsupported-version' });
    expect(sequenceCodec.decode('P2.anything')).toMatchObject({ ok: false, code: 'unsupported-version' });
  });

  it('reports unknown formats separately', () => {
    expect(sequenceCodec.decode('P9;abc')).toMatchObject({ ok: false, code: 'unsupported-version' });
  });

  it('uses a deterministic representation', () => {
    expect(sequenceCodec.encode(representativeSoloSequence)).toBe(sequenceCodec.encode(representativeSoloSequence));
  });
});
