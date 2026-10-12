import 'server-only';
// Fixed public destinations. Never proxy caller-controlled URLs or forward session cookies.
const repository = 'neilaureliuscollective/gent-ascend-collective-app';
const api = `https://api.github.com/repos/${repository}`;
export const inspectionPaths = [
  'src/domains/access/founder.ts',
  'src/domains/access/current.ts',
  'src/domains/intelligence/agent.ts',
  'src/domains/intelligence/validation.ts',
  'src/app/api/company-talk/chat/route.ts',
  'src/domains/company-work/service.ts',
] as const;
type Observation = {
  source: string;
  ok: boolean;
  status: number | null;
  data: unknown;
  issue: string | null;
};
async function observe(url: string, method: 'GET' | 'HEAD' = 'GET'): Promise<Observation> {
  try {
    const response = await fetch(url, {
      method,
      headers: { Accept: 'application/vnd.github+json' },
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(8000),
    });
    // Public responses are bounded before parsing, and no upstream error bodies are exposed.
    if (!response.ok)
      return {
        source: url,
        ok: false,
        status: response.status,
        data: null,
        issue: 'Public service returned an unsuccessful status.',
      };
    if (method === 'HEAD')
      return { source: url, ok: true, status: response.status, data: null, issue: null };
    const reader = response.body?.getReader();
    if (!reader) throw new Error('Missing body');
    const decoder = new TextDecoder();
    let text = '';
    let bytes = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.length;
      if (bytes > 150000) {
        await reader.cancel();
        throw new Error('Oversized response');
      }
      text += decoder.decode(value, { stream: true });
    }
    return {
      source: url,
      ok: true,
      status: response.status,
      data: JSON.parse(text + decoder.decode()),
      issue: null,
    };
  } catch {
    return {
      source: url,
      ok: false,
      status: null,
      data: null,
      issue: 'Public observation unavailable; health is unknown.',
    };
  }
}
function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
export async function inspectPlatform() {
  const asOf = new Date().toISOString();
  const [site, branch, runs] = await Promise.all([
    observe('https://www.gentascend.com', 'HEAD'),
    observe(`${api}/branches/main`),
    observe(`${api}/actions/runs?branch=main&per_page=5`),
  ]);
  const commit = record(record(branch.data).commit);
  const sha =
    typeof commit.sha === 'string' && /^[a-f0-9]{40}$/.test(commit.sha) ? commit.sha : null;
  // Pin all source reads to the same observed commit, never a moving branch.
  const files = sha
    ? await Promise.all(
        inspectionPaths.map(async (path) => {
          const result = await observe(`${api}/contents/${path}?ref=${sha}`);
          const data = record(result.data);
          const content =
            result.ok && data.encoding === 'base64' && typeof data.content === 'string'
              ? Buffer.from(data.content, 'base64').toString('utf8')
              : null;
          return {
            path,
            source: `https://github.com/${repository}/blob/${sha}/${path}`,
            ok: content !== null,
            excerpt: content?.slice(0, 1800) ?? null,
            excerpted: (content?.length ?? 0) > 1800,
            issue: content === null ? 'Source unavailable.' : null,
          };
        }),
      )
    : [];
  const workflowRuns = record(runs.data).workflow_runs;
  const workflows = Array.isArray(workflowRuns)
    ? workflowRuns.slice(0, 5).map((value) => {
        const run = record(value);
        return {
          id: typeof run.id === 'number' ? run.id : null,
          name: typeof run.name === 'string' ? run.name : 'Unknown workflow',
          status: typeof run.status === 'string' ? run.status : 'unknown',
          conclusion: typeof run.conclusion === 'string' ? run.conclusion : null,
          sha: typeof run.head_sha === 'string' ? run.head_sha : null,
          url:
            typeof run.html_url === 'string' &&
            run.html_url.startsWith(`https://github.com/${repository}/actions/runs/`)
              ? run.html_url
              : null,
        };
      })
    : [];
  return {
    asOf,
    repository,
    commit: sha,
    application: { url: site.source, status: site.status, available: site.ok, issue: site.issue },
    repositoryIssue: branch.issue,
    workflowIssue: runs.issue,
    workflows,
    files,
    limits:
      'Public homepage HTTP response and bounded source excerpts only. No authenticated app journey, private logs, deployment inspection, database health test or execution occurred.',
  };
}
export function platformEvidence(snapshot: Awaited<ReturnType<typeof inspectPlatform>>) {
  return [
    {
      label: 'Canonical platform observation',
      detail: JSON.stringify({
        asOf: snapshot.asOf,
        commit: snapshot.commit,
        application: snapshot.application,
        repositoryIssue: snapshot.repositoryIssue,
        workflows: snapshot.workflows,
        limits: snapshot.limits,
      }).slice(0, 2000),
    },
    ...snapshot.files.map((file) => ({
      label: file.path.slice(0, 100),
      detail:
        `Source: ${file.source}\nObserved: ${snapshot.asOf}\n${file.excerpted ? 'Partial excerpt; remaining source not supplied.\n' : ''}${file.excerpt ?? file.issue}`.slice(
          0,
          2000,
        ),
    })),
  ];
}
