import { ArchitectOrigin } from '@/components/architect-origin/workspace';
import { originReady } from '@/domains/architect-origin/service';
import './origin.css';
export const metadata = { title: 'Aethelios Architect — Origin' };
export default function ArchitectPage() {
  return (
    <ArchitectOrigin
      enabled={originReady()}
      aiEnabled={originReady() && process.env.ARCHITECT_ORIGIN_AI_ENABLED === 'true'}
    />
  );
}
