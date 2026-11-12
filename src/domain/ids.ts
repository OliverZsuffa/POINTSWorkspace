export type EntityId<TKind extends string> = string & {
  readonly __entityKind: TKind;
};

export type SequenceId = EntityId<'SequenceId'>;
export type PerformerId = EntityId<'PerformerId'>;
export type PositionId = EntityId<'PositionId'>;
export type BallId = EntityId<'BallId'>;
export type BeatId = EntityId<'BeatId'>;
export type SubdivisionId = EntityId<'SubdivisionId'>;
export type ActionEntryId = EntityId<'ActionEntryId'>;
export type LinkId = EntityId<'LinkId'>;

export const asSequenceId = (value: string): SequenceId => value as SequenceId;
export const asPerformerId = (value: string): PerformerId => value as PerformerId;
export const asPositionId = (value: string): PositionId => value as PositionId;
export const asBallId = (value: string): BallId => value as BallId;
export const asBeatId = (value: string): BeatId => value as BeatId;
export const asSubdivisionId = (value: string): SubdivisionId => value as SubdivisionId;
export const asActionEntryId = (value: string): ActionEntryId => value as ActionEntryId;
export const asLinkId = (value: string): LinkId => value as LinkId;
