import { maxReferenceBytes } from '@/domains/studio/image-validation';
export type TalkAttachment = {
  id: string;
  projectId: string;
  name: string;
  analysisPending?: boolean;
};
export type UploadTicket = {
  id: string;
  projectId: string;
  path: string;
  token: string;
  url: string;
  publishableKey: string;
};
export class ImageRequestError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function imageRequest<T>(body: unknown): Promise<T> {
  const response = await fetch('/api/aurelius/attachments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok)
    throw new ImageRequestError(result.error || 'Image request did not complete.', response.status);
  return result as T;
}
export function validateTalkImage(file: File) {
  if (
    !['image/png', 'image/jpeg', 'image/webp'].includes(file.type) ||
    file.size < 100 ||
    file.size > maxReferenceBytes
  )
    throw new Error(
      'Choose PNG, JPEG or WebP from 100 bytes to 10 MiB. Videos and general files are unsupported.',
    );
}
export async function transferTalkImage(ticket: UploadTicket, file: File) {
  const { createClient } = await import('@supabase/supabase-js');
  const result = await createClient(ticket.url, ticket.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
    .storage.from('aethelios-studio')
    .uploadToSignedUrl(ticket.path, ticket.token, file, { contentType: file.type, upsert: false });
  if (result.error)
    throw new Error('Image transfer did not confirm. Retry to verify it before uploading again.');
}
/** Retry verifies the same object first. A cancelled/superseded operation cannot continue or attach late. */
export async function uploadTalkImage(
  file: File,
  state: { ticket?: UploadTicket },
  current: () => boolean,
  phase: (label: string) => void,
  transfer = transferTalkImage,
) {
  validateTalkImage(file);
  if (!current()) return null;
  const finish = () =>
    imageRequest<{ id: string; projectId: string }>({
      action: 'complete',
      projectId: state.ticket!.projectId,
      id: state.ticket!.id,
      mediaType: file.type,
    });
  if (state.ticket) {
    phase('Verifying previous upload…');
    try {
      const saved = await finish();
      return current() ? saved : null;
    } catch (error) {
      if (!(error instanceof ImageRequestError) || error.status !== 409) throw error;
    }
    if (!current()) return null;
  } else {
    phase('Preparing image…');
    state.ticket = await imageRequest<UploadTicket>({
      action: 'prepare',
      mediaType: file.type,
      byteSize: file.size,
    });
    if (!current()) return null;
  }
  phase('Uploading image…');
  await transfer(state.ticket, file);
  if (!current()) return null;
  phase('Verifying original image…');
  const saved = await finish();
  return current() ? saved : null;
}
