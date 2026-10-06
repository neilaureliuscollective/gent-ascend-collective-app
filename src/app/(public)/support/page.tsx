import Link from 'next/link';
import type { Metadata } from 'next';
import { supportEmail } from '@/domains/release/model';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Member support' };
export default function Support() {
  const email = supportEmail(process.env);
  return (
    <main id="world-main">
      <header className="world-page-intro">
        <span className="world-kicker">Aethelios / Support</span>
        <h1>
          Keep your
          <br />
          <em>momentum.</em>
        </h1>
        <p>Account help, billing clarity and control of your information.</p>
      </header>
      <section className="world-section">
        <div className="world-feature-list">
          <article>
            <span className="world-kicker">Your account</span>
            <h2>Return to your day.</h2>
            <p>
              Use the same sign-in method you used to create your account. In Facebook’s browser,
              open Aethelios in your normal browser before signing in.
            </p>
            <Link className="world-text-link" href="/join">
              Account entrance →
            </Link>
            <p>
              <Link className="world-text-link" href="/app/install">
                Install and return →
              </Link>
            </p>
          </article>
          <article>
            <span className="world-kicker">Membership</span>
            <h2>Know where you stand.</h2>
            <p>
              Your membership screen shows confirmed billing and offers secure management when
              connected. Returning from checkout alone does not confirm payment.
            </p>
            <Link className="world-text-link" href="/app/membership">
              Your membership →
            </Link>
            <p>Product orders are handled separately through Shopify.</p>
            <Link className="world-text-link" href="/app/collection/orders">
              Your product orders →
            </Link>
          </article>
          <article>
            <span className="world-kicker">Your information</span>
            <h2>Keep control.</h2>
            <p>
              Edit your profile in You. In Aethelios, choose Memory to edit or remove confirmed
              memories; delete a conversation from its conversation controls. Deleting a chat does
              not remove separately saved memories or daily actions.
            </p>
            <Link className="world-text-link" href="/app/you">
              Your profile →
            </Link>
            <p>
              <Link className="world-text-link" href="/app/aethelios">
                Conversations and memory →
              </Link>
            </p>
            <p>
              Relevant private context is shared with the AI service when you choose to send it.
              General web research may consult public sources; saved replies retain returned source
              links.
            </p>
          </article>
        </div>
        <div className="editorial-split">
          <h2>
            A clear
            <br />
            <em>next step.</em>
          </h2>
          <div>
            {email ? (
              <>
                <p>
                  For account help, a billing question or an account-data export/deletion request,
                  contact member support. Whole-account export and deletion are not self-service
                  controls in this release. Contact support to request help with your data.
                </p>
                <a className="world-text-link" href={`mailto:${email}`}>
                  Contact support →
                </a>
                <p>
                  Include what you were trying to do, the screen and approximate time. Do not send
                  passwords, payment details or private health information. Support will need to
                  verify account ownership before acting on account-data requests.
                </p>
              </>
            ) : (
              <>
                <p>
                  A direct support contact has not been configured in this environment.
                  Whole-account export/deletion requests are not available here; the support process
                  must be confirmed before public launch.
                </p>
                <Link className="world-text-link" href="/app/you">
                  Return to your account →
                </Link>
              </>
            )}
            <p>
              If enabled, performance reporting sends only a measurement name/value, broad screen
              category and viewport category. It excludes account identifiers, conversation text,
              query strings and full URLs, and respects Do Not Track and Global Privacy Control.
              Hosting infrastructure may separately maintain request logs.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
