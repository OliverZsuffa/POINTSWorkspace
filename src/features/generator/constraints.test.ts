import { describe, expect, it } from 'vitest';
import { asActionEntryId, asLinkId } from '../../domain/ids';
import type { Sequence, SequenceFragment } from '../../domain/model';
import { rational } from '../../domain/time/rational';
import { representativeSoloSequence } from '../../fixtures/sequences';
import { allBeatsUsed, matchesFragment, preservesBaseSequence, satisfiesActionRequirements } from './constraints';

describe('generator constraints', () => {
  it('keeps every base beat and existing notation entry immutable', () => {
    const base = representativeSoloSequence;
    const addition = {
      id: asActionEntryId('added-empty'),
      performerId: base.performers[0]!.id,
      hand: 'left' as const,
      time: { beatId: base.beats[0]!.id, offset: rational(0) },
      action: { type: 'EMPTY' as const },
    };
    const completed: Sequence = { ...base, notation: [...base.notation, addition] };
    expect(preservesBaseSequence(base, completed)).toBe(true);

    const changed: Sequence = {
      ...completed,
      notation: completed.notation.map((entry) => entry.id === base.notation[0]!.id
        ? { ...entry, time: { ...entry.time, beatId: base.beats[1]!.id } }
        : entry),
    };
    expect(preservesBaseSequence(base, changed)).toBe(false);
  });

  it('matches fragments by contiguous beat position and action structure', () => {
    const sequence = representativeSoloSequence;
    const fragmentBeats = sequence.beats.slice(1, 3);
    const beatIds = new Set(fragmentBeats.map((beat) => beat.id));
    const fragment: SequenceFragment = {
      sequenceType: sequence.sequenceType,
      timeSignature: sequence.timeSignature,
      beats: fragmentBeats,
      performers: sequence.performers,
      positions: sequence.positions,
      notation: sequence.notation.filter((entry) => beatIds.has(entry.time.beatId)),
    };
    expect(matchesFragment(sequence, fragment)).toBe(true);

    const altered = {
      ...fragment,
      notation: fragment.notation.map((entry) => ({ ...entry, action: { type: 'EMPTY' as const } })),
    };
    expect(matchesFragment(sequence, altered)).toBe(false);
  });

  it('enforces action counts and performer scoped requirements', () => {
    const sequence = representativeSoloSequence;
    expect(satisfiesActionRequirements(sequence, {
      looping: 'either',
      actionRequirements: [
        { actionType: 'HOLD', occurrence: 'exact-count', count: 1 },
        { actionType: 'ZIP', occurrence: 'forbidden' },
      ],
      requiredFragments: [],
      forbiddenFragments: [],
    })).toBe(true);
    expect(satisfiesActionRequirements(sequence, {
      looping: 'either',
      actionRequirements: [{ actionType: 'HOLD', occurrence: 'exact-count', count: 2 }],
      requiredFragments: [],
      forbiddenFragments: [],
    })).toBe(false);
  });
  it('counts ZIP symbols as paired transfers and supports both directions', () => {
    const base = representativeSoloSequence;
    const [firstBeat, secondBeat] = base.beats;
    expect(firstBeat).toBeDefined();
    expect(secondBeat).toBeDefined();
    const firstLink = asLinkId('zip-left-to-right');
    const secondLink = asLinkId('zip-right-to-left');
    const zipEntries = [
      { id: asActionEntryId('zip-a-source'), performerId: base.performers[0]!.id, hand: 'left' as const, time: { beatId: firstBeat!.id, offset: rational(0) }, action: { type: 'ZIP' as const, role: 'source' as const, linkId: firstLink } },
      { id: asActionEntryId('zip-a-receiver'), performerId: base.performers[0]!.id, hand: 'right' as const, time: { beatId: firstBeat!.id, offset: rational(0) }, action: { type: 'ZIP' as const, role: 'receiver' as const, linkId: firstLink } },
      { id: asActionEntryId('zip-b-source'), performerId: base.performers[0]!.id, hand: 'right' as const, time: { beatId: secondBeat!.id, offset: rational(0) }, action: { type: 'ZIP' as const, role: 'source' as const, linkId: secondLink } },
      { id: asActionEntryId('zip-b-receiver'), performerId: base.performers[0]!.id, hand: 'left' as const, time: { beatId: secondBeat!.id, offset: rational(0) }, action: { type: 'ZIP' as const, role: 'receiver' as const, linkId: secondLink } },
    ];
    const sequence: Sequence = { ...base, notation: zipEntries };
    expect(satisfiesActionRequirements(sequence, {
      looping: 'either',
      actionRequirements: [{ actionType: 'ZIP', occurrence: 'exact-count', count: 2 }],
      zipTransferCount: 2,
      requiredFragments: [],
      forbiddenFragments: [],
    })).toBe(true);
    expect(satisfiesActionRequirements(sequence, {
      looping: 'either',
      actionRequirements: [{ actionType: 'ZIP', occurrence: 'exact-count', count: 4 }],
      requiredFragments: [],
      forbiddenFragments: [],
    })).toBe(false);
  });

  it('rejects a beat where both hands are EMPTY or have no action', () => {
    const base = representativeSoloSequence;
    const performerId = base.performers[0]!.id;
    const firstBeat = base.beats[0]!;
    const used = {
      id: asActionEntryId('used-left'),
      performerId,
      hand: 'left' as const,
      time: { beatId: firstBeat.id, offset: rational(0) },
      action: { type: 'HOLD' as const },
    };
    expect(allBeatsUsed({ ...base, notation: [used] })).toBe(false);
    const filled = base.beats.map((beat) => ({
      id: asActionEntryId('hold-' + beat.id),
      performerId,
      hand: 'left' as const,
      time: { beatId: beat.id, offset: rational(0) },
      action: { type: 'HOLD' as const },
    }));
    expect(allBeatsUsed({ ...base, notation: filled })).toBe(true);
    const emptyBeat = { ...filled[0]!, action: { type: 'EMPTY' as const } };
    expect(allBeatsUsed({ ...base, notation: [emptyBeat, ...filled.slice(1)] })).toBe(false);
  });

});
