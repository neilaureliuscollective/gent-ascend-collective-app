import 'server-only';
import { z } from 'zod';
import { IntelligenceError } from '@/domains/intelligence/service';
import { studioSession, verifyStudioProject, bucket as imageBucket } from './service';
import { parseDesignDocument, usedFontIds, type DesignDocument } from './design/document';
import { blockingIssues, imageAssetIds, validateDesign, type AssetInfo } from './design/validate';
import { exportSvg } from './design/svg-export';
import { exportPdf } from './design/pdf-export';
import { exportPng, inspectPng } from './design/png-export';
import { pagePixels } from './design/units';
import { presetDocument, finishLayoutPreset } from './design/presets';
import type { AssetBytes } from './design/assets';
import { imageDimensions } from './design/assets';
import { referenceType } from './image-validation';

export const designSaveInput = z
  .object({
    id: z.uuid(),
    projectId: z.uuid(),
    title: z.string().trim().min(1).max(80),
    document: z.unknown(),
    updatedAt: z.iso.datetime({ offset: true }).nullable(),
    revision: z.number().int().min(0),
    freeze: z.boolean().optional(),
  })
  .strict();

export const designCreateInput = z
  .object({
    projectId: z.uuid(),
    presetId: z.string().min(1).max(40),
    title: z.string().trim().min(1).max(80).optional(),
  })
  .strict();

export const designExportInput = z
  .object({
    projectId: z.uuid(),
    designId: z.uuid(),
    revisionId: z.uuid(),
    format: z.enum(['png', 'svg', 'pdf']),
    fontMode: z.enum(['embed', 'outline']).default('embed'),
  })
  .strict();

type SaveRow = { id: string; revision: number; updated_at: string; revision_id: string };

export async function createDesign(input: z.infer<typeof designCreateInput>) {
  await verifyStudioProject(input.projectId);
  const document = presetDocument(input.presetId, crypto.randomUUID());
  if (input.title) document.title = input.title;
  return saveDesign({
    id: document.id,
    projectId: input.projectId,
    title: document.title,
    document,
    updatedAt: null,
    revision: 0,
  });
}

export async function saveDesign(input: z.infer<typeof designSaveInput>) {
  await verifyStudioProject(input.projectId);
  const document = parseDesignDocument(input.document);
  if (document.id !== input.id) throw new IntelligenceError('Design identity does not match.', 422);
  const { client } = await studioSession();
  const result = await client.rpc('ai_studio_design_save', {
    p_id: input.id,
    p_project: input.projectId,
    p_title: input.title,
    p_document: document,
    p_updated: input.updatedAt,
    p_expected: input.revision,
    p_freeze: input.freeze ?? false,
  });
  if (result.error) {
    if (result.error.message.includes('DESIGN_CONFLICT'))
      throw new IntelligenceError('This design changed elsewhere. Refresh it before saving.', 409);
    throw new IntelligenceError(result.error.message.replace(/^.*ERROR:\s*/i, '') || 'Design could not be saved.', 422);
  }
  const row = Array.isArray(result.data) ? (result.data[0] as SaveRow | undefined) : (result.data as SaveRow | null);
  if (!row) throw new IntelligenceError('Design could not be saved.', 503);
  return { ...row, document };
}

export async function freezeDesign(designId: string, expectedRevision: number) {
  const { client } = await studioSession();
  const result = await client.rpc('ai_studio_design_freeze', {
    p_id: designId,
    p_expected: expectedRevision,
  });
  if (result.error || !result.data) {
    if (result.error?.message.includes('STALE_DESIGN_REVISION'))
      throw new IntelligenceError('That design revision is no longer the selected freeze target.', 409);
    throw new IntelligenceError('The design revision could not be frozen.', 409);
  }
  return { revisionId: result.data as string };
}

export async function designRevision(projectId: string, revisionId: string) {
  await verifyStudioProject(projectId);
  const { client, person } = await studioSession();
  const result = await client
    .from('ai_studio_design_revisions')
    .select('*')
    .eq('id', revisionId)
    .eq('project_id', projectId)
    .eq('person_id', person.id)
    .maybeSingle();
  if (result.error || !result.data)
    throw new IntelligenceError('Design revision not found.', 404);
  return {
    ...result.data,
    document: parseDesignDocument(result.data.document),
  };
}

