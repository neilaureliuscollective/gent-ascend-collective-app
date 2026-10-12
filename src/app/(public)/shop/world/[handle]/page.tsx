import { redirect } from 'next/navigation';
export default async function OldProduct({ params }: { params: Promise<{ handle: string }> }) {
  redirect(`/shop/${encodeURIComponent((await params).handle)}`);
}
