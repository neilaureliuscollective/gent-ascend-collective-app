import 'server-only';
import { currentAccess } from '@/domains/access/current';
import { currentFounderAccess } from '@/domains/access/founder';
import { originReady } from '@/domains/architect-origin/service';
import { workContent, workScope } from '@/domains/company-work/schema';
import {
  IntelligenceError,
  intelligenceSession,
} from '@/domains/intelligence/service';
import {
  emptyRecords,
  projectCommandHome,
  type ArchitectRecord,
  type CommandHomeData,
  type JobRecord,
  type SourceAvailability,
  type StudioVersionRecord,
  type WorkVersionRecord,
} from './model';

export async function readCommandHome(
  requestedFocus?: string | null,
  previousKey?: string | null,
): Promise<CommandHomeData> {
  const { client, person } = await intelligenceSession();
  const [founderOffice, access] = await Promise.all([
    currentFounderAccess().catch(() => false),
    currentAccess().catch(() => null),
  ]);
  const records = emptyRecords(person.id, new Date().toISOString());
  records.founderOffice = founderOffice;
  const studioEnabled = access?.has('aurelius.context') ?? false;
  const architectEnabled = originReady();

  const [architect, work, studio, talk] = await Promise.all([
    architectEnabled
      ? readArchitect(client, person.id)
      : Promise.resolve({
          availability: {
            id: 'architect' as const,
            state: 'awaiting' as const,
            message:
              'Architect persistence is awaiting its reviewed database migration. Existing environments remain available.',
          },
          projects: [] as ArchitectRecord[],
        }),
    readWork(client, person.id),
    studioEnabled
      ? readStudio(client, person.id)
      : Promise.resolve({
          availability: {
            id: 'studio' as const,
            state: 'closed' as const,
            message: 'Studio is not enabled for this account.',
          },
          projects: [],
          versions: [] as StudioVersionRecord[],
        }),
    readTalk(client, person.id),
  ]);

  records.architect = architect;
  records.companies = work.companies;
  records.jobs = work.jobs;
  records.versions = work.versions;
  records.workAvailability = work.availability;
  records.studio = studio;
  records.conversations = talk.conversations;
  records.talkAvailability = talk.availability;

  const projected = projectCommandHome(records, requestedFocus, previousKey);
  if (projected.selected?.source === 'architect') {
    const detailed = await readArchitectProject(client, person.id, projected.selected.id);
    if (detailed) {
      const index = records.architect.projects.findIndex((item) => item.id === detailed.id);
      if (index >= 0) records.architect.projects[index] = detailed;
      else records.architect.projects.push(detailed);
      return projectCommandHome(records, requestedFocus, previousKey);
    }
  }
  return projected;
}

type QueryClient = Awaited<ReturnType<typeof intelligenceSession>>['client'];

async function readArchitect(client: QueryClient, ownerId: string) {
  const availability: SourceAvailability = { id: 'architect', state: 'ready' };
  const projects = await client
    .from('architect_origin_projects')
    .select('id,updated_at,content')
    .eq('person_id', ownerId)
    .order('updated_at', { ascending: false })
    .limit(40);
  if (projects.error) {
    return {
      availability: {
        id: 'architect' as const,
        state: 'unavailable' as const,
        message: 'Architect projects could not be loaded.',
      },
      projects: [] as ArchitectRecord[],
    };
  }
  return {
    availability,
    projects: (projects.data ?? []).map((row) => {
      const content = row.content as {
        name?: string;
        description?: string;
        status?: string;
      };
      return {
        id: row.id,
        name: content.name ?? '',
        description: content.description ?? '',
        status: content.status ?? 'active',
        updatedAt: row.updated_at,
        documents: [],
      };
    }),
  };
}

async function readArchitectProject(
  client: QueryClient,
  ownerId: string,
  projectId: string,
): Promise<ArchitectRecord | null> {
  const [owned, runs] = await Promise.all([
    client
      .from('architect_origin_projects')
      .select('id,updated_at,content')
      .eq('person_id', ownerId)
      .eq('id', projectId)
      .maybeSingle(),
    client
      .from('architect_origin_runs')
      .select('status')
      .eq('person_id', ownerId)
      .eq('project_id', projectId)
      .eq('status', 'running')
      .limit(1),
  ]);
  if (owned.error || !owned.data) return null;
  const content = owned.data.content as {
    name?: string;
    description?: string;
    status?: string;
    documents?: ArchitectRecord['documents'];
    blueprint?: Record<string, string>;
  };
  const blueprint = content.blueprint ?? {};
  const blueprintExcerpt = ['state', 'next', 'vision', 'solution']
    .map((key) => blueprint[key]?.trim())
    .find(Boolean);
  return {
    id: owned.data.id,
    name: content.name ?? '',
    description: content.description ?? '',
    status: content.status ?? 'active',
    updatedAt: owned.data.updated_at,
    documents: Array.isArray(content.documents) ? content.documents : [],
    blueprintExcerpt,
    running: !runs.error && Boolean(runs.data?.length),
  };
}

