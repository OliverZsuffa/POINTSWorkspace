import type {
  ActionEntryId,
  BallId,
  BeatId,
  LinkId,
  PerformerId,
  PositionId,
  SequenceId,
  SubdivisionId,
} from './ids';
import type { Rational } from './time/rational';
import type { TimeSignature } from './time/time-signature';

export type Hand = 'left' | 'right';
export type SequenceType = 'solo' | 'circle-passing' | 'individual-passing';
export type IndividualPassingLayout = 'shared-positions' | 'per-performer-positions';

export interface Performer {
  readonly id: PerformerId;
  readonly name: string;
  /** Lowercase identifier used by individual passing notation. */
  readonly identifier?: string;
}

export type PositionOwner =
  | { readonly kind: 'performer'; readonly performerId: PerformerId }
  | { readonly kind: 'shared' };

export interface TablePosition {
  readonly kind: 'table';
  readonly id: PositionId;
  readonly name: string;
  readonly owner: PositionOwner;
}

export interface HandBackPosition {
  readonly kind: 'hand-back';
  readonly id: PositionId;
  readonly name: 'L' | 'R';
  readonly performerId: PerformerId;
  readonly hand: Hand;
}

export type PositionDefinition = TablePosition | HandBackPosition;

export interface Ball {
  readonly id: BallId;
}

export type ObjectLocation =
  | { readonly kind: 'position'; readonly positionId: PositionId }
  | {
      readonly kind: 'hand-held';
      readonly performerId: PerformerId;
      readonly hand: Hand;
    }
  | {
      readonly kind: 'hand-back';
      readonly positionId: PositionId;
      readonly performerId: PerformerId;
      readonly hand: Hand;
    };

export interface InitialObjectPlacement {
  readonly ballId: BallId;
  readonly location: ObjectLocation;
}

export interface InitialState {
  readonly placements: readonly InitialObjectPlacement[];
}

export interface Subdivision {
  readonly id: SubdivisionId;
  /** Start offset relative to the containing main beat, in the range [0, 1). */
  readonly start: Rational;
  /** Duration relative to the containing main beat. */
  readonly duration: Rational;
  readonly depth: number;
}

export interface Beat {
  readonly id: BeatId;
  readonly subdivisions: readonly Subdivision[];
}

export interface TimelinePosition {
  readonly beatId: BeatId;
  /** Fractional offset from the beginning of the main beat, in the range [0, 1). */
  readonly offset: Rational;
}

export interface PositionTarget {
  readonly kind: 'position';
  readonly positionId: PositionId;
}

export interface CirclePassingTarget {
  readonly kind: 'circle-position';
  readonly position: 'A' | 'B' | 'C';
  /** Omitted together with distance when addressing the acting performer's own position. */
  readonly direction?: 'left' | 'right';
  /** Distance to another performer. One is the immediate neighbour. */
  readonly distance?: number;
}

export interface IndividualPassRecipientTarget {
  readonly kind: 'pass-recipient-hand';
  readonly performerId: PerformerId;
  readonly hand: Hand;
}

export interface IndividualPassSourceTarget {
  readonly kind: 'pass-source';
  readonly performerId: PerformerId;
}

export type TableActionTarget = PositionTarget | CirclePassingTarget;
export type LiftActionTarget = TableActionTarget | IndividualPassSourceTarget;
export type LeaveActionTarget = TableActionTarget | IndividualPassRecipientTarget;

export interface HoldAction {
  readonly type: 'HOLD';
}

export interface LiftAction {
  readonly type: 'LIFT';
  readonly target: LiftActionTarget;
  readonly linkId?: LinkId;
}

export interface LeaveAction {
  readonly type: 'LEAVE';
  readonly target: LeaveActionTarget;
  readonly linkId?: LinkId;
}

export interface BounceAction {
  readonly type: 'BOUNCE';
  readonly target: TableActionTarget;
}

export interface TapAction {
  readonly type: 'TAP';
  readonly target: TableActionTarget;
}

export interface EmptyAction {
  readonly type: 'EMPTY';
}

export interface ZipAction {
  readonly type: 'ZIP';
  readonly role: 'source' | 'receiver';
  readonly linkId: LinkId;
}

export interface SpecialAction {
  readonly type: 'SPECIAL';
  readonly text: string;
  /** Present when this SPECIAL is linked to a coordinated action in another row. */
  readonly linkId?: LinkId;
}

export type NotationAction =
  | HoldAction
  | LiftAction
  | LeaveAction
  | BounceAction
  | TapAction
  | EmptyAction
  | ZipAction
  | SpecialAction;

