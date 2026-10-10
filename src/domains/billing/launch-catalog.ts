/** Approved commercial direction; catalog entries are never permission grants. */
export const launchPlans = [
  {
    id: 'access',
    name: 'Access',
    monthlyCents: 0,
    focus: 'Discover personal intelligence.',
    available: 'Basic profile, goals, introductory organization and Health education.',
    planned: 'Limited Intelligence and Entity allowances require provider and quota acceptance.',
  },
  {
    id: 'essential',
    name: 'Essential',
    monthlyCents: 1999,
    focus: 'Everyday personal intelligence.',
    available: 'Existing paid personal context, confirmed memory and progress.',
    planned: 'Living Profile and Ascendance Brief improvements; measured conversation allowances.',
  },
  {
    id: 'signature',
    name: 'Signature',
    monthlyCents: 4999,
    focus: 'Advanced interconnected intelligence.',
    available:
      'Existing specialist perspectives and Studio access, subject to configuration and current limits.',
    planned: 'Document understanding and expanded research and creation allowances.',
  },
  {
    id: 'architect',
    name: 'Architect',
    monthlyCents: 12900,
    focus: 'Create software you can own.',
    available:
      'Static website workshop: source editing, isolated preview, revisions, checks and export.',
    planned:
      'Authenticated, metered AI development jobs, GitHub workflows and approved deployment handoffs. Not a launched coding agent.',
  },
] as const;
export type LaunchTier = (typeof launchPlans)[number]['id'];
export function launchPrice(cents: number) {
  return cents === 0
    ? 'Free'
    : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}
