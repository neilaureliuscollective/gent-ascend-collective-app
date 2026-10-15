import { useState } from 'react';
import Image from './image';
import { createRoot } from 'react-dom/client';
import {
  IntelligencePresence,
  IntelligenceResponse,
  IntelligenceStatus,
  IntelligenceTaskCard,
} from '@/components/intelligence-motion/presence';
import { AppearanceControls } from '@/components/visual/appearance';
import {
  intelligencePhases,
  type IntelligencePhase,
  type IntelligenceOperation,
} from '@/platform/visual/intelligence-motion';
import palette from '@/platform/visual/aether-palette.json';
import { brand } from '@/platform/brand';
import './motion-gallery.css';
function Gallery() {
  const [phase, setPhase] = useState<IntelligencePhase>('thinking');
  const [level, setLevel] = useState(0);
  const operation: IntelligenceOperation = {
    id: `preview-${phase}`,
    phase,
    basis: 'preview',
    audioLevel: level,
  };
  return (
    <main style={{ background: palette.obsidian, color: palette.text }}>
      <header>
        <Image src={brand.crest} alt={brand.crestAlt} width={64} height={64} />
        <div>
          <p className="gallery-eyebrow">AETHELIOS · INTELLIGENCE MOTION</p>
          <h1>Intelligence, in motion.</h1>
        </div>
        <AppearanceControls />
      </header>
      <p className="gallery-disclosure">
        Visible response signature review · no operation is running. Microphone off. No audio, model
        requests or saved records.
      </p>
      <section className="gallery-stage" aria-label="Selected state preview">
        <IntelligencePresence key={phase} operation={operation} size="large" variant="signal" />
        <div>
          <IntelligenceStatus operation={operation} />
          <h2>One signature. Every scale.</h2>
          <p>
            Emerald intelligence within obsidian. Interwoven emerald light with a restrained gold
            edge. Immediate feedback that leaves room for your work.
          </p>
          <label>
            Preview state
            <select
              value={phase}
              onChange={(event) => setPhase(event.target.value as IntelligencePhase)}
            >
              {intelligencePhases.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          <label>
            Illustrative audio level · manual control
            <input
              type="range"
              min="0"
              max="1"
              step=".05"
              value={level}
              onChange={(event) => setLevel(Number(event.target.value))}
            />
          </label>
        </div>
      </section>
      <section className="gallery-grid" aria-label="All state previews">
        {intelligencePhases.map((value) => (
          <IntelligenceTaskCard
            key={value}
            title={value}
            operation={{ id: `tile-${value}`, phase: value, basis: 'preview' }}
          >
            <p>
              {value === 'complete'
                ? 'Complete does not mean saved without acknowledgment.'
                : value === 'listening' || value === 'speaking'
                  ? 'Audio motion requires a measured level.'
                  : 'State comes from the operation owner.'}
            </p>
          </IntelligenceTaskCard>
        ))}
      </section>
      <section className="gallery-conversation" aria-label="Conversation composition preview">
        <h2>Conversation mark</h2>
        <p>
          Official 192px A emblem at 24 CSS px plus a recessed emerald filament. Synthetic preview
          only.
        </p>
        <IntelligenceResponse operation={operation} name="Aethelios" />
      </section>
      <section className="gallery-grid" aria-label="Concurrent operation preview">
        <IntelligenceTaskCard
          title="Conversation"
          operation={{ id: 'voice', phase: 'listening', basis: 'preview' }}
        />
        <IntelligenceTaskCard
          title="Approved research task"
          operation={{ id: 'research', phase: 'researching', basis: 'preview' }}
        />
        <IntelligenceTaskCard
          title="Persistence acknowledgment"
          operation={{ id: 'save', phase: 'complete', basis: 'preview', persistence: 'uncertain' }}
        />
      </section>
    </main>
  );
}
createRoot(document.getElementById('root')!).render(<Gallery />);
