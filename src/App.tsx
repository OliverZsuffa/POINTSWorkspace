import { useMemo, useState, type KeyboardEvent } from 'react';
import {
  asActionEntryId,
  asBallId,
  asBeatId,
  asLinkId,
  asPerformerId,
  asPositionId,
  asSequenceId,
} from './domain/ids';
import type {
  Hand,
  NotationAction,
  NotationEntry,
  ObjectLocation,
  PositionDefinition,
  Sequence,
  SequenceType,
  TableActionTarget,
} from './domain/model';
import { rational } from './domain/time/rational';
import { DEFAULT_TIME_SIGNATURE } from './domain/time/time-signature';
import { simulateSequence } from './domain/state';

let nextId = 1;
const id = (prefix: string) => prefix + '-' + (++nextId).toString(36);
const hands: readonly Hand[] = ['left', 'right'];
const actionNames = ['LIFT', 'HOLD', 'LEAVE', 'BOUNCE', 'TAP', 'EMPTY', 'ZIP', 'SPECIAL'] as const;
type ActionName = (typeof actionNames)[number];
type EditorCell = { performerId: string; hand: Hand; beatId: string };
type ClipboardItem = { entry: NotationEntry; rowOffset: number; beatOffset: number };

function makeSequence(): Sequence {
  const performerId = asPerformerId('performer-1');
  const positions = ['A', 'B', 'C'].map((name) => ({
    kind: 'table' as const,
    id: asPositionId('position-' + name),
    name,
    owner: { kind: 'performer' as const, performerId },
  }));
  const backs = hands.map((hand) => ({
    kind: 'hand-back' as const,
    id: asPositionId('back-' + hand),
    name: (hand === 'left' ? 'L' : 'R') as 'L' | 'R',
    performerId,
    hand,
  }));
  const balls = ['ball-1', 'ball-2'].map((ball) => ({ id: asBallId(ball) }));
  return {
    id: asSequenceId('sequence-main'),
    sequenceType: 'solo',
    timeSignature: DEFAULT_TIME_SIGNATURE,
    bpm: 120,
    beats: Array.from({ length: 8 }, (_, index) => ({
      id: asBeatId('beat-' + (index + 1)),
      subdivisions: [],
    })),
    performers: [{ id: performerId, name: 'Juggler 1', identifier: 'a' }],
    positions: [...positions, ...backs],
    balls,
    initialState: {
      placements: balls.map((ball, index) => ({
        ballId: ball.id,
        location: { kind: 'position' as const, positionId: positions[index === 0 ? 0 : 2]!.id },
      })),
    },
    notation: [],
    tableLayout: { type: 'solo' },
    seatAssignments: [],
  };
}

function positionTargetId(action: NotationAction): ReturnType<typeof asPositionId> | undefined {
  switch (action.type) {
    case 'LIFT':
    case 'LEAVE':
    case 'TAP':
    case 'BOUNCE':
      return action.target.kind === 'position' ? action.target.positionId : undefined;
    default:
      return undefined;
  }
}

function updatePositionTarget(entry: NotationEntry, positionId: ReturnType<typeof asPositionId>): NotationEntry {
  const action = entry.action;
  switch (action.type) {
    case 'LIFT':
    case 'LEAVE':
    case 'TAP':
    case 'BOUNCE':
      return action.target.kind === 'position'
        ? { ...entry, action: { ...action, target: { ...action.target, positionId } } }
        : entry;
    default:
      return entry;
  }
}

function passRecipientTarget(entry: NotationEntry) {
  const action = entry.action;
  return action.type === 'LEAVE' && 'hand' in action.target ? action.target : undefined;
}

function passSourceTarget(entry: NotationEntry) {
  const action = entry.action;
  return action.type === 'LIFT' && 'performerId' in action.target ? action.target : undefined;
}

function positionName(sequence: Sequence, positionId: string): string {
  const position = sequence.positions.find((item) => item.id === positionId);
  return position?.name ?? '?';
}

function actionLabel(action: NotationAction, sequence: Sequence): string {
  switch (action.type) {
    case 'LIFT': {
      if (action.target.kind === 'position') return 'LIFT ' + positionName(sequence, action.target.positionId);
      if (action.target.kind === 'circle-position') return 'LIFT ' + action.target.position + circleSubscript(action.target);
      const target = action.target;
      const targetPerformerId = target.performerId;
      return 'LIFT X' + (sequence.performers.find((person) => person.id === targetPerformerId)?.identifier ?? '?');
    }
    case 'LEAVE': {
      if (action.target.kind === 'position') return 'LEAVE ' + positionName(sequence, action.target.positionId);
      if (action.target.kind === 'circle-position') return 'LEAVE ' + action.target.position + circleSubscript(action.target);
      const target = action.target;
      const targetHand = target.hand;
      const targetPerformerId = target.performerId;
      return 'LEAVE ' + (targetHand === 'left' ? 'L' : 'R') + (sequence.performers.find((person) => person.id === targetPerformerId)?.identifier ?? '?');
    }
    case 'TAP':
    case 'BOUNCE':
      return action.target.kind === 'position'
        ? action.type + ' ' + positionName(sequence, action.target.positionId)
        : action.type + ' ' + action.target.position + circleSubscript(action.target);
    case 'ZIP':
      return 'ZIP ' + (action.role === 'source' ? '↗' : '↙');
    case 'SPECIAL':
      return action.text || 'SPECIAL';
    default:
      return action.type;
  }
}

function makeAction(
  type: ActionName,
  sequence: Sequence,
  linkId?: ReturnType<typeof asLinkId>,
  performerId?: string,
): NotationAction {
  const position = sequence.positions.find((item) => item.kind === 'table' && (item.owner.kind === 'shared' || item.owner.performerId === performerId)) ?? sequence.positions.find((item) => item.kind === 'table');
  const target: TableActionTarget = sequence.sequenceType === 'circle-passing'
    ? { kind: 'circle-position', position: 'A' }
    : { kind: 'position', positionId: position?.id ?? asPositionId('missing-position') };
  switch (type) {
    case 'LIFT': return { type, target };
    case 'LEAVE': return { type, target };
    case 'TAP': return { type, target };
    case 'BOUNCE': return { type, target };
    case 'HOLD': return { type };
    case 'EMPTY': return { type };
    case 'ZIP': return { type, role: 'source', linkId: linkId ?? asLinkId(id('zip')) };
    case 'SPECIAL': return { type, text: 'SPECIAL' };
  }
}


function objectLocationKey(location: ObjectLocation): string {
  switch (location.kind) {
    case 'position': return 'p:' + location.positionId;
    case 'hand-held': return 'h:' + location.performerId + ':' + location.hand;
    case 'hand-back': return 'b:' + location.positionId;
  }
}

function sameLocation(a: ObjectLocation, b: ObjectLocation): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'position' && b.kind === 'position') return a.positionId === b.positionId;
  if (a.kind === 'hand-held' && b.kind === 'hand-held') return a.performerId === b.performerId && a.hand === b.hand;
  if (a.kind === 'hand-back' && b.kind === 'hand-back') return a.positionId === b.positionId;
  return false;
}

function circleSubscript(target: Extract<TableActionTarget, { kind: 'circle-position' }>): string {
  if (!target.direction || !target.distance) return '';
  return (target.distance > 1 ? String(target.distance) : '') + (target.direction === 'left' ? 'L' : 'R');
}