export type ActionType = NotationAction['type'];

export interface NotationEntry {
  readonly id: ActionEntryId;
  readonly performerId: PerformerId;
  readonly hand: Hand;
  readonly time: TimelinePosition;
  readonly action: NotationAction;
}

export type TableLayout =
  | { readonly type: 'solo' }
  | { readonly type: 'polygon'; readonly sideCount: number }
  | {
      readonly type: 'rectangle';
      readonly longSideSeatCount: number;
      readonly shortSideSeatCount: number;
    };

export type SeatPosition =
  | { readonly kind: 'polygon-edge'; readonly edgeIndex: number }
  | {
      readonly kind: 'rectangle-side';
      readonly side: 'long-a' | 'long-b' | 'short-a' | 'short-b';
      readonly seatIndex: number;
    };

export interface SeatAssignment {
  readonly performerId: PerformerId;
  readonly seat: SeatPosition;
}

export interface Sequence {
  readonly id: SequenceId;
  readonly sequenceType: SequenceType;
  readonly timeSignature: TimeSignature;
  /** Tempo is always measured in quarter notes per minute. */
  readonly bpm: number;
  /** Ordered main musical beats. Beat count is the length of this array. */
  readonly beats: readonly Beat[];
  readonly performers: readonly Performer[];
  readonly positions: readonly PositionDefinition[];
  readonly balls: readonly Ball[];
  readonly initialState: InitialState;
  readonly notation: readonly NotationEntry[];
  readonly individualPassingLayout?: IndividualPassingLayout;
  readonly tableLayout: TableLayout;
  readonly seatAssignments: readonly SeatAssignment[];
}

export interface HandObjectState {
  readonly heldBallId: BallId | null;
  readonly balancedBallId: BallId | null;
}

export interface ObjectStateSnapshot {
  readonly at: TimelinePosition;
  readonly phase: 'before' | 'after';
  readonly ballLocations: Readonly<Record<BallId, ObjectLocation>>;
  readonly handStates: Readonly<
    Record<PerformerId, Readonly<Record<Hand, HandObjectState>>>
  >;
}

export type ValidationSeverity = 'error' | 'warning';

export interface ValidationIssue {
  readonly code: string;
  readonly severity: ValidationSeverity;
  readonly description: string;
  readonly affectedEntries: readonly ActionEntryId[];
  readonly affectedPositions?: readonly PositionId[];
  readonly at?: TimelinePosition;
}

export interface ValidationResult {
  readonly isValid: boolean;
  readonly issues: readonly ValidationIssue[];
}

export interface SimulationResult {
  readonly snapshots: readonly ObjectStateSnapshot[];
  readonly validation: ValidationResult;
}

export interface SequenceFragment {
  readonly sequenceType: SequenceType;
  readonly timeSignature: TimeSignature;
  readonly beats: readonly Beat[];
  readonly performers: readonly Performer[];
  readonly positions: readonly PositionDefinition[];
  readonly notation: readonly NotationEntry[];
}

export type ActionRequirement =
  | {
      readonly actionType: ActionType;
      readonly occurrence: 'at-least-once' | 'forbidden';
      readonly performerId?: PerformerId;
    }
  | {
      readonly actionType: ActionType;
      readonly occurrence: 'exact-count';
      readonly count: number;
      readonly performerId?: PerformerId;
    };

export interface GeneratorConstraints {
  readonly looping: 'must-loop' | 'must-not-loop' | 'either';
  readonly actionRequirements: readonly ActionRequirement[];
  readonly zipTransferCount?: number;
  readonly passCount?: number;
  readonly requiredActionPerPerformer?: ActionType;
  readonly requiredFragments: readonly SequenceFragment[];
  readonly forbiddenFragments: readonly SequenceFragment[];
}

export interface GeneratorRequest {
  readonly sequenceTypes: readonly SequenceType[];
  readonly beatCount: number;
  readonly performerCount: number;
  readonly objectCount: number;
  readonly availablePositions: readonly PositionDefinition[];
  readonly timeSignature: TimeSignature;
  readonly initialState: InitialState;
  readonly sourceSequence?: Sequence;
  readonly constraints: GeneratorConstraints;
}

export interface GeneratedCandidate {
  readonly sequence: Sequence;
}

export type SequenceDecodeResult =
  | { readonly ok: true; readonly sequence: Sequence }
  | {
      readonly ok: false;
      readonly code: 'malformed' | 'unsupported-version' | 'invalid-data';
      readonly message: string;
    };
