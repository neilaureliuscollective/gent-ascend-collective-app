import { redirect } from 'next/navigation';
/** Preserve existing bookmarks, including selected conversations and starter drafts. */
export default async function LegacyIntelligencePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string') query.set(key, value);
    else if (Array.isArray(value)) value.forEach((entry) => query.append(key, entry));
  }
  redirect('/app/aethelios' + (query.size ? `?${query}` : ''));
}