async function readWork(client: QueryClient, ownerId: string) {
  const [companies, jobs] = await Promise.all([
    client
      .from('companies')
      .select('id,name')
      .eq('person_id', ownerId)
      .order('created_at', { ascending: false })
      .limit(40),
    client
      .from('company_jobs')
      .select('id,company_id,conversation_id,created_at,scope')
      .eq('person_id', ownerId)
      .order('created_at', { ascending: false })
      .limit(40),
  ]);
  if (companies.error || jobs.error) {
    return {
      availability: {
        id: 'work' as const,
        state: 'unavailable' as const,
        message: 'Company work could not be loaded.',
      },
      companies: [],
      jobs: [] as JobRecord[],
      versions: [] as WorkVersionRecord[],
    };
  }
  const jobRows = jobs.data ?? [];
  const versions =
    jobRows.length === 0
      ? { data: [], error: null }
      : await client
          .from('company_work_versions')
          .select('job_id,revision,content,reviewed_at,created_at')
          .eq('person_id', ownerId)
          .in(
            'job_id',
            jobRows.map((job) => job.id),
          )
          .order('revision', { ascending: false })
          .limit(80);
  if (versions.error) {
    return {
      availability: {
        id: 'work' as const,
        state: 'unavailable' as const,
        message: 'Company work history could not be loaded.',
      },
      companies: companies.data ?? [],
      jobs: [],
      versions: [] as WorkVersionRecord[],
    };
  }
  return {
    availability: { id: 'work' as const, state: 'ready' as const },
    companies: companies.data ?? [],
    jobs: jobRows.flatMap((job) => {
      const scope = workScope.safeParse(job.scope);
      return [
        {
          id: job.id,
          companyId: job.company_id,
          conversationId: job.conversation_id,
          createdAt: job.created_at,
          request: scope.success ? scope.data.request : '',
        },
      ];
    }),
    versions: (versions.data ?? []).flatMap((row) => {
      const parsed = workContent.safeParse(row.content);
      if (!parsed.success) return [];
      return [
        {
          jobId: row.job_id,
          revision: row.revision,
          title: parsed.data.title,
          summary: parsed.data.summary,
          gaps: parsed.data.gaps,
          slides: parsed.data.slides.map((slide) => ({ title: slide.title, body: slide.body })),
          reviewedAt: row.reviewed_at,
          createdAt: row.created_at,
        } satisfies WorkVersionRecord,
      ];
    }),
  };
}

async function readStudio(client: QueryClient, ownerId: string) {
  const projects = await client
    .from('ai_studio_projects')
    .select('id,title,updated_at')
    .eq('person_id', ownerId)
    .is('company_id', null)
    .order('updated_at', { ascending: false })
    .limit(40);
  if (projects.error) {
    return {
      availability: {
        id: 'studio' as const,
        state: 'unavailable' as const,
        message: 'Studio projects could not be loaded.',
      },
      projects: [],
      versions: [] as StudioVersionRecord[],
    };
  }
  const rows = projects.data ?? [];
  const versions =
    rows.length === 0
      ? { data: [], error: null }
      : await client
          .from('ai_studio_versions')
          .select('id,project_id,status,prompt,created_at')
          .eq('person_id', ownerId)
          .in(
            'project_id',
            rows.map((project) => project.id),
          )
          .order('created_at', { ascending: false })
          .limit(80);
  const library = rows.map((project) => ({
    id: project.id,
    title: project.title,
    updatedAt: project.updated_at,
  }));
  if (versions.error) {
    return {
      availability: {
        id: 'studio' as const,
        state: 'unavailable' as const,
        message: 'Studio versions could not be loaded.',
      },
      projects: library,
      versions: [] as StudioVersionRecord[],
    };
  }
  return {
    availability: { id: 'studio' as const, state: 'ready' as const },
    projects: library,
    versions: (versions.data ?? []).map((version) => ({
      id: version.id,
      projectId: version.project_id,
      status: version.status,
      prompt: version.prompt,
      createdAt: version.created_at,
    })),
  };
}

async function readTalk(client: QueryClient, ownerId: string) {
  const conversations = await client
    .from('ai_conversations')
    .select('id,title,updated_at')
    .eq('person_id', ownerId)
    .is('company_id', null)
    .is('archived_at', null)
    .order('updated_at', { ascending: false })
    .limit(8);
  if (conversations.error) {
    return {
      availability: {
        id: 'talk' as const,
        state: 'unavailable' as const,
        message: 'Saved conversations could not be loaded.',
      },
      conversations: [],
    };
  }
  return {
    availability: { id: 'talk' as const, state: 'ready' as const },
    conversations: (conversations.data ?? []).map((conversation) => ({
      id: conversation.id,
      title: conversation.title,
      updatedAt: conversation.updated_at,
    })),
  };
}

export function commandHomeError(error: unknown): never {
  if (error instanceof IntelligenceError) throw error;
  throw new IntelligenceError('Command could not load your saved work.', 503);
}
