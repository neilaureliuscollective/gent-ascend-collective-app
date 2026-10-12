import { AmbientHorizon } from '@/components/visual/ambient-horizon';
import Link from 'next/link';
import type { Metadata } from 'next';
import { StudioWorkspace } from '@/components/aurelius/studio-workspace';
import './studio-production.css';

export const metadata: Metadata = {
  title: 'Aethelios Studio',
  description:
    'Aethelios creative production: images, campaigns, voice, footage and reviewed delivery.',
};

export default function StudioPage() {
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
          Aethelios Chat ↗
        </Link>
      </div>
      <div className="studio-workflow-line" aria-label="Studio creative workflow">
        <span>01 / DIRECT</span>
        <span>02 / CREATE</span>
        <span>03 / REFINE</span>
        <span>04 / DELIVER</span>
      </div>
      <StudioWorkspace />
    </div>
  );
}
