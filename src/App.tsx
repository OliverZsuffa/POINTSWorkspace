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

let nextId = 0;
const id = (prefix: string) => prefix + '-' + (++nextId).toString(36);
const hands: readonly Hand[] = ['left', 'right'];
const actionNames = ['LIFT', 'HOLD', 'LEAVE', 'BOUNCE', 'TAP', 'EMPTY', 'ZIP', 'SPECIAL'] as const;
type ActionName = (typeof actionNames)[number];

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
  const balls = ['ball-1', 'ball-2', 'ball-3'].map((ball) => ({ id: asBallId(ball) }));
  return {
    id: asSequenceId('sequence-main'),
    sequenceType: 'solo',
    timeSignature: DEFAULT_TIME_SIGNATURE,
    bpm: 120,
    beats: Array.from({ length: 8 }, (_, index) => ({
      id: asBeatId('beat-' + (index + 1)),
      subdivisions: [],
    })),
    performers: [{ id: performerId, name: 'Juggler 1' }],
    positions: [...positions, ...backs],
    balls,
    initialState: {
      placements: balls.map((ball, index) => ({
        ballId: ball.id,
        location: { kind: 'position' as const, positionId: positions[index]!.id },
      })),
    },
    notation: [],
    tableLayout: { type: 'solo' },
    seatAssignments: [],
  };
}

function positionName(sequence: Sequence, positionId: string): string {
  const position = sequence.positions.find((item) => item.id === positionId);
  return position?.name ?? '?';
}

