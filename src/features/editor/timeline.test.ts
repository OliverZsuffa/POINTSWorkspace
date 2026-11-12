import { describe, expect, it } from 'vitest';
import { asBeatId, asSubdivisionId } from '../../domain/ids';
import { rational } from '../../domain/time/rational';
import type { Beat } from '../../domain/model';
import { getTimelineSlots, splitSubdivision } from './timeline';

const beat: Beat = { id: asBeatId('beat-1'), subdivisions: [] };
let nextId = 0;
const createId = () => asSubdivisionId('sub-' + (++nextId));

describe('editor timeline', () => {
  it('starts with one full beat interval', () => {
    expect(getTimelineSlots([beat])).toEqual([
      { beatId: beat.id, offset: rational(0), duration: rational(1), depth: 0, label: '1' },
    ]);
  });

  it('splits a beat into conventional eighth note positions', () => {
    const split = splitSubdivision(beat, rational(0), rational(1), createId);
    expect(getTimelineSlots([split]).map((slot) => slot.label)).toEqual(['1', '&']);
  });

  it('recursively splits an interval into sixteenth note positions', () => {
    const eighths = splitSubdivision(beat, rational(0), rational(1), createId);
    const first = getTimelineSlots([eighths])[0]!;
    const sixteenths = splitSubdivision(eighths, first.offset, first.duration, createId);
    expect(getTimelineSlots([sixteenths]).map((slot) => slot.label)).toEqual(['1', 'e', '&']);
  });

  it('does not alter a beat when the requested interval does not exist', () => {
    expect(splitSubdivision(beat, rational(1, 2), rational(1, 2), createId)).toBe(beat);
  });
});
