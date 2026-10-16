export const talkDestinationKinds = [
  'architect-origin',
  'architect-direction',
  'studio-image',
] as const;
export type TalkDestinationKind = (typeof talkDestinationKinds)[number];

export const talkDestinationStatuses = [
  'reviewable',
  'queued',
  'running',
  'awaiting-approval',
  'ready',
  'failed',
  'cancelled',
  'unavailable',
] as const;
export type TalkDestinationStatus = (typeof talkDestinationStatuses)[number];

export type TalkDestinationOffer = {
  kind: TalkDestinationKind;
  sourceId: string;
  sourceKind: string;
  sourceVersion: number;
  sourceTitle: string;
  destination: string;
  unsupported: string[];
  status: TalkDestinationStatus;
  snapshotBound: boolean;
};

export function describeTalkDestination(offer: TalkDestinationOffer) {
  const unsupported = offer.unsupported.length
    ? ` Unsupported: ${offer.unsupported.join('; ')}.`
    : ' Listed fields are supported on this contract.';
  const bind = offer.snapshotBound
    ? ' Accepted snapshot is bound to this task.'
    : ' Snapshot is not bound until you confirm.';
  return `${offer.sourceTitle} · ${offer.sourceKind} v${offer.sourceVersion} → ${offer.destination}. Status: ${offer.status}.${bind}${unsupported}`;
}
