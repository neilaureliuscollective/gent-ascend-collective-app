'use client';
import { useState, type CSSProperties } from 'react';
import { bookingUrl, type Brief } from '@/domains/technology/schema';
import { palettes } from '@/domains/technology/design';
export function SitePreview({ brief }: { brief: Brief }) {
  const [page, setPage] = useState('Home');
  const pages = brief.pages ?? [];
  const names = ['Home', 'Services', 'About', 'Contact', ...pages.map((p) => p.slug)];
  const active = names.includes(page) ? page : 'Home';
  const custom = pages.find((p) => p.slug === active);
  const safe = bookingUrl.safeParse(brief.bookingUrl);
  const d = brief.design,
    colors = d ? palettes[d.palette] : null;
  const style = colors
    ? ({
        '--site-bg': colors.background,
        '--site-fg': colors.foreground,
        '--site-accent': colors.accent,
        '--site-muted': colors.muted,
        '--site-border': colors.border,
        '--site-heading': d?.typography === 'serif' ? 'Georgia,serif' : 'system-ui,sans-serif',
        '--site-space': d?.spacing === 'spacious' ? '48px' : '24px',
      } as CSSProperties)
    : undefined;
  return (
    <section
      className="technology-preview"
      data-hero={d?.hero}
      data-designed={Boolean(d)}
      style={style}
      aria-label="Website preview"
    >
      <header>
        <span>{brief.name || 'Your business'}</span>
        <nav aria-label="Preview pages">
          {names.map((p) => (
            <button
              type="button"
              key={p}
              aria-current={active === p ? 'page' : undefined}
              onClick={() => setPage(p)}
            >
              {pages.find((v) => v.slug === p)?.title ?? p}
            </button>
          ))}
        </nav>
      </header>
      <main data-page={active}>
        {active === 'Home' && (
          <>
            <span className="eyebrow">
              {brief.industry === 'grooming-beauty'
                ? 'Care. Craft. Confidence.'
                : 'Expertise with purpose.'}
            </span>
            <h2>{brief.headline || 'Your next chapter starts here.'}</h2>
            <p>{brief.about || 'Describe your business to shape this preview.'}</p>
            <button type="button" onClick={() => setPage('Services')}>
              {d?.cta ?? 'Explore services'}
            </button>
          </>
        )}
        {active === 'Services' && (
          <>
            <h2>Services</h2>
            {brief.services.map((s, i) => (
              <article key={i}>
                <h3>
                  {s.name || 'Your service'} <span>{s.price}</span>
                </h3>
                <p>{s.description}</p>
              </article>
            ))}
          </>
        )}
        {active === 'About' && (
          <>
            <h2>About {brief.name}</h2>
            <p>{brief.about}</p>
          </>
        )}
        {active === 'Contact' && (
          <>
            <h2>Visit & connect</h2>
            <p>{brief.contact}</p>
            <p>{brief.hours}</p>
            {safe.success && safe.data && (
              <a href={safe.data} target="_blank" rel="noopener noreferrer">
                Open your booking provider ↗
              </a>
            )}
            <form onSubmit={(e) => e.preventDefault()}>
              <label>
                Your name
                <input disabled placeholder="Preview only" />
              </label>
              <label>
                Message
                <textarea
                  disabled
                  placeholder="Contact forms become operational in a later phase."
                />
              </label>
              <button disabled>Preview only · messages are not sent</button>
            </form>
          </>
        )}
        {custom && (
          <>
            <h2>{custom.title}</h2>
            <div className={`technology-page-sections ${custom.layout}`}>
              {custom.sections.map((s, i) => (
                <article key={i}>
                  <h3>{s.heading}</h3>
                  <p>{s.body}</p>
                </article>
              ))}
            </div>
          </>
        )}
      </main>
      <footer>Private preview · no live website, payments or appointment system</footer>
    </section>
  );
}
