import type { Sequence } from '../../domain/model';
import {
  representativeIndividualPassingSequence,
  representativeSoloSequence,
} from '../../fixtures/sequences';

export interface SequencePreset {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly sequence: Sequence;
}

export const sequencePresets: readonly SequencePreset[] = [
  {
    id: 'solo-basics',
    name: 'Solo basics',
    description: 'A short solo sequence demonstrating LIFT, HOLD, LEAVE and TAP.',
    sequence: representativeSoloSequence,
  },
  {
    id: 'individual-pass',
    name: 'Individual passing',
    description: 'Two performers exchanging an object with a linked pass.',
    sequence: representativeIndividualPassingSequence,
  },
];

export function searchPresets(query: string): readonly SequencePreset[] {
  const term = query.trim().toLocaleLowerCase();
  if (!term) return sequencePresets;
  return sequencePresets.filter((preset) =>
    (preset.name + ' ' + preset.description).toLocaleLowerCase().includes(term),
  );
}
