import { useMemo, useState } from 'react';
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
      if (other) notation = notation.filter((entry) => entry.id !== other.id);
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
    if (linkId) {
      const linked = sequence.notation.filter((entry) =>
        'linkId' in entry.action && entry.action.linkId === linkId &&
        entry.action.type === 'ZIP',
      );
      linked.forEach((entry) => removeIds.add(entry.id));
    }
    commit({ ...sequence, notation: sequence.notation.filter((entry) => !removeIds.has(entry.id)) });
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
  const selectedEntry = selected
    ? entryAt(selected.performerId, selected.hand, selected.beatId)
    : undefined;
  const targetableEntry = selectedEntry && (
    selectedEntry.action.type === 'LIFT' ||
    selectedEntry.action.type === 'LEAVE' ||
    selectedEntry.action.type === 'TAP' ||
    selectedEntry.action.type === 'BOUNCE'
  ) ? selectedEntry : undefined;

  return (
    <main className="app-root" aria-label="POINTS Workspace">
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
          <div className="performer-settings"><span>Performers</span>{sequence.performers.map((performer) => <span className="performer-chip" key={performer.id}>{performer.name}</span>)}<button type="button" onClick={addPerformer}>Add performer</button></div>
        </section>
      )}

      <section className="editor-toolbar" aria-label="Notation actions">
        <div className="action-tools">
          {actionNames.map((name) => (
            <button type="button" key={name} className={activeAction === name ? 'tool active' : 'tool'} onClick={() => { setActiveAction(name); if (selected) addAction(name); }} disabled={!selected}>
              {name}
            </button>
          ))}
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
                        onClick={() => setSelected({ performerId: performer.id, hand, beatId: beat.id })}
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
