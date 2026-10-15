'use client';
import { useContext, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import ReactMarkdown from 'react-markdown';
import { LiveController, type LiveState } from '@/domains/live/controller';
import './live.css';
import {
  IntelligencePresence,
  IntelligenceStatus,
  IntelligenceActivity,
} from '@/components/intelligence-motion/presence';
import { liveMotionOperation, liveJobMotionOperation } from '@/platform/visual/operation-adapters';
import { measuredAudioLevel } from '@/platform/visual/intelligence-motion';
import { useAppearance } from '@/components/visual/appearance';
import { ArtifactSurface } from './artifacts';
import { LiveAvailabilityContext, LiveContext } from './context';
import { LiveDiagnostics } from './diagnostics';
export function LiveConversationProvider({
  children,
  enabled = false,
  unavailableReason = 'Aethelios Live is unavailable on this deployment.',
}: {
  children: React.ReactNode;
  enabled?: boolean;
  unavailableReason?: string | null;
}) {
  const [controller] = useState(() => new LiveController());
  useEffect(() => {
    const hidden = () => {
      if (document.visibilityState === 'hidden')
        void controller.end(
          'Voice paused because Aethelios left the foreground. Resume when ready.',
        );
    };
    const away = () => {
      void controller.end('The connection stopped. Resume when ready.');
    };
    document.addEventListener('visibilitychange', hidden);
    window.addEventListener('pagehide', away);
    window.addEventListener('offline', away);
    return () => {
      document.removeEventListener('visibilitychange', hidden);
      window.removeEventListener('pagehide', away);
      window.removeEventListener('offline', away);
      controller.dispose();
    };
  }, [controller]);
  useEffect(() => {
    if (!enabled) void controller.end();
  }, [controller, enabled]);
  return (
    <LiveAvailabilityContext.Provider value={enabled ? null : unavailableReason}>
      <LiveContext.Provider value={enabled ? controller : null}>
        {children}
        {enabled && <LiveSurface controller={controller} />}
      </LiveContext.Provider>
    </LiveAvailabilityContext.Provider>
  );
}
const idleSnapshot: LiveState = {
  phase: 'idle',
  mode: 'compact',
  muted: false,
  error: '',
  conversationId: null,
  sessionId: null,
  jobs: [],
  artifactWorkspace: { artifacts: [], selectedId: null, projects: [] },
  artifactBusy: false,
  reviewedAction: null,
  expiresAt: null,
  transcript: [],
  savedItemIds: [],
  playbackBlocked: false,
  cleanupPending: false,
  recovering: false,
  speechDetected: false,
  responsePending: false,
  persistence: 'idle',
  persistenceEpoch: 0,
  artifactConversationId: null,
};
const noopSubscribe = () => () => {};
const getIdle = () => idleSnapshot;
export function useLiveSession() {
  const controller = useContext(LiveContext);
  const state = useSyncExternalStore(
    controller?.subscribe ?? noopSubscribe,
    controller?.getSnapshot ?? getIdle,
    controller?.getSnapshot ?? getIdle,
  );
  return { controller, state };
}
export function useLiveBusy() {
  const { state } = useLiveSession();
  return state.cleanupPending || ['connecting', 'listening', 'speaking'].includes(state.phase);
}
function LiveEntryLabel() {
  return (
    <>
      <span className="live-entry-full">Aethelios Live</span>
      <span className="live-entry-short" aria-hidden="true">
        Live
      </span>
    </>
  );
}
export function LiveVoiceEntry({
  conversationId,
  includeContext,
  disabled = false,
  onAdoptConversation,
}: {
  conversationId: string | null;
  includeContext: boolean;
  disabled?: boolean;
  onAdoptConversation?: (conversationId: string) => void;
}) {
  const controller = useContext(LiveContext);
  const unavailable = useContext(LiveAvailabilityContext);
  const [consent, setConsent] = useState(false);
  const [info, setInfo] = useState(false);
  const [approved, setApproved] = useState(false);
  const [contextApproved, setContextApproved] = useState(false);
  const [backgroundWork, setBackgroundWork] = useState(false);
  const [voice, setVoice] = useState<'cedar' | 'marin'>('cedar');
  if (!controller)
    return (
      <div className="live-entry">
        <button
          type="button"
          className="talk-tool"
          aria-label="Aethelios Live"
          aria-expanded={info}
          aria-controls="live-unavailable"
          onClick={() => setInfo((value) => !value)}
        >
          <LiveEntryLabel />
        </button>
        {info && (
          <div className="live-consent" id="live-unavailable" role="status">
            <p>Natural voice · founder pilot</p>
            <p>{unavailable ?? 'Aethelios Live is unavailable on this deployment.'}</p>
            <button type="button" onClick={() => setInfo(false)}>
              Close
            </button>
          </div>
        )}
      </div>
    );
  return (
    <div className="live-entry">
      <button
        type="button"
        className="talk-tool"
        aria-label="Aethelios Live"
        disabled={disabled}
        onClick={() => {
          const state = controller.getSnapshot();
          if (['connecting', 'listening', 'speaking'].includes(state.phase)) {
            controller.mode('immersive');
          } else setConsent(true);
        }}
      >
        <LiveEntryLabel />
      </button>
      {consent && (
        <div className="live-consent" role="group" aria-label="Voice pilot consent">
          <p>Natural voice · two-minute pilot</p>
          <p>
            Audio is sent to OpenAI. Transcripts are saved in this conversation after a reply
            finishes streaming. Interrupted replies are marked incomplete. Delete the conversation
            in Talk to remove its saved transcript. Non-content usage reservations remain.
          </p>
          <p>
            Voice continues while navigating inside Aethelios. Leaving the browser or locking the
            screen ends this pilot session. Research, images and Entities use their existing
            controls. Read-only research and one existing Council coworker can run in the background
            only after you approve the exact task.
          </p>
          <label>
            <input
              type="checkbox"
              checked={approved}
              onChange={(event) => setApproved(event.target.checked)}
            />{' '}
            I consent to audio processing and a saved transcript .
          </label>
          {includeContext && (
            <label>
              <input
                type="checkbox"
                checked={contextApproved}
                onChange={(event) => setContextApproved(event.target.checked)}
              />{' '}
              Include my selected personal context in voice.
            </label>
          )}
          <label>
            <input
              type="checkbox"
              checked={backgroundWork}
              onChange={(event) => setBackgroundWork(event.target.checked)}
            />{' '}
            Allow proposals for research, images, visual boards and Council coworkers. Each task
            requires approval.
          </label>
          <label>
            Voice
            <select
              value={voice}
              onChange={(event) => setVoice(event.target.value as 'cedar' | 'marin')}
            >
              <option value="cedar">Cedar</option>
              <option value="marin">Marin</option>
            </select>
          </label>
          <div className="live-consent-actions">
            <button
              type="button"
              disabled={!approved}
              onClick={() => {
                const id = conversationId ?? crypto.randomUUID();
                onAdoptConversation?.(id);
                setConsent(false);
                setApproved(false);
                void controller.start(id, includeContext && contextApproved, voice, backgroundWork);
                setContextApproved(false);
                setBackgroundWork(false);
              }}
            >
              Start voice
            </button>
            <button
              type="button"
              onClick={() => {
                setConsent(false);
                setApproved(false);
                setContextApproved(false);
                setBackgroundWork(false);
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
function LiveSurface({ controller }: { controller: LiveController }) {
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  );
  const dialog = useRef<HTMLDialogElement>(null);
  const { moving } = useAppearance();
  const orb = useRef<HTMLDivElement>(null);
  const operation = liveMotionOperation(state);
  const compact = useRef<HTMLElement>(null);
  const [transcript, setTranscript] = useState(true);
  const [draft, setDraft] = useState('');
  const [dock, setDock] = useState<HTMLElement | null>(null);
  const visible = state.phase !== 'idle';
  const active = ['connecting', 'listening', 'speaking'].includes(state.phase);
  const docked = Boolean(dock);
  useEffect(() => {
    setDock(document.getElementById('talk-voice-dock'));
  }, [visible, state.mode]);
  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    if (visible && state.mode === 'immersive' && !node.open) node.showModal();
    else if (node.open) node.close();
  }, [visible, state.mode]);
  useEffect(() => {
    if (!visible || state.mode !== 'compact' || docked) return;
    const frame = requestAnimationFrame(() => compact.current?.querySelector('button')?.focus());
    return () => cancelAnimationFrame(frame);
  }, [visible, state.mode, docked]);
  useEffect(() => {
    orb.current?.style.setProperty('--live-audio-level', '0');
    compact.current?.style.setProperty('--live-audio-level', '0');
    if (!active || !moving) return;
    let cancelled = false,
      sampling = false;
    const interval = setInterval(() => {
      if (sampling) return;
      sampling = true;
      void controller
        .audioLevels()
        .then((levels) => {
          if (!cancelled) {
            const value = String(
              measuredAudioLevel(liveMotionOperation(controller.getSnapshot(), levels)),
            );
            orb.current?.style.setProperty('--live-audio-level', value);
            compact.current?.style.setProperty('--live-audio-level', value);
          }
        })
        .catch(() => {})
        .finally(() => {
          sampling = false;
        });
    }, 120);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [active, moving, controller, state.phase, state.muted, state.playbackBlocked, state.mode]);
  useEffect(() => {
    if (!visible || !state.sessionId) return;
    void controller.refreshJobs();
    let attempts = 0;
    const timer = setInterval(() => {
      if (!active && ++attempts > 6) {
        clearInterval(timer);
        return;
      }
      void controller.refreshJobs();
    }, 1500);
    return () => clearInterval(timer);
  }, [controller, visible, state.sessionId, active]);
  const controls = (
    <div className="live-controls">
      <button
        type="button"
        disabled={!active || state.phase === 'connecting'}
        aria-pressed={state.muted}
        onClick={() => controller.mute()}
      >
        {state.muted ? 'Unmute microphone' : 'Mute microphone'}
      </button>
      <button type="button" disabled={!active} onClick={() => controller.interrupt()}>
        Stop speaking
      </button>
      <button
        type="button"
        onClick={() => {
          void controller.end();
        }}
      >
        End{state.cleanupPending ? ' / retry cleanup' : ''}
      </button>
      <button
        type="button"
        onClick={() => controller.mode(state.mode === 'immersive' ? 'compact' : 'immersive')}
      >
        {state.mode === 'immersive' ? 'Minimize' : 'Fullscreen'}
      </button>
      {!active && !state.cleanupPending && (
        <button type="button" onClick={() => controller.dismiss()}>
          Close
        </button>
      )}
      <button
        type="button"
        aria-pressed={transcript}
        onClick={() => setTranscript((value) => !value)}
      >
        Transcript
      </button>
    </div>
  );
  const content = (
    <>
      <p className="live-brand">AETHELIOS LIVE</p>
      <IntelligenceStatus operation={operation} />
      {state.error && <p role="alert">{state.error}</p>}
      {state.playbackBlocked && (
        <button
          type="button"
          onClick={() => {
            void controller.enablePlayback();
          }}
        >
          Enable voice playback
        </button>
      )}
      {controls}
      <LiveDiagnostics controller={controller} />
      {active && (
        <details className="live-creation">
          <summary>Creation and background work</summary>
          <ArtifactSurface controller={controller} />
        </details>
      )}
      {transcript && docked && (
        <p className="live-privacy">
          Provisional speech stays in the Talk timeline. Saving is confirmed there.
        </p>
      )}
      {transcript && !docked && (
        <div
          className="live-transcript"
          role="log"
          aria-live="off"
          aria-label="Live transcript; saving is confirmed in Talk"
        >
          {state.transcript.map((line) => (
            <p key={line.id}>
              <strong>{line.role === 'user' ? 'You' : 'Aethelios'}</strong> {line.text}
            </p>
          ))}
          {!state.transcript.length && <p>Your live transcript appears here.</p>}
        </div>
      )}
      {state.jobs.map((job) => (
        <section className="live-job" key={job.id} aria-label="Background work">
          <h3>
            {job.coworker ? `Council · ${job.coworker}` : 'Research'} · {job.status}
          </h3>
          <IntelligenceActivity operation={liveJobMotionOperation(job)} />
          <p>{job.task}</p>
          {job.status === 'approval' && active && (
            <>
              <button
                type="button"
                onClick={() => {
                  void controller.reviewJob(job.id, true);
                }}
              >
                Approve this task
              </button>
              <button
                type="button"
                onClick={() => {
                  void controller.reviewJob(job.id, false);
                }}
              >
                Decline
              </button>
            </>
          )}
          {job.status === 'complete' && (
            <>
              <ReactMarkdown
                components={{
                  img: () => null,
                  a: ({ href, children }) => (
                    <a href={href} target="_blank" rel="noopener noreferrer">
                      {children}
                    </a>
                  ),
                }}
              >
                {job.result}
              </ReactMarkdown>
              <p>
                Saved in Talk
                {job.duration_ms !== null
                  ? ` · ${(job.duration_ms / 1000).toFixed(1)} seconds`
                  : ''}
              </p>
            </>
          )}
          {job.status === 'approved' && <p>Working in the background. You can keep talking.</p>}
          {job.status === 'failed' && <p>The task did not complete. No result is claimed.</p>}
        </section>
      ))}
      {active && state.mode === 'immersive' && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const sent = controller.text(draft);
            if (sent.accepted) setDraft('');
          }}
        >
          <label>
            Type in this voice session
            <input
              value={draft}
              maxLength={4000}
              onChange={(event) => setDraft(event.target.value)}
            />
          </label>
          <button disabled={state.phase === 'connecting' || !draft.trim()}>Send</button>
        </form>
      )}
      <p className="live-privacy">
        Mute keeps the microphone connected. End releases it. Transcript text is provisional until
        it appears in saved Talk history.
      </p>
      {!active && state.error && (
        <button type="button" onClick={() => controller.dismiss()}>
          Stay in Talk
        </button>
      )}
    </>
  );
  return (
    <>
      <dialog
        ref={dialog}
        className="live-immersive"
        aria-label="Aethelios Live"
        onCancel={(event) => {
          event.preventDefault();
          controller.mode('compact');
        }}
      >
        <div className="live-orb" ref={orb}>
          <IntelligencePresence operation={operation} size="large" variant="signal" />
        </div>
        <div className="live-content">{content}</div>
      </dialog>
      {visible &&
        state.mode === 'compact' &&
        (active || state.cleanupPending || (state.phase === 'ended' && !state.error)) &&
        (() => {
          const compactChrome = (
            <section
              ref={compact}
              className={`live-compact${docked ? ' is-docked' : ''}`}
              aria-label="Persistent Aethelios voice controls"
            >
              <IntelligencePresence operation={operation} variant="signal" />
              {content}
            </section>
          );
          return dock ? createPortal(compactChrome, dock) : compactChrome;
        })()}
    </>
  );
}
