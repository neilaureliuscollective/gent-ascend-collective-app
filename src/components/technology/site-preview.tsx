'use client';
import { useState } from 'react';
import { bookingUrl, type Brief } from '@/domains/technology/schema';
export function SitePreview({ brief }: { brief: Brief }) {
  const [page, setPage] = useState('Home');
  const safe = bookingUrl.safeParse(brief.bookingUrl);
  return (
    <section className="technology-preview" aria-label="Website preview">
      <header>
        <span>{brief.name || 'Your business'}</span>
        <nav aria-label="Preview pages">
          {['Home', 'Services', 'About', 'Contact'].map((p) => (
            <button
              type="button"
              key={p}
              aria-current={page === p ? 'page' : undefined}
              onClick={() => setPage(p)}
            >
              {p}
            </button>
          ))}
        </nav>
      </header>
      <main>
        {page === 'Home' && (
          <>
            <span className="eyebrow">
              {brief.industry === 'grooming-beauty'
                ? 'Care. Craft. Confidence.'
                : 'Expertise with purpose.'}
            </span>
            <h2>{brief.headline || 'Your next chapter starts here.'}</h2>
            <p>{brief.about || 'Describe your business to shape this preview.'}</p>
            <button type="button" onClick={() => setPage('Services')}>
              Explore services
            </button>
          </>
        )}
        {page === 'Services' && (
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
        {page === 'About' && (
          <>
            <h2>About {brief.name}</h2>
            <p>{brief.about}</p>
          </>
        )}
        {page === 'Contact' && (
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
      </main>
      <footer>Private preview · no live website, payments or appointment system</footer>
    </section>
  );
}
