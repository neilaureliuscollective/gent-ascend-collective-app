// Isolated browser-fixture only. Synthetic responses never enter application routes.
import { useState, type CSSProperties } from 'react';
import { createRoot } from 'react-dom/client';
import { AureliusWorkspace } from '@/components/aurelius/workspace';
import { ConversationViewport } from '@/components/aurelius/conversation-viewport';
import { StudioWorkspace } from '@/components/aurelius/studio-workspace';
import { CompanyRoom } from '@/components/companies/company-room';
import { AppearanceControls, useAppearance } from '@/components/visual/appearance';
import { IntelligenceActivity } from '@/components/intelligence-motion/presence';
import { LivingSignal } from '@/components/intelligence-motion/living-signal';
import { liveMotionOperation } from '@/platform/visual/operation-adapters';
import type { WorkspaceData, StreamEvent, Turn } from '@/domains/intelligence/types';
import '@/app/globals.css';
import '@/app/sovereign.css';
import '@/app/imperial-workspace.css';
import '@/app/imperial-emerald-ii.css';
import '@/app/obsidian-smoked-glass.css';
import '@/app/(workspace)/app/work/work.css';
import './motion-integration.css';
const base: WorkspaceData = {
  ownerId: 'synthetic-owner',
  conversations: [],
  turns: [],
  memories: [],
  actionProposals: [],
  context: {
    profile: {
      name: 'Synthetic',
      priority: 'Review',
      timezone: 'UTC',
      units: 'metric',
      updatedAt: '2026-10-12',
    },
    goal: null,
    memories: [],
  },
  canChat: true,
  configured: true,
  model: 'synthetic-fixture',
};
const company = {
  id: 'c8000000-0000-4000-8000-000000000001',
  person_id: 'synthetic-owner',
  name: 'Synthetic company',
  brief: 'Fixture only',
  version: 1,
  confirmed_at: '2026-10-12',
  created_at: '2026-10-12',
};
const room = {
  company,
  founderAccess: false,
  conversations: [],
  turns: [] as Turn[],
  hasOlderTurns: false,
  nextCursor: null,
  canChat: true,
};
const project = {
  id: 'fixture-project',
  title: 'Synthetic creative project',
  creative_type: 'open',
  brief: {},
  updated_at: '2026-10-12',
};
const studio = {
  owner: 'synthetic-owner',
  projects: [project],
  projectId: project.id,
  versions: [],
  references: [],
  scenes: [],
  finishes: [],
  configured: true,
};
let stream: ReadableStreamDefaultController<Uint8Array> | null = null;
let imageReply: ((value: Response) => void) | null = null;
let turn: Turn | null = null;
const json = (value: unknown) =>
  new Response(JSON.stringify(value), { headers: { 'content-type': 'application/json' } });
