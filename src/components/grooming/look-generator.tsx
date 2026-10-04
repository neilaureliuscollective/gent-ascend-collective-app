'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { styles } from '@/domains/grooming/look-styles';

export function LookGenerator({ photos }: { photos: { id: string; captured_on: string }[] }) {
  const router = useRouter();
  const [photoId, setPhotoId] = useState(photos[0]?.id ?? '');
  const [styleId, setStyleId] = useState<keyof typeof styles>('tapered-sides');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const selected = styles[styleId];

  async function generate() {
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/grooming/look', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoId, styleId, consent }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Concept generation unavailable.');
      router.refresh();
      router.push('/app/grooming/look?result=created#history');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Concept unavailable.');
    } finally {
      setBusy(false);
    }
  }

  if (!photos.length)
    return (
      <div className="groom-look-empty">
        <span className="eyebrow">MY LOOK / NEEDS A REFERENCE</span>
        <h3>Start with one front photograph.</h3>
        <p>Save a front progress photo or complete Ascend Scan first. Then this becomes a visual direction tool instead of a style menu.</p>
      </div>
    );

  return (
    <div className="groom-look-studio">
      <div className="groom-look-head">
        <div>
          <span className="eyebrow">MY LOOK / VISUAL DIRECTION</span>
          <h3>Change one thing at a time.</h3>
          <p>Choose the direction first. Aethelios uses your selected reference only after you approve generation.</p>
        </div>
        <label>
          Reference
          <select value={photoId} onChange={(e) => setPhotoId(e.target.value)}>
            {photos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.captured_on} · front
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="groom-style-rail" role="group" aria-label="Style direction">
        {Object.entries(styles).map(([key, value]) => (
          <button
            type="button"
            key={key}
            aria-pressed={styleId === key}
            onClick={() => setStyleId(key as keyof typeof styles)}
          >
            <span>{value.category}</span>
            <strong>{value.label}</strong>
          </button>
        ))}
      </div>

      <div className="groom-look-decision">
        <span className="eyebrow">SELECTED DIRECTION</span>
        <h4>{selected.label}</h4>
        <p>{selected.reason}</p>
      </div>

      <label className="groom-inline-check groom-look-consent">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
        />
        <span>
          Create one private AI concept from this selected photo and direction. Concepts can change facial details or show an unrealistic result.
        </span>
      </label>

      <button
        type="button"
        className="button groom-look-generate"
        disabled={!consent || !photoId || busy}
        onClick={generate}
      >
        {busy ? 'Building the concept…' : 'Generate this direction →'}
      </button>
      <small>Four attempts per rolling day. Use the result as a conversation reference, not a predicted service outcome.</small>
      {error && <p className="groom-capture-error" role="alert">{error}</p>}
    </div>
  );
}
