import { CapabilityMenu } from './capability-menu';
import { currentAccess } from '@/domains/access/current';
import type { Capability } from '@/domains/access/policy';
const capabilities: { title: string; href: string; capability?: Capability }[] = [
  { title: 'Create in Studio', href: '/app/studio', capability: 'aurelius.context' },
  { title: 'Presence', href: '/app/presence', capability: 'profile.read' },
  { title: 'Performance', href: '/app/performance', capability: 'performance.read' },
  { title: 'Daily planning', href: '/app/daily', capability: 'daily.read' },
  { title: 'Goals', href: '/app/goals', capability: 'goals.read' },
  { title: 'Context setup', href: '/app/ascend-profile', capability: 'profile.read' },
  { title: 'Products · Legacy Reserve', href: '/app/collection' },
];
export async function Capabilities() {
  const access = await currentAccess().catch(() => null);
  return <CapabilityMenu items={capabilities.map(item => ({ title: item.title, href: item.href, status: item.capability ? access === null ? 'Access unavailable' : access.has(item.capability) ? 'Available' : 'Check account access' : 'Optional commerce' }))} />;
}
