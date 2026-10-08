import 'server-only';
import { intelligenceSession, IntelligenceError } from '@/domains/intelligence/service';
/** Metadata projection only. Every source retains its existing schema and scope. */
export async function readSavedWork() {
  const { client, person } = await intelligenceSession();
  const [missions, documents, conversations, projects, companies, jobs] = await Promise.all([
    client
      .from('intelligence_missions')
      .select('id,title,status,next_actions,updated_at')
      .eq('person_id', person.id)
      .order('updated_at', { ascending: false })
      .limit(100),
    client
      .from('mission_deliverable_summaries')
      .select('*')
      .eq('person_id', person.id)
      .order('created_at', { ascending: false })
      .limit(500),
    client
      .from('ai_conversations')
      .select('id,title,company_id,updated_at,archived_at')
      .eq('person_id', person.id)
      .order('updated_at', { ascending: false })
      .limit(100),
    client
      .from('ai_studio_projects')
      .select('id,title,company_id,job_id,updated_at')
      .eq('person_id', person.id)
      .order('updated_at', { ascending: false })
      .limit(100),
    client.from('companies').select('id,name').eq('person_id', person.id).limit(100),
    client
      .from('company_jobs')
      .select('id,company_id,scope,revision,created_at')
      .eq('person_id', person.id)
      .order('created_at', { ascending: false })
      .limit(100),
  ]);
  if (
    [missions, documents, conversations, projects, companies, jobs].some((result) => result.error)
  )
    throw new IntelligenceError('Saved work could not be loaded. Reload before continuing.', 503);
  // Additive rollout: missing Technology tables must not break existing Saved Work.
  const technology = await client
    .from('technology_projects')
    .select('*')
    .eq('person_id', person.id)
    .order('updated_at', { ascending: false })
    .limit(5);
  const technologyVersions = technology.error
    ? null
    : await client
        .from('technology_site_versions')
        .select('*')
        .eq('person_id', person.id)
        .limit(500);
  const names = new Map((companies.data ?? []).map((c) => [c.id, c.name]));
  const scope = (id: string | null) =>
    id ? `Company · ${names.get(id) ?? 'Private room'}` : 'Personal';
  return {
    ownerId: person.id,
    items: [
      ...(technology.data ?? []).map((p) => ({
        id: p.id,
        kind: 'Technology project',
        title:
          technologyVersions?.data?.find((v) => v.project_id === p.id && v.revision === p.revision)
            ?.brief.name ?? 'Website preview',
        scope: 'Personal',
        detail: `Private preview · version ${p.revision}`,
        date: p.updated_at,
        href: `/app/work/technology?project=${p.id}`,
      })),
      ...(jobs.data ?? []).map((job) => ({
        id: job.id,
        kind: 'Company work',
        title: job.scope.request,
        scope: scope(job.company_id),
        detail: `Saved work · revision ${job.revision}`,
        date: job.created_at,
        href: `/app/companies/${job.company_id}/work/${job.id}`,
      })),
      ...(missions.data ?? []).map((m) => ({
        id: m.id,
        kind: 'Mission',
        title: m.title,
        scope: 'Personal',
        detail: m.next_actions || m.status,
        date: m.updated_at,
        href: `/app/missions?id=${m.id}`,
      })),
      ...(documents.data ?? []).map((d) => ({
        id: d.id,
        kind: 'Document',
        title: d.title,
        scope: 'Personal',
        detail: `Version ${d.revision} · ${d.reviewed ? 'Reviewed by you' : 'Draft'}${d.mission_id ? '' : ' · Retained after Mission removal'}`,
        date: d.created_at,
        href: `/app/missions/deliverables?id=${d.id}`,
      })),
      ...(conversations.data ?? []).map((c) => ({
        id: c.id,
        kind: 'Conversation',
        title: c.title,
        scope: scope(c.company_id ?? null),
        detail: c.archived_at ? 'Archived' : 'Saved conversation',
        date: c.updated_at,
        href: c.company_id
          ? `/app/companies/${c.company_id}?conversation=${c.id}`
          : `/app/aethelios?conversation=${c.id}`,
      })),
      ...(projects.data ?? []).map((p) => ({
        id: p.id,
        kind: 'Visual project',
        title: p.title,
        scope: scope(p.company_id ?? null),
        detail: 'Studio · saved project',
        date: p.updated_at,
        href: p.company_id
          ? p.job_id
            ? `/app/companies/${p.company_id}/work/${p.job_id}`
            : `/app/companies/${p.company_id}`
          : `/app/studio?project=${p.id}`,
      })),
    ].sort((a, b) => b.date.localeCompare(a.date)),
  };
}
