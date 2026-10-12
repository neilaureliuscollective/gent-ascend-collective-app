import { createRoot } from 'react-dom/client';
import { HealthWorkspace, type HealthView } from '@/components/health/workspace';
import { healthFixture } from '../component-fixture/health';
import '@/app/globals.css';
import '@/app/interaction.css';
import '@/app/aether-materials.css';
import '@/app/imperial-workspace.css';
const view = new URLSearchParams(location.search).get('view') || 'command';
createRoot(document.getElementById('root')!).render(
  <div
    className="app-shell imperial-workspace"
    style={{ display: 'block', background: '#07130F', minHeight: '100vh' }}
  >
    <p style={{ padding: 12, color: '#aec2ad' }}>
      Synthetic Health fixture · no live records or model
    </p>
    <HealthWorkspace initial={healthFixture} view={view as HealthView} />
  </div>,
);
