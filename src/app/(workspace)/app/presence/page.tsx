import { PresenceConcierge } from '@/components/presence/presence-concierge';
import { readPresence } from '@/domains/presence/service';

export const metadata = {
  title: 'Presence | Aethelios',
  description: 'Appearance, confidence and preparation. Your private Presence concierge.',
};
export default async function Presence() {
  return <PresenceConcierge data={await readPresence()} />;
}
