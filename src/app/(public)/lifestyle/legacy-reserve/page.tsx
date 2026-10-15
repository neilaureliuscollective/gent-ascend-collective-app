import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Aethelios Lifestyle' };

/** Retired brand URL. Keep as a safe alias to the current public collection. */
export default function LegacyReserveAlias() {
  redirect('/shop');
}
