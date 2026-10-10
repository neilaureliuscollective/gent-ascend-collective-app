import { redirect } from 'next/navigation';
export const metadata = { title: 'Legacy Reserve', robots: { index: false, follow: false } };
export default async function ProductEntry({ params }: { params: Promise<{ handle: string }> }) {
  redirect(`/app/collection/${encodeURIComponent((await params).handle)}`);
}
