import type { Metadata } from 'next';
import { WorldShell } from '@/components/world/world-shell';
import './world.css';
import './world-atlas.css';
import './grooming-world.css';
export const metadata: Metadata = {
  title: 'Capabilities | Aethelios',
  robots: { index: false, follow: false },
};
export default function ExperienceLayout({ children }: { children: React.ReactNode }) {
  return <WorldShell>{children}</WorldShell>;
}
