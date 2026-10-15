import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { DesignWorkspace } from '@/components/studio/design-workspace';
import '@/app/aether-tokens.css';
import '@/app/forms.css';
import '@/app/imperial-workspace.css';
import '@/app/(workspace)/app/studio/studio-production.css';
import type { DesignDocument } from '@/domains/studio/design/document';
import './fixture.css';
type Row = {
  id: string;
  title: string;
  revision: number;
  updated_at: string;
  document: DesignDocument;
};
function Fixture() {
  const [designs, setDesigns] = useState<Row[]>([]);
  const load = () => {
    void fetch('/api/label-fixture')
      .then((r) => r.json())
      .then(setDesigns);
  };
  useEffect(load, []);
  return (
    <main className="app-shell imperial-workspace studio-page" style={{ padding: 'clamp(12px,3vw,40px)' }}>
      <p className="fixture-notice">
        SYNTHETIC ACCEPTANCE FIXTURE · Local API adapter, no Auth or model call · Not
        supplier-approved
      </p>
      <h1>
        Aethelios <span>Studio</span>
      </h1>
      <p>Human Ascendance / Label atelier</p>
      <DesignWorkspace
        projectId="10000000-0000-4000-8000-000000000001"
        designs={designs}
        versions={[]}
        references={[]}
        onChanged={load}
      />
    </main>
  );
}
createRoot(document.getElementById('root')!).render(<Fixture />);
