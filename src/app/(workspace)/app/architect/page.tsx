import { ArchitectOrigin } from '@/components/architect-origin/workspace';
import { appsReady } from '@/domains/architect-apps/readiness';
import { constructReady } from '@/domains/architect-construct/readiness';
import { originReady } from '@/domains/architect-origin/service';
import './origin.css';
export const metadata = { title: 'Aethelios Architect — Origin' };
export default function ArchitectPage() {
  return (
    <ArchitectOrigin
      enabled={originReady()}
      aiEnabled={originReady() && process.env.ARCHITECT_ORIGIN_AI_ENABLED === 'true'}
      constructEnabled={constructReady()}
      appsEnabled={appsReady()}
    />
  );
}
