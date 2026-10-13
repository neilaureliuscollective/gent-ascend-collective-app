import 'server-only';
import { createHash } from 'node:crypto';
import { currentFounderAccess } from '@/domains/access/founder';
import { IntelligenceError, intelligenceSession } from '@/domains/intelligence/service';
import { createWork, readWork } from '@/domains/company-work/service';
import { inspectPlatform, platformEvidence } from './platform';
import { describeConnections } from '@/domains/connections/service';
import { sessionStore } from '@/domains/connections/store';
import type { ConnectionView } from '@/domains/connections/schema';
import { aiConfigSchema } from '@/domains/intelligence/validation';
import { founderRequest, founderScope } from './schema';
import { workContractReady } from '@/domains/company-work/activation';
import { taskReadiness } from '@/domains/company-work/tasks';
import { workScope, workContent } from '@/domains/company-work/schema';

export async function founderSession() {
  const session = await intelligenceSession();
  if (!(await currentFounderAccess())) throw new IntelligenceError('Founder access required.', 403);
  return session;
}
export async function prepareFounderWork(body: unknown) {
  await founderSession();
  const input = founderRequest.safeParse(body);
  if (!input.success)
    throw new IntelligenceError('Choose a company, Coworker and substantive objective.');
  const scope = founderScope(
    input.data.objective,
    input.data.specialistId,
    input.data.evidence,
    input.data.figures,
  );
  if (input.data.evidence.length || input.data.figures.length)
    scope.constraints += ` Confirmed input fingerprint: ${createHash('sha256')
      .update(JSON.stringify({ evidence: input.data.evidence, figures: input.data.figures }))
      .digest('hex')}.`;
  let prior: Awaited<ReturnType<typeof readWork>> | null = null;
  try {
    prior = await readWork(input.data.companyId, input.data.jobId);
  } catch (error) {
    if (!(error instanceof IntelligenceError) || error.status !== 404) throw error;
  }
  if (prior) {
    if (
      prior.job.conversation_id !== input.data.conversationId ||
      prior.job.scope.request !== scope.request ||
      prior.job.scope.constraints !== scope.constraints
    )
      throw new IntelligenceError('Mission request changed. Open the original saved mission.', 409);
    return prior;
  }
  if (
    /\b(inspect|audit|broken|health|verify)\b/i.test(input.data.objective) &&
    /\b(aethelios|gentascend|gent ascend|platform|public app)\b/i.test(input.data.objective)
  )
    scope.evidence.push(...platformEvidence(await inspectPlatform()));
  return createWork({
    companyId: input.data.companyId,
    jobId: input.data.jobId,
    conversationId: input.data.conversationId,
    scope,
  });
}