function emit(event: StreamEvent) {
  if (!stream) return;
  stream.enqueue(new TextEncoder().encode(JSON.stringify(event) + '\n'));
  if (event.type === 'saved' || event.type === 'error') {
    stream.close();
    stream = null;
  }
}
window.fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (url.startsWith('/api/aurelius/chat') || url.startsWith('/api/company-talk/chat')) {
    if (new URLSearchParams(location.search).get('holdHeaders') === '1')
      await new Promise((resolve) => setTimeout(resolve, 1800));
    if (new URLSearchParams(location.search).get('rejectHeaders') === '1')
      return new Response(JSON.stringify({ error: 'Synthetic rejection' }), {
        status: 503,
        headers: { 'content-type': 'application/json' },
      });
    const body = JSON.parse(String(init?.body));
    turn = {
      id: body.requestId,
      person_id: 'synthetic-owner',
      conversation_id: body.conversationId,
      user_text: body.text,
      assistant_text:
        new URLSearchParams(location.search).get('longReply') === '1'
          ? 'Synthetic long response with useful text.\n\n'.repeat(80)
          : 'Synthetic response for motion verification.',
      status: 'complete',
      model: 'synthetic-fixture',
      context_included: false,
      prompt_version: 'fixture',
      feedback: null,
      created_at: '2026-10-12',
      finished_at: '2026-10-12',
    };
    return new Response(
      new ReadableStream<Uint8Array>({
        start(controller) {
          stream = controller;
          init?.signal?.addEventListener(
            'abort',
            () => {
              window.dispatchEvent(new Event('fixture:stream-aborted'));
              if (stream) {
                stream.close();
                stream = null;
              }
            },
            { once: true },
          );
        },
      }),
    );
  }
  if (url.startsWith('/api/company-talk')) return json(room);
  if (url.startsWith('/api/company-work')) return json({ jobs: [] });
  if (url.startsWith('/api/aurelius/creations')) {
    return json({
      creations: [],
      selected: {},
      images: [],
      selectedImageId: null,
      canCreateImages: false,
      imageAccess:
        new URLSearchParams(location.search).get('imageAccess') === 'unavailable'
          ? 'unavailable'
          : 'ready',
      attachmentProjectId: null,
    });
  }
  if (url.startsWith('/api/aurelius')) {
    if (
      url.includes('conversationId=') &&
      base.turns.length &&
      new URLSearchParams(location.search).get('holdReload') === '1'
    )
      await new Promise((resolve) => setTimeout(resolve, 1500));
    if (new URLSearchParams(location.search).get('history') === '1')
      return json({
        ...base,
        turns: Array.from({ length: 40 }, (_, index) => ({
          id: `fixture-history-${index}`,
          person_id: 'synthetic-owner',
          conversation_id: 'fixture-conversation',
          user_text: `Synthetic saved question ${index}`,
          assistant_text: 'Synthetic saved answer for long-history rendering.\n\n'.repeat(8),
          status: 'complete',
          model: 'synthetic-fixture',
          context_included: false,
          prompt_version: 'fixture',
          feedback: null,
          created_at: '2026-10-12',
          finished_at: '2026-10-12',
        })),
      });
    return json(base);
  }
  if (url === '/api/studio' && init?.method === 'POST')
    return new Promise<Response>((resolve) => {
      imageReply = resolve;
    });
  if (url.startsWith('/api/studio')) return json(studio);
  throw new Error('This isolated review does not contact external services.');
};
function Review() {
  const [surface, setSurface] = useState('talk');
  const [voice, setVoice] = useState<'connecting' | 'listening' | 'speaking' | 'ended' | 'error'>(
    'listening',
  );
  const [voiceLevel, setVoiceLevel] = useState(0);
  const [voiceOutput, setVoiceOutput] = useState(0);
  const [voiceMuted, setVoiceMuted] = useState(false);
  const [playbackBlocked, setPlaybackBlocked] = useState(false);
  const { moving } = useAppearance();
  const finish = () => {
    if (turn && stream) {
      base.turns = [turn];
      room.turns = [turn];
      emit({ type: 'saved', turn });
    }
    if (imageReply) {
      imageReply(json({ id: 'fixture-version' }));
      imageReply = null;
    }
  };
  return (
    <div className="app-shell imperial-workspace motion-integration-review">
      <header className="review-controls">
        <h1>Aethelios · motion integration review</h1>
        <p>
          Synthetic API events only. No account, model, microphone, live audio or database. Controls
          below manually emit fixture events.
        </p>
        <label>
          Surface
          <select
            aria-label="Surface"
            value={surface}
            onChange={(event) => {
              if (stream) {
                stream.close();
                stream = null;
              }
              setSurface(event.target.value);
            }}
          >
            <option value="talk">Talk / Council</option>
            <option value="studio">Studio</option>
            <option value="work">Work</option>
            <option value="voice">Live adapter preview</option>
          </select>
        </label>
        <AppearanceControls />
        <div>
          <p className="review-sim-label">Labeled synthetic sequences · not a live provider.</p>
          <button onClick={() => emit({ type: 'activity', phase: 'searching' })}>
            Emit search event
          </button>
          <button
            onClick={() =>
              emit({
                type: 'creation',
                item: {
                  id: 'fixture-image',
                  kind: 'image',
                  title: 'Synthetic image title',
                  status: 'approval',
                },
              })
            }
          >
            Emit image approval
          </button>
          <button
            onClick={() =>
              emit({
                type: 'creation',
                item: {
                  id: 'fixture-image',
                  kind: 'image',
                  title: 'Synthetic image title',
                  status: 'running',
                },
              })
            }
          >
            Emit image artifact
          </button>
          <button
            onClick={() =>
              emit({
                type: 'creation',
                item: {
                  id: 'fixture-image-ready',
                  kind: 'image',
                  title: 'Completed synthetic image',
                  status: 'complete',
                },
              })
            }
          >
            Emit completed image
          </button>
          <button
            onClick={() =>
              emit({
                type: 'delta',
                text:
                  new URLSearchParams(location.search).get('longReply') === '1'
                    ? 'Synthetic long response with useful text.\n\n'.repeat(80)
                    : 'Synthetic response for motion verification.',
              })
            }
          >
            Emit response text
          </button>
          <button onClick={() => emit({ type: 'activity', phase: 'saving' })}>
            Emit saving event
          </button>
          <button onClick={finish}>Confirm synthetic save</button>
          <button
            onClick={() =>
              emit({ type: 'error', message: 'Synthetic operation failed; save not confirmed.' })
            }
          >
            Emit failure
          </button>
        </div>
      </header>
      <main className="review-workspace" key={surface}>
        {surface === 'talk' ? (
          <ConversationViewport>
            <AureliusWorkspace />
          </ConversationViewport>
        ) : surface === 'studio' ? (
          <StudioWorkspace />
        ) : surface === 'work' ? (
          <CompanyRoom initial={room} />
        ) : (
          <section
            className="review-voice"
            style={
              {
                '--live-audio-level': voice === 'speaking' ? voiceOutput : voiceLevel,
              } as CSSProperties
            }
          >
            <p>Structural adapter preview only · no voice controller mounted.</p>
            <p>Synthetic measured envelope · not a live microphone or paid session.</p>
            <select
              aria-label="Voice phase"
              value={voice}
              onChange={(event) => setVoice(event.target.value as typeof voice)}
            >
              {['connecting', 'listening', 'speaking', 'ended', 'error'].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
            <label>
              <input
                type="checkbox"
                checked={voiceMuted}
                onChange={(event) => setVoiceMuted(event.target.checked)}
              />
              Mute input
            </label>
            <label>
              <input
                type="checkbox"
                checked={playbackBlocked}
                onChange={(event) => setPlaybackBlocked(event.target.checked)}
              />
              Block playback
            </label>
            <label>
              Synthetic audio level
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={voiceLevel}
                onChange={(event) => setVoiceLevel(Number(event.target.value))}
              />
            </label>
            <label>
              Synthetic output level
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                aria-label="Synthetic output level"
                value={voiceOutput}
                onChange={(event) => setVoiceOutput(Number(event.target.value))}
              />
            </label>
            <LivingSignal
              still={!moving}
              surface="voice-compact"
              operation={{
                ...liveMotionOperation(
                  {
                    sessionId: 'preview',
                    phase: voice,
                    muted: voiceMuted,
                    playbackBlocked,
                  },
                  { input: voiceLevel, output: voiceOutput },
                ),
                basis: 'preview',
              }}
            />
            <IntelligenceActivity
              operation={{
                ...liveMotionOperation(
                  {
                    sessionId: 'preview',
                    phase: voice,
                    muted: voiceMuted,
                    playbackBlocked,
                  },
                  { input: voiceLevel, output: voiceOutput },
                ),
                basis: 'preview',
              }}
            />
          </section>
        )}
      </main>
    </div>
  );
}
createRoot(document.getElementById('root')!).render(<Review />);
