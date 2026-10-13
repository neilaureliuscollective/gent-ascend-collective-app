import { z } from 'zod';
export const sections = {
  vision: 'Project vision',
  opportunity: 'Problem & opportunity',
  audience: 'Intended audience',
  requirements: 'Requirements & constraints',
  research: 'Research findings',
  solution: 'Proposed solution',
  architecture: 'Architecture / operating model',
  decisions: 'Key decisions',
  risks: 'Risks & open questions',
  milestones: 'Milestones & dependencies',
  deliverables: 'Deliverable specifications',
  state: 'Current project state',
  next: 'Recommended next actions',
} as const;
export const sectionKey = z.enum(
  Object.keys(sections) as [keyof typeof sections, ...(keyof typeof sections)[]],
);
export const disciplines = ['business', 'application', 'product', 'custom'] as const;
export const documentKinds = [
  'Business plan',
  'Research dossier',
  'Product requirements',
  'Product development brief',
  'Technical architecture',
  'Project roadmap',
  'Strategic plan',
] as const;
export const safeUrl = z
  .string()
  .max(2048)
  .refine((value) => {
    try {
      const u = new URL(value);
      return (
        ['https:', 'http:'].includes(u.protocol) && !u.username && !u.password && !/\s/.test(value)
      );
    } catch {
      return false;
    }
  });
export const sourceSchema = z
  .object({ url: safeUrl, title: z.string().max(160), provenance: z.enum(['provider', 'user']) })
  .strict();
export const blueprintSchema = z
  .object(
    Object.fromEntries(Object.keys(sections).map((key) => [key, z.string().max(3000)])) as Record<
      keyof typeof sections,
      z.ZodString
    >,
  )
  .strict();
export const documentSchema = z
  .object({
    id: z.uuid(),
    title: z.string().trim().min(1).max(120),
    kind: z.enum(documentKinds),
    content: z.string().min(1).max(24000),
    status: z.enum(['draft', 'approved']),
    basis: z.number().int().nonnegative(),
  })
  .strict();
export const projectContentSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    description: z.string().max(2000),
    discipline: z.enum(disciplines),
    status: z.enum(['active', 'paused', 'archived']),
    blueprint: blueprintSchema,
    sources: z.array(sourceSchema).max(30),
    documents: z.array(documentSchema).max(20),
  })
  .strict()
  .refine(
    (value) => new TextEncoder().encode(JSON.stringify(value)).length <= 100000,
    'Project exceeds the 100 KB bound.',
  )
  .refine(
    (value) => new Set(value.documents.map((d) => d.id)).size === value.documents.length,
    'Document IDs must be unique.',
  );
export type ProjectContent = z.infer<typeof projectContentSchema>;
export type OriginProject = {
  id: string;
  person_id: string;
  revision: number;
  content: ProjectContent;
  created_at: string;
  updated_at: string;
};
export type OriginVersion = {
  id: string;
  project_id: string;
  person_id: string;
  revision: number;
  content: ProjectContent;
  note: string;
  created_at: string;
};
export const proposalSchema = z
  .object({
    reply: z.string().min(1).max(6000),
    changes: z
      .array(
        z
          .object({
            section: sectionKey,
            content: z.string().max(3000),
            reason: z.string().max(500),
          })
          .strict(),
      )
      .max(5),
    document: z
      .object({ title: z.string().min(1).max(120), content: z.string().min(1).max(24000) })
      .strict()
      .nullable(),
  })
  .strict()
  .refine(
    (value) => new Set(value.changes.map((c) => c.section)).size === value.changes.length,
    'Each section may be revised once.',
  );
export type Proposal = z.infer<typeof proposalSchema>;
export type OriginRun = {
  id: string;
  project_id: string;
  person_id: string;
  revision: number;
  kind: 'conversation' | 'blueprint' | 'research' | 'document';
  instruction: string;
  status: 'running' | 'complete' | 'failed';
  output:
    | (Proposal & {
        sources: z.infer<typeof sourceSchema>[];
        kind: string;
        model: string;
        researchAvailable: boolean;
      })
    | null;
  created_at: string;
};
export const saveCommand = z
  .object({
    action: z.literal('save'),
    projectId: z.uuid(),
    requestId: z.uuid(),
    expected: z.number().int().min(0).max(499),
    content: projectContentSchema,
    note: z.string().trim().min(1).max(300),
  })
  .strict();
export const generateCommand = z
  .object({
    action: z.literal('generate'),
    projectId: z.uuid(),
    requestId: z.uuid(),
    expected: z.number().int().positive().max(500),
    kind: z.enum(['conversation', 'blueprint', 'research', 'document']),
    instruction: z.string().trim().min(1).max(3000),
    documentKind: z.enum(documentKinds),
    documentId: z.uuid().nullable(),
    consent: z.literal(true),
  })
  .strict();