async function ownedAssets(projectId: string, document: DesignDocument): Promise<{ info: AssetInfo[]; bytes: AssetBytes[] }> {
  const { client, person } = await studioSession();
  const needed = imageAssetIds(document);
  const bytes: AssetBytes[] = [];
  const info: AssetInfo[] = [];
  for (const layer of needed) {
    const row =
      layer.assetKind === 'version'
        ? await client
            .from('ai_studio_versions')
            .select('id,storage_key,project_id,status')
            .eq('id', layer.assetId)
            .eq('person_id', person.id)
            .eq('project_id', projectId)
            .eq('status', 'complete')
            .maybeSingle()
        : await client
            .from('ai_studio_references')
            .select('id,storage_key,project_id,media_type')
            .eq('id', layer.assetId)
            .eq('person_id', person.id)
            .eq('project_id', projectId)
            .maybeSingle();
    if (row.error || !row.data?.storage_key)
      throw new IntelligenceError('A placed image is not available in this project.', 404);
    const file = await client.storage.from(imageBucket).download(row.data.storage_key);
    if (file.error || !file.data) throw new IntelligenceError('A placed image could not be read.', 503);
    const buffer = new Uint8Array(await file.data.arrayBuffer());
    const media = referenceType(buffer);
    if (!media) throw new IntelligenceError('A placed image is not a supported PNG, JPEG or WebP file.', 422);
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

export async function exportDesign(input: z.infer<typeof designExportInput>) {
  const revision = await designRevision(input.projectId, input.revisionId);
  if (revision.design_id !== input.designId)
    throw new IntelligenceError('Export must use the selected design revision.', 422);
  const document = revision.document;
  void usedFontIds(document);
  const assets = await ownedAssets(input.projectId, document);
  const issues = await validateDesign(document, assets.info);
  const blocked = blockingIssues(issues);
  if (blocked.length) throw new IntelligenceError(blocked[0]!.message, 422);
  const size = pagePixels(document.page);
  let bytes: Uint8Array;
  let type: string;
  if (input.format === 'svg') {
    bytes = await exportSvg(document, assets.bytes, input.fontMode);
    type = 'image/svg+xml';
  } else if (input.format === 'pdf') {
    bytes = await exportPdf(document, assets.bytes);
    type = 'application/pdf';
  } else {
    bytes = await exportPng(document, assets.bytes);
    inspectPng(bytes);
    type = 'image/png';
  }
  const { client, person } = await studioSession();
  const key = `${(await authUid(client))}/${input.projectId}/${input.designId}/${input.revisionId}.${input.format}`;
  const uploaded = await client.storage.from('aethelios-studio-designs').upload(key, bytes, {
    contentType: type,
    upsert: true,
  });
  if (uploaded.error) throw new IntelligenceError('The export could not be stored privately.', 503);
  const recorded = await client.rpc('ai_studio_export_record', {
    p_design: input.designId,
    p_revision: input.revisionId,
    p_format: input.format,
    p_key: key,
    p_width: size.width,
    p_height: size.height,
    p_ppi: document.page.ppi,
  });
  if (recorded.error)
    throw new IntelligenceError('The export was stored but could not be recorded. Refresh before retrying.', 409);
  void person;
  return {
    id: recorded.data as string,
    format: input.format,
    width: size.width,
    height: size.height,
    ppi: document.page.ppi,
    issues,
    bytes,
    type,
    prepress: 'unavailable' as const,
    color: 'rgb' as const,
  };
}

async function authUid(client: Awaited<ReturnType<typeof studioSession>>['client']) {
  const { data } = await client.auth.getUser();
  if (!data.user) throw new IntelligenceError('Sign in to export.', 401);
  return data.user.id;
}

export async function designExportBlob(id: string) {
  const { client, person } = await studioSession();
  const row = await client
    .from('ai_studio_design_exports')
    .select('*')
    .eq('id', id)
    .eq('person_id', person.id)
    .maybeSingle();
  if (row.error || !row.data) throw new IntelligenceError('Export not found.', 404);
  const file = await client.storage.from('aethelios-studio-designs').download(row.data.storage_key);
  if (file.error || !file.data) throw new IntelligenceError('Export unavailable.', 503);
  return { blob: file.data, format: row.data.format as 'png' | 'svg' | 'pdf' };
}

export function finishAsDesign(
  id: string,
  layout: Parameters<typeof finishLayoutPreset>[1],
  brand?: Parameters<typeof finishLayoutPreset>[2],
) {
  return finishLayoutPreset(id, layout, brand);
}
