import { describe, expect, it } from 'vitest';
import { asBeatId } from '../../domain/ids';
import { rational } from '../../domain/time/rational';
import type { Beat } from '../../domain/model';
import { getTimelineSlots } from './timeline';

describe('editor timeline', () => {
  it('creates exactly one notation slot for every discrete beat', () => {
    const beats: Beat[] = [
      { id: asBeatId('beat-1') },
      { id: asBeatId('beat-2'), durationKind: 'half' },
      { id: asBeatId('beat-3') },
    ];
    expect(getTimelineSlots(beats)).toEqual([
      { beatId: beats[0]!.id, offset: rational(0), duration: rational(1), label: '1' },
      { beatId: beats[1]!.id, offset: rational(0), duration: rational(1), label: '2' },
      { beatId: beats[2]!.id, offset: rational(0), duration: rational(1), label: '3' },
    ]);
  });

  it('does not create additional notation columns for a half beat', () => {
    const beat: Beat = { id: asBeatId('half'), durationKind: 'half' };
    expect(getTimelineSlots([beat])).toHaveLength(1);
    expect(getTimelineSlots([beat])[0]?.offset).toEqual(rational(0));
  });
});
