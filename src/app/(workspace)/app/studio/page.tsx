import Link from 'next/link';
import type { Metadata } from 'next';
import { StudioWorkspace } from '@/components/aurelius/studio-workspace';
import { AetheliosSpaceNavigation } from '@/components/aurelius/space-navigation';

export const metadata: Metadata = {
  title: 'Aethelios Studio',
  description: 'Develop creative projects, references and images with Aethelios.',
};

export default async function StudioPage({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const { project } = await searchParams;
  const initialProject = project && /^[0-9a-f-]{36}$/i.test(project) ? project : null;
  return (
    <div className="studio-page">
      <div className="studio-world-heading">
        <div>
          <p className="eyebrow">AETHELIOS / CREATIVE INTELLIGENCE</p>
          <h1>Studio<span className="brand-star">✦</span></h1>
          <p>From an idea to a world you can see.</p>
        </div>
        <Link className="text-link" href="/app/aethelios">Aethelios Chat ↗</Link>
      </div>
      <AetheliosSpaceNavigation placement="studio" />
      <StudioWorkspace key={initialProject} initialProject={initialProject} />
    </div>
  );
}
