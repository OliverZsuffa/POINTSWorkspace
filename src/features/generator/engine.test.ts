import { describe, expect, it } from 'vitest';
import { asActionEntryId, asLinkId } from '../../domain/ids';
import type { GeneratorRequest } from '../../domain/model';
import { representativeSoloSequence } from '../../fixtures/sequences';
import { candidateKey, generateFlourishes, isAbstractStateValid, sequenceGenerator } from './engine';
import { simulateSequence } from '../../domain/state';

function request(mode: GeneratorRequest['mode']): GeneratorRequest {
  const sequence = representativeSoloSequence;
  return {
    mode,
    sequenceTypes: [sequence.sequenceType],
    templateSequence: sequence,
    ...(mode === 'complete-base' ? { baseSequence: sequence } : {}),
    beatCount: sequence.beats.length,
    performerCount: sequence.performers.length,
    objectCount: sequence.balls.length,
    availablePositions: sequence.positions,
    timeSignature: sequence.timeSignature,
    initialState: sequence.initialState,
    maxResults: 1,
    maxSearchNodes: 100_000,
    constraints: {
      looping: 'either',
      actionRequirements: mode === 'from-scratch'
        ? [{ actionType: 'LIFT', occurrence: 'at-least-once' }]
        : [{ actionType: 'EMPTY', occurrence: 'at-least-once' }],
      requiredActionPerPerformer: mode === 'from-scratch' ? 'LIFT' : undefined,
      requiredFragments: [],
      forbiddenFragments: [],
    },
  };
}

