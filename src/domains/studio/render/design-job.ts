import { parseDesignDocument, usedFontIds, type DesignDocument } from '../design/document';
import { blockingIssues, imageAssetIds, validateDesign, type AssetInfo } from '../design/validate';
import { exportSvg } from '../design/svg-export';
import { exportPdf } from '../design/pdf-export';
import { exportPng, inspectPng } from '../design/png-export';
import { pagePixels } from '../design/units';
import type { AssetBytes } from '../design/assets';
import { imageDimensions } from '../design/assets';
import { referenceType } from '../image-validation';
import { designAttemptObjectKey, publishOrReconcileAttempt } from './attempt-storage';
import { RENDER_LIMITS, TempBudget, jobDeadlineAt, remainingMs } from './limits';
import { downloadBounded } from './materialize';
import { combineAbortSignals } from './process';

const IMAGE_BUCKET = 'aethelios-studio';
const DESIGN_BUCKET = 'aethelios-studio-designs';

export function designExportNeedsFfmpeg(document: DesignDocument, format: 'png' | 'svg' | 'pdf') {
  if (format === 'png') return true;
  if (format === 'svg') return false;
  return document.layers.some((layer) => layer.type === 'svg');
}

export async function renderDesignBytes(
  document: DesignDocument,
  assets: AssetBytes[],
  format: 'png' | 'svg' | 'pdf',
  fontMode: 'embed' | 'outline' = 'embed',
  options: { signal?: AbortSignal; timeoutMs?: number } = {},
) {
  void usedFontIds(document);
  if (format === 'svg') {
    return { bytes: await exportSvg(document, assets, fontMode), type: 'image/svg+xml' as const };
  }
  if (format === 'pdf') {
    return { bytes: await exportPdf(document, assets), type: 'application/pdf' as const };
  }
  const bytes = await exportPng(document, assets, undefined, options);
  inspectPng(bytes);
  return { bytes, type: 'image/png' as const };
}

export async function ownedDesignAssets(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any,
  personId: string,
  projectId: string,
  document: DesignDocument,
  signal?: AbortSignal,
) {
  const needed = imageAssetIds(document);
  const bytes: AssetBytes[] = [];
  const info: AssetInfo[] = [];
  const budget = new TempBudget();
  for (const layer of needed) {
    const row =
      layer.assetKind === 'version'
        ? await client
            .from('ai_studio_versions')
            .select('id,storage_key,project_id,status')
            .eq('id', layer.assetId)
            .eq('person_id', personId)
            .eq('project_id', projectId)
            .eq('status', 'complete')
            .maybeSingle()
        : await client
            .from('ai_studio_references')
            .select('id,storage_key,project_id,media_type')
            .eq('id', layer.assetId)
            .eq('person_id', personId)
            .eq('project_id', projectId)
            .maybeSingle();
    if (row.error || !row.data?.storage_key) throw new Error('A placed image is not available in this project.');
    const buffer = new Uint8Array(
      await downloadBounded(client.storage.from(IMAGE_BUCKET).download(row.data.storage_key), budget, signal),
    );
    const media = referenceType(buffer);
    if (!media) throw new Error('A placed image is not a supported PNG, JPEG or WebP file.');
    const size = imageDimensions(buffer, media);
    bytes.push({
      id: layer.assetId,
      kind: layer.assetKind,
      bytes: buffer,
      mediaType: media,
      widthPx: size.widthPx,
      heightPx: size.heightPx,
    });
    info.push({
      id: layer.assetId,
      kind: layer.assetKind,
      widthPx: size.widthPx,
      heightPx: size.heightPx,
    });
  }
  return { info, bytes };
}

