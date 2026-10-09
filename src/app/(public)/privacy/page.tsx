import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { approvedPolicies } from '@/domains/release/policies';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Privacy — Public Aethelios' };
export default function Privacy() {
  const policy = approvedPolicies(process.env);
  if (!policy) notFound();
  return (
    <main id="world-main">
      <header className="world-page-intro">
        <span className="world-kicker">Public Aethelios / Privacy</span>
        <h1>
          Your information.
          <br />
          <em>Your choices.</em>
        </h1>
        <p>
          Version {policy.version}. Public Aethelios is operated by {policy.operator}.
        </p>
      </header>
      <section className="world-section">
        <h2>Information you choose to keep</h2>
        <p>
          We process account details, conversations, uploaded files, confirmed memories, and records
          you save so you can use and return to your work. Saved documents and memories are separate
          from conversation history.
        </p>
        <h2>Using intelligence</h2>
        <p>
          Requests and the context you select are sent to OpenAI to generate responses or assets.
          Provider requests use store:false. This setting does not promise zero provider retention.
          Public research may send a search query and return external sources. Review sensitive
          material before sharing it; do not submit information you have no authority to use.
        </p>
        <h2>Storage and service providers</h2>
        <p>
          Supabase supports authentication, application records, and private asset storage. Vercel
          hosts the application and may maintain request logs. Billing and product purchases use
          separate payment or merchant services when enabled; their privacy notices also apply. We
          do not claim that your records are used to train a private model.
        </p>
        <h2>Control and account requests</h2>
        <p>
          You can edit your profile, remove confirmed memories, and delete conversations through
          their controls. Deleting one record does not remove separately saved work. Whole-account
          export and deletion require assisted support and verified account ownership. Backup,
          security, and legally required records may require separate retention handling; ask
          support about the applicable handling before sending sensitive data.
        </p>
        <h2>Device storage and measurements</h2>
        <p>
          Authentication uses session cookies. Drafts and preferences may remain on your device. The
          offline fallback does not deliberately cache authenticated responses. When enabled,
          performance measurements exclude account identifiers, conversation text, query strings,
          and full URLs, and respect Do Not Track and Global Privacy Control. Hosting logs are
          separate.
        </p>
        <h2>Questions and requests</h2>
        <p>
          Contact <a href={`mailto:${policy.email}`}>{policy.email}</a> for privacy questions or an
          owner-verified account-data request. Do not include passwords or payment credentials.
        </p>
        <Link className="world-text-link" href="/terms">
          Terms of use →
        </Link>
      </section>
    </main>
  );
}
