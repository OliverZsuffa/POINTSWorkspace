import { describe, expect, it } from 'vitest';
import type { GeneratorRequest } from '../../domain/model';
import { representativeSoloSequence } from '../../fixtures/sequences';
import { candidateKey, sequenceGenerator } from './engine';

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
    maxSearchNodes: 5000,
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
      maxSearchNodes: 5000,
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
    expect(candidates[0]?.notation).toHaveLength(2);
  });
  it('generates CLAP as exactly two linked SPECIAL entries and no standalone SPECIAL', async () => {
    const base = representativeSoloSequence;
    const candidates = [];
    const clapRequest: GeneratorRequest = {
      ...request('from-scratch'),
      templateSequence: { ...base, notation: [] },
      constraints: {
        looping: 'either',
        actionRequirements: [{ actionType: 'SPECIAL', occurrence: 'exact-count', count: 2 }],
        requiredFragments: [],
        forbiddenFragments: [],
      },
      maxSearchNodes: 20_000,
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
      templateSequence: { ...base, notation: [], initialState },
      initialState,
      constraints: {
        looping: 'either',
        actionRequirements: [],
        zipTransferCount: 2,
        requiredFragments: [],
        forbiddenFragments: [],
      },
      maxSearchNodes: 100_000,
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

});
