import { redirect } from 'next/navigation';

export const metadata = { title: 'Aethelios Lifestyle' };

/** Retired brand URL. Keep as a safe alias to the current member collection. */
export default function LegacyReserveAlias() {
  redirect('/app/collection');
}
