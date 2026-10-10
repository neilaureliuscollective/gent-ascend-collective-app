import Link from 'next/link';
import { AppointmentPreparation } from '@/components/health/appointment-preparation';
import '@/app/ecosystem.css';
export const metadata = {
  title: 'Aethelios Health — Know More. Live Better.',
  description:
    'An educational foundation for understanding health and preparing for professional conversations.',
};
export default function Health() {
  return (
    <div className="ecosystem-page health-foundation">
      <header className="ecosystem-heading">
        <p className="eyebrow">AETHELIOS HEALTH / EDUCATIONAL FOUNDATION</p>
        <h1>
          Know More.
          <br />
          Live Better.
        </h1>
        <p className="lead">
          Understand the questions before seeking the answers. A thoughtful starting point for
          biological literacy and conversations with qualified professionals.
        </p>
        <p className="health-boundary">
          Educational information only. No diagnosis, treatment recommendations or clinical service.
          For urgent concerns, contact local emergency services.
        </p>
      </header>
      <section className="health-literacy">
        <h2>Understand the context.</h2>
        <div>
          <article>
            <h3>A result is one signal.</h3>
            <p>
              A laboratory reference range is not a diagnosis. Timing, measurement method, symptoms
              and professional interpretation matter. Ask what a result can and cannot tell you.
            </p>
          </article>
          <article>
            <h3>Trends need comparable records.</h3>
            <p>
              Different laboratories, units and collection conditions can make comparison difficult.
              Ask your clinician whether a change is meaningful before drawing conclusions.
            </p>
          </article>
          <article>
            <h3>Preparation supports understanding.</h3>
            <p>
              Bring your questions and current medicine list to your appointment. Ask for a clear
              explanation, appropriate next steps and when to follow up.
            </p>
          </article>
        </div>
      </section>
      <AppointmentPreparation />
      <section className="health-roadmap">
        <p className="eyebrow">The future biological environment</p>
        <h2>
          Built carefully.
          <br />
          Kept separate.
        </h2>
        <dl>
          {[
            [
              'Biological Identity',
              'Planned: a purpose-specific, member-controlled health profile.',
            ],
            [
              'Biomarker Vault & Health Timeline',
              'Planned: private records and longitudinal views after security, consent and retention requirements are established.',
            ],
            ['Human Systems Atlas', 'Planned: a richer educational guide to human biology.'],
            [
              'Biological Intelligence Brief',
              'Planned: authorized, source-labeled understanding without invented trends.',
            ],
            [
              'Wearables & clinician connectivity',
              'Future integrations; no device, medical record or clinician connection is active here.',
            ],
          ].map(([name, copy]) => (
            <div key={name}>
              <dt>{name}</dt>
              <dd>{copy}</dd>
            </div>
          ))}
        </dl>
        <p>
          No health records are uploaded, stored or shared by this page. Membership does not
          authorize clinical care. Existing wellness and Performance records remain in their current
          domains; this page does not copy them.
        </p>
        <Link href="/app/ecosystem">Return to the ecosystem →</Link>
      </section>
    </div>
  );
}
