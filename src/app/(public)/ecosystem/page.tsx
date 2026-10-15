import { Suspense } from 'react';
import type { Metadata } from 'next';
import { EcosystemExperience } from '@/components/ecosystem/ecosystem-experience';
import { ecosystemJourneyGate } from '@/domains/ecosystem/gate';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Aethelios Ecosystem',
  description:
    'One world for human vision, creation and progress. Explore an illustrative project and the planned membership catalog.',
};

export default async function PublicEcosystemPage() {
  const gate = await ecosystemJourneyGate();
  return (
    <main id="world-main" className="eco-public-page">
      <Suspense fallback={<p className="eco-example-label">Loading the Ecosystem preview…</p>}>
        <EcosystemExperience gate={gate} surface="public" />
      </Suspense>
    </main>
  );
}