function ActionSymbol({ action, sequence, hand }: { action: NotationAction; sequence: Sequence; hand: Hand }) {
  if (action.type === 'EMPTY') return null;
  if (action.type === 'SPECIAL') return <span className="special-symbol">{action.text || 'SPECIAL'}</span>;
  let path = '';
  let target = '';
  let subscript = '';
  let circledTarget = false;
  switch (action.type) {
    case 'HOLD': path = 'M7 9H41 M7 39H41'; break;
    case 'LIFT':
      path = 'M7 9H41 M7 9V39 M7 39H41';
      if (action.target.kind === 'position') target = positionName(sequence, action.target.positionId);
      else if (action.target.kind === 'circle-position') { target = action.target.position; subscript = circleSubscript(action.target); }
      else if ('performerId' in action.target) { const targetPerformerId = action.target.performerId; target = 'X'; subscript = sequence.performers.find((person) => person.id === targetPerformerId)?.identifier ?? '?'; }
      break;
    case 'LEAVE':
      path = 'M7 9H41 M41 9V39 M7 39H41';
      if (action.target.kind === 'position') target = positionName(sequence, action.target.positionId);
      else if (action.target.kind === 'circle-position') { target = action.target.position; subscript = circleSubscript(action.target); }
      else if ('hand' in action.target) { const targetHand = action.target.hand; const targetPerformerId = action.target.performerId; target = targetHand === 'left' ? 'L' : 'R'; circledTarget = true; subscript = sequence.performers.find((person) => person.id === targetPerformerId)?.identifier ?? '?'; }
      break;
    case 'BOUNCE':
      path = 'M7 9H41 M7 39H41';
      if (action.target.kind === 'position') target = positionName(sequence, action.target.positionId);
      else { target = action.target.position; subscript = circleSubscript(action.target); }
      break;
    case 'TAP':
      if (action.target.kind === 'position') target = positionName(sequence, action.target.positionId);
      else { target = action.target.position; subscript = circleSubscript(action.target); }
      break;
    case 'ZIP':
      path = action.role === 'source'
        ? hand === 'left' ? 'M7 9H41 M41 9V39' : 'M7 39H41 M41 9V39'
        : hand === 'left' ? 'M7 9H41 M7 9V39' : 'M7 39H41 M7 9V39';
      break;
  }
  return (
    <svg className="notation-symbol" viewBox="0 0 48 48" aria-hidden="true">
      <rect x="1.5" y="1.5" width="45" height="45" rx="5" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1.2" />
      <path d={path} fill="none" stroke="#263238" strokeWidth="2.6" strokeLinecap="square" strokeLinejoin="miter" />
      {circledTarget && <circle cx="20" cy="23" r="8" fill="none" stroke="#263238" strokeWidth="1.8" />}
      {target && <text x={subscript ? 20 : 24} y={subscript ? 23 : 24} textAnchor="middle" dominantBaseline="middle" fontFamily="Arial,sans-serif" fontSize={target.length > 2 ? 10 : subscript ? 12 : 15} fill="#263238">{target}{subscript && <tspan fontSize="9" baselineShift="sub">{subscript}</tspan>}</text>}
    </svg>
  );
}

function NotationMark({ action, sequence, hand }: { action: NotationAction; sequence: Sequence; hand: Hand }) {
  if (action.type === 'EMPTY') return null;
  if (action.type === 'SPECIAL') return <span className="special-symbol">{action.text || 'SPECIAL'}</span>;
  if (action.type === 'TAP') return <ActionSymbol action={action} sequence={sequence} hand={hand} />;
  let path = '';
  let label = '';
  let subscript = '';
  let circledTarget = false;
  switch (action.type) {
    case 'LIFT':
      path = 'M0 19H100 M0 19V81 M0 81H100';
      if (action.target.kind === 'position') label = positionName(sequence, action.target.positionId);
      else if (action.target.kind === 'circle-position') { label = action.target.position; subscript = circleSubscript(action.target); }
      else if ('performerId' in action.target) { const targetPerformerId = action.target.performerId; label = 'X'; subscript = sequence.performers.find((person) => person.id === targetPerformerId)?.identifier ?? '?'; }
      break;
    case 'HOLD': path = 'M0 19H100 M0 81H100'; label = 'HOLD'; break;
    case 'LEAVE':
      path = 'M0 19H100 M100 19V81 M0 81H100';
      if (action.target.kind === 'position') label = positionName(sequence, action.target.positionId);
      else if (action.target.kind === 'circle-position') { label = action.target.position; subscript = circleSubscript(action.target); }
      else if ('hand' in action.target) { const targetHand = action.target.hand; const targetPerformerId = action.target.performerId; label = targetHand === 'left' ? 'L' : 'R'; circledTarget = true; subscript = sequence.performers.find((person) => person.id === targetPerformerId)?.identifier ?? '?'; }
      break;
    case 'BOUNCE':
      path = 'M0 19H100 M0 81H100';
      if (action.target.kind === 'position') label = positionName(sequence, action.target.positionId);
      else { label = action.target.position; subscript = circleSubscript(action.target); }
      break;
    case 'ZIP':
      path = action.role === 'source'
        ? hand === 'left' ? 'M0 19H100 M100 19V81' : 'M0 81H100 M100 19V81'
        : hand === 'left' ? 'M0 19H100 M0 19V81' : 'M0 81H100 M0 19V81';
      label = 'ZIP';
      break;
  }
  return (
    <svg className="ball-segment" viewBox="0 0 100 100" aria-hidden="true">
      <path d={path} fill="none" stroke="#263238" strokeWidth="2.6" strokeLinecap="square" strokeLinejoin="miter" />
      {circledTarget && <circle cx="36" cy="50" r="13" fill="none" stroke="#263238" strokeWidth="1.8" />}
      <text x={subscript ? 36 : 50} y="50" textAnchor="middle" dominantBaseline="middle" fontFamily="Arial,sans-serif" fontSize={label.length > 2 ? 11 : 16} fill="#263238">{label}{subscript && <tspan fontSize="11" baselineShift="sub">{subscript}</tspan>}</text>
    </svg>
  );
}

