import type { Hand, NotationAction, Sequence } from '../../domain/model';
import { getActionSymbolGeometry } from './action-symbol';

export function NotationSymbol({
  action,
  sequence,
  hand,
  className,
  abstractTargets = false,
}: {
  action: NotationAction;
  sequence: Sequence;
  hand: Hand;
  className: string;
  abstractTargets?: boolean;
}) {
  const geometry = getActionSymbolGeometry(action, sequence, hand, abstractTargets);
  if (!geometry) return null;

  if (geometry.specialText) {
    return (
      <span className={'special-symbol' + (geometry.clap ? ' clap-symbol' : '')} aria-label={geometry.clap ? 'Clap' : undefined}>
        {geometry.clap ? <span className="clap-bar" /> : geometry.specialText}
        {'linkId' in action && action.linkId && !geometry.clap && <span className="special-link-indicator" aria-label="Linked SPECIAL">↔</span>}
      </span>
    );
  }

  return (
    <svg className={className} viewBox="0 0 100 100" aria-hidden="true">
      <path d={geometry.path} fill="none" stroke="#172033" strokeWidth="5.5" strokeLinecap="square" strokeLinejoin="miter" />
      {geometry.circledTarget && <circle cx="36" cy="50" r="13" fill="none" stroke="#263238" strokeWidth="1.8" />}
      {geometry.label && (
        <text x={geometry.subscript ? 38 : 50} y="50" textAnchor="middle" dominantBaseline="middle" fontFamily="Arial,sans-serif" fontSize={geometry.label.length > 3 ? 38 : 46} fontWeight="700" fill="#172033">
          {geometry.label}
          {geometry.subscript && <tspan fontSize="28" baselineShift="sub">{geometry.subscript}</tspan>}
        </text>
      )}
    </svg>
  );
}