export const originCommand = z.discriminatedUnion('action', [saveCommand, generateCommand]);
export function initialProject(
  idea: string,
  discipline: ProjectContent['discipline'],
): ProjectContent {
  return {
    name: idea.slice(0, 100).trim() || 'Untitled project',
    description: idea.slice(0, 2000),
    discipline,
    status: 'active',
    sources: [],
    documents: [],
    blueprint: {
      ...(Object.fromEntries(
        Object.keys(sections).map((key) => [key, '']),
      ) as ProjectContent['blueprint']),
      vision: idea.slice(0, 3000),
      state: 'Vision exploration. Requirements and feasibility remain to be confirmed.',
      next: 'Clarify the intended audience and desired outcome.',
    },
  };
}
/** Fixed budget, prioritizing current direction; never sends an entire project history. */
export function boundedContext(
  project: OriginProject,
  runs: OriginRun[],
  documentId: string | null,
) {
  const document = project.content.documents.find((d) => d.id === documentId);
  return {
    revision: project.revision,
    name: project.content.name,
    discipline: project.content.discipline,
    blueprint: Object.fromEntries(
      Object.entries(project.content.blueprint).map(([key, text]) => [
        key,
        text.slice(0, key === 'vision' || key === 'requirements' ? 1800 : 650),
      ]),
    ),
    sources: project.content.sources.slice(-12).filter((s) => s.url.length <= 500),
    document: document ? { ...document, content: document.content.slice(0, 12000) } : null,
    recentExploration: runs
      .filter((r) => r.status === 'complete' && r.output)
      .slice(0, 3)
      .map((r) => ({
        user: r.instruction.slice(0, 500),
        suggestion: r.output!.reply.slice(0, 700),
      })),
    omittedContent:
      'Sections may be excerpted; older history and other documents are omitted. Ask for specific missing information.',
  };
}
export function projectMarkdown(content: ProjectContent) {
  return (
    `# ${content.name}\n\n${content.description}\n\n` +
    Object.entries(sections)
      .map(
        ([key, label]) =>
          `## ${label}\n\n${content.blueprint[key as keyof typeof sections] || 'Not yet defined.'}`,
      )
      .join('\n\n') +
    '\n\n## Evidence\n\n' +
    content.sources.map((s) => `${s.title}: ${s.url} (${s.provenance})`).join('\n')
  );
}
/** Checks are deterministic consistency prompts, never independent factual validation. */
export function consistencyNotes(content: ProjectContent, revision: number) {
  return [
    !content.sources.length
      ? 'No attributed evidence has been saved. Market and feasibility claims need verification.'
      : '',
    !content.blueprint.risks ? 'Risks and validation requirements are not defined.' : '',
    ...content.documents
      .filter((d) => d.basis < revision - 1)
      .map(
        (d) =>
          `${d.title} was drafted against an earlier project revision. Review alignment before using it.`,
      ),
    content.discipline === 'product'
      ? 'Physical products require qualified laboratory, engineering, supplier, legal and safety review before production.'
      : '',
    content.discipline === 'application'
      ? 'A technical document specifies an application; it does not demonstrate working software.'
      : '',
  ].filter(Boolean);
}

/** Exact scoped document changes; the model never rewrites an unseen document tail. */
export const documentEditSchema = z
  .object({ before: z.string().min(1).max(2000), after: z.string().max(4000) })
  .strict();
export const generationSchema = z
  .object({ ...proposalSchema.shape, documentEdits: z.array(documentEditSchema).max(3) })
  .strict();
export type DocumentEdit = z.infer<typeof documentEditSchema>;
export function applyDocumentEdits(content: string, edits: DocumentEdit[]) {
  const positions = edits
    .map((edit) => {
      const start = content.indexOf(edit.before);
      if (start < 0 || content.indexOf(edit.before, start + 1) >= 0)
        throw new Error('Document edit must identify one exact passage.');
      return { ...edit, start, end: start + edit.before.length };
    })
    .sort((a, b) => a.start - b.start);
  for (let i = 1; i < positions.length; i++)
    if (positions[i]!.start < positions[i - 1]!.end) throw new Error('Document edits overlap.');
  let result = content;
  for (const edit of positions.toReversed())
    result = result.slice(0, edit.start) + edit.after + result.slice(edit.end);
  if (!result.trim() || result.length > 24000)
    throw new Error('Document edit exceeds content bounds.');
  return result;
}
