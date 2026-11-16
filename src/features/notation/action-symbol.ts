import type { Hand, NotationAction, Sequence } from '../../domain/model';

export interface ActionSymbolGeometry {
  readonly path: string;
  readonly label: string;
  readonly subscript: string;
  readonly circledTarget: boolean;
  readonly specialText?: string;
  readonly clap: boolean;
}

function circleSubscript(target: Extract<NotationAction, { type: 'LIFT' }>['target']): string {
  if (target.kind !== 'circle-position' || !target.direction || !target.distance) return '';
  return (target.distance > 1 ? String(target.distance) : '') + (target.direction === 'left' ? 'L' : 'R');
}

function positionReference(sequence: Sequence, positionId: string): string {
  const position = sequence.positions.find((item) => item.id === positionId);
  if (!position) return '?';
  if (position.kind === 'table' && position.owner.kind === 'performer') {
    const owner = position.owner as Extract<Sequence['positions'][number], { kind: 'table' }>['owner'] & { readonly kind: 'performer'; readonly performerId: Sequence['performers'][number]['id'] };
    const identifier = sequence.performers.find((person) => person.id === owner.performerId)?.identifier;
    return identifier ? position.name + '(' + identifier + ')' : position.name;
  }
  return position.name;
}

/** Shared, renderer independent action geometry for editor, previews, and export. */
export function getActionSymbolGeometry(
  action: NotationAction,
  sequence: Sequence,
  hand: Hand,
  abstractTargets = false,
): ActionSymbolGeometry | null {
  if (action.type === 'EMPTY') return null;
  if (action.type === 'SPECIAL') {
    return { path: '', label: '', subscript: '', circledTarget: false, specialText: action.text || 'SPECIAL', clap: action.text === 'Clap' };
  }
  let path = '';
  let label = '';
  let subscript = '';
  let circledTarget = false;
  switch (action.type) {
    case 'HOLD': path = 'M0 0H100 M0 100H100'; break;
    case 'LIFT':
      path = 'M0 0H100 M0 0V100 M0 100H100';
      if (action.target.kind === 'position') label = positionReference(sequence, action.target.positionId);
      else if (action.target.kind === 'circle-position') { label = action.target.position; subscript = circleSubscript(action.target); }
      else if (action.target.kind === 'pass-source') {
        label = 'X';
        const target = action.target as Extract<NotationAction, { type: 'LIFT' }>['target'] & { readonly kind: 'pass-source'; readonly performerId: Sequence['performers'][number]['id'] };
        subscript = sequence.performers.find((person) => person.id === target.performerId)?.identifier ?? '?';
      }
      break;
    case 'LEAVE':
      path = 'M0 0H100 M100 0V100 M0 100H100';
      if (action.target.kind === 'position') label = positionReference(sequence, action.target.positionId);
      else if (action.target.kind === 'circle-position') { label = action.target.position; subscript = circleSubscript(action.target); }
      else if (action.target.kind === 'pass-recipient-hand') {
        label = action.target.hand === 'left' ? 'L' : 'R';
        circledTarget = true;
        const target = action.target as Extract<NotationAction, { type: 'LEAVE' }>['target'] & { readonly kind: 'pass-recipient-hand'; readonly performerId: Sequence['performers'][number]['id'] };
        subscript = sequence.performers.find((person) => person.id === target.performerId)?.identifier ?? '?';
      }
      break;
    case 'BOUNCE':
      path = 'M0 0H100 M0 100H100';
      if (action.target.kind === 'position') label = positionReference(sequence, action.target.positionId);
      else { label = action.target.position; subscript = circleSubscript(action.target); }
      break;
    case 'TAP':
      if (action.target.kind === 'position') label = positionReference(sequence, action.target.positionId);
      else { label = action.target.position; subscript = circleSubscript(action.target); }
      break;
    case 'ZIP':
      path = action.role === 'source'
        ? hand === 'left' ? 'M0 0H100 M100 0V100' : 'M0 100H100 M100 0V100'
        : hand === 'left' ? 'M0 0H100 M0 0V100' : 'M0 100H100 M0 0V100';
      break;
  }
  if (abstractTargets && 'target' in action &&
    (action.target.kind === 'position' || action.target.kind === 'circle-position')) {
    label = '';
    subscript = '';
  }
  return { path, label, subscript, circledTarget, clap: false };
}
