import Link from 'next/link';
import type { WorkspaceData } from '@/domains/intelligence/types';

export function ContextPanel({
  data,
  preview,
  included,
}: {
  data: WorkspaceData;
  preview: boolean;
  included: boolean;
}) {
  return (
    <section className="context-space">
      <p className="eyebrow">The person behind the conversation</p>
      <h3>A fuller picture. On your terms.</h3>
      <p>
        Your profile, active goal and confirmed memories can inform each new message. You choose
        what to share.
      </p>
      <div className="context-scope">
        <span className="context-indicator" data-active={!preview && included} aria-hidden="true" />
        {preview
          ? 'Preview · no personal data loaded'
          : included
            ? 'Personal context is on for your next message'
            : 'Personal context is off for your next message'}
      </div>
      <div className="context-cards">
        <article>
          <span className="eyebrow">01 / Your foundation</span>
          <h4>{preview ? 'Your perspective starts here.' : data.context.profile.name}</h4>
          <p>
            {data.context.profile.priority ||
              'Add a current priority to give your conversations direction.'}
          </p>
          <Link className="text-link" href="/app/you">
            {preview ? 'Connect your account' : 'Refine your profile'} →
          </Link>
        </article>
        <article>
          <span className="eyebrow">02 / Your direction</span>
          <h4>{data.context.goal?.title || 'Something worth moving toward.'}</h4>
          <p>
            {data.context.goal?.reason || 'Your active goal gives Aethelios a point of reference.'}
          </p>
          {data.context.goal?.nextStep && (
            <div className="context-next">
              <span>Next step</span>
              <p>{data.context.goal.nextStep}</p>
            </div>
          )}
          <Link className="text-link" href="/app/goals">
            Your goals →
          </Link>
        </article>
        <article>
          <span className="eyebrow">03 / What carries forward</span>
          <h4>
            {data.memories.length
              ? `${data.memories.length} confirmed ${data.memories.length === 1 ? 'memory' : 'memories'}`
              : 'Known because you chose it.'}
          </h4>
          <p>
            Preferences and personal facts you explicitly confirm in Memory. AI suggestions never
            become facts automatically.
          </p>
        </article>
      </div>
      <details className="context-boundaries">
        <summary>Understand the boundaries</summary>
        <p>
          He receives up to 20 recent completed exchanges within a bounded context window. Older
          conversations are saved, but are not automatically recalled.
        </p>
        <p>
          Turning personal context off does not remove details already written in this conversation.
          Start a new conversation for a fresh context.
        </p>
        <p>
          Live web research, voice, file uploads and external actions are not connected in this
          release.
        </p>
        {!preview && (
          <p>
            Configured model: {data.model}. Configuration alone does not verify a working
            connection. A model response is a suggestion, not a verified fact.
          </p>
        )}
      </details>
    </section>
  );
}
