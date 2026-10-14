'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useConversationDraft } from '@/components/aurelius/draft-handoff';
import {
  commandFocusPayload,
  sourceLabel,
  type CommandHomeData,
  type CommandItem,
} from '@/domains/command-home/model';

export function CommandConversation({
  ownerId,
  selected,
  recent,
  signedOut,
}: {
  ownerId: string;
  selected: CommandItem | null;
  recent: CommandHomeData['recentConversation'];
  signedOut: boolean;
}) {
  const [text, setText] = useState('');
  const [fresh, setFresh] = useState(false);
  const root = useRef<HTMLElement>(null);
  const router = useRouter();
  const handoff = useConversationDraft();

  useEffect(() => {
    let frame = 0;
    const viewport = window.visualViewport;
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (viewport && viewport.scale !== 1) return;
        if (
          !root.current?.contains(document.activeElement) ||
          document.activeElement?.tagName !== 'TEXTAREA'
        )
          return;
        const action = root.current.querySelector<HTMLButtonElement>('button[type="submit"]');
        if (!action) return;
        const nav = document.querySelector<HTMLElement>('nav.navigation');
        const edge = viewport ? viewport.height + viewport.offsetTop : innerHeight;
        const navTop =
          matchMedia('(max-width: 1100px)').matches && nav ? nav.getBoundingClientRect().top : edge;
        const overflow = action.getBoundingClientRect().bottom - Math.min(edge, navTop) + 16;
        if (overflow > 0) window.scrollBy({ top: overflow, behavior: 'instant' });
      });
    };
    viewport?.addEventListener('resize', schedule);
    window.addEventListener('resize', schedule);
    document.addEventListener('focusin', schedule);
    return () => {
      cancelAnimationFrame(frame);
      viewport?.removeEventListener('resize', schedule);
      window.removeEventListener('resize', schedule);
      document.removeEventListener('focusin', schedule);
    };
  }, []);

  if (signedOut) {
    return (
      <section className="command-talk" aria-label="Talk with Aethelios">
        <p>Sign in to continue a thought with Aethelios. Nothing is sent from Command.</p>
        <Link className="command-action" href="/enter">
          Sign in to talk
        </Link>
      </section>
    );
  }

  const context = !fresh && selected ? selected : null;
  return (
    <section ref={root} className="command-talk" aria-label="Talk with Aethelios">
      <header>
        <h2>Continue thinking</h2>
        <p>
          {context
            ? `${sourceLabel(context.source)} · ${context.title} will be named when you continue. Sending still happens in Talk.`
            : 'Start a fresh conversation. No project context will be attached.'}
        </p>
      </header>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!text.trim() || !handoff || !ownerId) return;
          handoff.stage({
            text: text.trim(),
            ownerId,
            recovery: 'memory',
            conversationId: context?.conversationId,
            payload: commandFocusPayload(context ?? null),
          });
          router.push(
            context?.conversationId
              ? `/app/aethelios?conversation=${context.conversationId}`
              : '/app/aethelios',
          );
        }}
      >
        <label htmlFor="command-thought">What are we working on?</label>
        <textarea
          id="command-thought"
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={2}
          maxLength={6000}
          placeholder="Bring a thought. Continue in Talk when you are ready."
          aria-describedby="command-thought-note"
        />
        <div className="command-talk-actions">
          <small id="command-thought-note">
            Unsent text stays here through resize and closing this panel. Continuing does not enqueue
            a build or a paid request.
          </small>
          <button type="submit" className="command-action" disabled={!text.trim()}>
            Continue in Talk
          </button>
        </div>
      </form>
      <div className="command-talk-links">
        <button type="button" className="text-button" onClick={() => setFresh((value) => !value)}>
          {fresh ? 'Use selected work as context' : 'Start a fresh conversation'}
        </button>
        {recent && (
          <Link prefetch={false} href={`/app/aethelios?conversation=${recent.id}`}>
            Resume {recent.title}
          </Link>
        )}
      </div>
    </section>
  );
}
