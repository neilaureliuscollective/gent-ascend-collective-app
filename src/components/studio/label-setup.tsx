'use client';
import { useState } from 'react';
import {
  labelBriefSchema,
  parseSupplierProfile,
  type LabelBrief,
  type SupplierProfile,
} from '@/domains/studio/label/contract';
import { sanitizeSvg } from '@/domains/studio/design/sanitize';
import type { DesignDocument } from '@/domains/studio/design/document';

type Created = { id: string; revision: number; updated_at: string; document: DesignDocument };
export function LabelSetup({
  projectId,
  onCreated,
}: {
  projectId: string;
  onCreated: (row: Created) => void;
}) {
  const [profile, setProfile] = useState<SupplierProfile | null>(null);
  const [templateHash, setTemplateHash] = useState('');
  const [factsHash, setFactsHash] = useState('');
  const [logo, setLogo] = useState('');
  const [logoName, setLogoName] = useState('');
  const [productName, setProductName] = useState('');
  const [direction, setDirection] = useState(
    'Obsidian, emerald and restrained gold. Clear editorial typography.',
  );
  const [source, setSource] = useState<LabelBrief['source']>({
    kind: 'manual',
    reference: '',
    revision: '',
  });
  const [mode, setMode] = useState<'deterministic' | 'model'>('deterministic');
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function read(file: File | undefined, action: (text: string) => void) {
    if (!file) return;
    try {
      if (file.size > 100000) throw new Error('Use a profile/brief/SVG smaller than 100 KB.');
      action(await file.text());
      setConsent(false);
      setError('');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Import failed.');
    }
  }
  async function hash(file: File | undefined, set: (value: string) => void) {
    if (!file) return;
    try {
      if (file.size > 20_000_000) throw new Error('Source files are limited to 20 MB.');
      set(
        Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await file.arrayBuffer())))
          .map((b) => b.toString(16).padStart(2, '0'))
          .join(''),
      );
      setError('');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Source verification failed.');
    }
  }
  const matched =
    profile && profile.template.sha256 === templateHash && profile.facts.sha256 === factsHash;
  async function create() {
    if (!matched || !logo) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/studio/label', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          profile,
          logo,
          brief: labelBriefSchema.parse({
            schema: 'studio-label-brief/v1',
            productName,
            direction,
            source,
          }),
          mode,
          modelConsent: consent,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Label creation failed.');
      onCreated(result);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Label creation failed.');
    } finally {
      setBusy(false);
      setConsent(false);
    }
  }
  return (
    <section className="studio-label-setup" aria-label="Create supplier label">
      <div>
        <p className="eyebrow">PRODUCT LABEL / SUPPLIER PROFILE</p>
        <h3>From direction to editable artwork.</h3>
        <p>
          Import the current SKU profile and matching source files. Required copy and matrix-code
          space remain protected. No supplier size or facts are invented.
        </p>
        <details>
          <summary>Prepare a supplier profile</summary>
          <p>
            Download the exact product template from Supliful → Customize and sell → Create label →
            Upload a Design. A designer must transcribe its trim, bleed, safe, artwork and
            required-copy regions into the versioned Studio JSON profile. Preserve complex facts
            tables as outlined SVG regions; use text regions only where exact plain text and layout
            are sufficient. Source SHA-256 hashes bind that profile to your original template and
            facts files. This is a profile importer, not an Illustrator parser. Check every region
            against the original before use.
          </p>
          <p>
            All coordinates are millimetres from trim top-left; bleed is outside trim and added
            once. Template and facts revisions cannot be changed inside an existing label. Import a
            new design for updates.
          </p>
        </details>
      </div>
      <div className="studio-label-inputs">
        <label>
          Supplier profile (.json)
          <input
            type="file"
            accept=".json,application/json"
            onChange={(event) =>
              void read(event.target.files?.[0], (text) => {
                setProfile(parseSupplierProfile(JSON.parse(text)));
                setTemplateHash('');
                setFactsHash('');
              })
            }
          />
        </label>
        <label>
          Original supplier template
          <input
            type="file"
            accept=".ai,.pdf,.svg,.json"
            onChange={(event) => void hash(event.target.files?.[0], setTemplateHash)}
          />
        </label>
        <label>
          Original product facts
          <input
            type="file"
            accept=".txt,.pdf,.json"
            onChange={(event) => void hash(event.target.files?.[0], setFactsHash)}
          />
        </label>
        <label>
          Approved logo (.svg)
          <input
            type="file"
            accept=".svg,image/svg+xml"
            onChange={(event) => {
              const file = event.target.files?.[0];
              void read(file, (text) => {
                setLogo(sanitizeSvg(text));
                setLogoName(file?.name ?? '');
              });
            }}
          />
        </label>
        <label>
          Talk brief (.json)
          <input
            type="file"
            accept=".json,application/json"
            onChange={(event) =>
              void read(event.target.files?.[0], (text) => {
                const brief = labelBriefSchema.parse(JSON.parse(text));
                setProductName(brief.productName);
                setDirection(brief.direction);
                setSource(brief.source);
              })
            }
          />
        </label>
        <label>
          Product name
          <input
            value={productName}
            maxLength={80}
            onChange={(event) => {
              setProductName(event.target.value);
              setConsent(false);
            }}
          />
        </label>
        <label className="studio-label-direction">
          Creative direction
          <textarea
            value={direction}
            maxLength={1500}
            onChange={(event) => {
              setDirection(event.target.value);
              setConsent(false);
            }}
          />
        </label>
        <label>
          Layout method
          <select
            value={mode}
            onChange={(event) => {
              setMode(event.target.value as typeof mode);
              setConsent(false);
            }}
          >
            <option value="deterministic">Deterministic layout · no model call</option>
            <option value="model">Model layout · existing connection</option>
          </select>
        </label>
        {mode === 'model' ? (
          <label>
            <input
              type="checkbox"
              checked={consent}
              onChange={(event) => setConsent(event.target.checked)}
            />
            Send this brief, brand kit and artwork dimensions for one model layout request.
          </label>
        ) : null}
      </div>
      <p role="status">
        {profile
          ? `${profile.fixture ? 'SYNTHETIC FIXTURE — NOT FOR MANUFACTURING · ' : ''}${profile.supplier} ${profile.sku} · template ${profile.template.revision} · facts ${profile.facts.revision}`
          : 'Supplier profile required. Print export is unavailable without exact SKU geometry and required copy.'}
      </p>
      {profile ? (
        <p>
          {matched
            ? 'Source files match the imported profile.'
            : 'Select matching template and facts source files to verify hashes.'}{' '}
          {logoName ? `Logo: ${logoName}` : ''}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="studio-error">
          {error}
        </p>
      ) : null}
      <button
        type="button"
        disabled={
          busy || !matched || !logo || !productName.trim() || (mode === 'model' && !consent)
        }
        onClick={() => void create()}
      >
        {busy ? 'Creating label…' : 'Create editable label'}
      </button>
      <p className="muted">
        Technical validation never means Supliful approval. Marketing mockups remain separate from
        this print document.
      </p>
    </section>
  );
}