export async function runDesignExportJob(input: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any;
  personId: string;
  jobId: string;
  document: DesignDocument;
  projectId: string;
  format: 'png' | 'svg' | 'pdf';
  fontMode: 'embed' | 'outline';
  signal?: AbortSignal;
}) {
  const token = crypto.randomUUID();
  const claimed = await input.client.rpc('ai_studio_design_export_claim', { p_id: input.jobId, p_token: token });
  if (claimed.error || !claimed.data) throw new Error('This design export could not obtain a lease.');
  const deadlineAt = jobDeadlineAt();
  const abort = new AbortController();
  const signal = combineAbortSignals(
    [input.signal, abort.signal, AbortSignal.timeout(RENDER_LIMITS.jobMs)].filter(
      (value): value is AbortSignal => Boolean(value),
    ),
  );
  const beat = setInterval(() => {
    void input.client
      .rpc('ai_studio_design_export_heartbeat', { p_id: input.jobId, p_token: token })
      .then(async (pulse: { data: unknown }) => {
        const row = await input.client
          .from('ai_studio_design_export_jobs')
          .select('status,lease_token')
          .eq('id', input.jobId)
          .maybeSingle();
        if (!pulse.data || row.data?.status === 'cancelled' || row.data?.lease_token !== token) abort.abort();
      });
  }, 15_000);
  const uploaded: string[] = [];
  try {
    if (signal.aborted) throw new Error('Studio design export was cancelled.');
    const assets = await ownedDesignAssets(input.client, input.personId, input.projectId, input.document, signal);
    const issues = await validateDesign(input.document, assets.info);
    const blocked = blockingIssues(issues);
    if (blocked.length) throw new Error(blocked[0]!.message);
    const size = pagePixels(input.document.page);
    const rendered = await renderDesignBytes(input.document, assets.bytes, input.format, input.fontMode, {
      signal,
      timeoutMs: remainingMs(deadlineAt, RENDER_LIMITS.pngMs),
    });
    if (signal.aborted) throw new Error('Studio design export was cancelled.');
    const person = await input.client.from('persons').select('auth_user_id').eq('id', input.personId).maybeSingle();
    const uid = (person.data?.auth_user_id as string | undefined) ?? (await input.client.auth.getUser()).data.user?.id;
    if (!uid) throw new Error('Owner identity unavailable for private design storage.');
    const key = designAttemptObjectKey({
      uid,
      projectId: input.projectId,
      jobId: input.jobId,
      token,
      format: input.format,
    });
    const bucket = input.client.storage.from(DESIGN_BUCKET);
    const remove = async (paths: string[]) => {
      if (paths.length) await bucket.remove(paths);
    };
    const stored = await bucket.upload(key, rendered.bytes, { contentType: rendered.type, upsert: false });
    uploaded.push(key);
    if (stored.error) throw new Error('The export could not be stored privately.');
    const still = await input.client
      .from('ai_studio_design_export_jobs')
      .select('status,lease_token,storage_key')
      .eq('id', input.jobId)
      .maybeSingle();
    if (still.data?.status === 'cancelled' || still.data?.lease_token !== token) {
      await remove(uploaded);
      throw new Error('Studio design export was cancelled.');
    }
    const outcome = await publishOrReconcileAttempt({
      finish: async () =>
        await input.client.rpc('ai_studio_design_export_finish', {
          p_id: input.jobId,
          p_token: token,
          p_key: key,
          p_width: size.width,
          p_height: size.height,
          p_ppi: input.document.page.ppi,
        }),
      readJob: async () => {
        const row = await input.client
          .from('ai_studio_design_export_jobs')
          .select('status,lease_token,storage_key')
          .eq('id', input.jobId)
          .maybeSingle();
        if (row.error) return { available: false as const, reason: row.error.message };
        return { available: true as const, row: row.data };
      },
      uploaded,
      remove,
      token,
    });
    if (!outcome.published) throw new Error('Completion receipt was rejected; late output was not published.');
    const finished = await input.client
      .from('ai_studio_design_export_jobs')
      .select('export_id,width,height,ppi')
      .eq('id', input.jobId)
      .maybeSingle();
    return {
      id: input.jobId,
      status: 'complete' as const,
      exportId: (finished.data?.export_id as string | null) ?? null,
      format: input.format,
      width: size.width,
      height: size.height,
      ppi: input.document.page.ppi,
      issues,
      type: rendered.type,
      needsFfmpeg: designExportNeedsFfmpeg(input.document, input.format),
    };
  } catch (error) {
    await input.client.rpc('ai_studio_design_export_fail', {
      p_id: input.jobId,
      p_token: token,
      p_code: signal.aborted ? 'cancelled' : 'render_failed',
    });
    throw error;
  } finally {
    clearInterval(beat);
  }
}

export function parsePinnedDesignDocument(value: unknown) {
  return parseDesignDocument(value);
}
