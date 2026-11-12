import { useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import {
  asActionEntryId,
  asBallId,
  asBeatId,
  asLinkId,
  asPerformerId,
  asPositionId,
  asSequenceId,
  asSubdivisionId,
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
import { compareRational, rational, type Rational } from './domain/time/rational';
import { DEFAULT_TIME_SIGNATURE } from './domain/time/time-signature';
import { simulateSequence } from './domain/state';
import { getBallRectangleEntries } from './features/editor/rectangles';
import { getTimelineSlots, splitSubdivision, type TimelineSlot } from './features/editor/timeline';
import SequenceRenderer from './features/renderer/SequenceRenderer';

let nextId = 1;
const id = (prefix: string) => prefix + '-' + (++nextId).toString(36);
const hands: readonly Hand[] = ['left', 'right'];
const actionNames = ['LIFT', 'HOLD', 'LEAVE', 'BOUNCE', 'TAP', 'EMPTY', 'ZIP', 'SPECIAL'] as const;
type ActionName = (typeof actionNames)[number];
type EditorCell = { performerId: string; hand: Hand; beatId: string; offset?: Rational; duration?: Rational };
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

function positionNotation(sequence: Sequence, positionId: string): { name: string; subscript?: string } {
  const position = sequence.positions.find((item) => item.id === positionId);
  if (!position) return { name: '?' };
  if (position.kind !== 'table') return { name: position.name };
  const duplicates = sequence.positions.filter((item) => item.kind === 'table' && item.name === position.name);
  if (duplicates.length < 2) return { name: position.name };
  if (position.owner.kind !== 'performer') return { name: position.name };
  const performerId = position.owner.performerId;
  const identifier = sequence.performers.find((person) => person.id === performerId)?.identifier;
  return identifier ? { name: position.name, subscript: identifier } : { name: position.name };
}

function positionReference(sequence: Sequence, positionId: string): string {
  const reference = positionNotation(sequence, positionId);
  return reference.subscript ? reference.name + '(' + reference.subscript + ')' : reference.name;
}

function actionLabel(action: NotationAction, sequence: Sequence): string {
  switch (action.type) {
    case 'LIFT': {
      if (action.target.kind === 'position') return 'LIFT ' + positionReference(sequence, action.target.positionId);
      if (action.target.kind === 'circle-position') return 'LIFT ' + action.target.position + circleSubscript(action.target);
      const target = action.target;
      const targetPerformerId = target.performerId;
      return 'LIFT X' + (sequence.performers.find((person) => person.id === targetPerformerId)?.identifier ?? '?');
    }
    case 'LEAVE': {
      if (action.target.kind === 'position') return 'LEAVE ' + positionReference(sequence, action.target.positionId);
      if (action.target.kind === 'circle-position') return 'LEAVE ' + action.target.position + circleSubscript(action.target);
      const target = action.target;
      const targetHand = target.hand;
      const targetPerformerId = target.performerId;
      return 'LEAVE ' + (targetHand === 'left' ? 'L' : 'R') + (sequence.performers.find((person) => person.id === targetPerformerId)?.identifier ?? '?');
    }
    case 'TAP':
    case 'BOUNCE':
      return action.target.kind === 'position'
        ? action.type + ' ' + positionReference(sequence, action.target.positionId)
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
  if (action.type === 'SPECIAL') return <span className="special-symbol">{action.text || 'SPECIAL'}{action.linkId && <span className="special-link-indicator" aria-label="Linked SPECIAL">↔</span>}</span>;
  let path = '';
  let target = '';
  let subscript = '';
  let circledTarget = false;
  switch (action.type) {
    case 'HOLD': path = 'M7 9H41 M7 39H41'; break;
    case 'LIFT':
      path = 'M7 9H41 M7 9V39 M7 39H41';
      if (action.target.kind === 'position') target = positionReference(sequence, action.target.positionId);
      else if (action.target.kind === 'circle-position') { target = action.target.position; subscript = circleSubscript(action.target); }
      else if ('performerId' in action.target) { const targetPerformerId = action.target.performerId; target = 'X'; subscript = sequence.performers.find((person) => person.id === targetPerformerId)?.identifier ?? '?'; }
      break;
    case 'LEAVE':
      path = 'M7 9H41 M41 9V39 M7 39H41';
      if (action.target.kind === 'position') target = positionReference(sequence, action.target.positionId);
      else if (action.target.kind === 'circle-position') { target = action.target.position; subscript = circleSubscript(action.target); }
      else if ('hand' in action.target) { const targetHand = action.target.hand; const targetPerformerId = action.target.performerId; target = targetHand === 'left' ? 'L' : 'R'; circledTarget = true; subscript = sequence.performers.find((person) => person.id === targetPerformerId)?.identifier ?? '?'; }
      break;
    case 'BOUNCE':
      path = 'M7 9H41 M7 39H41';
      if (action.target.kind === 'position') target = positionReference(sequence, action.target.positionId);
      else { target = action.target.position; subscript = circleSubscript(action.target); }
      break;
    case 'TAP':
      if (action.target.kind === 'position') target = positionReference(sequence, action.target.positionId);
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
      <path d={path} fill="none" stroke="#172033" strokeWidth="3.5" strokeLinecap="square" strokeLinejoin="miter" />
      {circledTarget && <circle cx="20" cy="23" r="8" fill="none" stroke="#263238" strokeWidth="1.8" />}
      {target && <text x={subscript ? 20 : 24} y={subscript ? 23 : 24} textAnchor="middle" dominantBaseline="middle" fontFamily="Arial,sans-serif" fontSize={target.length > 3 ? 18 : subscript ? 22 : 25} fill="#263238">{target}{subscript && <tspan fontSize="14" baselineShift="sub">{subscript}</tspan>}</text>}
    </svg>
  );
}

function NotationMark({ action, sequence, hand }: { action: NotationAction; sequence: Sequence; hand: Hand }) {
  if (action.type === 'EMPTY') return null;
  if (action.type === 'SPECIAL') return <span className="special-symbol">{action.text || 'SPECIAL'}{action.linkId && <span className="special-link-indicator" aria-label="Linked SPECIAL">↔</span>}</span>;
  let path = '';
  let label = '';
  let subscript = '';
  let circledTarget = false;
  switch (action.type) {
    case 'TAP':
      if (action.target.kind === 'position') label = positionReference(sequence, action.target.positionId);
      else { label = action.target.position; subscript = circleSubscript(action.target); }
      break;
    case 'LIFT':
      path = 'M0 0H100 M0 0V100 M0 100H100';
      if (action.target.kind === 'position') label = positionReference(sequence, action.target.positionId);
      else if (action.target.kind === 'circle-position') { label = action.target.position; subscript = circleSubscript(action.target); }
      else if ('performerId' in action.target) { const targetPerformerId = action.target.performerId; label = 'X'; subscript = sequence.performers.find((person) => person.id === targetPerformerId)?.identifier ?? '?'; }
      break;
    case 'HOLD': path = 'M0 0H100 M0 100H100'; break;
    case 'LEAVE':
      path = 'M0 0H100 M100 0V100 M0 100H100';
      if (action.target.kind === 'position') label = positionReference(sequence, action.target.positionId);
      else if (action.target.kind === 'circle-position') { label = action.target.position; subscript = circleSubscript(action.target); }
      else if ('hand' in action.target) { const targetHand = action.target.hand; const targetPerformerId = action.target.performerId; label = targetHand === 'left' ? 'L' : 'R'; circledTarget = true; subscript = sequence.performers.find((person) => person.id === targetPerformerId)?.identifier ?? '?'; }
      break;
    case 'BOUNCE':
      path = 'M0 0H100 M0 100H100';
      if (action.target.kind === 'position') label = positionReference(sequence, action.target.positionId);
      else { label = action.target.position; subscript = circleSubscript(action.target); }
      break;
    case 'ZIP':
      path = action.role === 'source'
        ? hand === 'left' ? 'M0 0H100 M100 0V100' : 'M0 100H100 M100 0V100'
        : hand === 'left' ? 'M0 0H100 M0 0V100' : 'M0 100H100 M0 0V100';
      break;
  }
  return (
    <svg className="ball-segment" viewBox="0 0 100 100" aria-hidden="true">
      <path d={path} fill="none" stroke="#172033" strokeWidth="5.5" strokeLinecap="square" strokeLinejoin="miter" />
      {circledTarget && <circle cx="36" cy="50" r="13" fill="none" stroke="#263238" strokeWidth="1.8" />}
      {label && <text x={subscript ? 38 : 50} y="50" textAnchor="middle" dominantBaseline="middle" fontFamily="Arial,sans-serif" fontSize={label.length > 3 ? 38 : 46} fontWeight="700" fill="#172033">{label}{subscript && <tspan fontSize="28" baselineShift="sub">{subscript}</tspan>}</text>}
    </svg>
  );
}

export default function App() {
  const [sequence, setSequence] = useState<Sequence>(makeSequence);
  const [selected, setSelected] = useState<EditorCell | null>(null);
  const [selectedCells, setSelectedCells] = useState<EditorCell[]>([]);
  const [clipboard, setClipboard] = useState<ClipboardItem[]>([]);
  const [moveStart, setMoveStart] = useState<EditorCell | null>(null);
  const [touchMode, setTouchMode] = useState<'select' | 'draw' | 'move' | null>(null);
  const [history, setHistory] = useState<Sequence[]>([]);
  const [future, setFuture] = useState<Sequence[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [showEditor, setShowEditor] = useState(true);
  const [showRenderer, setShowRenderer] = useState(true);
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<'editor' | 'renderer'>('editor');
  const [panelsSwapped, setPanelsSwapped] = useState(false);
  const [editorShare, setEditorShare] = useState(50);
  const [resizingPanels, setResizingPanels] = useState(false);
  const [showInitialPositions, setShowInitialPositions] = useState(false);
  const [updateReady, setUpdateReady] = useState(false);
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [showState, setShowState] = useState(false);
  const [showShortcutHelp, setShowShortcutHelp] = useState(false);
  const [dragStart, setDragStart] = useState<EditorCell | null>(null);
  const [passRecipientId, setPassRecipientId] = useState('');
  const [passRecipientHand, setPassRecipientHand] = useState<Hand>('left');

  useEffect(() => {
    if (!resizingPanels) return;
    const move = (event: PointerEvent) => {
      const workspace = document.querySelector('.workspace-panels');
      if (!workspace) return;
      const bounds = workspace.getBoundingClientRect();
      if (bounds.width <= 0) return;
      const percentage = ((event.clientX - bounds.left) / bounds.width) * 100;
      setEditorShare(Math.max(25, Math.min(75, panelsSwapped ? 100 - percentage : percentage)));
    };
    const stop = () => setResizingPanels(false);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
    };
  }, [resizingPanels, panelsSwapped]);

  useEffect(() => {
    if (resizingPanels) return;
    window.dispatchEvent(new Event('resize'));
  }, [activeWorkspaceTab, editorShare, panelsSwapped, showEditor, showRenderer, resizingPanels]);

  useEffect(() => {
    const announceUpdate = () => setUpdateReady(true);
    window.addEventListener('points-update-ready', announceUpdate);
    return () => window.removeEventListener('points-update-ready', announceUpdate);
  }, []);

  const editorPerformers = sequence.sequenceType === 'circle-passing' ? sequence.performers.slice(0, 1) : sequence.performers;
  const editorPositions = sequence.positions.filter((position) =>
    position.kind === 'table' && (sequence.sequenceType !== 'circle-passing' ||
      (position.owner.kind === 'performer' && position.owner.performerId === sequence.performers[0]?.id)),
  );
  const simulationModel = useMemo(() => {
    if (sequence.sequenceType !== 'circle-passing' || sequence.performers.length <= 1) {
      return { sequence, sourceEntryById: new Map<string, NotationEntry['id']>() };
    }
    const representative = sequence.performers[0]!;
    const pattern = sequence.notation.filter((entry) => entry.performerId === representative.id);
    const sourceEntryById = new Map<string, NotationEntry['id']>();
    const instances = sequence.performers.slice(1).flatMap((performer) => {
      const linkIds = new Map<string, ReturnType<typeof asLinkId>>();
      return pattern.map((entry) => {
        let action = entry.action;
        if ('linkId' in action && action.linkId) {
          const mapped = linkIds.get(action.linkId) ?? asLinkId('circle-' + action.linkId + '-' + performer.id);
          linkIds.set(action.linkId, mapped);
          action = { ...action, linkId: mapped } as NotationAction;
        }
        if ('target' in action) {
          const sourceTarget = action.target;
          if (sourceTarget.kind === 'position') {
            const targetPosition = sequence.positions.find((position) => position.id === sourceTarget.positionId);
            const matchingPosition = targetPosition?.kind === 'table'
              ? sequence.positions.find((position) => position.kind === 'table' && position.name === targetPosition.name &&
                position.owner.kind === 'performer' && position.owner.performerId === performer.id)
              : targetPosition?.kind === 'hand-back'
                ? sequence.positions.find((position) => position.kind === 'hand-back' && position.hand === targetPosition.hand && position.performerId === performer.id)
                : undefined;
            if (matchingPosition) action = { ...action, target: { kind: 'position', positionId: matchingPosition.id } } as NotationAction;
          }
        }
        const cloneId = asActionEntryId('circle-' + entry.id + '-' + performer.id);
        sourceEntryById.set(cloneId, entry.id);
        return { ...entry, id: cloneId, performerId: performer.id, action };
      });
    });
    return { sequence: { ...sequence, notation: [...pattern, ...instances] }, sourceEntryById };
  }, [sequence]);
  const simulationSequence = simulationModel.sequence;
  const simulation = useMemo(() => simulateSequence(simulationSequence), [simulationSequence]);
  const timelineSlots = getTimelineSlots(sequence.beats);
  const issuesByEntry = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const issue of simulation.validation.issues) {
      for (const entryId of issue.affectedEntries) {
        const sourceId = simulationModel.sourceEntryById.get(entryId) ?? entryId;
        map.set(sourceId, [...(map.get(sourceId) ?? []), issue.description]);
      }
    }
    return map;
  }, [simulation, simulationModel]);
  const displayedIssues = useMemo(() => {
    const grouped = new Map<string, (typeof simulation.validation.issues)[number]>();
    for (const issue of simulation.validation.issues) {
      const key = issue.code + '|' + issue.description;
      const affectedEntries = [...new Set(issue.affectedEntries.map((entryId) =>
        simulationModel.sourceEntryById.get(entryId) ?? entryId,
      ))];
      const existing = grouped.get(key);
      grouped.set(key, existing
        ? { ...existing, affectedEntries: [...new Set([...existing.affectedEntries, ...affectedEntries])] }
        : { ...issue, affectedEntries });
    }
    return [...grouped.values()];
  }, [simulation, simulationModel]);

  const selectCell = (cell: EditorCell, extend = false) => {
    setSelected(cell);
    setPassRecipientId('');
    setPassRecipientHand('left');
    setSelectedCells((current) => extend
      ? current.some((item) => item.performerId === cell.performerId && item.hand === cell.hand && item.beatId === cell.beatId && compareRational(item.offset ?? rational(0), cell.offset ?? rational(0)) === 0) ? current : [...current, cell]
      : [cell]);
  };

  const clearSelection = () => { setSelected(null); setSelectedCells([]); setDragStart(null); setMoveStart(null); setTouchMode(null); setShowActionMenu(false); };

  const commit = (next: Sequence) => {
    setHistory((items) => [...items.slice(-99), sequence]);
    setFuture([]);
    setSequence(next);
  };

  const entryAt = (performerId: string, hand: Hand, beatId: string, offset: Rational = rational(0)) =>
    sequence.notation.find((entry) =>
      entry.performerId === performerId && entry.hand === hand && entry.time.beatId === beatId &&
      compareRational(entry.time.offset, offset) === 0,
    );

  const drawRectangle = (first: EditorCell, last: EditorCell) => {
    if (first.performerId !== last.performerId) return;
    const firstIndex = timelineSlots.findIndex((slot) => slot.beatId === first.beatId && compareRational(slot.offset, first.offset ?? rational(0)) === 0);
    const lastIndex = timelineSlots.findIndex((slot) => slot.beatId === last.beatId && compareRational(slot.offset, last.offset ?? rational(0)) === 0);
    if (firstIndex < 0 || lastIndex < 0 || firstIndex === lastIndex) return;
    const startIndex = Math.min(firstIndex, lastIndex);
    const endIndex = Math.max(firstIndex, lastIndex);
    const startCell = firstIndex <= lastIndex ? first : last;
    const endCell = firstIndex <= lastIndex ? last : first;
    const performerId = asPerformerId(startCell.performerId);
    const targetPosition = sequence.positions.find((position) => position.kind === 'table' && (position.owner.kind === 'shared' || position.owner.performerId === startCell.performerId))
      ?? sequence.positions.find((position) => position.kind === 'table');
    if (!targetPosition) return;
    const cellsToCheck: { hand: Hand; slot: TimelineSlot }[] = [];
    if (startCell.hand === endCell.hand) {
      for (let index = startIndex; index <= endIndex; index += 1) cellsToCheck.push({ hand: startCell.hand, slot: timelineSlots[index]! });
    } else {
      for (let index = startIndex; index <= startIndex + 1; index += 1) cellsToCheck.push({ hand: startCell.hand, slot: timelineSlots[index]! });
      for (let index = startIndex + 1; index <= endIndex; index += 1) cellsToCheck.push({ hand: endCell.hand, slot: timelineSlots[index]! });
    }
    if (cellsToCheck.some(({ hand, slot }) => entryAt(startCell.performerId, hand, slot.beatId, slot.offset))) return;

    const entries: NotationEntry[] = [];
    const add = (hand: Hand, slot: TimelineSlot, action: NotationAction) => entries.push({
      id: asActionEntryId(id('entry')),
      performerId,
      hand,
      time: { beatId: slot.beatId, offset: slot.offset },
      action,
    });
    if (startCell.hand === endCell.hand) {
      for (let index = startIndex; index <= endIndex; index += 1) {
        const slot = timelineSlots[index]!;
        const action: NotationAction = index === startIndex
          ? { type: 'LIFT', target: { kind: 'position', positionId: targetPosition.id } }
          : index === endIndex
            ? { type: 'LEAVE', target: { kind: 'position', positionId: targetPosition.id } }
            : { type: 'HOLD' };
        add(startCell.hand, slot, action);
      }
    } else {
      if (endIndex - startIndex < 2) return;
      const linkId = asLinkId(id('zip'));
      for (let index = startIndex; index <= endIndex; index += 1) {
        const slot = timelineSlots[index]!;
        if (index === startIndex) {
          add(startCell.hand, slot, { type: 'LIFT', target: { kind: 'position', positionId: targetPosition.id } });
        } else if (index === startIndex + 1) {
          add(startCell.hand, slot, { type: 'ZIP', role: 'source', linkId });
          add(endCell.hand, slot, { type: 'ZIP', role: 'receiver', linkId });
        } else if (index === endIndex) {
          add(endCell.hand, slot, { type: 'LEAVE', target: { kind: 'position', positionId: targetPosition.id } });
        } else {
          add(endCell.hand, slot, { type: 'HOLD' });
        }
      }
    }
    commit({ ...sequence, notation: [...sequence.notation, ...entries] });
    selectCell(endCell);
  };

  const handleEditorKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.target instanceof HTMLElement && ['INPUT', 'SELECT', 'TEXTAREA'].includes(event.target.tagName)) return;
    const modifier = event.ctrlKey || event.metaKey;
    if (modifier && event.key.toLowerCase() === 'c') { event.preventDefault(); copySelected(); return; }
    if (modifier && event.key.toLowerCase() === 'v') { event.preventDefault(); pasteSelected(); return; }
    if (modifier && event.key.toLowerCase() === 'z') { event.preventDefault(); if (event.shiftKey) redo(); else undo(); return; }
    if (modifier && event.key.toLowerCase() === 'y') { event.preventDefault(); redo(); return; }
    if (event.key === '?' || (event.shiftKey && event.key === '/')) { event.preventDefault(); setShowShortcutHelp(true); return; }
    if (event.key === 'Escape') {
      if (showShortcutHelp) setShowShortcutHelp(false);
      else clearSelection();
      return;
    }
    if (!selected) return;
    if (event.key === 'Backspace' || event.key === 'Delete') {
      event.preventDefault();
      removeSelected();
      return;
    }
    const selectedEntry = entryAt(selected.performerId, selected.hand, selected.beatId, selected.offset ?? rational(0));
    const targetKey = event.key.toUpperCase();
    if (!modifier && /^[A-Z]$/.test(targetKey)) {
      if (selectedEntry?.action.type === 'LEAVE' && 'hand' in selectedEntry.action.target && 'performerId' in selectedEntry.action.target) {
        const recipient = sequence.performers.find((person) => person.identifier?.toUpperCase() === targetKey && person.id !== selected.performerId);
        if (recipient) { event.preventDefault(); changePassTarget(selectedEntry, recipient.id, selectedEntry.action.target.hand); return; }
      }
      if (selectedEntry?.action.type === 'LIFT' && 'performerId' in selectedEntry.action.target) {
        const source = sequence.performers.find((person) => person.identifier?.toUpperCase() === targetKey && person.id !== selected.performerId);
        if (source) { event.preventDefault(); changePassTarget(selectedEntry, source.id); return; }
      }
      const circlePositionKey = sequence.sequenceType === 'circle-passing' && ['A', 'B', 'C'].includes(targetKey);
      const position = circlePositionKey ? undefined : sequence.positions.find((item) =>
        item.name.toUpperCase() === targetKey &&
        (item.kind === 'table'
          ? item.owner.kind === 'shared' || item.owner.performerId === selected.performerId
          : (selectedEntry?.action.type === 'LIFT' || selectedEntry?.action.type === 'LEAVE') && item.performerId === selected.performerId),
      );
      if (circlePositionKey || position) {
        event.preventDefault();
        const currentAction = selectedEntry?.action;
        const nextType: ActionName = currentAction?.type === 'HOLD' ? 'BOUNCE'
          : currentAction?.type === 'EMPTY' || !currentAction ? 'TAP'
            : ['LIFT', 'LEAVE', 'TAP', 'BOUNCE'].includes(currentAction.type) ? currentAction.type
              : 'TAP';
        const target: TableActionTarget = circlePositionKey
          ? { kind: 'circle-position', position: targetKey as 'A' | 'B' | 'C' }
          : { kind: 'position', positionId: position!.id };
        const nextAction = { type: nextType, target } as NotationAction;
        const nextEntry: NotationEntry = selectedEntry
          ? { ...selectedEntry, action: nextAction }
          : {
              id: asActionEntryId(id('entry')),
              performerId: asPerformerId(selected.performerId),
              hand: selected.hand,
              time: { beatId: asBeatId(selected.beatId), offset: selected.offset ?? rational(0) },
              action: nextAction,
            };
        let notation = sequence.notation.filter((entry) => entry.id !== selectedEntry?.id);
        const oldAction = selectedEntry?.action;
        const oldLinkId = oldAction && 'linkId' in oldAction ? oldAction.linkId : undefined;
        if (oldLinkId && (oldAction?.type === 'ZIP' ||
          (oldAction?.type === 'LEAVE' && 'target' in oldAction && oldAction.target.kind === 'pass-recipient-hand') ||
          (oldAction?.type === 'LIFT' && 'target' in oldAction && oldAction.target.kind === 'pass-source'))) {
          notation = notation.filter((entry) => !('linkId' in entry.action && entry.action.linkId === oldLinkId));
        } else if (oldLinkId && oldAction?.type === 'SPECIAL') {
          notation = notation.map((entry) => entry.action.type === 'SPECIAL' && entry.action.linkId === oldLinkId
            ? { ...entry, action: { type: 'SPECIAL', text: entry.action.text } }
            : entry);
        }
        commit({ ...sequence, notation: [...notation, nextEntry] });
        setShowActionMenu(false);
        return;
      }
    }
    const actionShortcuts: Record<string, ActionName> = {
      '1': 'LIFT', '2': 'HOLD', '3': 'LEAVE', '4': 'BOUNCE',
      '5': 'TAP', '6': 'EMPTY', '7': 'ZIP', '8': 'SPECIAL',
    };
    if (!modifier && actionShortcuts[event.key]) {
      event.preventDefault();
      addAction(actionShortcuts[event.key]!);
      return;
    }
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    const rows = editorPerformers.flatMap((performer) =>
      hands.map((hand) => ({ performerId: performer.id, hand })),
    );
    const rowIndex = rows.findIndex((row) => row.performerId === selected.performerId && row.hand === selected.hand);
    const slotIndex = timelineSlots.findIndex((slot) => slot.beatId === selected.beatId && compareRational(slot.offset, selected.offset ?? rational(0)) === 0);
    let nextRow = rowIndex;
    let nextSlot = slotIndex;
    if (event.key === 'ArrowLeft') nextSlot -= 1;
    if (event.key === 'ArrowRight') nextSlot += 1;
    if (event.key === 'ArrowUp') nextRow -= 1;
    if (event.key === 'ArrowDown') nextRow += 1;
    const row = rows[Math.max(0, Math.min(rows.length - 1, nextRow))];
    const slot = timelineSlots[Math.max(0, Math.min(timelineSlots.length - 1, nextSlot))];
    if (row && slot) { selectCell({ performerId: row.performerId, hand: row.hand, beatId: slot.beatId, offset: slot.offset, duration: slot.duration }, event.shiftKey); setShowActionMenu(!entryAt(row.performerId, row.hand, slot.beatId, slot.offset)); }
  };

  const addAction = (type: ActionName) => {
    if (!selected) return;
    const { performerId, hand, beatId } = selected;
    const existing = entryAt(performerId, hand, beatId, selected.offset ?? rational(0));
    const linkId = asLinkId(id('link'));
    let action = makeAction(type, sequence, linkId, performerId);
    const existingSpecialLinkId = existing?.action.type === 'SPECIAL' ? existing.action.linkId : undefined;
    if (type === 'SPECIAL') {
      const text = window.prompt('SPECIAL', existing?.action.type === 'SPECIAL' ? existing.action.text : 'SPECIAL');
      if (text === null) return;
      action = { type: 'SPECIAL', text, ...(existingSpecialLinkId ? { linkId: existingSpecialLinkId } : {}) };
    }
    let notation = sequence.notation.filter((entry) => entry.id !== existing?.id);
    if (existing && 'linkId' in existing.action && existing.action.linkId) {
      const existingLinkId = existing.action.linkId;
      if (existing.action.type === 'ZIP' ||
          (existing.action.type === 'LEAVE' && existing.action.target.kind === 'pass-recipient-hand') ||
          (existing.action.type === 'LIFT' && existing.action.target.kind === 'pass-source')) {
        notation = notation.filter((entry) =>
          !('linkId' in entry.action && entry.action.linkId === existingLinkId),
        );
      } else if (existing.action.type === 'SPECIAL' && type !== 'SPECIAL') {
        notation = notation.map((entry) =>
          entry.action.type === 'SPECIAL' && entry.action.linkId === existingLinkId
            ? { ...entry, action: { type: 'SPECIAL', text: entry.action.text } }
            : entry,
        );
      }
    }
    if (type === 'SPECIAL' && existingSpecialLinkId && action.type === 'SPECIAL') {
      notation = notation.map((entry) => entry.action.type === 'SPECIAL' && entry.action.linkId === existingSpecialLinkId
        ? { ...entry, action: { ...entry.action, text: action.text } }
        : entry);
    }
    const newEntry: NotationEntry = {
      id: existing?.id ?? asActionEntryId(id('entry')),
      performerId: asPerformerId(performerId),
      hand,
      time: { beatId: asBeatId(beatId), offset: selected.offset ?? rational(0) },
      action,
    };
    notation = [...notation, newEntry];

    if (type === 'ZIP') {
      const otherHand = hand === 'left' ? 'right' : 'left';
      const other = entryAt(performerId, otherHand, beatId, selected.offset ?? rational(0));
      if (other) {
        window.alert('The other hand already has notation at this beat.');
        return;
      }
      const paired: NotationEntry = {
        id: asActionEntryId(id('entry')),
        performerId: asPerformerId(performerId),
        hand: otherHand,
        time: { beatId: asBeatId(beatId), offset: selected.offset ?? rational(0) },
        action: { type: 'ZIP', role: 'receiver', linkId },
      };
      notation = [...notation.filter((entry) => entry.id !== newEntry.id), newEntry, paired];
    }
    commit({ ...sequence, notation });
    setShowActionMenu(false);
  };

  const removeCells = (cells: readonly EditorCell[]) => {
    const entries = cells.map((cell) => entryAt(cell.performerId, cell.hand, cell.beatId, cell.offset ?? rational(0))).filter((entry): entry is NotationEntry => Boolean(entry));
    if (!entries.length) return;
    const removeIds = new Set(entries.map((entry) => entry.id));
    const zipLinks = new Set(entries.flatMap((entry) => entry.action.type === 'ZIP' ? [entry.action.linkId] : []));
    for (const linkId of zipLinks) {
      for (const entry of sequence.notation) if (entry.action.type === 'ZIP' && entry.action.linkId === linkId) removeIds.add(entry.id);
    }
    const passLinks = new Set(entries.flatMap((entry) =>
      (entry.action.type === 'LEAVE' && entry.action.target.kind === 'pass-recipient-hand') ||
      (entry.action.type === 'LIFT' && entry.action.target.kind === 'pass-source')
        ? 'linkId' in entry.action && entry.action.linkId ? [entry.action.linkId] : []
        : [],
    ));
    for (const linkId of passLinks) {
      for (const entry of sequence.notation) if ('linkId' in entry.action && entry.action.linkId === linkId) removeIds.add(entry.id);
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
    if (cells.length) { setSelectedCells(selected ? [selected] : []); setShowActionMenu(true); }
  };

  const moveRectangle = (first: EditorCell, last: EditorCell) => {
    if (first.performerId !== last.performerId || first.hand !== last.hand) {
      window.alert('Move a rectangle within the same hand row.');
      return;
    }
    const sourceSlot = timelineSlots.findIndex((slot) => slot.beatId === first.beatId && compareRational(slot.offset, first.offset ?? rational(0)) === 0);
    const targetSlot = timelineSlots.findIndex((slot) => slot.beatId === last.beatId && compareRational(slot.offset, last.offset ?? rational(0)) === 0);
    const offset = targetSlot - sourceSlot;
    if (sourceSlot < 0 || targetSlot < 0 || offset === 0) return;
    const selectedSourceCells = selectedCells.some((cell) =>
      cell.performerId === first.performerId && cell.hand === first.hand && cell.beatId === first.beatId &&
      compareRational(cell.offset ?? rational(0), first.offset ?? rational(0)) === 0,
    ) ? selectedCells : [first];
    const sourceEntries = selectedSourceCells
      .map((cell) => entryAt(cell.performerId, cell.hand, cell.beatId, cell.offset ?? rational(0)))
      .filter((entry): entry is NotationEntry => Boolean(entry));
    if (!sourceEntries.length) return;
    const moving = new Map<string, NotationEntry>();
    for (const entry of sourceEntries) {
      for (const rectangleEntry of getBallRectangleEntries(sequence, simulation, entry)) moving.set(rectangleEntry.id, rectangleEntry);
    }
    const rectangle = [...moving.values()];
    if (!rectangle.length) return;
    const movingIds = new Set(rectangle.map((entry) => entry.id));
    const destinations = rectangle.map((entry) => {
      const currentSlot = timelineSlots.findIndex((slot) => slot.beatId === entry.time.beatId && compareRational(slot.offset, entry.time.offset) === 0);
      return { entry, slot: timelineSlots[currentSlot + offset] };
    });
    if (destinations.some((item) => !item.slot)) {
      window.alert('The complete rectangle selection would extend beyond the sequence.');
      return;
    }
    const conflict = destinations.some(({ entry, slot }) => sequence.notation.some((other) =>
      !movingIds.has(other.id) && other.performerId === entry.performerId && other.hand === entry.hand &&
      other.time.beatId === slot!.beatId && compareRational(other.time.offset, slot!.offset) === 0,
    ));
    if (conflict) {
      window.alert('Move cancelled because the destination contains notation.');
      return;
    }
    const slotByEntry = new Map(destinations.map(({ entry, slot }) => [entry.id, slot!]));
    commit({ ...sequence, notation: sequence.notation.map((entry) => {
      const slot = slotByEntry.get(entry.id);
      return slot ? { ...entry, time: { beatId: slot.beatId, offset: slot.offset } } : entry;
    }) });
    const shiftCell = (cell: EditorCell): EditorCell => {
      const index = timelineSlots.findIndex((slot) => slot.beatId === cell.beatId && compareRational(slot.offset, cell.offset ?? rational(0)) === 0);
      const slot = timelineSlots[index + offset];
      return slot ? { ...cell, beatId: slot.beatId, offset: slot.offset, duration: slot.duration } : cell;
    };
    setSelectedCells((cells) => cells.map(shiftCell));
    if (selected) setSelected(shiftCell(selected));
  };

  const copySelected = () => {
    const cells = selectedCells.length ? selectedCells : selected ? [selected] : [];
    if (!cells.length) return;
    const anchor = cells[0]!;
    const anchorRow = editorPerformers.findIndex((person) => person.id === anchor.performerId) * 2 + hands.indexOf(anchor.hand);
    const anchorBeat = sequence.beats.findIndex((beat) => beat.id === anchor.beatId);
    const entries = cells.map((cell) => entryAt(cell.performerId, cell.hand, cell.beatId, cell.offset ?? rational(0))).filter((entry): entry is NotationEntry => Boolean(entry));
    const links = new Set(entries.flatMap((entry) => 'linkId' in entry.action && entry.action.linkId ? [entry.action.linkId] : []));
    for (const entry of sequence.notation) {
      if ('linkId' in entry.action && entry.action.linkId && links.has(entry.action.linkId) && !entries.some((item) => item.id === entry.id)) entries.push(entry);
    }
    if (!entries.length) { setClipboard([]); return; }
    setClipboard(entries.map((entry) => ({
      entry,
      rowOffset: editorPerformers.findIndex((person) => person.id === entry.performerId) * 2 + hands.indexOf(entry.hand) - anchorRow,
      beatOffset: sequence.beats.findIndex((beat) => beat.id === entry.time.beatId) - anchorBeat,
    })));
  };

  const pasteSelected = () => {
    if (!selected || !clipboard.length) return;
    const rows = editorPerformers.flatMap((performer) => hands.map((hand) => ({ performerId: performer.id, hand })));
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
    setShowActionMenu(false);
  };

  const selectInterval = (beatId: string, offset: Rational, duration: Rational) => {
    const cells = editorPerformers.flatMap((performer) => hands.map((hand) => ({ performerId: performer.id, hand, beatId, offset, duration })));
    if (cells[0]) { setSelected(cells[0]); setSelectedCells(cells); setPassRecipientId(''); setPassRecipientHand('left'); setShowActionMenu(false); }
  };

  const selectBeat = (beatId: string) => {
    const cells = editorPerformers.flatMap((performer) => hands.flatMap((hand) =>
      timelineSlots.filter((slot) => slot.beatId === beatId).map((slot) => ({
        performerId: performer.id, hand, beatId, offset: slot.offset, duration: slot.duration,
      })),
    ));
    if (cells[0]) { setSelected(cells[0]); setSelectedCells(cells); setPassRecipientId(''); setPassRecipientHand('left'); setShowActionMenu(false); }
  };

  const subdivideInterval = (beatId: string, offset: Rational, duration: Rational) => {
    const beat = sequence.beats.find((item) => item.id === beatId);
    if (!beat) return;
    const updated = splitSubdivision(beat, offset, duration, () => asSubdivisionId(id('subdivision')));
    if (updated === beat) return;
    commit({ ...sequence, beats: sequence.beats.map((item) => item.id === beatId ? updated : item) });
    setShowActionMenu(false);
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
        if (!initial) return false;
        const current = latest?.ballLocations[ball.id];
        if (!current) return true;
        const location = initial.location;
        const positionId = location.kind === 'position' || location.kind === 'hand-back' ? location.positionId : undefined;
        const referencedByPosition = positionId !== undefined && sequence.notation.some((entry) => positionTargetId(entry.action) === positionId);
        const referencedByHand = location.kind === 'hand-held' && sequence.notation.some((entry) =>
          entry.performerId === location.performerId && entry.hand === location.hand &&
          ['HOLD', 'LIFT', 'LEAVE', 'BOUNCE', 'ZIP', 'SPECIAL'].includes(entry.action.type),
        );
        return referencedByPosition || referencedByHand || simulation.snapshots.some((snapshot) =>
          !snapshot.ballLocations[ball.id] || !sameLocation(location, snapshot.ballLocations[ball.id]!),
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
    setShowActionMenu(true);
  };
  const addBeat = () => insertBeatAfter();
  const moveBeat = (beatId: string, direction: -1 | 1) => {
    const index = sequence.beats.findIndex((beat) => beat.id === beatId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= sequence.beats.length) return;
    const beats = [...sequence.beats];
    [beats[index], beats[target]] = [beats[target]!, beats[index]!];
    commit({ ...sequence, beats });
    setShowActionMenu(false);
  };
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
    const usedIdentifiers = new Set(sequence.performers.map((person) => person.identifier));
    const identifier = 'abcdefghijklmnopqrstuvwxyz'.split('').find((letter) => !usedIdentifiers.has(letter));
    if (!identifier) { window.alert('The editor supports at most 26 performer identifiers.'); return; }
    const usedNames = new Set(sequence.performers.map((person) => person.name));
    let nameNumber = performerNumber;
    while (usedNames.has('Juggler ' + nameNumber)) nameNumber += 1;
    const performer = { id: performerId, name: 'Juggler ' + nameNumber, identifier };
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
    const missingSeatAssignments = sequence.performers
      .filter((person) => !sequence.seatAssignments.some((assignment) => assignment.performerId === person.id))
      .map((person) => {
        const index = sequence.performers.findIndex((item) => item.id === person.id);
        return {
          performerId: person.id,
          seat: { kind: 'rectangle-side' as const, side: (index % 2 === 0 ? 'long-a' : 'long-b') as 'long-a' | 'long-b', seatIndex: Math.floor(index / 2) },
        };
      });
    const seatAssignments = [...sequence.seatAssignments, ...missingSeatAssignments, {
      performerId, seat: { kind: 'rectangle-side' as const, side: (performerNumber % 2 ? 'long-a' : 'long-b') as 'long-a' | 'long-b', seatIndex: Math.floor((performerNumber - 1) / 2) },
    }];
    commit({
      ...sequence, performers: [...sequence.performers, performer], positions, seatAssignments,
      balls: [...sequence.balls, ...newBalls],
      initialState: { placements: [...sequence.initialState.placements,
        { ballId: newBalls[0]!.id, location: initialA },
        { ballId: newBalls[1]!.id, location: initialC },
      ] },
      tableLayout: sequence.sequenceType === 'circle-passing'
        ? { type: 'polygon', sideCount: performerNumber }
        : sequence.sequenceType === 'solo' ? { type: 'rectangle', longSideSeatCount: Math.max(1, Math.ceil(performerNumber / 2)), shortSideSeatCount: 0 } : sequence.tableLayout,
    });
  };

  const updatePerformer = (performerId: string, field: 'name' | 'identifier', value: string) => {
    const clean = value.trim();
    if (field === 'name' && !clean) { window.alert('A performer needs a name.'); return; }
    if (field === 'identifier') {
      if (!/^[a-z]$/.test(clean)) { window.alert('Use one lowercase letter as the performer identifier.'); return; }
      if (sequence.performers.some((person) => person.id !== performerId && person.identifier === clean)) {
        window.alert('This performer identifier is already in use.');
        return;
      }
    }
    commit({ ...sequence, performers: sequence.performers.map((person) => person.id === performerId
      ? field === 'name' ? { ...person, name: clean } : { ...person, identifier: clean }
      : person) });
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
      notation: sequence.sequenceType === 'circle-passing' && sequence.performers[0]?.id === performerId
        ? sequence.notation.filter((entry) => entry.performerId === performerId).map((entry) => ({ ...entry, performerId: sequence.performers.find((item) => item.id !== performerId)!.id }))
        : sequence.notation.filter((entry) => entry.performerId !== performerId),
      seatAssignments: sequence.seatAssignments.filter((assignment) => assignment.performerId !== performerId),
      tableLayout: sequence.sequenceType === 'solo'
        ? { type: 'solo' }
        : sequence.sequenceType === 'circle-passing'
          ? { type: 'polygon', sideCount: Math.max(3, sequence.performers.length - 1) }
          : { type: 'rectangle', longSideSeatCount: Math.max(1, Math.ceil((sequence.performers.length - 1) / 2)), shortSideSeatCount: 0 },
    });
    const remainingPerformers = sequence.performers.filter((person) => person.id !== performerId);
    if (selected?.performerId === performerId) {
      if (sequence.sequenceType === 'circle-passing' && remainingPerformers[0]) {
        selectCell({ ...selected, performerId: remainingPerformers[0].id });
      } else {
        clearSelection();
      }
    } else {
      setSelectedCells((cells) => cells.filter((cell) => cell.performerId !== performerId));
    }
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
    const circlePositionIds = sequence.sequenceType === 'circle-passing'
      ? new Set(sequence.positions.filter((position) => position.kind === 'table' && position.name === current.name).map((position) => position.id))
      : new Set([positionId]);
    const duplicate = sequence.positions.some((position) =>
      position.kind === 'table' && !circlePositionIds.has(position.id) && position.name === cleanName &&
      (sequence.sequenceType === 'circle-passing' ||
       (position.owner.kind === current.owner.kind &&
        (position.owner.kind === 'shared' || (current.owner.kind === 'performer' && position.owner.performerId === current.owner.performerId)))),
    );
    if (duplicate) {
      window.alert('A position with this name already exists in the same layout.');
      return;
    }
    commit({ ...sequence, positions: sequence.positions.map((position) =>
      circlePositionIds.has(position.id) && position.kind === 'table' ? { ...position, name: cleanName } : position,
    ) });
  };

  const removePosition = (positionId: string) => {
    const current = sequence.positions.find((position) => position.id === positionId);
    const removeIds = sequence.sequenceType === 'circle-passing' && current?.kind === 'table'
      ? new Set(sequence.positions.filter((position) => position.kind === 'table' && position.name === current.name).map((position) => position.id))
      : new Set([positionId]);
    commit({ ...sequence, positions: sequence.positions.filter((position) => !removeIds.has(position.id)) });
  };

  const changeType = (type: SequenceType) => {
    if (type === 'circle-passing' && sequence.performers.length < 3) {
      window.alert('Circle passing requires at least three participants.');
      return;
    }
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

    const representativeId = sequence.performers[0]?.id;
    const sourcePerformerId = sequence.performers.find((person) =>
      sequence.notation.some((entry) => entry.performerId === person.id),
    )?.id ?? representativeId;
    let notation = sequence.notation;
    if (type === 'circle-passing') {
      notation = sequence.notation
        .filter((entry) => entry.performerId === sourcePerformerId)
        .map((entry) => ({ ...entry, performerId: representativeId! }));
    } else if (sequence.sequenceType === 'circle-passing' && representativeId) {
      const pattern = sequence.notation.filter((entry) => entry.performerId === representativeId);
      const instances = sequence.performers.slice(1).flatMap((performer) => {
        const linkIds = new Map<string, ReturnType<typeof asLinkId>>();
        return pattern.map((entry) => {
          let action = entry.action;
          if ('linkId' in action && action.linkId) {
            const mapped = linkIds.get(action.linkId) ?? asLinkId('mode-' + action.linkId + '-' + performer.id);
            linkIds.set(action.linkId, mapped);
            action = { ...action, linkId: mapped } as NotationAction;
          }
          if ('target' in action) {
            const sourceTarget = action.target;
            const matchingPosition = sourceTarget.kind === 'circle-position'
              ? positions.find((position) => position.kind === 'table' &&
                position.name === sourceTarget.position &&
                position.owner.kind === 'performer' && position.owner.performerId === performer.id)
              : sourceTarget.kind === 'position'
                ? (() => {
                    const previousPosition = positions.find((position) => position.id === sourceTarget.positionId);
                    return previousPosition?.kind === 'hand-back'
                      ? positions.find((position) => position.kind === 'hand-back' && position.hand === previousPosition.hand && position.performerId === performer.id)
                      : undefined;
                  })()
                : undefined;
            if (matchingPosition) action = { ...action, target: { kind: 'position', positionId: matchingPosition.id } } as NotationAction;
          }
          return { ...entry, id: asActionEntryId('mode-' + entry.id + '-' + performer.id), performerId: performer.id, action };
        });
      });
      notation = [...pattern, ...instances];
    }

    notation = notation.map((entry) => {
      const action = entry.action;
      if (!('target' in action)) return entry;
      const currentTarget = action.target;
      if (type === 'circle-passing' && currentTarget.kind === 'position') {
        const targetPosition = positions.find((position) => position.id === currentTarget.positionId);
        if (targetPosition?.kind === 'table' && ['A', 'B', 'C'].includes(targetPosition.name)) {
          return { ...entry, action: { ...action, target: { kind: 'circle-position' as const, position: targetPosition.name as 'A' | 'B' | 'C' } } as NotationAction };
        }
      }
      if (type !== 'circle-passing' && currentTarget.kind === 'circle-position') {
        const targetPosition = positions.find((position) => position.kind === 'table' && position.name === currentTarget.position &&
          (position.owner.kind === 'shared' || (position.owner.kind === 'performer' && position.owner.performerId === entry.performerId)));
        if (targetPosition) return { ...entry, action: { ...action, target: { kind: 'position' as const, positionId: targetPosition.id } } as NotationAction };
      }
      return entry;
    });

    const seatAssignments = type === 'individual-passing'
      ? [...sequence.seatAssignments, ...sequence.performers
          .filter((person) => !sequence.seatAssignments.some((assignment) => assignment.performerId === person.id))
          .map((person) => {
            const index = sequence.performers.findIndex((item) => item.id === person.id);
            return {
              performerId: person.id,
              seat: { kind: 'rectangle-side' as const, side: (index % 2 === 0 ? 'long-a' : 'long-b') as 'long-a' | 'long-b', seatIndex: Math.floor(index / 2) },
            };
          })]
      : sequence.seatAssignments;
    commit({
      ...sequence, sequenceType: type, positions, notation, individualPassingLayout, seatAssignments,
      tableLayout: type === 'solo' ? { type: 'solo' }
        : type === 'circle-passing' ? { type: 'polygon', sideCount: sequence.performers.length }
          : { type: 'rectangle', longSideSeatCount: Math.max(1, Math.ceil(sequence.performers.length / 2)), shortSideSeatCount: 0 },
    });
    if (type === 'circle-passing') {
      if (selected && representativeId) selectCell({ ...selected, performerId: representativeId });
      else setSelectedCells([]);
    }
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
    if (entryAt(selected.performerId, selected.hand, selected.beatId, selected.offset ?? rational(0)) ||
        entryAt(selected.performerId, otherHand, selected.beatId, selected.offset ?? rational(0))) return;
    const linkId = asLinkId(id('special-link'));
    const entries: NotationEntry[] = hands.map((hand) => ({
      id: asActionEntryId(id('entry')),
      performerId: asPerformerId(selected.performerId),
      hand,
      time: { beatId: asBeatId(selected.beatId), offset: selected.offset ?? rational(0) },
      action: { type: 'SPECIAL', text: 'Clap', linkId },
    }));
    commit({ ...sequence, notation: [...sequence.notation, ...entries] });
    setShowActionMenu(false);
  };

  const addIndividualPass = () => {
    if (!selected || sequence.sequenceType !== 'individual-passing') return;
    const recipient = sequence.performers.find((person) => person.id === passRecipientId && person.id !== selected.performerId) ?? sequence.performers.find((person) => person.id !== selected.performerId);
    if (!recipient || recipient.id === selected.performerId) return;
    const recipientHand = passRecipientHand;
    if (entryAt(selected.performerId, selected.hand, selected.beatId, selected.offset ?? rational(0)) ||
        entryAt(recipient.id, recipientHand, selected.beatId, selected.offset ?? rational(0))) {
      window.alert('Both hands must be empty at this beat.');
      return;
    }
    const linkId = asLinkId(id('pass-link'));
    const time = { beatId: asBeatId(selected.beatId), offset: selected.offset ?? rational(0) };
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
    setShowActionMenu(false);
    setPassRecipientId('');
    setPassRecipientHand('left');
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
  const editSpecial = (entry: NotationEntry, cell: EditorCell) => {
    if (entry.action.type !== 'SPECIAL') return;
    const text = window.prompt('SPECIAL', entry.action.text);
    if (text === null) return;
    const linkId = entry.action.linkId;
    commit({ ...sequence, notation: sequence.notation.map((item) =>
      item.action.type === 'SPECIAL' && (item.id === entry.id || (linkId !== undefined && item.action.linkId === linkId))
        ? { ...item, action: { ...item.action, text } }
        : item,
    ) });
    selectCell(cell);
    setShowActionMenu(false);
  };

  const selectedEntry = selected
    ? entryAt(selected.performerId, selected.hand, selected.beatId, selected.offset ?? rational(0))
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
          {showEditor && showRenderer && <button type="button" onClick={() => setPanelsSwapped((value) => !value)} aria-label="Swap panels" title="Swap panels">⇄</button>}
          {!showEditor && <button type="button" onClick={() => setShowEditor(true)}>Show editor</button>}
          {!showRenderer && <button type="button" onClick={() => setShowRenderer(true)}>Show renderer</button>}
          <button type="button" onClick={() => setShowSettings((value) => !value)} aria-expanded={showSettings}>Settings</button>
          <button type="button" onClick={() => setShowShortcutHelp(true)} aria-label="Keyboard shortcuts" title="Keyboard shortcuts">?</button>
        </div>
      </header>
      {updateReady && <div className="update-banner" role="status">
        <span>An update is ready. It will activate after all POINTS tabs are closed. This tab will not reload automatically.</span>
        <button type="button" onClick={() => setUpdateReady(false)} aria-label="Dismiss update notice">Dismiss</button>
      </div>}
      <nav className="workspace-tabs" aria-label="Workspace views">
        {showEditor && <button type="button" className={activeWorkspaceTab === 'editor' ? 'active' : ''} aria-pressed={activeWorkspaceTab === 'editor'} onClick={() => setActiveWorkspaceTab('editor')}>Editor</button>}
        {showRenderer && <button type="button" className={activeWorkspaceTab === 'renderer' ? 'active' : ''} aria-pressed={activeWorkspaceTab === 'renderer'} onClick={() => setActiveWorkspaceTab('renderer')}>Renderer</button>}
      </nav>

      {showSettings && (
        <section className="settings-panel" aria-label="Sequence settings">
          <label>Type
            <select value={sequence.sequenceType} onChange={(event) => changeType(event.target.value as SequenceType)}>
              <option value="solo">Solo</option>
              <option value="circle-passing" disabled={sequence.performers.length < 3}>Circle passing</option>
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
          <div className="performer-settings">
            <span>{sequence.sequenceType === 'circle-passing' ? 'People' : 'Performers'}</span>
            {sequence.sequenceType === 'circle-passing' ? (
              <div className="stepper" aria-label="People in circle">
                <button type="button" onClick={() => removePerformer(sequence.performers[sequence.performers.length - 1]!.id)} disabled={sequence.performers.length <= 3} aria-label="Remove one person">−</button>
                <output aria-label="People count">{sequence.performers.length}</output>
                <button type="button" onClick={addPerformer} aria-label="Add one person">+</button>
              </div>
            ) : (
              <>
                {sequence.performers.map((performer) => (
                  <div className="performer-chip" key={performer.id + performer.name + performer.identifier}>
                    <input className="performer-name" aria-label={'Performer name ' + performer.name} defaultValue={performer.name} onBlur={(event) => updatePerformer(performer.id, 'name', event.target.value)} />
                    <input className="performer-identifier" aria-label={'Performer identifier ' + (performer.identifier ?? '')} defaultValue={performer.identifier ?? ''} maxLength={1} onBlur={(event) => updatePerformer(performer.id, 'identifier', event.target.value)} />
                    {sequence.performers.length > 1 && <button type="button" className="remove-chip" onClick={() => removePerformer(performer.id)} aria-label={'Remove ' + performer.name}>×</button>}
                  </div>
                ))}
                <button type="button" onClick={addPerformer}>Add performer</button>
              </>
            )}
          </div>
          <div className="position-settings">
            <span>Positions</span>
            {sequence.sequenceType === 'circle-passing' ? <span className="position-summary">A · B · C</span> : <>
              {editorPositions.map((position) => (
                <div className="position-edit" key={position.id + position.name}>
                  <input aria-label={'Rename position ' + position.name} defaultValue={position.name} onBlur={(event) => renamePosition(position.id, event.target.value)} />
                  <button type="button" onClick={() => removePosition(position.id)} aria-label={'Remove position ' + position.name}>×</button>
                </div>
              ))}
              <button type="button" onClick={addPosition}>Add position</button>
            </>}
          </div>
        </section>
      )}

      <section className="initial-positions" aria-label="Initial positions">
        <button type="button" className="initial-positions-heading" onClick={() => setShowInitialPositions((value) => !value)} aria-expanded={showInitialPositions}>
          <strong>Initial positions</strong>
          <span>{sequence.initialState.placements.length} / {sequence.balls.length}</span>
          <span className="disclosure-indicator">{showInitialPositions ? '−' : '+'}</span>
        </button>
        {showInitialPositions && <div className="initial-positions-content">
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
                      <span className="position-name">{positionReference(sequence, position.id)}</span><span className="ball-indicator" />
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
        </div>}
      </section>

      <section
        className={'workspace-panels' + (panelsSwapped && showEditor && showRenderer ? ' swapped' : '') + ' active-' + activeWorkspaceTab}
        style={{ gridTemplateColumns: showEditor && showRenderer
          ? panelsSwapped
            ? `calc(${100 - editorShare}% - 4px) 8px calc(${editorShare}% - 4px)`
            : `calc(${editorShare}% - 4px) 8px calc(${100 - editorShare}% - 4px)`
          : 'minmax(0, 1fr)' }}
      >
        {showEditor && <div className="editor-workspace-panel">
          <div className="workspace-panel-header">
            <strong>Sequence editor</strong>
            <button type="button" onClick={() => { setShowEditor(false); setActiveWorkspaceTab('renderer'); }} disabled={!showRenderer}>Hide</button>
          </div>
          <div className="editor-workspace">
      <section className="editor-toolbar" aria-label="Notation actions">
        <div className="action-tools">
          <button type="button" className={'tool mode-tool' + (touchMode === 'select' ? ' active' : '')} onClick={() => { setTouchMode(touchMode === 'select' ? null : 'select'); setDragStart(null); setMoveStart(null); setShowActionMenu(false); }}>Select</button>
          <button type="button" className="tool clipboard-tool" onClick={copySelected} disabled={!selected || !(selectedCells.length ? selectedCells : [selected]).some((cell) => Boolean(entryAt(cell.performerId, cell.hand, cell.beatId, cell.offset ?? rational(0))))}>Copy</button>
          <button type="button" className="tool clipboard-tool" onClick={pasteSelected} disabled={!selected || clipboard.length === 0}>Paste</button>
          <button type="button" className={'tool mode-tool' + (touchMode === 'draw' ? ' active' : '')} onClick={() => { setTouchMode(touchMode === 'draw' ? null : 'draw'); setDragStart(null); setShowActionMenu(false); }}>Draw</button>
          <button type="button" className={'tool mode-tool' + (touchMode === 'move' ? ' active' : '')} onClick={() => { setTouchMode(touchMode === 'move' ? null : 'move'); setMoveStart(null); setShowActionMenu(false); }}>Move</button>
          {selectedEntry && <button type="button" className="tool change-action-tool" onClick={() => setShowActionMenu((open) => !open)}>Change action</button>}
          {showActionMenu && actionNames.map((name) => (
            <button type="button" key={name} aria-label={name} title={name} className={'tool' + (name === 'ZIP' ? ' zip-tool' : '')} onClick={() => { if (selected) addAction(name); }}>
              {name === 'ZIP' ? <span className="zip-tool-preview"><ActionSymbol action={{ type: 'ZIP', role: 'source', linkId: asLinkId('zip-preview') }} sequence={sequence} hand="left" /><ActionSymbol action={{ type: 'ZIP', role: 'receiver', linkId: asLinkId('zip-preview') }} sequence={sequence} hand="right" /></span> : <ActionSymbol action={makeAction(name, sequence)} sequence={sequence} hand={selected?.hand ?? 'left'} />}
            </button>
          ))}
          {showActionMenu && sequence.sequenceType === 'individual-passing' && <>
            <label className="target-control">Pass to <select value={passRecipientValue} onChange={(event) => setPassRecipientId(event.target.value)}>{sequence.performers.filter((person) => person.id !== selected?.performerId).map((person) => <option key={person.id} value={person.id}>{person.name} ({person.identifier ?? '?'})</option>)}</select></label>
            <label className="target-control">Hand <select value={passRecipientHand} onChange={(event) => setPassRecipientHand(event.target.value as Hand)}><option value="left">Left</option><option value="right">Right</option></select></label>
            <button type="button" className="tool" onClick={addIndividualPass} disabled={!selected || sequence.performers.length < 2}>PASS</button>
          </>}
          {showActionMenu && <button type="button" className="tool" onClick={addClap} disabled={!selected}>CLAP</button>}
          <button type="button" className="tool delete-tool" onClick={removeSelected} disabled={!selected || !(selectedCells.length ? selectedCells : [selected]).some((cell) => Boolean(entryAt(cell.performerId, cell.hand, cell.beatId, cell.offset ?? rational(0))))}>Delete</button>
        </div>
        <span className="selection-label">{selected ? (sequence.sequenceType === 'circle-passing' ? 'Pattern' : sequence.performers.find((item) => item.id === selected.performerId)?.name) + ' · ' + selected.hand + ' · beat ' + (sequence.beats.findIndex((beat) => beat.id === selected.beatId) + 1) : 'Select a cell'}</span>
        <div className="target-tools">
          {!showActionMenu && targetableEntry && targetableEntry.action.target.kind === 'position' && (
            <label className="target-control">Target
              <select value={targetableEntry.action.target.positionId} onChange={(event) => changeTarget(targetableEntry, event.target.value)}>
                {sequence.positions.filter((position) => position.kind === 'table' || ((targetableEntry.action.type === 'LIFT' || targetableEntry.action.type === 'LEAVE') && position.kind === 'hand-back')).map((position) => {
                  const ownerPerformerId = position.kind === 'table' && position.owner.kind === 'performer'
                    ? position.owner.performerId
                    : undefined;
                  const ownerName = position.kind === 'hand-back'
                    ? sequence.performers.find((person) => person.id === position.performerId)?.name
                    : ownerPerformerId
                      ? sequence.performers.find((person) => person.id === ownerPerformerId)?.name
                      : undefined;
                  return <option key={position.id} value={position.id}>{ownerName ? ownerName + ' · ' + position.name : position.name}</option>;
                })}
              </select>
            </label>
          )}
          {!showActionMenu && targetableEntry && targetableEntry.action.target.kind === 'circle-position' && (
            <div className="target-control">
              <label>Position <select value={targetableEntry.action.target.position} onChange={(event) => changeCircleTarget(targetableEntry, 'position', event.target.value)}><option>A</option><option>B</option><option>C</option></select></label>
              <label>Performer <select value={targetableEntry.action.target.direction ? 'other' : 'self'} onChange={(event) => setCircleTargetMode(targetableEntry, event.target.value as 'self' | 'other')}><option value="self">Self</option><option value="other" disabled={sequence.performers.length < 2}>Other</option></select></label>
              {targetableEntry.action.target.direction && <>
                <label>Direction <select value={targetableEntry.action.target.direction} onChange={(event) => changeCircleTarget(targetableEntry, 'direction', event.target.value)}><option value="left">Left</option><option value="right">Right</option></select></label>
                <label>Distance <input type="number" min="1" max={Math.max(1, sequence.performers.length - 1)} value={targetableEntry.action.target.distance ?? 1} onChange={(event) => changeCircleTarget(targetableEntry, 'distance', event.target.value)} /></label>
              </>}
            </div>
          )}
          {!showActionMenu && targetableEntry && selectedPassRecipient && (
            <div className="target-control">
              <label>Recipient <select value={selectedPassRecipient.performerId} onChange={(event) => changePassTarget(targetableEntry, event.target.value, selectedPassRecipient.hand)}>{sequence.performers.filter((person) => person.id !== selected?.performerId).map((person) => <option key={person.id} value={person.id}>{person.name} ({person.identifier ?? '?'})</option>)}</select></label>
              <label>Hand <select value={selectedPassRecipient.hand} onChange={(event) => changePassTarget(targetableEntry, selectedPassRecipient.performerId, event.target.value as Hand)}><option value="left">Left</option><option value="right">Right</option></select></label>
            </div>
          )}
          {!showActionMenu && targetableEntry && selectedPassSource && (
            <label className="target-control">Source <select value={selectedPassSource.performerId} onChange={(event) => changePassTarget(targetableEntry, event.target.value)}>{sequence.performers.filter((person) => person.id !== selected?.performerId).map((person) => <option key={person.id} value={person.id}>{person.name} ({person.identifier ?? '?'})</option>)}</select></label>
          )}
        </div>
      </section>

      <section className="editor-scroll" aria-label="Notation editor" onClick={(event) => { if (event.target === event.currentTarget) clearSelection(); }}>
        <div className="notation-grid">
          <div className="grid-head" style={{ gridTemplateColumns: `82px repeat(${timelineSlots.length}, var(--notation-cell-size)) 18px` }}>
            <div className="row-label heading-label">{sequence.sequenceType === 'circle-passing' ? 'PATTERN' : 'PERFORMER'}</div>
            {timelineSlots.map((slot, index) => {
              const beatIndex = sequence.beats.findIndex((beat) => beat.id === slot.beatId);
              const beat = sequence.beats[beatIndex]!;
              const isBeatStart = compareRational(slot.offset, rational(0)) === 0;
              const isBeatEnd = timelineSlots[index + 1]?.beatId !== slot.beatId;
              return <div className={'beat-head' + (isBeatStart ? ' beat-start' : '') + (isBeatStart && beatIndex % sequence.timeSignature.beatGrouping.length === 0 ? ' bar-start' : '')} key={beat.id + ':' + slot.offset.numerator + '/' + slot.offset.denominator}>
                <button type="button" className="beat-select" onClick={() => isBeatStart ? selectBeat(beat.id) : selectInterval(beat.id, slot.offset, slot.duration)} aria-label={isBeatStart ? 'Select beat ' + (beatIndex + 1) : 'Select beat ' + (beatIndex + 1) + ' subdivision ' + slot.label}>
                  <span>{slot.label}</span><small>{isBeatStart ? Math.floor(beatIndex / sequence.timeSignature.beatGrouping.length) + 1 + '.' + (beatIndex % sequence.timeSignature.beatGrouping.length + 1) : ' '}</small>
                </button>
                {isBeatStart && <button type="button" className="move-beat move-beat-left" onClick={() => moveBeat(beat.id, -1)} disabled={beatIndex === 0} aria-label={'Move beat ' + (beatIndex + 1) + ' left'}>‹</button>}
                {isBeatStart && <button type="button" className="move-beat move-beat-right" onClick={() => moveBeat(beat.id, 1)} disabled={beatIndex === sequence.beats.length - 1} aria-label={'Move beat ' + (beatIndex + 1) + ' right'}>›</button>}
                <button type="button" className="subdivide-interval" onClick={() => subdivideInterval(beat.id, slot.offset, slot.duration)} aria-label={'Subdivide beat ' + (beatIndex + 1) + ' interval ' + slot.label}>÷</button>
                {isBeatEnd && <button type="button" className="insert-beat" onClick={() => insertBeatAfter(beat.id)} aria-label={'Insert beat after ' + (beatIndex + 1)}>+</button>}
              </div>;
            })}
            <button type="button" className="add-beat" onClick={addBeat} aria-label="Add beat">+</button>
          </div>
          {(sequence.beats.some((beat) => beat.subdivisions.length > 0) || (sequence.timeSignature.numerator === 6 && sequence.timeSignature.denominator === 8)) && <p className="timeline-note">Subdivisions are shown in the notation grid, but the simulator currently evaluates all actions in a main beat simultaneously. The current binary subdivision model does not represent triplet subdivisions in 6/8.</p>}
          {editorPerformers.map((performer) => (
            <div className="performer-block" key={performer.id}>
              <div className="performer-heading">{sequence.sequenceType === 'circle-passing' ? 'Pattern' : performer.name}<span>{sequence.sequenceType === 'circle-passing' ? '' : performer.identifier ?? ''}</span></div>
              {hands.map((hand) => (
                <div className="hand-row" key={hand} style={{ gridTemplateColumns: `82px repeat(${timelineSlots.length}, var(--notation-cell-size)) 18px` }}>
                  <div className="row-label">{hand === 'left' ? 'L' : 'R'}</div>
                  {timelineSlots.map((slot) => {
                    const beatIndex = sequence.beats.findIndex((beat) => beat.id === slot.beatId);
                    const beat = sequence.beats[beatIndex]!;
                    const entry = entryAt(performer.id, hand, beat.id, slot.offset);
                    const selectedCell = selectedCells.some((cell) => cell.performerId === performer.id && cell.hand === hand && cell.beatId === beat.id && compareRational(cell.offset ?? rational(0), slot.offset) === 0);
                    const errors = entry ? issuesByEntry.get(entry.id) ?? [] : [];
                    return (
                      <button
                        type="button"
                        key={beat.id + ':' + slot.offset.numerator + '/' + slot.offset.denominator}
                        className={'notation-cell' + (selectedCell ? ' selected' : '') + (errors.length ? ' invalid' : '') + (entry ? ' occupied' : '') + (beatIndex % sequence.timeSignature.beatGrouping.length === 0 && compareRational(slot.offset, rational(0)) === 0 ? ' bar-start' : '')}
                        onMouseDown={(event) => {
                          if (touchMode) return;
                          const cell = { performerId: performer.id, hand, beatId: beat.id, offset: slot.offset, duration: slot.duration };
                          if (event.ctrlKey) {
                            event.preventDefault();
                            setShowActionMenu(false);
                          } else if (event.shiftKey) {
                            event.preventDefault();
                            selectCell(cell);
                            setDragStart(cell);
                            setShowActionMenu(false);
                          } else if (entry) {
                            setMoveStart(cell);
                          }
                        }}
                        onMouseUp={() => {
                          if (touchMode) return;
                          const cell = { performerId: performer.id, hand, beatId: beat.id, offset: slot.offset, duration: slot.duration };
                          if (dragStart) { drawRectangle(dragStart, cell); setDragStart(null); return; }
                          if (moveStart) {
                            const sameCell = moveStart.performerId === cell.performerId && moveStart.hand === cell.hand && moveStart.beatId === cell.beatId && compareRational(moveStart.offset ?? rational(0), cell.offset ?? rational(0)) === 0;
                            if (!sameCell) moveRectangle(moveStart, cell);
                            setMoveStart(null);
                          }
                        }}
                        onClick={(event) => {
                          const cell = { performerId: performer.id, hand, beatId: beat.id, offset: slot.offset, duration: slot.duration };
                          if (event.ctrlKey) { selectCell(cell, true); setShowActionMenu(false); return; }
                          if (touchMode === 'select') { selectCell(cell, true); setShowActionMenu(false); return; }
                          if (touchMode === 'draw') {
                            if (!dragStart) { selectCell(cell); setDragStart(cell); }
                            else { drawRectangle(dragStart, cell); setDragStart(null); setTouchMode(null); }
                            return;
                          }
                          if (touchMode === 'move') {
                            if (!moveStart) {
                              if (entry) { selectCell(cell); setMoveStart(cell); }
                            } else { moveRectangle(moveStart, cell); setMoveStart(null); setTouchMode(null); }
                            return;
                          }
                          if (dragStart || moveStart) return;
                          selectCell(cell, event.shiftKey);
                          if (!event.shiftKey) setShowActionMenu(!entry);
                        }}
                        onContextMenu={(event) => { if (entry?.action.type === 'SPECIAL') { event.preventDefault(); editSpecial(entry, { performerId: performer.id, hand, beatId: beat.id, offset: slot.offset, duration: slot.duration }); } }}
                        aria-label={performer.name + ' ' + hand + ' beat ' + (beatIndex + 1) + (compareRational(slot.offset, rational(0)) === 0 ? '' : ' ' + slot.label) + (entry ? ' ' + actionLabel(entry.action, sequence) : ' empty')}
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

          </div>
        </div>}
        {showEditor && showRenderer && <div
          className="workspace-divider"
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize workspace panels"
          aria-valuemin={25}
          aria-valuemax={75}
          aria-valuenow={editorShare}
          tabIndex={0}
          onPointerDown={(event) => { event.preventDefault(); setResizingPanels(true); }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowLeft') setEditorShare((value) => panelsSwapped ? Math.min(75, value + 3) : Math.max(25, value - 3));
            if (event.key === 'ArrowRight') setEditorShare((value) => panelsSwapped ? Math.max(25, value - 3) : Math.min(75, value + 3));
          }}
        />}
        {showRenderer && <div className="renderer-workspace-panel">
          <div className="workspace-panel-header">
            <strong>Sequence renderer</strong>
            <button type="button" onClick={() => { setShowRenderer(false); setActiveWorkspaceTab('editor'); }} disabled={!showEditor}>Hide</button>
          </div>
          <SequenceRenderer
            sequence={simulationSequence}
            simulation={simulation}
            onSelectHand={(performerId, hand, beatId) => {
              selectCell({ performerId: sequence.sequenceType === 'circle-passing' ? sequence.performers[0]!.id : performerId, hand, beatId });
              setShowActionMenu(false);
            }}
          />
        </div>}
      </section>

      <section className="bottom-panels">
        <div className="validation-panel" role="region" aria-label="Validation">
          <div className="panel-heading"><strong>Validation</strong><span className={simulation.validation.isValid ? 'valid-count' : 'error-count'}>{displayedIssues.length} {displayedIssues.length === 1 ? 'issue' : 'issues'}</span></div>
          {displayedIssues.length === 0 ? <p className="no-issues">Sequence valid</p> : <ul>{displayedIssues.map((issue, index) => (
            <li key={issue.code + index}><span>{issue.description}</span>{issue.affectedEntries[0] && <button type="button" onClick={() => {
              const affectedEntryId = issue.affectedEntries[0];
              if (!affectedEntryId) return;
              const sourceId = simulationModel.sourceEntryById.get(affectedEntryId) ?? affectedEntryId;
              const entry = sequence.notation.find((item) => item.id === sourceId);
              if (entry) {
                const slot = timelineSlots.find((item) =>
                  item.beatId === entry.time.beatId &&
                  compareRational(item.offset, entry.time.offset) === 0,
                );
                selectCell({
                  performerId: entry.performerId,
                  hand: entry.hand,
                  beatId: entry.time.beatId,
                  offset: entry.time.offset,
                  duration: slot?.duration,
                });
              }
            }}>Go to</button>}</li>
          ))}</ul>}
        </div>
        <div className="state-panel" role="region" aria-label="Object state">
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
    {showShortcutHelp && <div className="shortcut-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowShortcutHelp(false); }}>
      <section className="shortcut-dialog" role="dialog" aria-modal="true" aria-labelledby="shortcut-title">
        <div className="shortcut-heading"><h2 id="shortcut-title">Keyboard shortcuts</h2><button type="button" onClick={() => setShowShortcutHelp(false)} aria-label="Close keyboard shortcuts">×</button></div>
        <div className="shortcut-list">
          <div><kbd>← ↑ ↓ →</kbd><span>Move selection</span></div>
          <div><kbd>Shift + arrows</kbd><span>Extend selection</span></div>
          <div><kbd>1 to 8</kbd><span>Insert LIFT, HOLD, LEAVE, BOUNCE, TAP, EMPTY, ZIP or SPECIAL</span></div>
          <div><kbd>A / B / C / L / R</kbd><span>Set a position target, where available</span></div>
          <div><kbd>Performer ID</kbd><span>Set a passing performer target</span></div>
          <div><kbd>Ctrl / ⌘ + C</kbd><span>Copy selected notation</span></div>
          <div><kbd>Ctrl / ⌘ + V</kbd><span>Paste at selected cell</span></div>
          <div><kbd>Ctrl / ⌘ + Z</kbd><span>Undo</span></div>
          <div><kbd>Ctrl / ⌘ + Shift + Z</kbd><span>Redo</span></div>
          <div><kbd>Ctrl / ⌘ + Y</kbd><span>Redo</span></div>
          <div><kbd>Backspace / Delete</kbd><span>Delete selected notation</span></div>
          <div><kbd>Escape</kbd><span>Clear selection or close this help</span></div>
          <div><kbd>?</kbd><span>Show this reference</span></div>
          <div><kbd>Shift + drag</kbd><span>Draw a ball rectangle</span></div>
          <div><kbd>Ctrl + click</kbd><span>Add a cell to the selection</span></div>
        </div>
      </section>
    </div>}
    </main>
  );
}
