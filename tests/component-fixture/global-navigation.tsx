import { createRoot } from 'react-dom/client';
import { Shell } from '@/components/shell';
import { WorldHeader } from '@/components/public/world-header';
import { AureliusWorkspace } from '@/components/aurelius/workspace';
import { ConversationViewport } from '@/components/aurelius/conversation-viewport';
import '@/app/globals.css';
import '@/app/interaction.css';
import '@/app/imperial-workspace.css';
import '@/app/imperial-emerald-ii.css';
import '@/app/obsidian-smoked-glass.css';
import '@/app/(public)/world.css';
const params = new URLSearchParams(location.search);
const route = params.get('route') || '/app';
const signedIn = params.get('identity') !== 'anonymous';
const founderOffice = params.get('identity') === 'founder';
history.replaceState(null, '', route + location.search);
const content = (
  <>
    <p>Local synthetic navigation fixture · no authenticated account or live voice.</p>
    <h1>{route}</h1>
    <label>
      Retained draft
      <textarea aria-label="Retained draft" defaultValue="An unsaved idea" />
    </label>
    <div style={{ height: 1400 }}>Page scroll continuity</div>
  </>
);
createRoot(document.getElementById('root')!).render(
  route === '/' ? (
    <>
      <WorldHeader access={{ signedIn, founderOffice }} />
      <main style={{ paddingTop: 100 }}>{content}</main>
    </>
  ) : (
    <Shell signedIn={signedIn} founderOffice={founderOffice}>
      {route === '/app/aethelios' ? (
        <ConversationViewport>
          <AureliusWorkspace />
        </ConversationViewport>
      ) : (
        content
      )}
    </Shell>
  ),
);
