'use client';

import { useRef, useState } from 'react';

export type MachineScoutResult = {
  name: string;
  equipment: string;
  movementPattern: string;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  setupCue: string;
  confidence: 'high' | 'medium' | 'low';
  uncertainty: string;
};

async function compressImage(file: File) {
  const bitmap = await createImageBitmap(file);
  const max = 1280;
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Image processing is unavailable.');
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return { image: canvas.toDataURL('image/jpeg', 0.78), mediaType: 'image/jpeg' as const };
}

export function MachineScout({
  disabled,
  onAdd,
}: {
  disabled: boolean;
  onAdd: (result: MachineScoutResult) => Promise<void>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState<MachineScoutResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');

  async function inspect(file: File) {
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const image = await compressImage(file);
      const response = await fetch('/api/performance/machine-scout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(image),
        signal: AbortSignal.timeout(22000),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Machine Scout could not inspect that.');
      setResult(body as MachineScoutResult);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Try another photo.');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <section className="perf-machine-scout">
      <div className="perf-machine-scout-heading">
        <div>
          <span className="eyebrow">AETHELIOS / MACHINE SCOUT</span>
          <h3>See it. Identify it. Train it.</h3>
          <p>Choose a photo of the machine in front of you. The image is used for this inspection only.</p>
        </div>
        <button type="button" className="perf-primary" disabled={disabled || busy} onClick={() => inputRef.current?.click()}>
          {busy ? 'Inspecting…' : 'Scan machine'}
        </button>
        <input
          ref={inputRef}
          className="perf-visually-hidden"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void inspect(file);
          }}
        />
      </div>

      {error && <p className="perf-machine-error" role="alert">{error}</p>}

      {result && (
        <div className="perf-machine-result">
          <div className="perf-machine-result-topline">
            <span>{result.confidence.toUpperCase()} CONFIDENCE</span>
            <span>{result.equipment}</span>
          </div>
          <h4>{result.name}</h4>
          <p className="perf-machine-pattern">{result.movementPattern}</p>
          <div className="perf-machine-muscles">
            {result.primaryMuscles.map((muscle) => <span key={muscle}>{muscle}</span>)}
          </div>
          <p>{result.setupCue}</p>
          {result.uncertainty && <small>{result.uncertainty}</small>}
          <button
            type="button"
            className="perf-primary"
            disabled={disabled || adding}
            onClick={async () => {
              setAdding(true);
              try {
                await onAdd(result);
                setResult(null);
              } finally {
                setAdding(false);
              }
            }}
          >
            {adding ? 'Adding…' : 'Add to this workout →'}
          </button>
        </div>
      )}
    </section>
  );
}
