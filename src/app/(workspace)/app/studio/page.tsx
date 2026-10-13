import { Icon } from '@/components/visual/icon';
import { AmbientHorizon } from '@/components/visual/ambient-horizon';
import Link from 'next/link';
import { z } from 'zod';
import type { Metadata } from 'next';
import { StudioWorkspace } from '@/components/aurelius/studio-workspace';
import './studio-production.css';

export const metadata: Metadata = {
  title: 'Aethelios Studio',
  description:
    'Aethelios creative production: images, campaigns, voice, footage and reviewed delivery.',
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
          <p>Your vision, developed with intention.</p>
        </div>
        <Link className="text-link" href="/app/aethelios">
          Aethelios Chat <Icon name="arrow-up-right" className="action-icon" />
        </Link>
      </div>
      <div className="studio-workflow-line" aria-label="Studio creative workflow">
        <span>01 / DIRECT</span>
        <span>02 / CREATE</span>
        <span>03 / REFINE</span>
        <span>04 / DELIVER</span>
      </div>
      <StudioWorkspace
        initialProject={initialProject.success ? initialProject.data : undefined}
        initialVersion={initialVersion.success ? initialVersion.data : undefined}
      />
    </div>
  );
}
