import { AureliusWorkspace } from '@/components/aurelius/workspace';
export default async function AureliusPage({
  searchParams,
}: {
  searchParams: Promise<{ starter?: string; conversation?: string }>;
}) {
  const params = await searchParams;
  const starters: Record<string, string> = {
    plan: 'Help me choose what matters most today and turn it into a manageable plan.',
    reflect:
      'Help me reflect on today: what mattered, what I learned, and what to carry into tomorrow.',
    perspective: 'Help me think clearly about a decision I am facing.',
  };
  const initialDraft =
    typeof params.starter === 'string' && Object.hasOwn(starters, params.starter)
      ? starters[params.starter]
      : '';
  const initialConversation =
    typeof params.conversation === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      params.conversation,
    )
      ? params.conversation
      : null;
  return (
    <>
      <div className="page-heading compact-heading aurelius-page-heading">
        <div>
          <p className="eyebrow">Your personal intelligence</p>
          <h1>Aurelius.</h1>
        </div>
        <p className="muted">
          A considered perspective.
          <br />A deliberate next step.
        </p>
      </div>
      <section className="aurelius-surface">
        <AureliusWorkspace
          key={initialConversation ?? (initialDraft || 'new')}
          initialDraft={initialDraft}
          initialConversation={initialConversation}
        />
      </section>
    </>
  );
}
