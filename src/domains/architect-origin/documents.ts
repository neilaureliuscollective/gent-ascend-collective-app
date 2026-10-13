import { sections, documentKinds, consistencyNotes, type ProjectContent } from './schema';

/** A deterministic editable work product, never a claim of new research. */
export function compileDocument(content: ProjectContent, kind: (typeof documentKinds)[number]) {
  const scope: Record<(typeof documentKinds)[number], (keyof typeof sections)[]> = {
    'Business plan': [
      'vision',
      'opportunity',
      'audience',
      'research',
      'solution',
      'architecture',
      'requirements',
      'risks',
      'milestones',
      'next',
    ],
    'Research dossier': [
      'vision',
      'opportunity',
      'audience',
      'research',
      'risks',
      'decisions',
      'next',
    ],
    'Product requirements': [
      'vision',
      'opportunity',
      'audience',
      'requirements',
      'solution',
      'architecture',
      'risks',
      'milestones',
      'deliverables',
    ],
    'Product development brief': [
      'vision',
      'audience',
      'requirements',
      'research',
      'solution',
      'architecture',
      'risks',
      'milestones',
      'deliverables',
    ],
    'Technical architecture': [
      'vision',
      'requirements',
      'solution',
      'architecture',
      'decisions',
      'risks',
      'milestones',
      'deliverables',
    ],
    'Project roadmap': [
      'vision',
      'state',
      'milestones',
      'decisions',
      'risks',
      'deliverables',
      'next',
    ],
    'Strategic plan': [
      'vision',
      'opportunity',
      'audience',
      'research',
      'solution',
      'decisions',
      'risks',
      'milestones',
      'next',
    ],
  };
  const evidence: string[] = [];
  let evidenceSize = 0;
  for (const source of content.sources) {
    const line = `${source.title}: ${source.url} (${source.provenance})`;
    if (evidenceSize + line.length > 4500) {
      evidence.push('Additional sources remain in the project evidence library.');
      break;
    }
    evidence.push(line);
    evidenceSize += line.length;
  }
  return (
    `# ${content.name} — ${kind}\n\nDraft compiled from the approved Living Blueprint. No additional research or independent validation performed.\n\n${content.description}\n\n` +
    scope[kind]
      .map(
        (key) =>
          `## ${sections[key]}\n\n${content.blueprint[key] ? content.blueprint[key].slice(0, 1200) + (content.blueprint[key].length > 1200 ? '\n\nSection excerpted; review the complete approved Blueprint before finalizing.' : '') : 'Open requirement: define and validate this section before relying on this document.'}`,
      )
      .join('\n\n') +
    '\n\n## Evidence and validation\n\n' +
    (evidence.join('\n') ||
      'No attributed sources saved. Validate consequential claims before use.') +
    '\n\n' +
    consistencyNotes(content, 0).join('\n\n')
  );
}
