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
      <section className="health-literacy" aria-label="Human Systems Atlas">
        <p className="eyebrow">HUMAN SYSTEMS ATLAS / EDUCATIONAL INTRODUCTION</p>
        <h2>Understand the systems. Ask better questions.</h2>
        <p>
          These short introductions describe general biology, not your personal health. No records
          or inferred scores are used.
        </p>
        {[
          [
            'Heart & circulation',
            'The cardiovascular system moves blood, oxygen and nutrients around the body.',
            'What does this measurement tell us, and under what conditions should it be repeated?',
            'https://medlineplus.gov/heartdiseases.html',
          ],
          [
            'Metabolism & energy',
            'Metabolism describes chemical processes involved in using and storing energy. A single laboratory value does not describe the whole system.',
            'Which factors could affect this result, and what context would help interpret it?',
            'https://medlineplus.gov/metabolicdisorders.html',
          ],
          [
            'Sleep & recovery',
            'Sleep supports many functions, including attention and recovery. Sleep needs and persistent sleep problems deserve individual professional assessment.',
            'Could medicines, habits or an underlying condition be affecting my sleep?',
            'https://medlineplus.gov/healthysleep.html',
          ],
          [
            'Movement & musculoskeletal health',
            'Bones, muscles and joints work together to support movement. Pain and function need assessment in context.',
            'What activity is appropriate for me, and when should I seek further assessment?',
            'https://medlineplus.gov/exerciseandphysicalfitness.html',
          ],
        ].map(([title, explanation, question, source]) => (
          <details key={title}>
            <summary>{title}</summary>
            <p>{explanation}</p>
            <p>
              <strong>Appointment question:</strong> {question}
            </p>
            <a href={source} target="_blank" rel="noreferrer">
              Explore MedlinePlus education (US National Library of Medicine) →
            </a>
          </details>
        ))}
        <p>
          Editorial introduction, updated October 10, 2026. The linked resources provide further
          education; these summaries have not received clinical review.
        </p>
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
            [
              'Human Systems Atlas',
              'Educational introduction available above; deeper content and clinical review remain future work.',
            ],
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
