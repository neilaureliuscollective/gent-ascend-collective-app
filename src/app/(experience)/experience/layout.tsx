import type { Metadata } from 'next';
import { WorldShell } from '@/components/world/world-shell';
import './world.css';
import './world-atlas.css';
export const metadata: Metadata = {
  title: 'Your world | Gent Ascend Collective',
  robots: { index: false, follow: false },
};
export default function ExperienceLayout({ children }: { children: React.ReactNode }) {
  return <WorldShell>{children}</WorldShell>;
}
