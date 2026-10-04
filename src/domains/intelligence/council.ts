/** Member Council: reviewed roles from founder architecture, with no founder tools. */
export const council = [
  {
    id: 'athena',
    name: 'Athena',
    role: 'Research & strategy',
    description: 'Compare options, frame decisions and pressure-test the plan.',
    lens: 'Separate supplied evidence from assumptions. Compare practical options, tradeoffs and a next step. Never claim fresh research or invent citations.',
  },
  {
    id: 'prometheus',
    name: 'Prometheus',
    role: 'Architecture & engineering',
    description: 'Shape requirements, explain systems and prepare verifiable build plans.',
    lens: 'Define requirements, dependencies and acceptance checks. Explain supplied code or systems. No repository access or execution is available; label proposed code untested.',
  },
  {
    id: 'apollo',
    name: 'Apollo',
    role: 'Creative direction',
    description: 'Refine writing, brand direction and creative briefs.',
    lens: 'Develop distinctive, useful creative directions grounded in the brief. Explain tone, hierarchy and usability. Draft text and media briefs; do not claim to generate media or operate Studio.',
  },
  {
    id: 'hermes',
    name: 'Hermes',
    role: 'Growth & commercial operations',
    description: 'Clarify offers, customer journeys and practical growth experiments.',
    lens: 'Connect customer needs, offers, distribution and unit economics. Label projections and assumptions. Draft measurable experiments. Never claim accounts are connected or messages sent.',
  },
  {
    id: 'themis',
    name: 'Themis',
    role: 'Quality & verification',
    description: 'Challenge unsupported claims and examine risks and decision quality.',
    lens: 'Review against explicit criteria. Identify evidence gaps, risks and corrections by importance. Never report tests, audits or live verification as passed without evidence. No legal certification.',
  },
] as const;
export type SpecialistId = (typeof council)[number]['id'];
export type CouncilSelection = { kind: 'specialist' | 'table'; specialists: SpecialistId[] };
export type CouncilRoute = { id: SpecialistId; reason: string };
export function specialist(id: SpecialistId) {
  return council.find((member) => member.id === id)!;
}
export function relevantCouncil(text: string): CouncilRoute[] {
  const routes: CouncilRoute[] = [];
  const add = (id: SpecialistId, reason: string) => routes.push({ id, reason });
  if (/\b(code|repo|bug|software|api|database|architecture|engineering|build an app)\b/i.test(text))
    add('prometheus', 'Requirements, systems and a verifiable plan.');
  if (/\b(brand|design|copy|campaign|creative|content|writing|visual|studio)\b/i.test(text))
    add('apollo', 'Creative direction and clarity of expression.');
  if (
    /\b(revenue|pricing|offer|customer|sales|launch|distribution|partnership|business)\b/i.test(
      text,
    )
  )
    add('hermes', 'Commercial assumptions and practical experiments.');
  if (
    /\b(strategy|decision|compare|research|plan|planning|travel|trip|career|priorities|opportunity)\b/i.test(
      text,
    )
  )
    add('athena', 'Options, evidence and tradeoffs.');
  if (/\b(risk|review|verify|check|quality|assumption|decision|compare)\b/i.test(text))
    add('themis', 'Evidence gaps, downside and decision quality.');
  return routes.slice(0, 3);
}
export function tableRoutes(text: string): CouncilRoute[] {
  const routes = relevantCouncil(text);
  if (routes.length < 2 && !routes.some((r) => r.id === 'athena'))
    routes.push({ id: 'athena', reason: 'Frame the question and practical options.' });
  if (routes.length < 2 && !routes.some((r) => r.id === 'themis'))
    routes.push({ id: 'themis', reason: 'Challenge assumptions and identify missing evidence.' });
  return routes.slice(0, 3);
}
// The existing owner-bound turn ledger stores the exact reviewed prompt/cast.
// Versioned tags avoid a new persistence silo or a schema deployment dependency.
const prefix = 'council.1';
export function councilPromptVersion(selection: CouncilSelection) {
  return `${prefix}.${selection.kind === 'table' ? 't' : 's'}.${selection.specialists.join(',')}`;
}
export function councilFromVersion(version: string): CouncilSelection | null {
  const match = /^council\.1\.(s|t)\.([a-z,]+)$/.exec(version);
  if (!match) return null;
  const ids = match[2]!.split(',');
  if (
    ids.some((id) => !council.some((member) => member.id === id)) ||
    new Set(ids).size !== ids.length ||
    ids.length > 3 ||
    (match[1] === 's' ? ids.length !== 1 : ids.length < 2)
  )
    return null;
  return { kind: match[1] === 't' ? 'table' : 'specialist', specialists: ids as SpecialistId[] };
}
export function councilLabel(selection: CouncilSelection | null) {
  return selection?.kind === 'specialist'
    ? specialist(selection.specialists[0]!).name
    : selection?.kind === 'table'
      ? 'Aethelios · The Table'
      : 'Aethelios';
}
