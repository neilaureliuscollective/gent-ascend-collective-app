/** A content digest establishes identity, never the authority of a client payload. */
export const UNVERIFIED_PREMIUM_DIRECTION =
  'This premium direction is not verified from its Talk source. It cannot be displayed or used for generation.';

export function hasVerifiedPremiumAuthority(input: {
  verified?: boolean;
  sourceKind?: string;
  compatibleTextImport?: string;
}) {
  return (
    input.verified === true && input.sourceKind === 'talk-authorized' && !input.compatibleTextImport
  );
}
