'use client';

import { useEffect, useRef, useState } from 'react';

export type MachineScoutCandidate = {
  name: string;
  equipment: string;
  movementPattern: string;
};

export type MachineScoutResult = {
  name: string;
  equipment: string;
  movementPattern: string;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  setupCue: string;
  confidence: 'high' | 'medium' | 'low';
  uncertainty: string;
  alternatives?: MachineScoutCandidate[];
};

async function compressImage(file: File) {
  const bitmap = await createImageBitmap(file);
  const max = 1536;
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Image processing is unavailable.');
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return { image: canvas.toDataURL('image/jpeg', 0.82), mediaType: 'image/jpeg' as const };
}

export function MachineScout({
  disabled,
  onAdd,
}: {
  disabled: boolean;
  onAdd: (result: MachineScoutResult) => Promise<void>;
}) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState<MachineScoutResult | null>(null);
  const [preview, setPreview] = useState('');
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  async function inspect(file: File) {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(URL.createObjectURL(file));
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const image = await compressImage(file);
      const response = await fetch('/api/performance/machine-scout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(image),
        signal: AbortSignal.timeout(28000),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Machine Scout could not inspect that.');
      setResult(body as MachineScoutResult);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Try another photo.');
    } finally {
      setBusy(false);
      if (cameraRef.current) cameraRef.current.value = '';
      if (libraryRef.current) libraryRef.current.value = '';
    }
  }

  function chooseCandidate(candidate: MachineScoutCandidate) {
    if (!result) return;
    setResult({ ...result, ...candidate, confidence: 'medium', uncertainty: 'You selected this match.' });
  }

  return (
    <section className="perf-machine-scout perf-machine-scout-v2">
      <div className="perf-machine-scout-heading">
        <div>
          <span className="eyebrow">AETHELIOS / MACHINE SCOUT</span>
          <h3>Point. Identify. Train.</h3>
          <p>Frame the full machine if you can. A second angle is better than a bad guess.</p>
        </div>
      </div>

      {!preview && (
        <div className="perf-scout-launch">
          <button type="button" className="perf-primary" disabled={disabled || busy} onClick={() => cameraRef.current?.click()}>
            Use camera
          </button>
          <button type="button" disabled={disabled || busy} onClick={() => libraryRef.current?.click()}>
            Choose photo
          </button>
        </div>
      )}

      <input ref={cameraRef} className="perf-visually-hidden" type="file" accept="image/*" capture="environment" onChange={(event) => { const file = event.target.files?.[0]; if (file) void inspect(file); }} />
      <input ref={libraryRef} className="perf-visually-hidden" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { const file = event.target.files?.[0]; if (file) void inspect(file); }} />

      {preview && (
        <div className="perf-scout-stage">
          <img src={preview} alt="Machine selected for identification" />
          {busy && (
            <div className="perf-scout-analyzing" aria-live="polite">
              <i />
              <strong>Aethelios is inspecting the machine…</strong>
              <span>Looking at frame, handles, pads, and movement path.</span>
            </div>
          )}
          {!busy && (
            <button type="button" className="perf-scout-retake" onClick={() => cameraRef.current?.click()}>Retake</button>
          )}
        </div>
      )}

      {error && (
        <div className="perf-machine-error" role="alert">
          <strong>Not enough confidence yet.</strong>
          <span>{error}</span>
          <div className="perf-scout-retry">
            <button type="button" onClick={() => cameraRef.current?.click()}>Take another angle</button>
            <button type="button" onClick={() => libraryRef.current?.click()}>Choose another photo</button>
          </div>
        </div>
      )}

      {result && (
        <div className="perf-machine-result">
          <div className="perf-machine-result-topline">
            <span>{result.confidence.toUpperCase()} CONFIDENCE</span>
            <span>{result.equipment}</span>
          </div>
          <h4>{result.name}</h4>
          <p className="perf-machine-pattern">{result.movementPattern}</p>
          <div className="perf-machine-muscles">{result.primaryMuscles.map((muscle) => <span key={muscle}>{muscle}</span>)}</div>
          <p>{result.setupCue}</p>
          {result.uncertainty && <small>{result.uncertainty}</small>}

          {result.alternatives && result.alternatives.length > 0 && result.confidence !== 'high' && (
            <div className="perf-scout-alternatives">
              <span className="eyebrow">OTHER LIKELY MATCHES</span>
              {result.alternatives.map((candidate) => (
                <button type="button" key={candidate.name} onClick={() => chooseCandidate(candidate)}>
                  <strong>{candidate.name}</strong>
                  <span>{candidate.movementPattern}</span>
                </button>
              ))}
            </div>
          )}

          <div className="perf-scout-confirm">
            <button
              type="button"
              className="perf-primary"
              disabled={disabled || adding}
              onClick={async () => {
                setAdding(true);
                try {
                  await onAdd(result);
                  setResult(null);
                  setPreview('');
                } finally {
                  setAdding(false);
                }
              }}
            >
              {adding ? 'Adding…' : 'That’s it — add movement →'}
            </button>
            <button type="button" disabled={adding} onClick={() => cameraRef.current?.click()}>Not it · rescan</button>
          </div>
        </div>
      )}
    </section>
  );
}
