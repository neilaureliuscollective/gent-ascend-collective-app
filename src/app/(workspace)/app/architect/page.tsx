import Link from 'next/link';
import { ArchitectWorkshop } from '@/components/architect-workshop';
import '@/app/ecosystem.css';
import './workshop.css';
export const metadata = {
  title: 'Architect — website workshop',
  description:
    'Create, revise, preview, check and export a static website. AI execution remains under development.',
};
export default function Architect() {
  return (
    <div className="ecosystem-page">
      <header className="ecosystem-heading">
        <p className="eyebrow">AETHELIOS ARCHITECT / WORKING PREVIEW</p>
        <h1>From idea to source.</h1>
        <p className="lead">
          A real static website workflow. Build the first version, inspect the code and take it with
          you.
        </p>
      </header>
      <ArchitectWorkshop />
      <section className="ecosystem-note">
        <h2>The next engineering milestone</h2>
        <p>
          Metered AI development, authenticated cloud projects, GitHub changes, executable previews
          and approved deployment handoffs are under development. Architect enrollment remains gated
          until those workflows are validated. This free workshop does not unlock an AI agent.
        </p>
        <Link href="/app/entities#prometheus">Explore the technical Entity →</Link>
        <p>
          You can export your project deliverables for independent use. That does not grant rights
          to rebrand or resell the Aethelios platform. Final commercial ownership terms require
          review before enrollment.
        </p>
      </section>
    </div>
  );
}
