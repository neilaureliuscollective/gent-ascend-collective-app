import {
  coworkers,
  type CouncilSelection,
  type SpecialistId,
} from '@/domains/intelligence/council';
export function explicitlyRequestedCoworkers(text: string): CouncilSelection | undefined {
  const named = coworkers
    .filter((member) =>
      new RegExp(
        `(?:\\b(?:have|ask|involve|assign|bring|with|team|assemble)\\b[^.\\n]{0,100}\\b${member.id}\\b|^\\s*${member.id}\\b\\s*[,;:]?)`,
        'i',
      ).test(text),
    )
    .map((member) => member.id);
  return named.length
    ? { kind: named.length === 1 ? 'specialist' : 'table', specialists: named }
    : undefined;
}
export function routeFounderCoworker(text: string): SpecialistId {
  const named = explicitlyRequestedCoworkers(text)?.specialists[0];
  if (named) return named;
  if (/\b(capital|credit|financ(?:ing|e options)|loan|lender|underwriting|borrow)\b/i.test(text))
    return 'cassian';
  if (
    /\b(financial|finances|cash.?flow|budget|expenses?|profit|statements?|balance sheet|p&l)\b/i.test(
      text,
    )
  )
    return 'mara';
  if (
    /\b(product|software|application|app|code|engineering|website|launch|aethelios|repository|platform)\b/i.test(
      text,
    )
  )
    return 'cassius';
  if (/\b(brand|creative|writing|design|copy|campaign)\b/i.test(text)) return 'apollo';
  return 'athena';
}
