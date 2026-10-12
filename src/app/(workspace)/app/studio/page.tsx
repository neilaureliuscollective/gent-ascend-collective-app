import { AmbientHorizon } from '@/components/visual/ambient-horizon';
import Link from 'next/link';
import { z } from 'zod';
import type { Metadata } from 'next';
import { StudioWorkspace } from '@/components/aurelius/studio-workspace';

export const metadata: Metadata = {
  title: 'Aethelios Studio',
  description: 'Develop creative projects, references and images with Aethelios.',
};

export default async function StudioPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string; version?: string }>;
}) {
  const params = await searchParams;
  const initialProject = z.uuid().safeParse(params.project);
  const initialVersion = z.uuid().safeParse(params.version);
  return (
    <div className="studio-page">
      <div className="studio-world-heading io-hero">
        <AmbientHorizon />
        <div>
          <p className="eyebrow">AETHELIOS / CREATIVE INTELLIGENCE</p>
          <h1>
            Studio<span className="brand-star">✦</span>
          </h1>
          <p>From an idea to a world you can see.</p>
        </div>
        <Link className="text-link" href="/app/aethelios">
          Aethelios Chat ↗
        </Link>
      </div>
      <StudioWorkspace
        initialProject={initialProject.success ? initialProject.data : undefined}
        initialVersion={initialVersion.success ? initialVersion.data : undefined}
      />
    </div>
  );
}
