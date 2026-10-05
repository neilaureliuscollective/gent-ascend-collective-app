'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useConversationDraft } from '@/components/aurelius/draft-handoff';
import type { DailyData } from '@/domains/daily/model';

export function HomeConversation({ data }: { data: DailyData }) {
  const [text, setText] = useState('');
  const root = useRef<HTMLElement>(null);
  // Keep the action above the persistent navigation when a phone keyboard reduces the view.
  // One layout read per focus/resize; no polling and no interference with accessibility zoom.
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
  const router = useRouter();
  const handoff = useConversationDraft();
  const personal = data.mode === 'personal' && !!data.ownerId;
  return (
    <section ref={root} className="home-conversation" aria-label="Talk with Aethelios">
      <div className="home-conversation-heading">
        <strong>Aethelios</strong>
        <span>Your personal intelligence</span>
      </div>
      {personal ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!text.trim() || !handoff || !data.ownerId) return;
            handoff.stage({ text: text.trim(), ownerId: data.ownerId });
            router.push('/app/aethelios');
          }}
        >
          <label htmlFor="home-thought">What are we working on?</label>
          <textarea
            id="home-thought"
            value={text}
            onChange={(event) => setText(event.target.value)}
            rows={2}
            maxLength={6000}
            placeholder="Bring a thought. Find your next move."
            aria-describedby="home-thought-note"
          />
          <div className="home-conversation-actions">
            <small id="home-thought-note">Continue in Talk, then send when you’re ready.</small>
            <button type="submit" className="command-action" disabled={!text.trim()}>
              Continue in Talk <span aria-hidden="true">↗</span>
            </button>
          </div>
        </form>
      ) : (
        <div className="home-conversation-preview">
          <p>What are we working on?</p>
          <Link
            prefetch={false}
            className="command-action"
            href={data.mode === 'sample' ? '/app/aethelios' : '/enter'}
          >
            {data.mode === 'sample' ? 'Explore Talk' : 'Sign in to talk'} ↗
          </Link>
        </div>
      )}
      {personal && data.conversation && (
        <Link
          prefetch={false}
          className="home-resume"
          href={`/app/aethelios?conversation=${data.conversation.id}`}
        >
          Resume: {data.conversation.title} <span aria-hidden="true">↗</span>
        </Link>
      )}
    </section>
  );
}
