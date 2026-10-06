import { presenceStarter } from '@/domains/presence/model';
import { readCommand } from '@/domains/daily-command/service';
import { readWorldPriority } from '@/domains/daily/world-priority';
import { commandDraft } from '@/domains/daily-command/model';
import { ConversationViewport } from '@/components/aurelius/conversation-viewport';
import Link from 'next/link';
import { AppearanceControls } from '@/components/visual/appearance';
import type { Metadata } from 'next';
import { aethelios } from '@/platform/intelligence-identity';
export const metadata: Metadata = {
  title: 'Aethelios',
  description: aethelios.description,
};
import { AureliusWorkspace } from '@/components/aurelius/workspace';
import { companyJob } from '@/domains/company-work/starters';
export default async function AetheliosPage({
  searchParams,
}: {
  searchParams: Promise<{ starter?: string; conversation?: string; link?: string }>;
}) {
  const params = await searchParams;
  const linked = false;
  const starters: Record<string, string> = {
    'weekly-review':
      'Review my last seven days using my saved personal context if I enable it. Distinguish missing records from zero activity. Help me identify what worked, what got in the way, and one realistic adjustment for next week. Ask only what is needed. Propose changes for my review; do not claim to save them.',
    plan: 'Help me choose what matters most today and turn it into a manageable plan.',
    reflect:
      'Help me reflect on today: what mattered, what I learned, and what to carry into tomorrow.',
    presence: presenceStarter,
    'presence-style':
      'Help me choose wardrobe and appearance preparation for an important occasion. Ask about the setting, dress expectations and clothes I already own. Use saved preferences only if I enable personal context. Do not invent an inventory or recommend purchases by default.',
    'grooming-event': presenceStarter,
    grooming: presenceStarter,
    perspective: 'Help me think clearly about a decision I am facing.',
  };
  const command = params.starter === 'command' ? await readCommand().catch(() => null) : null;
  const priority =
    params.starter === 'first-session' ? await readWorldPriority().catch(() => null) : null;
  const firstDraft =
    priority?.mode === 'personal' && priority.intention
      ? `My priority today is: ${priority.intention}\n${priority.nextAction ? `My next saved move is: ${priority.nextAction}\n` : ''}Help me make this practical. Ask only what you need, and offer one useful next step. Do not change my records unless I confirm.`
      : '';
  const initialDraft =
    companyJob(params.starter)?.draft ||
    firstDraft ||
    (command?.snapshot
      ? commandDraft(command.snapshot)
      : typeof params.starter === 'string' && Object.hasOwn(starters, params.starter)
        ? starters[params.starter]
        : '');
  const initialConversation =
    typeof params.conversation === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      params.conversation,
    )
      ? params.conversation
      : null;
  return (
    <ConversationViewport>
      <header className="aethelios-room-heading">
        <Link href="/app/work" aria-label="Company work">
          ←
        </Link>
        <div>
          <span className="eyebrow">COMPANY INTELLIGENCE</span>
          <h1>Aethelios</h1>
        </div>
        <AppearanceControls />
        <nav aria-label="Aethelios destinations">
          <Link href="/app/studio">Studio ↗</Link>
          <Link href="/app/aethelios/meet">Meet ↗</Link>
        </nav>
      </header>
      <section className="aurelius-surface">
        <AureliusWorkspace
          founderLinked={linked}
          key={initialConversation ?? (initialDraft || 'new')}
          initialDraft={initialDraft}
          initialConversation={initialConversation}
        />
      </section>
    </ConversationViewport>
  );
}