export async function readFounderOffice() {
  const { client, person } = await founderSession();
  const since = new Date(Date.now() - 7 * 86400000).toISOString();
  const [companies, jobs, turns, usage, memories, proposals, personalMissions] = await Promise.all([
    client
      .from('companies')
      .select('*')
      .eq('person_id', person.id)
      .order('created_at', { ascending: false }),
    client
      .from('company_jobs')
      .select('*')
      .eq('person_id', person.id)
      .order('created_at', { ascending: false })
      .limit(100),
    client
      .from('ai_turns')
      .select('id,conversation_id,status,model,created_at,finished_at,prompt_version')
      .eq('person_id', person.id)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(300),
    client
      .from('ai_usage')
      .select('id,input_tokens,output_tokens,created_at')
      .eq('person_id', person.id)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(300),
    client
      .from('ai_memories')
      .select('*')
      .eq('person_id', person.id)
      .order('confirmed_at', { ascending: false })
      .limit(24),
    client
      .from('ai_action_proposals')
      .select('*')
      .eq('person_id', person.id)
      .order('proposed_at', { ascending: false })
      .limit(100),
    client
      .from('intelligence_missions')
      .select('*')
      .eq('person_id', person.id)
      .order('updated_at', { ascending: false })
      .limit(100),
  ]);
  if (
    companies.error ||
    jobs.error ||
    turns.error ||
    usage.error ||
    memories.error ||
    proposals.error ||
    personalMissions.error
  )
    throw new IntelligenceError(
      'Founder records could not be loaded. No empty or healthy state is inferred.',
      503,
    );
  // Fetch exact current versions, not historical slide decks on every refresh.
  const currentJobs = (jobs.data ?? []).filter((job) => job.revision > 0);
  const batches = [];
  for (let index = 0; index < currentJobs.length; index += 20)
    batches.push(currentJobs.slice(index, index + 20));
  const versionReads = await Promise.all(
    batches.map((batch) =>
      client
        .from('company_work_versions')
        .select('*')
        .eq('person_id', person.id)
        .or(
          batch
            .map(
              (job) =>
                `and(company_id.eq.${job.company_id},job_id.eq.${job.id},revision.eq.${job.revision})`,
            )
            .join(','),
        )
        .limit(batch.length),
    ),
  );
  if (versionReads.some((result) => result.error))
    throw new IntelligenceError('Mission version receipts unavailable.', 503);
  const versions = versionReads.flatMap((result) => result.data ?? []);
  const config = aiConfigSchema.parse(process.env);
  const missionCards = (jobs.data ?? []).map((job) => {
    const scope = workScope.safeParse(job.scope);
    if (!scope.success) throw new IntelligenceError('A saved job needs scope repair.', 409);
    const latest = versions.find((v) => v.job_id === job.id && v.revision === job.revision);
    const content = latest ? workContent.safeParse(latest.content) : null;
    if (content && !content.success)
      throw new IntelligenceError('A saved deliverable needs repair.', 409);
    const recentTurn = (turns.data ?? []).find((t) => t.conversation_id === job.conversation_id);
    return {
      id: job.id,
      companyId: job.company_id,
      companyName: job.company_name,
      title: scope.data.request,
      revision: job.revision,
      createdAt: job.created_at,
      updatedAt: latest?.created_at ?? job.created_at,
      latestVersion: latest?.id ?? null,
      reviewedAt: latest?.reviewed_at ?? null,
      summary: content?.success ? content.data.summary : null,
      actions: content?.success ? content.data.actions : [],
      gaps: content?.success ? content.data.gaps : [],
      tasks: content?.success ? (content.data.taskPlan ?? []) : [],
      approvals: content?.success ? (content.data.approvalRequests ?? []) : [],
      readiness: content?.success
        ? (content.data.taskPlan ?? []).map((task) => ({
            id: task.id,
            title: task.title,
            assignee: task.assignee,
            ...taskReadiness(content.data.taskPlan ?? [], task.id),
          }))
        : [],
      status:
        job.revision > 0 && !latest
          ? 'history_unavailable'
          : content?.success &&
              content.data.approvalRequests?.some((item) => item.status === 'pending')
            ? 'awaiting_approval'
            : content?.success &&
                content.data.approvalRequests?.some((item) => item.status === 'approved')
              ? 'approved_awaiting_executor'
              : content?.success &&
                  content.data.taskPlan?.some((item) => item.status !== 'completed')
                ? 'active'
                : latest
                  ? latest.reviewed_at
                    ? 'reviewed'
                    : 'needs_review'
                  : recentTurn?.status === 'failed' || recentTurn?.status === 'cancelled'
                    ? 'interrupted'
                    : 'prepared',
      assignment: scope.data.constraints.match(/^Assigned Coworker: ([a-z]+)\./)?.[1] ?? null,
    };
  });
  missionCards.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const recordedUsage = usage.data ?? [];
  return {
    ownerId: person.id,
    person: {
      displayName: person.display_name,
      timezone: person.timezone,
      priority: person.priority,
    },
    asOf: new Date().toISOString(),
    companies: companies.data ?? [],
    missions: missionCards,
    memories: memories.data ?? [],
    proposals: proposals.data ?? [],
    personalMissions: personalMissions.data ?? [],
    operations: {
      windowStart: since,
      turns: turns.data ?? [],
      usageRecords: recordedUsage.length,
      inputTokens: recordedUsage.reduce((n, r) => n + (r.input_tokens ?? 0), 0),
      outputTokens: recordedUsage.reduce((n, r) => n + (r.output_tokens ?? 0), 0),
      incompleteUsage: recordedUsage.filter(
        (r) => r.input_tokens === null || r.output_tokens === null,
      ).length,
      bounded: recordedUsage.length === 300 || turns.data?.length === 300,
      workContractReady: workContractReady(),
      modelConfigured: Boolean(config.OPENAI_API_KEY),
      model: config.AURELIUS_AI_MODEL,
      commerceConfigured: Boolean(
        process.env.SHOPIFY_STORE_DOMAIN && process.env.SHOPIFY_STOREFRONT_PRIVATE_TOKEN,
      ),
    },
    connections: await describeConnections(person.id, sessionStore(client)).catch(
      (): { github: ConnectionView; vercel: ConnectionView } => ({
        github: {
          provider: 'github',
          label: 'GitHub',
          purpose: 'Read-only selected repository access.',
          status: 'verification_failed',
          setupRequired: false,
          configured: false,
          accountLogin: null,
          accountId: null,
          selectedName: null,
          selectedId: null,
          capabilities: [],
          lastVerifiedAt: null,
          lastError: 'Connection state could not be loaded.',
          installationRemainsHint: '',
          accessMode: 'none',
          resources: [],
          deployment: null,
          summary: 'GitHub connection state could not be loaded.',
        },
        vercel: {
          provider: 'vercel',
          label: 'Vercel',
          purpose: 'Read-only selected project access.',
          status: 'verification_failed',
          setupRequired: false,
          configured: false,
          accountLogin: null,
          accountId: null,
          selectedName: null,
          selectedId: null,
          capabilities: [],
          lastVerifiedAt: null,
          lastError: 'Connection state could not be loaded.',
          installationRemainsHint: '',
          accessMode: 'none',
          resources: [],
          deployment: null,
          summary: 'Vercel connection state could not be loaded.',
        },
      }),
    ),
  };
}
export type FounderOfficeData = Awaited<ReturnType<typeof readFounderOffice>>;
