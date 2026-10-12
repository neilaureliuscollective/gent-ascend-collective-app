import type { WorkVersion } from './schema';
// Derived receipts only; never evidence that an external action executed.
export function approvalHistory(versions: WorkVersion[], proposalId: string) {
  const ordered = [...versions].sort((a, b) => a.revision - b.revision);
  let previous: string | null = null;
  return ordered.flatMap((version) => {
    const proposal = version.content.approvalRequests?.find((item) => item.id === proposalId);
    if (!proposal || proposal.status === previous) return [];
    const event =
      previous === null && ordered[0]!.revision > 1
        ? `observed_${proposal.status}`
        : proposal.status === 'rejected' && previous === 'approved'
          ? 'approval_withdrawn'
          : proposal.status;
    previous = proposal.status;
    return [
      {
        versionId: version.id,
        revision: version.revision,
        savedAt: version.created_at,
        event,
        source: version.source,
      },
    ];
  });
}