export default function App() {
  const [sequence, setSequence] = useState<Sequence>(makeSequence);
  const [selected, setSelected] = useState<EditorCell | null>(null);
  const [selectedCells, setSelectedCells] = useState<EditorCell[]>([]);
  const [clipboard, setClipboard] = useState<ClipboardItem[]>([]);
  const [eraseStart, setEraseStart] = useState<EditorCell | null>(null);
  const [activeAction, setActiveAction] = useState<ActionName>('LIFT');
  const [history, setHistory] = useState<Sequence[]>([]);
  const [future, setFuture] = useState<Sequence[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [showState, setShowState] = useState(false);
  const [dragStart, setDragStart] = useState<{ performerId: string; hand: Hand; beatId: string } | null>(null);
  const [passRecipientId, setPassRecipientId] = useState('');
  const [passRecipientHand, setPassRecipientHand] = useState<Hand>('left');

  const simulation = useMemo(() => simulateSequence(sequence), [sequence]);
  const issuesByEntry = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const issue of simulation.validation.issues) {
      for (const entryId of issue.affectedEntries) {
        map.set(entryId, [...(map.get(entryId) ?? []), issue.description]);
      }
    }
    return map;
  }, [simulation]);

  const selectCell = (cell: EditorCell, extend = false) => {
    setSelected(cell);
    setSelectedCells((current) => extend
      ? current.some((item) => item.performerId === cell.performerId && item.hand === cell.hand && item.beatId === cell.beatId) ? current : [...current, cell]
      : [cell]);
  };

  const clearSelection = () => { setSelected(null); setSelectedCells([]); setDragStart(null); setEraseStart(null); };

  const commit = (next: Sequence) => {
    setHistory((items) => [...items.slice(-99), sequence]);
    setFuture([]);
    setSequence(next);
  };

  const entryAt = (performerId: string, hand: Hand, beatId: string) =>
    sequence.notation.find((entry) =>
      entry.performerId === performerId && entry.hand === hand && entry.time.beatId === beatId &&
      entry.time.offset.numerator === 0,
    );

  const drawRectangle = (
    first: { performerId: string; hand: Hand; beatId: string },
    last: { performerId: string; hand: Hand; beatId: string },
  ) => {
    if (first.performerId !== last.performerId) return;
    let start = first;
    let end = last;
    let startIndex = sequence.beats.findIndex((beat) => beat.id === start.beatId);
    let endIndex = sequence.beats.findIndex((beat) => beat.id === end.beatId);
    if (startIndex < 0 || endIndex < 0 || startIndex === endIndex) return;
    if (startIndex > endIndex) {
      [start, end] = [end, start];
      [startIndex, endIndex] = [endIndex, startIndex];
    }
    const performerId = asPerformerId(start.performerId);
    const targetPosition = sequence.positions.find((position) => position.kind === 'table' && (position.owner.kind === 'shared' || position.owner.performerId === start.performerId)) ?? sequence.positions.find((position) => position.kind === 'table');
    if (!targetPosition) return;
    const affectedHands = start.hand === end.hand ? [start.hand] : [start.hand, end.hand];
    for (let index = startIndex; index <= endIndex; index += 1) {
      const beat = sequence.beats[index];
      if (!beat) return;
      for (const hand of affectedHands) {
        if (entryAt(start.performerId, hand, beat.id)) return;
      }
    }

    const entries: NotationEntry[] = [];
    if (start.hand === end.hand) {
      for (let index = startIndex; index <= endIndex; index += 1) {
        const beat = sequence.beats[index]!;
        const action: NotationAction = index === startIndex
          ? { type: 'LIFT', target: { kind: 'position', positionId: targetPosition.id } }
          : index === endIndex
            ? { type: 'LEAVE', target: { kind: 'position', positionId: targetPosition.id } }
            : { type: 'HOLD' };
        entries.push({
          id: asActionEntryId(id('entry')),
          performerId,
          hand: start.hand,
          time: { beatId: beat.id, offset: rational(0) },
          action,
        });
      }
    } else {
      if (endIndex - startIndex < 2) return;
      const linkId = asLinkId(id('zip'));
      for (let index = startIndex; index <= endIndex; index += 1) {
        const beat = sequence.beats[index]!;
        if (index === startIndex) {
          entries.push({
            id: asActionEntryId(id('entry')), performerId, hand: start.hand,
            time: { beatId: beat.id, offset: rational(0) },
            action: { type: 'LIFT', target: { kind: 'position', positionId: targetPosition.id } },
          });
        } else if (index === startIndex + 1) {
          entries.push(
            {
              id: asActionEntryId(id('entry')), performerId, hand: start.hand,
              time: { beatId: beat.id, offset: rational(0) },
              action: { type: 'ZIP', role: 'source', linkId },
            },
            {
              id: asActionEntryId(id('entry')), performerId, hand: end.hand,
              time: { beatId: beat.id, offset: rational(0) },
              action: { type: 'ZIP', role: 'receiver', linkId },
            },
          );
        } else if (index === endIndex) {
          entries.push({
            id: asActionEntryId(id('entry')), performerId, hand: end.hand,
            time: { beatId: beat.id, offset: rational(0) },
            action: { type: 'LEAVE', target: { kind: 'position', positionId: targetPosition.id } },
          });
        } else {
          entries.push({
            id: asActionEntryId(id('entry')), performerId, hand: end.hand,
            time: { beatId: beat.id, offset: rational(0) },
            action: { type: 'HOLD' },
          });
        }
      }
    }
    commit({ ...sequence, notation: [...sequence.notation, ...entries] });
    selectCell(end);
  };

  const handleEditorKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.target instanceof HTMLElement && ['INPUT', 'SELECT', 'TEXTAREA'].includes(event.target.tagName)) return;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'c') { event.preventDefault(); copySelected(); return; }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'v') { event.preventDefault(); pasteSelected(); return; }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); undo(); return; }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') { event.preventDefault(); redo(); return; }
    if (event.key === 'Escape') { clearSelection(); return; }
    if (!selected) return;
    if (event.key === 'Backspace' || event.key === 'Delete') {
      event.preventDefault();
      removeSelected();
      return;
    }
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    const rows = sequence.performers.flatMap((performer) =>
      hands.map((hand) => ({ performerId: performer.id, hand })),
    );
    const rowIndex = rows.findIndex((row) => row.performerId === selected.performerId && row.hand === selected.hand);
    const beatIndex = sequence.beats.findIndex((beat) => beat.id === selected.beatId);
    let nextRow = rowIndex;
    let nextBeat = beatIndex;
    if (event.key === 'ArrowLeft') nextBeat -= 1;
    if (event.key === 'ArrowRight') nextBeat += 1;
    if (event.key === 'ArrowUp') nextRow -= 1;
    if (event.key === 'ArrowDown') nextRow += 1;
    const row = rows[Math.max(0, Math.min(rows.length - 1, nextRow))];
    const beat = sequence.beats[Math.max(0, Math.min(sequence.beats.length - 1, nextBeat))];
    if (row && beat) selectCell({ performerId: row.performerId, hand: row.hand, beatId: beat.id }, event.shiftKey);
  };

  const addAction = (type: ActionName) => {
    if (!selected) return;
    const { performerId, hand, beatId } = selected;
    const existing = entryAt(performerId, hand, beatId);
    const linkId = asLinkId(id('link'));
    let action = makeAction(type, sequence, linkId, performerId);
    if (type === 'SPECIAL') {
      const text = window.prompt('SPECIAL', existing?.action.type === 'SPECIAL' ? existing.action.text : 'SPECIAL');
      if (text === null) return;
      action = { type: 'SPECIAL', text };
    }
    let notation = sequence.notation.filter((entry) => entry.id !== existing?.id);
    if (existing && 'linkId' in existing.action && existing.action.linkId) {
      const existingLinkId = existing.action.linkId;
      if (existing.action.type === 'ZIP') {
        notation = notation.filter((entry) =>
          !('linkId' in entry.action && entry.action.linkId === existingLinkId),
        );
      } else if (existing.action.type === 'SPECIAL') {
        notation = notation.map((entry) =>
          entry.action.type === 'SPECIAL' && entry.action.linkId === existingLinkId
            ? { ...entry, action: { type: 'SPECIAL', text: entry.action.text } }
            : entry,
        );
      }
    }
    const newEntry: NotationEntry = {
      id: existing?.id ?? asActionEntryId(id('entry')),
      performerId: asPerformerId(performerId),
      hand,
      time: { beatId: asBeatId(beatId), offset: rational(0) },
      action,
    };
    notation = [...notation, newEntry];

    if (type === 'ZIP') {
      const otherHand = hand === 'left' ? 'right' : 'left';
      const other = entryAt(performerId, otherHand, beatId);
      if (other) {
        window.alert('The other hand already has notation at this beat.');
        return;
      }
      const paired: NotationEntry = {
        id: asActionEntryId(id('entry')),
        performerId: asPerformerId(performerId),
        hand: otherHand,
        time: { beatId: asBeatId(beatId), offset: rational(0) },
        action: { type: 'ZIP', role: 'receiver', linkId },
      };
      notation = [...notation.filter((entry) => entry.id !== newEntry.id), newEntry, paired];
    }
    commit({ ...sequence, notation });
  };

  const removeCells = (cells: readonly EditorCell[]) => {
    const entries = cells.map((cell) => entryAt(cell.performerId, cell.hand, cell.beatId)).filter((entry): entry is NotationEntry => Boolean(entry));
    if (!entries.length) return;
    const removeIds = new Set(entries.map((entry) => entry.id));
    const zipLinks = new Set(entries.filter((entry) => entry.action.type === 'ZIP').map((entry) => entry.action.linkId));
    for (const linkId of zipLinks) {
      for (const entry of sequence.notation) if (entry.action.type === 'ZIP' && entry.action.linkId === linkId) removeIds.add(entry.id);
    }
    const specialLinks = new Set(entries.filter((entry) => entry.action.type === 'SPECIAL' && entry.action.linkId).map((entry) => (entry.action as Extract<NotationAction, { type: 'SPECIAL' }>).linkId!));
    let notation = sequence.notation.filter((entry) => !removeIds.has(entry.id));
    for (const linkId of specialLinks) {
      notation = notation.map((entry) => entry.action.type === 'SPECIAL' && entry.action.linkId === linkId
        ? { ...entry, action: { type: 'SPECIAL', text: entry.action.text } }
        : entry);
    }
    commit({ ...sequence, notation });
  };

  const removeSelected = () => {
    const cells = selectedCells.length ? selectedCells : selected ? [selected] : [];
    removeCells(cells);
  };

  const eraseRectangle = (first: EditorCell, last: EditorCell) => {
    const rows = sequence.performers.flatMap((performer) => hands.map((hand) => ({ performerId: performer.id, hand })));
    const firstRow = rows.findIndex((row) => row.performerId === first.performerId && row.hand === first.hand);
    const lastRow = rows.findIndex((row) => row.performerId === last.performerId && row.hand === last.hand);
    const firstBeat = sequence.beats.findIndex((beat) => beat.id === first.beatId);
    const lastBeat = sequence.beats.findIndex((beat) => beat.id === last.beatId);
    const cells: EditorCell[] = [];
    for (let row = Math.min(firstRow, lastRow); row <= Math.max(firstRow, lastRow); row += 1) {
      for (let beat = Math.min(firstBeat, lastBeat); beat <= Math.max(firstBeat, lastBeat); beat += 1) {
        const targetRow = rows[row];
        const targetBeat = sequence.beats[beat];
        if (targetRow && targetBeat) cells.push({ ...targetRow, beatId: targetBeat.id });
      }
    }
    removeCells(cells);
  };

  const copySelected = () => {
    const cells = selectedCells.length ? selectedCells : selected ? [selected] : [];
    if (!cells.length) return;
    const anchor = cells[0]!;
    const anchorRow = sequence.performers.findIndex((person) => person.id === anchor.performerId) * 2 + hands.indexOf(anchor.hand);
    const anchorBeat = sequence.beats.findIndex((beat) => beat.id === anchor.beatId);
    const entries = cells.map((cell) => entryAt(cell.performerId, cell.hand, cell.beatId)).filter((entry): entry is NotationEntry => Boolean(entry));
    const links = new Set(entries.flatMap((entry) => 'linkId' in entry.action && entry.action.linkId ? [entry.action.linkId] : []));
    for (const entry of sequence.notation) {
      if ('linkId' in entry.action && entry.action.linkId && links.has(entry.action.linkId) && !entries.some((item) => item.id === entry.id)) entries.push(entry);
    }
    setClipboard(entries.map((entry) => ({
      entry,
      rowOffset: sequence.performers.findIndex((person) => person.id === entry.performerId) * 2 + hands.indexOf(entry.hand) - anchorRow,
      beatOffset: sequence.beats.findIndex((beat) => beat.id === entry.time.beatId) - anchorBeat,
    })));
  };

  const pasteSelected = () => {
    if (!selected || !clipboard.length) return;
    const rows = sequence.performers.flatMap((performer) => hands.map((hand) => ({ performerId: performer.id, hand })));
    const anchorRow = rows.findIndex((row) => row.performerId === selected.performerId && row.hand === selected.hand);
    const anchorBeat = sequence.beats.findIndex((beat) => beat.id === selected.beatId);
    const destinations = clipboard.map((item) => {
      const row = rows[anchorRow + item.rowOffset];
      const beat = sequence.beats[anchorBeat + item.beatOffset];
      return row && beat ? { item, row, beat } : undefined;
    });
    if (destinations.some((destination) => !destination)) { window.alert('The copied notation does not fit at this location.'); return; }
    const validDestinations = destinations as { item: ClipboardItem; row: { performerId: typeof sequence.performers[number]['id']; hand: Hand }; beat: typeof sequence.beats[number] }[];
    const occupied = validDestinations.some(({ item, row, beat }) =>
      sequence.notation.some((entry) => entry.performerId === row.performerId && entry.hand === row.hand && entry.time.beatId === beat.id && entry.time.offset.numerator === item.entry.time.offset.numerator && entry.time.offset.denominator === item.entry.time.offset.denominator),
    );
    if (occupied) { window.alert('Paste cancelled because one or more destination cells are occupied.'); return; }
    const linkIds = new Map<string, ReturnType<typeof asLinkId>>();
    const pasted = validDestinations.map(({ item, row, beat }) => {
      let action = item.entry.action;
      if ('linkId' in action && action.linkId) {
        const mapped = linkIds.get(action.linkId) ?? asLinkId(id('paste-link'));
        linkIds.set(action.linkId, mapped);
        action = { ...action, linkId: mapped } as NotationAction;
      }
      return {
        ...item.entry,
        id: asActionEntryId(id('paste-entry')),
        performerId: asPerformerId(row.performerId),
        hand: row.hand,
        time: { ...item.entry.time, beatId: beat.id },
        action,
      };
    });
    commit({ ...sequence, notation: [...sequence.notation, ...pasted] });
    selectCell({ performerId: selected.performerId, hand: selected.hand, beatId: selected.beatId });
  };

  const selectBeat = (beatId: string) => {
    const cells = sequence.performers.flatMap((performer) => hands.map((hand) => ({ performerId: performer.id, hand, beatId })));
    if (cells[0]) { setSelected(cells[0]); setSelectedCells(cells); }
  };

  const undo = () => {
    const previous = history[history.length - 1];
    if (!previous) return;
    setFuture((items) => [...items, sequence]);
    setHistory((items) => items.slice(0, -1));
    setSequence(previous);
  };
  const redo = () => {
    const next = future[future.length - 1];
    if (!next) return;
    setHistory((items) => [...items, sequence]);
    setFuture((items) => items.slice(0, -1));
    setSequence(next);
  };

  const changeBallCount = (requested: number) => {
    const count = Math.max(1, Math.min(30, Math.floor(requested)));
    if (count === sequence.balls.length) return;
    if (count < sequence.balls.length) {
      const removed = sequence.balls.slice(count);
      const latest = simulation.snapshots[simulation.snapshots.length - 1];
      const unsafe = removed.some((ball) => {
        const initial = sequence.initialState.placements.find((placement) => placement.ballId === ball.id);
        const current = latest?.ballLocations[ball.id];
        if (!initial || !current || initial.location.kind !== 'position') return true;
        const initialPositionId = initial.location.positionId;
        const referencedByNotation = sequence.notation.some((entry) =>
          positionTargetId(entry.action) === initialPositionId,
        );
        return referencedByNotation || simulation.snapshots.some((snapshot) =>
          !snapshot.ballLocations[ball.id] || !sameLocation(initial.location, snapshot.ballLocations[ball.id]!),
        );
      });
      if (unsafe) { window.alert('The selected balls are in use. Move them back to their initial table positions before reducing the count.'); return; }
      const removedIds = new Set(removed.map((ball) => ball.id));
      commit({ ...sequence, balls: sequence.balls.slice(0, count), initialState: { placements: sequence.initialState.placements.filter((placement) => !removedIds.has(placement.ballId)) } });
      return;
    }
    const occupied = new Set(sequence.initialState.placements.map((placement) => objectLocationKey(placement.location)));
    const candidates: ObjectLocation[] = [
      ...sequence.positions.filter((position) => position.kind === 'table').map((position) => ({ kind: 'position' as const, positionId: position.id })),
      ...sequence.performers.flatMap((performer) => hands.map((hand) => ({ kind: 'hand-held' as const, performerId: performer.id, hand }))),
      ...sequence.positions.filter((position) => position.kind === 'hand-back').map((position) => ({ kind: 'hand-back' as const, positionId: position.id, performerId: position.performerId, hand: position.hand })),
    ];
    const key = objectLocationKey;
    const added = Array.from({ length: count - sequence.balls.length }, () => ({ id: asBallId(id('new-ball')) }));
    const placements = [...sequence.initialState.placements];
    for (const ball of added) {
      const location = candidates.find((candidate) => !occupied.has(key(candidate)));
      if (!location) { window.alert('There is no free initial position for another ball.'); return; }
      occupied.add(key(location));
      placements.push({ ballId: ball.id, location });
    }
    commit({ ...sequence, balls: [...sequence.balls, ...added], initialState: { placements } });
  };

  const insertBeatAfter = (beatId?: string) => {
    const index = beatId ? sequence.beats.findIndex((beat) => beat.id === beatId) : sequence.beats.length - 1;
    if (index < 0) return;
    const beat = { id: asBeatId(id('new-beat')), subdivisions: [] };
    const beats = [...sequence.beats];
    beats.splice(index + 1, 0, beat);
    commit({ ...sequence, beats });
    selectCell({ performerId: sequence.performers[0]!.id, hand: 'left', beatId: beat.id });
  };
  const addBeat = () => insertBeatAfter();
  const removeBeat = () => {
    const target = selected?.beatId ? sequence.beats.find((beat) => beat.id === selected.beatId) : sequence.beats[sequence.beats.length - 1];
    if (!target || sequence.beats.length <= 1) return;
    if (sequence.notation.some((entry) => entry.time.beatId === target.id)) {
      window.alert('A beat containing notation cannot be removed.');
      return;
    }
    const index = sequence.beats.findIndex((beat) => beat.id === target.id);
    const beats = sequence.beats.filter((beat) => beat.id !== target.id);
    commit({ ...sequence, beats });
    const nextBeat = beats[Math.min(index, beats.length - 1)]!;
    if (selected) selectCell({ ...selected, beatId: nextBeat.id });
  };
  const addPerformer = () => {
    const performerId = asPerformerId(id('performer'));
    const performerNumber = sequence.performers.length + 1;
    const performer = { id: performerId, name: 'Juggler ' + performerNumber, identifier: String.fromCharCode(96 + performerNumber) };
    const sharedLayout = sequence.sequenceType === 'individual-passing' && sequence.individualPassingLayout === 'shared-positions';
    const ownedPositions = (sharedLayout ? [] : ['A', 'B', 'C']).map((name) => ({
      kind: 'table' as const, id: asPositionId(id('position')), name,
      owner: { kind: 'performer' as const, performerId },
    }));
    const positions: PositionDefinition[] = [...sequence.positions, ...ownedPositions, ...hands.map((hand) => ({
      kind: 'hand-back' as const, id: asPositionId(id('back')), name: (hand === 'left' ? 'L' : 'R') as 'L' | 'R', performerId, hand,
    }))];
    const newBalls = [{ id: asBallId(id('new-ball')) }, { id: asBallId(id('new-ball')) }];
    const sharedA = sharedLayout ? sequence.positions.find((position) => position.kind === 'table' && position.owner.kind === 'shared' && position.name === 'A') : undefined;
    const sharedC = sharedLayout ? sequence.positions.find((position) => position.kind === 'table' && position.owner.kind === 'shared' && position.name === 'C') : undefined;
    const sharedAOccupied = sharedA ? sequence.initialState.placements.some((placement) => objectLocationKey(placement.location) === 'p:' + sharedA.id) : true;
    const sharedCOccupied = sharedC ? sequence.initialState.placements.some((placement) => objectLocationKey(placement.location) === 'p:' + sharedC.id) : true;
    const initialA: ObjectLocation = sharedLayout
      ? sharedA && !sharedAOccupied ? { kind: 'position', positionId: sharedA.id } : { kind: 'hand-held', performerId, hand: 'left' }
      : { kind: 'position', positionId: ownedPositions[0]!.id };
    const initialC: ObjectLocation = sharedLayout
      ? sharedC && !sharedCOccupied ? { kind: 'position', positionId: sharedC.id } : { kind: 'hand-held', performerId, hand: 'right' }
      : { kind: 'position', positionId: ownedPositions[2]!.id };
    const seatAssignments = [...sequence.seatAssignments, {
      performerId, seat: { kind: 'rectangle-side' as const, side: (performerNumber % 2 ? 'long-a' : 'long-b') as 'long-a' | 'long-b', seatIndex: Math.floor((performerNumber - 1) / 2) },
    }];
    commit({
      ...sequence, performers: [...sequence.performers, performer], positions, seatAssignments,
      balls: [...sequence.balls, ...newBalls],
      initialState: { placements: [...sequence.initialState.placements,
        { ballId: newBalls[0]!.id, location: initialA },
        { ballId: newBalls[1]!.id, location: initialC },
      ] },
      tableLayout: sequence.sequenceType === 'solo' ? { type: 'rectangle', longSideSeatCount: Math.ceil((performerNumber + 1) / 2), shortSideSeatCount: 0 } : sequence.tableLayout,
    });
  };

  const removePerformer = (performerId: string) => {
    const performer = sequence.performers.find((item) => item.id === performerId);
    if (!performer || sequence.performers.length <= 1) return;
    if (!window.confirm('Remove ' + performer.name + ' and their notation?')) return;
    const removedPositions = new Set(sequence.positions.filter((position) =>
      position.kind === 'hand-back' ? position.performerId === performerId :
        position.owner.kind === 'performer' && position.owner.performerId === performerId,
    ).map((position) => position.id));
    const removedBalls = new Set(sequence.initialState.placements.filter((placement) => {
      const location = placement.location;
      if (location.kind === 'hand-held') return location.performerId === performerId;
      if (location.kind === 'hand-back') return location.performerId === performerId;
      return removedPositions.has(location.positionId);
    }).map((placement) => placement.ballId));
    const positions = sequence.positions.filter((position) => !removedPositions.has(position.id));
    commit({
      ...sequence,
      performers: sequence.performers.filter((item) => item.id !== performerId),
      positions,
      balls: sequence.balls.filter((ball) => !removedBalls.has(ball.id)),
      initialState: { placements: sequence.initialState.placements.filter((placement) => !removedBalls.has(placement.ballId)) },
      notation: sequence.notation.filter((entry) => entry.performerId !== performerId),
      seatAssignments: sequence.seatAssignments.filter((assignment) => assignment.performerId !== performerId),
      tableLayout: sequence.sequenceType === 'solo'
        ? { type: 'solo' }
        : { type: 'rectangle', longSideSeatCount: Math.max(1, sequence.performers.length - 1), shortSideSeatCount: 0 },
    });
    if (selected?.performerId === performerId) clearSelection();
  };

  const addPosition = () => {
    const used = new Set(sequence.positions.filter((position) => position.kind === 'table').map((position) => position.name));
    const name = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').find((letter) => !used.has(letter));
    if (!name) return;
    const owners = sequence.sequenceType === 'individual-passing' && sequence.individualPassingLayout === 'shared-positions'
      ? [{ kind: 'shared' as const }]
      : sequence.performers.map((performer) => ({ kind: 'performer' as const, performerId: performer.id }));
    const added = owners.map((owner) => ({
      kind: 'table' as const,
      id: asPositionId(id('position')),
      name,
      owner,
    }));
    commit({ ...sequence, positions: [...sequence.positions, ...added] });
  };

  const renamePosition = (positionId: string, name: string) => {
    const cleanName = name.trim();
    if (!cleanName) return;
    const current = sequence.positions.find((position) => position.id === positionId);
    if (!current || current.kind !== 'table') return;
    const duplicate = sequence.positions.some((position) =>
      position.kind === 'table' && position.id !== positionId && position.name === cleanName &&
      (position.owner.kind === current.owner.kind &&
       (position.owner.kind === 'shared' || (current.owner.kind === 'performer' && position.owner.performerId === current.owner.performerId))),
    );
    if (duplicate) {
      window.alert('A position with this name already exists in the same layout.');
      return;
    }
    commit({ ...sequence, positions: sequence.positions.map((position) =>
      position.id === positionId && position.kind === 'table' ? { ...position, name: cleanName } : position,
    ) });
  };

  const removePosition = (positionId: string) => {
    commit({ ...sequence, positions: sequence.positions.filter((position) => position.id !== positionId) });
  };

  const changeType = (type: SequenceType) => {
    let positions = sequence.positions;
    let individualPassingLayout = sequence.individualPassingLayout;
    if (type === 'circle-passing' || (type === 'individual-passing' && sequence.individualPassingLayout !== 'shared-positions')) {
      const tables = sequence.positions.filter((position) => position.kind === 'table');
      const names = [...new Set(tables.map((position) => position.name))];
      const normalized = sequence.performers.flatMap((performer, performerIndex) => names.map((name) => {
        const existing = tables.find((position) => position.name === name && position.owner.kind === 'performer' && position.owner.performerId === performer.id)
          ?? (performerIndex === 0 ? tables.find((position) => position.name === name) : undefined);
        return existing
          ? { ...existing, owner: { kind: 'performer' as const, performerId: performer.id } }
          : { kind: 'table' as const, id: asPositionId(id('position')), name, owner: { kind: 'performer' as const, performerId: performer.id } };
      }));
      positions = [...sequence.positions.filter((position) => position.kind === 'hand-back'), ...normalized];
      individualPassingLayout = 'per-performer-positions';
    }
    commit({
      ...sequence, sequenceType: type, positions, individualPassingLayout,
      tableLayout: type === 'solo' ? { type: 'solo' } : { type: 'rectangle', longSideSeatCount: Math.max(1, sequence.performers.length), shortSideSeatCount: 0 },
    });
  };

  const changeIndividualLayout = (layout: 'shared-positions' | 'per-performer-positions') => {
    if (sequence.sequenceType !== 'individual-passing' || layout === sequence.individualPassingLayout) return;
    const tables = sequence.positions.filter((position) => position.kind === 'table');
    const names = [...new Set(tables.map((position) => position.name))];
    if (layout === 'shared-positions') {
      const shared = names.map((name) => {
        const existing = tables.find((position) => position.name === name && position.owner.kind === 'shared');
        const first = tables.find((position) => position.name === name);
        return existing ?? (first ? { ...first, owner: { kind: 'shared' as const } } : undefined);
      }).filter((position): position is PositionDefinition & { kind: 'table' } => Boolean(position));
      const byName = new Map<string, ReturnType<typeof asPositionId>>(shared.map((position): [string, ReturnType<typeof asPositionId>] => [position.name, position.id]));
      const oldToNew = new Map<ReturnType<typeof asPositionId>, ReturnType<typeof asPositionId>>(tables.map((position): [ReturnType<typeof asPositionId>, ReturnType<typeof asPositionId>] => [position.id, byName.get(position.name)!]));
      const placements = sequence.initialState.placements.map((placement) => {
        const location = placement.location;
        if (location.kind !== 'position') return placement;
        const positionId = oldToNew.get(location.positionId);
        return positionId ? { ...placement, location: { kind: 'position' as const, positionId } } : placement;
      });
      const occupied = new Set<string>();
      for (const placement of placements) {
        const key = objectLocationKey(placement.location);
        if (occupied.has(key)) { window.alert('Shared positions cannot contain multiple balls. Move the extra balls to hands or hand backs before switching layouts.'); return; }
        occupied.add(key);
      }
      const notation = sequence.notation.map((entry) => {
        const oldPositionId = positionTargetId(entry.action);
        const newPositionId = oldPositionId ? oldToNew.get(oldPositionId) : undefined;
        return newPositionId ? updatePositionTarget(entry, newPositionId) : entry;
      });
      commit({ ...sequence, positions: [...sequence.positions.filter((position) => position.kind === 'hand-back'), ...shared], initialState: { placements }, notation, individualPassingLayout: layout });
      return;
    }
    const perPerformer = sequence.performers.flatMap((performer, performerIndex) => names.map((name) => {
      const existing = tables.find((position) => position.name === name && position.owner.kind === 'performer' && position.owner.performerId === performer.id)
        ?? (performerIndex === 0 ? tables.find((position) => position.name === name) : undefined);
      return existing
        ? { ...existing, owner: { kind: 'performer' as const, performerId: performer.id } }
        : { kind: 'table' as const, id: asPositionId(id('position')), name, owner: { kind: 'performer' as const, performerId: performer.id } };
    }));
    const firstPositions = new Map<string, ReturnType<typeof asPositionId>>(perPerformer.filter((position) => position.owner.kind === 'performer' && position.owner.performerId === sequence.performers[0]?.id).map((position): [string, ReturnType<typeof asPositionId>] => [position.name, position.id]));
    const sharedToFirst = new Map<ReturnType<typeof asPositionId>, ReturnType<typeof asPositionId>>(tables.filter((position) => position.owner.kind === 'shared').map((position): [ReturnType<typeof asPositionId>, ReturnType<typeof asPositionId>] => [position.id, firstPositions.get(position.name)!]));
    const placements = sequence.initialState.placements.map((placement) => {
      const location = placement.location;
      if (location.kind !== 'position') return placement;
      const positionId = sharedToFirst.get(location.positionId);
      return positionId ? { ...placement, location: { kind: 'position' as const, positionId } } : placement;
    });
    const notation = sequence.notation.map((entry) => {
      const oldPositionId = positionTargetId(entry.action);
      if (!oldPositionId || !sharedToFirst.has(oldPositionId)) return entry;
      const oldPosition = tables.find((position) => position.id === oldPositionId);
      const targetId = perPerformer.find((position) => position.name === oldPosition?.name && position.owner.kind === 'performer' && position.owner.performerId === entry.performerId)?.id ?? sharedToFirst.get(oldPositionId)!;
      return updatePositionTarget(entry, targetId);
    });
    commit({ ...sequence, positions: [...sequence.positions.filter((position) => position.kind === 'hand-back'), ...perPerformer], initialState: { placements }, notation, individualPassingLayout: layout });
  };

  const changeTarget = (entry: NotationEntry, targetId: string) => {
    if (!['LIFT', 'LEAVE', 'TAP', 'BOUNCE'].includes(entry.action.type)) return;
    const action = entry.action;
    if (action.type === 'LIFT' || action.type === 'LEAVE' || action.type === 'TAP' || action.type === 'BOUNCE') {
      commit({
        ...sequence,
        notation: sequence.notation.map((item) => item.id === entry.id
          ? { ...item, action: { ...action, target: { kind: 'position', positionId: asPositionId(targetId) } } }
          : item),
      });
    }
  };

  const changePassTarget = (entry: NotationEntry, targetPerformerId: string, hand?: Hand) => {
    const linkId = 'linkId' in entry.action ? entry.action.linkId : undefined;
    if (!linkId) return;
    const sender = sequence.notation.find((item) => {
      const action = item.action;
      return action.type === 'LEAVE' && 'hand' in action.target && action.linkId === linkId;
    });
    const receiver = sequence.notation.find((item) => {
      const action = item.action;
      return action.type === 'LIFT' && 'performerId' in action.target && action.linkId === linkId;
    });
    if (!sender || !receiver) return;
    const senderAction = sender.action;
    const receiverAction = receiver.action;
    if (senderAction.type !== 'LEAVE' || !('hand' in senderAction.target) || receiverAction.type !== 'LIFT' || !('performerId' in receiverAction.target)) return;
    const recipientId = entry.action.type === 'LIFT' ? receiver.performerId : targetPerformerId;
    const sourceId = entry.action.type === 'LEAVE' ? sender.performerId : targetPerformerId;
    const recipientHand = hand ?? senderAction.target.hand;
    commit({ ...sequence, notation: sequence.notation.map((item) => {
      if (item.id === sender.id) return { ...item, performerId: asPerformerId(sourceId), action: { ...senderAction, target: { ...senderAction.target, performerId: asPerformerId(recipientId), hand: recipientHand } } };
      if (item.id === receiver.id) return { ...item, performerId: asPerformerId(recipientId), hand: recipientHand, action: { ...receiverAction, target: { ...receiverAction.target, performerId: asPerformerId(sourceId) } } };
      return item;
    }) });
  };

  const changeBpm = (value: number) => {
    if (Number.isFinite(value) && value > 0) commit({ ...sequence, bpm: value });
  };

  const toggleInitialLocation = (location: ObjectLocation) => {
    const occupied = sequence.initialState.placements.find((placement) => sameLocation(placement.location, location));
    if (occupied) {
      commit({
        ...sequence,
        initialState: { placements: sequence.initialState.placements.filter((placement) => placement.ballId !== occupied.ballId) },
      });
      return;
    }
    const placed = new Set(sequence.initialState.placements.map((placement) => placement.ballId));
    const nextBall = sequence.balls.find((ball) => !placed.has(ball.id));
    if (!nextBall) return;
    commit({
      ...sequence,
      initialState: {
        placements: [...sequence.initialState.placements, { ballId: nextBall.id, location }],
      },
    });
  };

  const addClap = () => {
    if (!selected) return;
    const otherHand = selected.hand === 'left' ? 'right' : 'left';
    if (entryAt(selected.performerId, selected.hand, selected.beatId) ||
        entryAt(selected.performerId, otherHand, selected.beatId)) return;
    const linkId = asLinkId(id('special-link'));
    const entries: NotationEntry[] = hands.map((hand) => ({
      id: asActionEntryId(id('entry')),
      performerId: asPerformerId(selected.performerId),
      hand,
      time: { beatId: asBeatId(selected.beatId), offset: rational(0) },
      action: { type: 'SPECIAL', text: 'Clap', linkId },
    }));
    commit({ ...sequence, notation: [...sequence.notation, ...entries] });
  };

  const addIndividualPass = () => {
    if (!selected || sequence.sequenceType !== 'individual-passing') return;
    const recipient = sequence.performers.find((person) => person.id === passRecipientId && person.id !== selected.performerId) ?? sequence.performers.find((person) => person.id !== selected.performerId);
    if (!recipient || recipient.id === selected.performerId) return;
    const recipientHand = passRecipientHand;
    if (entryAt(selected.performerId, selected.hand, selected.beatId) ||
        entryAt(recipient.id, recipientHand, selected.beatId)) {
      window.alert('Both hands must be empty at this beat.');
      return;
    }
    const linkId = asLinkId(id('pass-link'));
    const time = { beatId: asBeatId(selected.beatId), offset: rational(0) };
    const entries: NotationEntry[] = [
      {
        id: asActionEntryId(id('entry')),
        performerId: asPerformerId(selected.performerId),
        hand: selected.hand,
        time,
        action: { type: 'LEAVE', target: { kind: 'pass-recipient-hand', performerId: recipient.id, hand: recipientHand }, linkId },
      },
      {
        id: asActionEntryId(id('entry')),
        performerId: recipient.id,
        hand: recipientHand,
        time,
        action: { type: 'LIFT', target: { kind: 'pass-source', performerId: asPerformerId(selected.performerId) }, linkId },
      },
    ];
    commit({ ...sequence, notation: [...sequence.notation, ...entries] });
  };

  const changeCircleTarget = (entry: NotationEntry, field: 'position' | 'direction' | 'distance', value: string) => {
    const action = entry.action;
    if (action.type !== 'LIFT' && action.type !== 'LEAVE' && action.type !== 'TAP' && action.type !== 'BOUNCE') return;
    if (action.target.kind !== 'circle-position') return;
    const target = {
      ...action.target,
      ...(field === 'position' ? { position: value as 'A' | 'B' | 'C' } : {}),
      ...(field === 'direction' ? { direction: value as 'left' | 'right' } : {}),
      ...(field === 'distance' ? { distance: Math.min(Math.max(1, Number(value) || 1), Math.max(1, sequence.performers.length - 1)) } : {}),
    };
    commit({ ...sequence, notation: sequence.notation.map((item) =>
      item.id === entry.id ? { ...item, action: { ...action, target } } : item,
    ) });
  };
  const setCircleTargetMode = (entry: NotationEntry, mode: 'self' | 'other') => {
    const action = entry.action;
    if (!('target' in action) || action.target.kind !== 'circle-position') return;
    const target = mode === 'self'
      ? { kind: 'circle-position' as const, position: action.target.position }
      : { kind: 'circle-position' as const, position: action.target.position, direction: 'left' as const, distance: 1 };
    commit({ ...sequence, notation: sequence.notation.map((item) => item.id === entry.id ? { ...item, action: { ...action, target } as NotationAction } : item) });
  };
  const selectedEntry = selected
    ? entryAt(selected.performerId, selected.hand, selected.beatId)
    : undefined;
  const targetableEntry = selectedEntry && (
    selectedEntry.action.type === 'LIFT' ||
    selectedEntry.action.type === 'LEAVE' ||
    selectedEntry.action.type === 'TAP' ||
    selectedEntry.action.type === 'BOUNCE'
  ) ? selectedEntry as NotationEntry & {
    action: Extract<NotationAction, { type: 'LIFT' | 'LEAVE' | 'TAP' | 'BOUNCE' }>;
  } : undefined;

  const passRecipientValue = sequence.performers.find((person) => person.id === passRecipientId && person.id !== selected?.performerId)?.id ?? sequence.performers.find((person) => person.id !== selected?.performerId)?.id ?? '';
  const selectedPassRecipient = selectedEntry ? passRecipientTarget(selectedEntry) : undefined;
  const selectedPassSource = selectedEntry ? passSourceTarget(selectedEntry) : undefined;
  const selectedBeatIndex = selected ? sequence.beats.findIndex((beat) => beat.id === selected.beatId) : -1;
  const selectedSnapshot = selectedBeatIndex >= 0
    ? [...simulation.snapshots].reverse().find((snapshot) => {
      const snapshotBeatIndex = sequence.beats.findIndex((beat) => beat.id === snapshot.at.beatId);
      return snapshotBeatIndex < selectedBeatIndex || (snapshotBeatIndex === selectedBeatIndex && snapshot.phase === 'after');
    }) ?? simulation.snapshots[0]
    : simulation.snapshots[0];
  const stateBeatLabel = selectedBeatIndex < 0
    ? 'Initial state'
    : selectedSnapshot?.at.beatId === selected?.beatId && selectedSnapshot?.phase === 'after'
      ? 'After beat ' + (selectedBeatIndex + 1)
      : 'Before beat ' + (selectedBeatIndex + 1);

  return (
    <main className="app-root" aria-label="POINTS Workspace" tabIndex={0} onKeyDown={handleEditorKeyDown}>
      <header className="topbar">
        <div className="brand"><span className="brand-mark">P</span><span>POINTS</span></div>
        <div className="top-actions">
          <button type="button" onClick={undo} disabled={!history.length} title="Undo">↶</button>
          <button type="button" onClick={redo} disabled={!future.length} title="Redo">↷</button>
          <button type="button" onClick={() => setShowSettings((value) => !value)} aria-expanded={showSettings}>Settings</button>
        </div>
      </header>

      {showSettings && (
        <section className="settings-panel" aria-label="Sequence settings">
          <label>Type
            <select value={sequence.sequenceType} onChange={(event) => changeType(event.target.value as SequenceType)}>
              <option value="solo">Solo</option>
              <option value="circle-passing">Circle passing</option>
              <option value="individual-passing">Individual passing</option>
            </select>
          </label>
          {sequence.sequenceType === 'individual-passing' && <label>Position layout
            <select value={sequence.individualPassingLayout ?? 'per-performer-positions'} onChange={(event) => changeIndividualLayout(event.target.value as 'shared-positions' | 'per-performer-positions')}>
              <option value="per-performer-positions">Per performer</option>
              <option value="shared-positions">Shared</option>
            </select>
          </label>}
          <label>BPM
            <input type="number" min="1" max="400" value={sequence.bpm} onChange={(event) => changeBpm(Number(event.target.value))} />
          </label>
          <label>Time
            <select value={sequence.timeSignature.numerator + '/' + sequence.timeSignature.denominator} onChange={(event) => {
              const value = event.target.value;
              const [n, d] = value.split('/').map(Number);
              const grouping = n === 6 && d === 8 ? [3, 3] : Array.from({ length: n! }, () => 1);
              commit({ ...sequence, timeSignature: { numerator: n!, denominator: d as 1 | 2 | 4 | 8 | 16 | 32 | 64, beatGrouping: grouping } });
            }}>
              <option value="4/4">4/4</option><option value="3/4">3/4</option><option value="6/8">6/8</option><option value="2/4">2/4</option>
            </select>
          </label>
          <div className="setting-control"><span>Balls</span><div className="stepper"><button type="button" onClick={() => changeBallCount(sequence.balls.length - 1)} disabled={sequence.balls.length <= 1}>−</button><output>{sequence.balls.length}</output><button type="button" onClick={() => changeBallCount(sequence.balls.length + 1)}>+</button></div></div>
          <div className="setting-control"><span>Beats</span><div className="stepper"><button type="button" onClick={removeBeat} disabled={sequence.beats.length <= 1 || sequence.notation.some((entry) => entry.time.beatId === sequence.beats[sequence.beats.length - 1]?.id)}>−</button><output>{sequence.beats.length}</output><button type="button" onClick={addBeat}>+</button></div></div>
          <div className="performer-settings"><span>Performers</span>{sequence.performers.map((performer) => <span className="performer-chip" key={performer.id}>{performer.name}{sequence.performers.length > 1 && <button type="button" className="remove-chip" onClick={() => removePerformer(performer.id)} aria-label={'Remove ' + performer.name}>×</button>}</span>)}<button type="button" onClick={addPerformer}>Add performer</button></div>
          <div className="position-settings"><span>Positions</span>{sequence.positions.filter((position) => position.kind === 'table').map((position) => <div className="position-edit" key={position.id}><input aria-label={'Rename position ' + position.name} defaultValue={position.name} onBlur={(event) => renamePosition(position.id, event.target.value)} /><button type="button" onClick={() => removePosition(position.id)} aria-label={'Remove position ' + position.name}>×</button></div>)}<button type="button" onClick={addPosition}>Add position</button></div>
        </section>
      )}

      <section className="initial-positions" aria-label="Initial positions">
        <div className="initial-positions-heading">
          <strong>Initial positions</strong>
          <span>{sequence.initialState.placements.length} / {sequence.balls.length}</span>
        </div>
        {sequence.performers.map((performer) => {
          const tablePositions = sequence.positions.filter((position) =>
            position.kind === 'table' &&
            (position.owner.kind === 'performer'
              ? position.owner.performerId === performer.id
              : performer.id === sequence.performers[0]?.id),
          );
          const heldLocation = (hand: Hand): ObjectLocation => ({ kind: 'hand-held', performerId: performer.id, hand });
          return (
            <div className="initial-performer" key={performer.id}>
              <div className="initial-performer-name">{performer.name}</div>
              <div className="initial-position-row">
                {tablePositions.map((position) => {
                  const location: ObjectLocation = { kind: 'position', positionId: position.id };
                  const ball = sequence.initialState.placements.find((placement) => sameLocation(placement.location, location));
                  return (
                    <button type="button" key={position.id} className={'initial-position' + (ball ? ' has-ball' : '')}
                      onClick={() => toggleInitialLocation(location)}
                      disabled={!ball && sequence.initialState.placements.length >= sequence.balls.length}
                      aria-label={position.name + (ball ? ', occupied' : ', empty')}>
                      <span className="position-name">{position.name}</span><span className="ball-indicator" />
                    </button>
                  );
                })}
                {hands.map((hand) => {
                  const location = heldLocation(hand);
                  const ball = sequence.initialState.placements.find((placement) => sameLocation(placement.location, location));
                  const back = sequence.positions.find((position) => position.kind === 'hand-back' && position.performerId === performer.id && position.hand === hand);
                  const backLocation: ObjectLocation | undefined = back
                    ? { kind: 'hand-back', positionId: back.id, performerId: performer.id, hand }
                    : undefined;
                  const backBall = backLocation
                    ? sequence.initialState.placements.find((placement) => sameLocation(placement.location, backLocation))
                    : undefined;
                  return (
                    <div className="initial-hand-group" key={hand}>
                      <button type="button" className={'initial-position hand-held' + (ball ? ' has-ball' : '')}
                        onClick={() => toggleInitialLocation(location)}
                        disabled={!ball && sequence.initialState.placements.length >= sequence.balls.length}
                        aria-label={(hand === 'left' ? 'Left' : 'Right') + ' hand' + (ball ? ', occupied' : ', empty')}>
                        <span className="position-name">{hand === 'left' ? 'Left' : 'Right'} hand</span><span className="ball-indicator" />
                      </button>
                      {backLocation && <button type="button" className={'initial-position hand-back' + (backBall ? ' has-ball' : '')}
                        onClick={() => toggleInitialLocation(backLocation)}
                        disabled={!backBall && sequence.initialState.placements.length >= sequence.balls.length}
                        aria-label={back!.name + ' hand back' + (backBall ? ', occupied' : ', empty')}>
                        <span className="position-name">{back!.name}</span><span className="ball-indicator" />
                      </button>}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </section>

      <section className="editor-toolbar" aria-label="Notation actions">
        <div className="action-tools">
          {actionNames.map((name) => (
            <button type="button" key={name} aria-label={name} title={name} className={(activeAction === name ? 'tool active' : 'tool') + (name === 'ZIP' ? ' zip-tool' : '')} onClick={() => { setActiveAction(name); if (selected) addAction(name); }} disabled={!selected}>
              {name === 'ZIP' ? <span className="zip-tool-preview"><ActionSymbol action={{ type: 'ZIP', role: 'source', linkId: asLinkId('zip-preview') }} sequence={sequence} hand="left" /><ActionSymbol action={{ type: 'ZIP', role: 'receiver', linkId: asLinkId('zip-preview') }} sequence={sequence} hand="right" /></span> : <ActionSymbol action={makeAction(name, sequence)} sequence={sequence} hand={selected?.hand ?? 'left'} />}
            </button>
          ))}
          {sequence.sequenceType === 'individual-passing' && <>
            <label className="target-control">Pass to <select value={passRecipientValue} onChange={(event) => setPassRecipientId(event.target.value)}>{sequence.performers.filter((person) => person.id !== selected?.performerId).map((person) => <option key={person.id} value={person.id}>{person.name} ({person.identifier ?? '?'})</option>)}</select></label>
            <label className="target-control">Hand <select value={passRecipientHand} onChange={(event) => setPassRecipientHand(event.target.value as Hand)}><option value="left">Left</option><option value="right">Right</option></select></label>
            <button type="button" className="tool" onClick={addIndividualPass} disabled={!selected || sequence.performers.length < 2}>PASS</button>
          </>}
          <button type="button" className="tool" onClick={addClap} disabled={!selected}>CLAP</button>
          <button type="button" className="tool delete-tool" onClick={removeSelected} disabled={!selected || !entryAt(selected.performerId, selected.hand, selected.beatId)}>Delete</button>
        </div>
        <span className="selection-label">{selected ? sequence.performers.find((item) => item.id === selected.performerId)?.name + ' · ' + selected.hand + ' · beat ' + (sequence.beats.findIndex((beat) => beat.id === selected.beatId) + 1) : 'Select a cell'}</span>
        {targetableEntry && targetableEntry.action.target.kind === 'position' && (
          <label className="target-control">Target
            <select value={targetableEntry.action.target.positionId} onChange={(event) => changeTarget(targetableEntry, event.target.value)}>
              {sequence.positions.filter((position) => position.kind === 'table' || ((targetableEntry.action.type === 'LIFT' || targetableEntry.action.type === 'LEAVE') && position.kind === 'hand-back' && position.performerId === targetableEntry.performerId)).map((position) => (
                <option key={position.id} value={position.id}>{position.name}</option>
              ))}
            </select>
          </label>
        )}
        {targetableEntry && targetableEntry.action.target.kind === 'circle-position' && (
          <div className="target-control">
            <label>Position <select value={targetableEntry.action.target.position} onChange={(event) => changeCircleTarget(targetableEntry, 'position', event.target.value)}><option>A</option><option>B</option><option>C</option></select></label>
            <label>Performer <select value={targetableEntry.action.target.direction ? 'other' : 'self'} onChange={(event) => setCircleTargetMode(targetableEntry, event.target.value as 'self' | 'other')}><option value="self">Self</option><option value="other" disabled={sequence.performers.length < 2}>Other</option></select></label>
            {targetableEntry.action.target.direction && <>
              <label>Direction <select value={targetableEntry.action.target.direction} onChange={(event) => changeCircleTarget(targetableEntry, 'direction', event.target.value)}><option value="left">Left</option><option value="right">Right</option></select></label>
              <label>Distance <input type="number" min="1" max={Math.max(1, sequence.performers.length - 1)} value={targetableEntry.action.target.distance ?? 1} onChange={(event) => changeCircleTarget(targetableEntry, 'distance', event.target.value)} /></label>
            </>}
          </div>
        )}
        {targetableEntry && selectedPassRecipient && (
          <div className="target-control">
            <label>Recipient <select value={selectedPassRecipient.performerId} onChange={(event) => changePassTarget(targetableEntry, event.target.value, selectedPassRecipient.hand)}>{sequence.performers.filter((person) => person.id !== selected?.performerId).map((person) => <option key={person.id} value={person.id}>{person.name} ({person.identifier ?? '?'})</option>)}</select></label>
            <label>Hand <select value={selectedPassRecipient.hand} onChange={(event) => changePassTarget(targetableEntry, selectedPassRecipient.performerId, event.target.value as Hand)}><option value="left">Left</option><option value="right">Right</option></select></label>
          </div>
        )}
        {targetableEntry && selectedPassSource && (
          <label className="target-control">Source <select value={selectedPassSource.performerId} onChange={(event) => changePassTarget(targetableEntry, event.target.value)}>{sequence.performers.filter((person) => person.id !== selected?.performerId).map((person) => <option key={person.id} value={person.id}>{person.name} ({person.identifier ?? '?'})</option>)}</select></label>
        )}
      </section>

      <section className="editor-scroll" aria-label="Notation editor" onClick={(event) => { if (event.target === event.currentTarget) clearSelection(); }}>
        <div className="notation-grid">
          <div className="grid-head" style={{ gridTemplateColumns: `82px repeat(${sequence.beats.length}, 42px) 18px` }}>
            <div className="row-label heading-label">PERFORMER</div>
            {sequence.beats.map((beat, index) => <div className="beat-head" key={beat.id}><button type="button" className="beat-select" onClick={() => selectBeat(beat.id)} aria-label={'Select beat ' + (index + 1)}><span>{index + 1}</span><small>{Math.floor(index / sequence.timeSignature.beatGrouping.length) + 1}.{(index % sequence.timeSignature.beatGrouping.length) + 1}</small></button><button type="button" className="insert-beat" onClick={() => insertBeatAfter(beat.id)} aria-label={'Insert beat after ' + (index + 1)}>+</button></div>)}
            <button type="button" className="add-beat" onClick={addBeat} aria-label="Add beat">+</button>
          </div>
          {sequence.performers.map((performer) => (
            <div className="performer-block" key={performer.id}>
              <div className="performer-heading">{performer.name}<span>{performer.identifier ?? ''}</span></div>
              {hands.map((hand) => (
                <div className="hand-row" key={hand} style={{ gridTemplateColumns: `82px repeat(${sequence.beats.length}, 42px) 18px` }}>
                  <div className="row-label">{hand === 'left' ? 'L' : 'R'}</div>
                  {sequence.beats.map((beat, index) => {
                    const entry = entryAt(performer.id, hand, beat.id);
                    const selectedCell = selectedCells.some((cell) => cell.performerId === performer.id && cell.hand === hand && cell.beatId === beat.id);
                    const errors = entry ? issuesByEntry.get(entry.id) ?? [] : [];
                    return (
                      <button
                        type="button"
                        key={beat.id}
                        className={'notation-cell' + (selectedCell ? ' selected' : '') + (errors.length ? ' invalid' : '') + (entry ? ' occupied' : '')}
                        onMouseDown={(event) => {
                          const cell = { performerId: performer.id, hand, beatId: beat.id };
                          if (event.ctrlKey) {
                            event.preventDefault();
                            setEraseStart(cell);
                          } else if (event.shiftKey) {
                            event.preventDefault();
                            selectCell(cell);
                            setDragStart(cell);
                          }
                        }}
                        onMouseUp={() => {
                          const cell = { performerId: performer.id, hand, beatId: beat.id };
                          if (eraseStart) { eraseRectangle(eraseStart, cell); setEraseStart(null); return; }
                          if (!dragStart) return;
                          drawRectangle(dragStart, cell);
                          setDragStart(null);
                        }}
                        onClick={(event) => {
                          if (dragStart || eraseStart) return;
                          selectCell({ performerId: performer.id, hand, beatId: beat.id }, event.shiftKey);
                        }}
                        onDoubleClick={() => entry && entry.action.type === 'SPECIAL' && addAction('SPECIAL')}
                        aria-label={performer.name + ' ' + hand + ' beat ' + (index + 1) + (entry ? ' ' + actionLabel(entry.action, sequence) : ' empty')}
                        title={errors.join(' ')}
                      >
                        {entry ? <NotationMark action={entry.action} sequence={sequence} hand={hand} /> : null}
                      </button>
                    );
                  })}
                  <span className="grid-end" />
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>

      <section className="bottom-panels">
        <div className="validation-panel">
          <div className="panel-heading"><strong>Validation</strong><span className={simulation.validation.isValid ? 'valid-count' : 'error-count'}>{simulation.validation.issues.length} {simulation.validation.issues.length === 1 ? 'issue' : 'issues'}</span></div>
          {simulation.validation.issues.length === 0 ? <p className="no-issues">Sequence valid</p> : <ul>{simulation.validation.issues.slice(0, 8).map((issue, index) => (
            <li key={issue.code + index}><span>{issue.description}</span>{issue.affectedEntries[0] && <button type="button" onClick={() => {
              const entry = sequence.notation.find((item) => item.id === issue.affectedEntries[0]);
              if (entry) selectCell({ performerId: entry.performerId, hand: entry.hand, beatId: entry.time.beatId });
            }}>Go to</button>}</li>
          ))}</ul>}
        </div>
        <div className="state-panel">
          <button type="button" className="state-toggle" onClick={() => setShowState((value) => !value)} aria-expanded={showState}>Object state {showState ? '−' : '+'}</button>
          {showState && <div className="state-content"><div className="state-beat-label">{stateBeatLabel}</div>
            {sequence.balls.map((ball) => {
              const location = selectedSnapshot?.ballLocations[ball.id] ??
                sequence.initialState.placements.find((placement) => placement.ballId === ball.id)?.location;
              const label = !location ? 'Unplaced' : location.kind === 'position'
                ? positionName(sequence, location.positionId)
                : location.kind === 'hand-held'
                  ? (sequence.performers.find((person) => person.id === location.performerId)?.name ?? '?') + ' ' + location.hand
                  : (sequence.performers.find((person) => person.id === location.performerId)?.name ?? '?') + ' ' + location.hand + ' back';
              return <div className="state-ball" key={ball.id}><span />{label}</div>;
            })}
          </div>}
        </div>
      </section>
    </main>
  );
}