function actionLabel(action: NotationAction, sequence: Sequence): string {
  switch (action.type) {
    case 'LIFT':
    case 'LEAVE':
    case 'TAP':
    case 'BOUNCE':
      return action.target.kind === 'position'
        ? action.type + ' ' + positionName(sequence, action.target.positionId)
        : action.target.kind === 'circle-position'
          ? action.type + ' ' + action.target.position + action.target.distance + (action.target.direction === 'left' ? 'L' : 'R')
          : action.type + ' ' + action.target.performerId;
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
): NotationAction {
  const position = sequence.positions.find((item) => item.kind === 'table');
  const target: TableActionTarget = sequence.sequenceType === 'circle-passing'
    ? { kind: 'circle-position', position: 'A', direction: 'left', distance: 1 }
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

export default function App() {
  const [sequence, setSequence] = useState<Sequence>(makeSequence);
  const [selected, setSelected] = useState<{ performerId: string; hand: Hand; beatId: string } | null>(null);
  const [activeAction, setActiveAction] = useState<ActionName>('LIFT');
  const [history, setHistory] = useState<Sequence[]>([]);
  const [future, setFuture] = useState<Sequence[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [showState, setShowState] = useState(false);
  const [dragStart, setDragStart] = useState<{ performerId: string; hand: Hand; beatId: string } | null>(null);

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
    const targetPosition = sequence.positions.find((position) => position.kind === 'table');
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
    setSelected(end);
  };

  const handleEditorKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.target instanceof HTMLElement && ['INPUT', 'SELECT', 'TEXTAREA'].includes(event.target.tagName)) return;
    if (!selected) return;
    if (event.key === 'Escape') {
      setSelected(null);
      setDragStart(null);
      return;
    }
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
    if (row && beat) setSelected({ performerId: row.performerId, hand: row.hand, beatId: beat.id });
  };

  const addAction = (type: ActionName) => {
    if (!selected) return;
    const { performerId, hand, beatId } = selected;
    const existing = entryAt(performerId, hand, beatId);
    const linkId = asLinkId(id('link'));
    let action = makeAction(type, sequence, linkId);
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

  const removeSelected = () => {
    if (!selected) return;
    const existing = entryAt(selected.performerId, selected.hand, selected.beatId);
    if (!existing) return;
    const removeIds = new Set([existing.id]);
    const linkId = 'linkId' in existing.action ? existing.action.linkId : undefined;
    let notation = sequence.notation.filter((entry) => !removeIds.has(entry.id));
    if (linkId && existing.action.type === 'ZIP') {
      notation = notation.filter((entry) =>
        !('linkId' in entry.action && entry.action.linkId === linkId),
      );
    } else if (linkId && existing.action.type === 'SPECIAL') {
      notation = notation.map((entry) =>
        entry.action.type === 'SPECIAL' && entry.action.linkId === linkId
          ? { ...entry, action: { type: 'SPECIAL', text: entry.action.text } }
          : entry,
      );
    }
    commit({ ...sequence, notation });
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

  const addBeat = () => commit({
    ...sequence,
    beats: [...sequence.beats, { id: asBeatId(id('beat')), subdivisions: [] }],
  });
  const removeBeat = () => {
    const last = sequence.beats[sequence.beats.length - 1];
    if (!last || sequence.beats.length <= 1) return;
    if (sequence.notation.some((entry) => entry.time.beatId === last.id)) return;
    commit({ ...sequence, beats: sequence.beats.slice(0, -1) });
  };
  const addPerformer = () => {
    const performerId = asPerformerId(id('performer'));
    const performerNumber = sequence.performers.length + 1;
    const performer = { id: performerId, name: 'Juggler ' + performerNumber, identifier: String.fromCharCode(96 + performerNumber) };
    let positions: PositionDefinition[] = [...sequence.positions];
    if (sequence.sequenceType !== 'individual-passing') {
      positions = [
        ...positions,
        ...['A', 'B', 'C'].map((name) => ({
          kind: 'table' as const, id: asPositionId(id('position')), name,
          owner: { kind: 'performer' as const, performerId },
        })),
      ];
    }
    positions = [...positions, ...hands.map((hand) => ({
      kind: 'hand-back' as const, id: asPositionId(id('back')), name: (hand === 'left' ? 'L' : 'R') as 'L' | 'R', performerId, hand,
    }))];
    const seatAssignments = [...sequence.seatAssignments, {
      performerId, seat: { kind: 'rectangle-side' as const, side: (performerNumber % 2 ? 'long-a' : 'long-b') as 'long-a' | 'long-b', seatIndex: Math.floor((performerNumber - 1) / 2) },
    }];
    commit({
      ...sequence, performers: [...sequence.performers, performer], positions, seatAssignments,
      tableLayout: sequence.sequenceType === 'solo' ? { type: 'rectangle', longSideSeatCount: Math.ceil((performerNumber + 1) / 2), shortSideSeatCount: 0 } : sequence.tableLayout,
    });
  };

  const removePerformer = (performerId: string) => {
    const performer = sequence.performers.find((item) => item.id === performerId);
    if (!performer || sequence.performers.length <= 1) return;
    if (!window.confirm('Remove ' + performer.name + ' and their notation?')) return;
    const positions = sequence.positions.filter((position) =>
      position.kind === 'hand-back'
        ? position.performerId !== performerId
        : position.owner.kind === 'shared' || position.owner.performerId !== performerId,
    );
    commit({
      ...sequence,
      performers: sequence.performers.filter((item) => item.id !== performerId),
      positions,
      notation: sequence.notation.filter((entry) => entry.performerId !== performerId),
      seatAssignments: sequence.seatAssignments.filter((assignment) => assignment.performerId !== performerId),
      tableLayout: sequence.sequenceType === 'solo'
        ? { type: 'solo' }
        : { type: 'rectangle', longSideSeatCount: Math.max(1, sequence.performers.length - 1), shortSideSeatCount: 0 },
    });
    if (selected?.performerId === performerId) setSelected(null);
  };

  const addPosition = () => {
    const used = new Set(sequence.positions.filter((position) => position.kind === 'table').map((position) => position.name));
    const name = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').find((letter) => !used.has(letter));
    if (!name) return;
    const owners = sequence.sequenceType === 'individual-passing'
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
    if (type === 'individual-passing') {
      positions = positions.map((position) => position.kind === 'table'
        ? { ...position, owner: { kind: 'shared' as const } } : position);
    } else if (sequence.sequenceType === 'individual-passing') {
      positions = positions.map((position) => position.kind === 'table'
        ? { ...position, owner: { kind: 'performer' as const, performerId: sequence.performers[0]!.id } } : position);
    }
    commit({
      ...sequence, sequenceType: type, positions,
      ...(type === 'individual-passing' ? { individualPassingLayout: 'shared-positions' as const } : {}),
      tableLayout: type === 'solo' ? { type: 'solo' } : { type: 'rectangle', longSideSeatCount: Math.max(1, sequence.performers.length), shortSideSeatCount: 0 },
    });
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

  const changeBpm = (value: number) => {
    if (Number.isFinite(value) && value > 0) commit({ ...sequence, bpm: value });
  };

  const changeInitialLocation = (ballId: string, value: string) => {
    const parts = value.split(':');
    let location: ObjectLocation | undefined;
    if (parts[0] === 'position' && parts[1]) {
      location = { kind: 'position', positionId: asPositionId(parts[1]) };
    } else if (parts[0] === 'held' && parts[1] && (parts[2] === 'left' || parts[2] === 'right')) {
      location = { kind: 'hand-held', performerId: asPerformerId(parts[1]), hand: parts[2] };
    } else if (parts[0] === 'back' && parts[1]) {
      const position = sequence.positions.find((item) => item.id === parts[1]);
      if (position?.kind === 'hand-back') {
        location = { kind: 'hand-back', positionId: position.id, performerId: position.performerId, hand: position.hand };
      }
    }
    if (!location) return;
    const placements = sequence.initialState.placements.filter((placement) => placement.ballId !== ballId);
    commit({ ...sequence, initialState: { placements: [...placements, { ballId: asBallId(ballId), location }] } });
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
    const recipientInput = window.prompt('Recipient performer identifier or name');
    if (!recipientInput) return;
    const recipient = sequence.performers.find((person) =>
      person.id !== selected.performerId &&
      (person.identifier?.toLowerCase() === recipientInput.toLowerCase() ||
       person.name.toLowerCase() === recipientInput.toLowerCase()),
    );
    if (!recipient) {
      window.alert('Performer not found.');
      return;
    }
    const handInput = window.prompt('Receiving hand: left or right', selected.hand === 'left' ? 'right' : 'left');
    if (handInput !== 'left' && handInput !== 'right') return;
    const recipientHand = handInput as Hand;
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
    if (entry.action.type !== 'LIFT' && entry.action.type !== 'LEAVE' && entry.action.type !== 'TAP' && entry.action.type !== 'BOUNCE') return;
    if (entry.action.target.kind !== 'circle-position') return;
    const target = {
      ...entry.action.target,
      ...(field === 'position' ? { position: value as 'A' | 'B' | 'C' } : {}),
      ...(field === 'direction' ? { direction: value as 'left' | 'right' } : {}),
      ...(field === 'distance' ? { distance: Math.max(1, Number(value) || 1) } : {}),
    };
    commit({ ...sequence, notation: sequence.notation.map((item) =>
      item.id === entry.id ? { ...item, action: { ...entry.action, target } } : item,
    ) });
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
          <div className="setting-control"><span>Beats</span><div className="stepper"><button type="button" onClick={removeBeat} disabled={sequence.beats.length <= 1 || sequence.notation.some((entry) => entry.time.beatId === sequence.beats[sequence.beats.length - 1]?.id)}>−</button><output>{sequence.beats.length}</output><button type="button" onClick={addBeat}>+</button></div></div>
          <div className="performer-settings"><span>Performers</span>{sequence.performers.map((performer) => <span className="performer-chip" key={performer.id}>{performer.name}{sequence.performers.length > 1 && <button type="button" className="remove-chip" onClick={() => removePerformer(performer.id)} aria-label={'Remove ' + performer.name}>×</button>}</span>)}<button type="button" onClick={addPerformer}>Add performer</button></div>
          <div className="position-settings"><span>Positions</span>{sequence.positions.filter((position) => position.kind === 'table').map((position) => <div className="position-edit" key={position.id}><input aria-label={'Rename position ' + position.name} defaultValue={position.name} onBlur={(event) => renamePosition(position.id, event.target.value)} /><button type="button" onClick={() => removePosition(position.id)} aria-label={'Remove position ' + position.name}>×</button></div>)}<button type="button" onClick={addPosition}>Add position</button></div>
          <details className="initial-state-settings">
            <summary>Initial object distribution</summary>
            <div className="initial-state-grid">
              {sequence.balls.map((ball, index) => {
                const placement = sequence.initialState.placements.find((item) => item.ballId === ball.id);
                const location = placement?.location;
                const value = !location ? '' : location.kind === 'position'
                  ? 'position:' + location.positionId
                  : location.kind === 'hand-held'
                    ? 'held:' + location.performerId + ':' + location.hand
                    : 'back:' + location.positionId;
                return <label key={ball.id}>Object {index + 1}
                  <select value={value} onChange={(event) => changeInitialLocation(ball.id, event.target.value)}>
                    <option value="">Unplaced</option>
                    {sequence.positions.filter((position) => position.kind === 'table').map((position) => <option key={position.id} value={'position:' + position.id}>{position.name}</option>)}
                    {sequence.performers.flatMap((person) => hands.map((hand) => <option key={person.id + hand} value={'held:' + person.id + ':' + hand}>{person.name} {hand}</option>))}
                    {sequence.positions.filter((position) => position.kind === 'hand-back').map((position) => <option key={position.id} value={'back:' + position.id}>{sequence.performers.find((person) => person.id === position.performerId)?.name} {position.name} back</option>)}
                  </select>
                </label>;
              })}
            </div>
          </details>
        </section>
      )}

      <section className="editor-toolbar" aria-label="Notation actions">
        <div className="action-tools">
          {actionNames.map((name) => (
            <button type="button" key={name} className={activeAction === name ? 'tool active' : 'tool'} onClick={() => { setActiveAction(name); if (selected) addAction(name); }} disabled={!selected}>
              {name}
            </button>
          ))}
          {sequence.sequenceType === 'individual-passing' && <button type="button" className="tool" onClick={addIndividualPass} disabled={!selected}>PASS</button>}
          <button type="button" className="tool" onClick={addClap} disabled={!selected}>CLAP</button>
          <button type="button" className="tool delete-tool" onClick={removeSelected} disabled={!selected || !entryAt(selected.performerId, selected.hand, selected.beatId)}>Delete</button>
        </div>
        <span className="selection-label">{selected ? sequence.performers.find((item) => item.id === selected.performerId)?.name + ' · ' + selected.hand + ' · beat ' + (sequence.beats.findIndex((beat) => beat.id === selected.beatId) + 1) : 'Select a cell'}</span>
        {targetableEntry && targetableEntry.action.target.kind === 'position' && (
          <label className="target-control">Target
            <select value={targetableEntry.action.target.positionId} onChange={(event) => changeTarget(targetableEntry, event.target.value)}>
              {sequence.positions.filter((position) => position.kind === 'table').map((position) => (
                <option key={position.id} value={position.id}>{position.name}</option>
              ))}
            </select>
          </label>
        )}
        {targetableEntry && targetableEntry.action.target.kind === 'circle-position' && (
          <div className="target-control">
            <label>Position <select value={targetableEntry.action.target.position} onChange={(event) => changeCircleTarget(targetableEntry, 'position', event.target.value)}><option>A</option><option>B</option><option>C</option></select></label>
            <label>Direction <select value={targetableEntry.action.target.direction} onChange={(event) => changeCircleTarget(targetableEntry, 'direction', event.target.value)}><option value="left">Left</option><option value="right">Right</option></select></label>
            <label>Distance <input type="number" min="1" max={Math.max(1, sequence.performers.length - 1)} value={targetableEntry.action.target.distance} onChange={(event) => changeCircleTarget(targetableEntry, 'distance', event.target.value)} /></label>
          </div>
        )}
      </section>

      <section className="editor-scroll" aria-label="Notation editor">
        <div className="notation-grid">
          <div className="grid-head" style={{ gridTemplateColumns: `130px repeat(${sequence.beats.length}, minmax(72px, 1fr)) 18px` }}>
            <div className="row-label heading-label">PERFORMER</div>
            {sequence.beats.map((beat, index) => <div className="beat-head" key={beat.id}><span>{index + 1}</span><small>{Math.floor(index / sequence.timeSignature.beatGrouping.length) + 1}.{(index % sequence.timeSignature.beatGrouping.length) + 1}</small></div>)}
            <button type="button" className="add-beat" onClick={addBeat} aria-label="Add beat">+</button>
          </div>
          {sequence.performers.map((performer) => (
            <div className="performer-block" key={performer.id}>
              <div className="performer-heading">{performer.name}<span>{performer.identifier ?? ''}</span></div>
              {hands.map((hand) => (
                <div className="hand-row" key={hand} style={{ gridTemplateColumns: `130px repeat(${sequence.beats.length}, minmax(72px, 1fr)) 18px` }}>
                  <div className="row-label">{hand === 'left' ? 'L' : 'R'}</div>
                  {sequence.beats.map((beat, index) => {
                    const entry = entryAt(performer.id, hand, beat.id);
                    const selectedCell = selected?.performerId === performer.id && selected.hand === hand && selected.beatId === beat.id;
                    const errors = entry ? issuesByEntry.get(entry.id) ?? [] : [];
                    return (
                      <button
                        type="button"
                        key={beat.id}
                        className={'notation-cell' + (selectedCell ? ' selected' : '') + (errors.length ? ' invalid' : '') + (entry ? ' occupied' : '')}
                        onMouseDown={(event) => {
                          if (!event.shiftKey) return;
                          event.preventDefault();
                          const cell = { performerId: performer.id, hand, beatId: beat.id };
                          setSelected(cell);
                          setDragStart(cell);
                        }}
                        onMouseUp={() => {
                          if (!dragStart) return;
                          drawRectangle(dragStart, { performerId: performer.id, hand, beatId: beat.id });
                          setDragStart(null);
                        }}
                        onClick={() => {
                          if (!dragStart) setSelected({ performerId: performer.id, hand, beatId: beat.id });
                        }}
                        onDoubleClick={() => entry && entry.action.type === 'SPECIAL' && addAction('SPECIAL')}
                        aria-label={performer.name + ' ' + hand + ' beat ' + (index + 1) + (entry ? ' ' + actionLabel(entry.action, sequence) : ' empty')}
                        title={errors.join(' ')}
                      >
                        {entry ? <><strong>{entry.action.type === 'ZIP' ? '⇄' : entry.action.type === 'SPECIAL' ? '★' : entry.action.type === 'EMPTY' ? '·' : entry.action.type.slice(0, 1)}</strong><small>{actionLabel(entry.action, sequence).replace(entry.action.type, '').trim()}</small></> : null}
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
              if (entry) setSelected({ performerId: entry.performerId, hand: entry.hand, beatId: entry.time.beatId });
            }}>Go to</button>}</li>
          ))}</ul>}
        </div>
        <div className="state-panel">
          <button type="button" className="state-toggle" onClick={() => setShowState((value) => !value)} aria-expanded={showState}>Object state {showState ? '−' : '+'}</button>
          {showState && <div className="state-content">
            {sequence.balls.map((ball) => {
              const location = simulation.snapshots[simulation.snapshots.length - 1]?.ballLocations[ball.id] ??
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