describe('sequence generator', () => {
  it('generates a valid sequence from a blank template', async () => {
    const candidates = [];
    for await (const candidate of sequenceGenerator.generate(request('from-scratch'))) candidates.push(candidate.sequence);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.notation.some((entry) => entry.action.type === 'LIFT')).toBe(true);
  });

  it('generates executable core sequences containing LEAVE when required', async () => {
    const base = representativeSoloSequence;
    const leaveRequest: GeneratorRequest = {
      ...request('from-scratch'),
      templateSequence: { ...base, beats: base.beats.slice(0, 3), notation: [] },
      beatCount: 3,
      locationMode: 'abstract',
      constraints: {
        looping: 'either',
        actionRequirements: [{ actionType: 'LEAVE', occurrence: 'at-least-once' }],
        requiredFragments: [],
        forbiddenFragments: [],
      },
      maxResults: 1,
    };
    const candidates = [];
    for await (const candidate of sequenceGenerator.generate(leaveRequest)) candidates.push(candidate.sequence);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]!.notation.some((entry) => entry.action.type === 'LEAVE')).toBe(true);
    expect(simulateSequence(candidates[0]!).validation.isValid).toBe(true);
  });

  it('completes a base without changing any existing action or beat', async () => {
    const base = representativeSoloSequence;
    const candidates = [];
    for await (const candidate of sequenceGenerator.generate(request('complete-base'))) candidates.push(candidate.sequence);
    expect(candidates).toHaveLength(1);
    const result = candidates[0]!;
    expect(result.beats).toEqual(base.beats);
    for (const entry of base.notation) {
      expect(result.notation.find((item) => item.id === entry.id)).toEqual(entry);
    }
    expect(result.notation.length).toBeGreaterThan(base.notation.length);
  });

  it('treats cyclic rotations as duplicates only when loop canonicalization is enabled', () => {
    const sequence = representativeSoloSequence;
    const rotated = {
      ...sequence,
      beats: [...sequence.beats.slice(1), sequence.beats[0]!],
      notation: sequence.notation,
    };
    expect(candidateKey(sequence, true)).toBe(candidateKey(rotated, true));
    expect(candidateKey(sequence, false)).not.toBe(candidateKey(rotated, false));
  });

  it('stops promptly when its abort signal is already cancelled', async () => {
    const controller = new AbortController();
    controller.abort();
    const candidates = [];
    for await (const candidate of sequenceGenerator.generate(request('from-scratch'), controller.signal)) candidates.push(candidate);
    expect(candidates).toHaveLength(0);
  });

  it('does not confuse one added action with a one action base', async () => {
    const sequence = {
      ...representativeSoloSequence,
      notation: [representativeSoloSequence.notation[0]!],
    };
    const baseRequest: GeneratorRequest = {
      mode: 'complete-base',
      sequenceTypes: [sequence.sequenceType],
      templateSequence: sequence,
      baseSequence: sequence,
      beatCount: sequence.beats.length,
      performerCount: sequence.performers.length,
      objectCount: sequence.balls.length,
      availablePositions: sequence.positions,
      timeSignature: sequence.timeSignature,
      initialState: sequence.initialState,
      maxResults: 1,
      maxSearchNodes: 100_000,
      constraints: {
        looping: 'either',
        actionRequirements: [{ actionType: 'EMPTY', occurrence: 'at-least-once' }],
        requiredFragments: [],
        forbiddenFragments: [],
      },
    };
    const candidates = [];
    for await (const candidate of sequenceGenerator.generate(baseRequest)) candidates.push(candidate.sequence);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.notation.length).toBeGreaterThan(2);
    expect(candidates[0]?.notation.some((entry) => entry.action.type === 'EMPTY')).toBe(true);
  });
  it('generates CLAP as exactly two linked SPECIAL entries and no standalone SPECIAL', async () => {
    const base = representativeSoloSequence;
    const candidates = [];
    const clapRequest: GeneratorRequest = {
      ...request('from-scratch'),
      templateSequence: { ...base, notation: [] },
      locationMode: 'abstract',
      constraints: {
        looping: 'either',
        actionRequirements: [{ actionType: 'SPECIAL', occurrence: 'exact-count', count: 2 }],
        requiredFragments: [],
        forbiddenFragments: [],
      },
      maxSearchNodes: 100_000,
    };
    for await (const candidate of sequenceGenerator.generate(clapRequest)) {
      candidates.push(candidate.sequence);
    }
    expect(candidates).toHaveLength(1);
    const clapEntries = candidates[0]!.notation.filter((entry) => entry.action.type === 'SPECIAL');
    expect(clapEntries).toHaveLength(2);
    expect(clapEntries.every((entry) => entry.action.type === 'SPECIAL' && entry.action.text === 'Clap')).toBe(true);
    expect(new Set(clapEntries.map((entry) => entry.action.type === 'SPECIAL' ? entry.action.linkId : undefined)).size).toBe(1);
  });

  it('finds two ZIP transfers when the second one must reverse direction', async () => {
    const base = representativeSoloSequence;
    const performerId = base.performers[0]!.id;
    const initialState = {
      placements: [{
        ballId: base.balls[0]!.id,
        location: { kind: 'hand-held' as const, performerId, hand: 'left' as const },
      }],
    };
    const zipRequest: GeneratorRequest = {
      ...request('from-scratch'),
      templateSequence: { ...base, beats: base.beats.slice(0, 2), notation: [], initialState },
      beatCount: 2,
      initialState,
      constraints: {
        looping: 'either',
        actionRequirements: [],
        zipTransferCount: 2,
        requiredFragments: [],
        forbiddenFragments: [],
      },
      maxSearchNodes: 20_000,
    };
    const candidates = [];
    for await (const candidate of sequenceGenerator.generate(zipRequest)) {
      candidates.push(candidate.sequence);
    }
    expect(candidates).toHaveLength(1);
    const result = candidates[0]!;
    const zipSources = result.notation
      .filter((entry) => entry.action.type === 'ZIP' && entry.action.role === 'source')
      .sort((left, right) => base.beats.findIndex((beat) => beat.id === left.time.beatId) -
        base.beats.findIndex((beat) => beat.id === right.time.beatId));
    expect(zipSources).toHaveLength(2);
    expect(zipSources.map((entry) => entry.hand)).toEqual(['left', 'right']);
  });

  it('generates abstract structures before expanding concrete position choices', async () => {
    const base = representativeSoloSequence;
    const generationRequest: GeneratorRequest = {
      ...request('from-scratch'),
      templateSequence: { ...base, notation: [] },
      locationMode: 'abstract',
      maxResults: 1,
      maxSearchNodes: 100_000,
    };
    const structures = [];
    for await (const candidate of sequenceGenerator.generate(generationRequest)) {
      structures.push(candidate.sequence);
    }
    expect(structures).toHaveLength(1);
    const abstractTargets = structures[0]!.notation.filter((entry) =>
      entry.action.type === 'LIFT' || entry.action.type === 'LEAVE' ||
      entry.action.type === 'TAP' || entry.action.type === 'BOUNCE',
    );
    expect(abstractTargets.length).toBeGreaterThan(0);
    expect(structures[0]!.notation.every((entry) => entry.action.type !== 'TAP' && entry.action.type !== 'BOUNCE' && !(entry.action.type === 'SPECIAL' && entry.action.text === 'Clap'))).toBe(true);
    expect(abstractTargets.every((entry) =>
      entry.action.type === 'LIFT' || entry.action.type === 'LEAVE' ||
      entry.action.type === 'TAP' || entry.action.type === 'BOUNCE'
        ? entry.action.target.kind === 'position' && entry.action.target.positionId === base.positions[0]!.id
        : true,
    )).toBe(true);

    const concrete = [];
    for await (const candidate of sequenceGenerator.expandLocations(base, generationRequest)) {
      concrete.push(candidate.sequence);
    }
    expect(concrete).toHaveLength(1);
    expect(concrete[0]!.notation.some((entry) =>
      (entry.action.type === 'LIFT' || entry.action.type === 'LEAVE' ||
        entry.action.type === 'TAP' || entry.action.type === 'BOUNCE') &&
      entry.action.target.kind === 'position',
    )).toBe(true);
  });

  it('accepts a linked CLAP with otherwise valid empty-hand actions', () => {
    const base = representativeSoloSequence;
    const performer = base.performers[0]!;
    const clapLink = asLinkId('abstract-clap');
    const notation = [
      ...(['left', 'right'] as const).map((hand) => ({
        id: asActionEntryId('abstract-clap-' + hand),
        performerId: performer.id,
        hand,
        time: { beatId: base.beats[0]!.id, offset: { numerator: 0, denominator: 1 } },
        action: { type: 'SPECIAL' as const, text: 'Clap', linkId: clapLink },
      })),
      ...base.beats.slice(1).map((beat, index) => ({
        id: asActionEntryId('abstract-tap-' + index),
        performerId: performer.id,
        hand: 'left' as const,
        time: { beatId: beat.id, offset: { numerator: 0, denominator: 1 } },
        action: { type: 'TAP' as const, target: { kind: 'position' as const, positionId: base.positions[0]!.id } },
      })),
    ];
    expect(isAbstractStateValid({ ...base, notation })).toBe(true);
  });

  it('rejects an abstract structure made entirely of HOLD when hands start empty', () => {
    const base = representativeSoloSequence;
    const sequence = {
      ...base,
      initialState: { placements: [] },
      notation: base.beats.flatMap((beat) => base.performers.flatMap((performer) =>
        (['left', 'right'] as const).map((hand) => ({
          id: ('hold-' + beat.id + '-' + hand) as typeof base.notation[number]['id'],
          performerId: performer.id,
          hand,
          time: { beatId: beat.id, offset: { numerator: 0, denominator: 1 } },
          action: { type: 'HOLD' as const },
        })),
      )),
    };
    expect(isAbstractStateValid(sequence)).toBe(false);
  });

  it('accepts HOLD after an abstract LIFT has picked up an available object', () => {
    const base = representativeSoloSequence;
    const firstBeat = base.beats[0]!;
    const secondBeat = base.beats[1]!;
    const performer = base.performers[0]!;
    const position = base.positions.find((item) => item.kind === 'table')!;
    const sequence = {
      ...base,
      beats: [firstBeat, secondBeat],
      notation: [
        {
          id: 'abstract-lift' as typeof base.notation[number]['id'],
          performerId: performer.id,
          hand: 'left' as const,
          time: { beatId: firstBeat.id, offset: { numerator: 0, denominator: 1 } },
          action: { type: 'LIFT' as const, target: { kind: 'position' as const, positionId: position.id } },
        },
        {
          id: 'abstract-hold' as typeof base.notation[number]['id'],
          performerId: performer.id,
          hand: 'left' as const,
          time: { beatId: secondBeat.id, offset: { numerator: 0, denominator: 1 } },
          action: { type: 'HOLD' as const },
        },
      ],
    };
    expect(isAbstractStateValid(sequence)).toBe(true);
  });

  it('rejects abstract LEAVE when the hand does not hold an object', () => {
    const base = representativeSoloSequence;
    const beat = base.beats[0]!;
    const performer = base.performers[0]!;
    const position = base.positions.find((item) => item.kind === 'table')!;
    const sequence = {
      ...base,
      notation: [{
        id: 'abstract-leave' as typeof base.notation[number]['id'],
        performerId: performer.id,
        hand: 'left' as const,
        time: { beatId: beat.id, offset: { numerator: 0, denominator: 1 } },
        action: { type: 'LEAVE' as const, target: { kind: 'position' as const, positionId: position.id } },
      }],
    };
    expect(isAbstractStateValid(sequence)).toBe(false);
  });

  it('creates optional flourish variants and keeps the core sequence', () => {
    const core = representativeSoloSequence;
    const variants = generateFlourishes(core);
    expect(variants[0]).toBe(core);
    expect(variants.length).toBeGreaterThan(1);
    expect(variants.every((variant) => simulateSequence(variant).validation.isValid)).toBe(true);
    expect(variants.some((variant) => variant.notation.some((entry) => entry.action.type === 'BOUNCE'))).toBe(true);
    expect(variants.some((variant) => variant.notation.some((entry) => entry.action.type === 'TAP'))).toBe(true);
    expect(variants.some((variant) => variant.notation.filter((entry) => entry.action.type === 'TAP' || entry.action.type === 'BOUNCE' || (entry.action.type === 'SPECIAL' && entry.action.text === 'Clap')).length >= 2)).toBe(true);
  });

});
