import { Suspense } from 'react';
import { EcosystemExperience } from '@/components/ecosystem/ecosystem-experience';
import { ecosystemJourneyGate } from '@/domains/ecosystem/gate';
import './ecosystem.css';

export const metadata = { title: 'Aethelios Ecosystem' };

export default async function EcosystemPage() {
  const gate = await ecosystemJourneyGate();
  return (
    <Suspense fallback={<p className="eco-example-label">Loading the Ecosystem preview…</p>}>
      <EcosystemExperience gate={gate} surface="member" />
    </Suspense>
  );
}
