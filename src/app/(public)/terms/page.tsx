import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { approvedPolicies } from '@/domains/release/policies';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Terms — Public Aethelios' };
export default function Terms() {
  const policy = approvedPolicies(process.env);
  if (!policy) notFound();
  return (
    <main id="world-main">
      <header className="world-page-intro">
        <span className="world-kicker">Public Aethelios / Terms</span>
        <h1>
          Intelligence,
          <br />
          <em>with clear boundaries.</em>
        </h1>
        <p>
          Version {policy.version}. Public Aethelios is operated by {policy.operator}.
        </p>
      </header>
      <section className="world-section">
        <h2>Your account and access</h2>
        <p>
          Keep your account credentials secure and use only information you have authority to
          access. Account creation does not purchase a subscription or grant intelligence access.
          Beta invitations, membership, and feature availability are separate. Access and usage
          allowances are shown by the application; do not bypass limits or another person’s
          ownership boundaries.
        </p>
        <h2>Review before relying on an answer</h2>
        <p>
          AI responses and generated assets can be incomplete, inaccurate, or unsuitable. Verify
          important facts and review outputs before publishing or acting. Aethelios does not replace
          licensed medical, legal, financial, or other professional advice. A draft or suggested
          action is not proof that an external action occurred.
        </p>
        <h2>Your work and permissions</h2>
        <p>
          You remain responsible for the material you submit and how you use generated outputs. Do
          not upload unlawful material, credentials, or content that infringes another person’s
          rights. The application processes submitted material to provide the requested service.
          Saved memory, document promotion, and contextual sharing require the relevant user
          confirmation; generated suggestions cannot approve themselves.
        </p>
        <h2>Payments and service changes</h2>
        <p>
          Any enabled purchase must show its price, applicable terms, and confirmation before
          payment. A checkout return is not proof of active membership. Merchant purchases are
          separate from software access. Beta features may change or be unavailable; we do not
          promise autonomous execution, uninterrupted availability, or outcomes that have not been
          delivered.
        </p>
        <h2>Help and account-data requests</h2>
        <p>
          Contact <a href={`mailto:${policy.email}`}>{policy.email}</a> for account or billing help.
          Whole-account export and deletion are assisted requests requiring verified ownership. Do
          not send passwords or payment credentials.
        </p>
        <Link className="world-text-link" href="/privacy">
          Privacy information →
        </Link>
      </section>
    </main>
  );
}
