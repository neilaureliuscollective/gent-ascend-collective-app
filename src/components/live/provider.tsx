'use client';
import { useContext, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import ReactMarkdown from 'react-markdown';
import { LiveController, type LiveState } from '@/domains/live/controller';
import './live.css';
import {
  ConversationAnnouncer,
  IntelligenceStatus,
  IntelligenceActivity,
} from '@/components/intelligence-motion/presence';
import { liveMotionOperation, liveJobMotionOperation } from '@/platform/visual/operation-adapters';
import type { LiveCallLevels } from '@/platform/visual/live-call-presentation';
import { createLiveLevelPoller } from '@/platform/visual/live-level-poller';
import { useAppearance } from '@/components/visual/appearance';
import { LiveCallControls } from './call-controls';
import { LiveCallGlobe } from './call-globe';
import { ArtifactSurface } from './artifacts';
import { LiveAvailabilityContext, LiveContext, LiveAcknowledgementUserContext } from './context';
import { hasLiveAcknowledgement, saveLiveAcknowledgement } from '@/domains/live/acknowledgement';
import { LiveDiagnostics } from './diagnostics';
import {
  getTalkVoiceDock,
  getTalkVoiceDockSnapshot,
  requestTalkTranscriptFocus,
  subscribeTalkVoiceDock,
} from './voice-dock';
export function LiveConversationProvider({
  children,
  enabled = false,
  authUserId = null,
  unavailableReason = 'Aethelios Live is unavailable on this deployment.',
}: {
  children: React.ReactNode;
  enabled?: boolean;
  authUserId?: string | null;
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
    <LiveAcknowledgementUserContext.Provider value={authUserId}>
      <LiveAvailabilityContext.Provider value={enabled ? null : unavailableReason}>
        <LiveContext.Provider value={enabled ? controller : null}>
          {children}
          {enabled && <LiveSurface controller={controller} />}
        </LiveContext.Provider>
      </LiveAvailabilityContext.Provider>
    </LiveAcknowledgementUserContext.Provider>
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
export function LiveVoiceEntry(props: Parameters<typeof VoiceEntry>[0]) {
  const userId = useContext(LiveAcknowledgementUserContext);
  return <VoiceEntry key={userId ?? 'anonymous'} {...props} />;
}
function VoiceEntry({
  conversationId,
  includeContext,
  disabled = false,
  onAdoptConversation,
  workTarget = null,
}: {
  conversationId: string | null;
  includeContext: boolean;
  disabled?: boolean;
  onAdoptConversation?: (conversationId: string) => void;
  workTarget?: { creationId: string; field: string } | null;
}) {
  const controller = useContext(LiveContext);
  const unavailable = useContext(LiveAvailabilityContext);
  const userId = useContext(LiveAcknowledgementUserContext);
  const [consent, setConsent] = useState(false);
  const [info, setInfo] = useState(false);
  const [approved, setApproved] = useState(false);
  const [contextApproved, setContextApproved] = useState(false);
  const [backgroundWork, setBackgroundWork] = useState(false);
  const [voice, setVoice] = useState<'cedar' | 'marin'>('cedar');
  const start = (personal = false, proposals = false) => {
    if (!controller) return;
    const id = conversationId ?? crypto.randomUUID();
    onAdoptConversation?.(id);
    setConsent(false);
    void controller.start(id, personal, voice, proposals, workTarget);
    setContextApproved(false);
    setBackgroundWork(false);
  };
  const options = () => {
    setApproved(hasLiveAcknowledgement(userId));
    setContextApproved(false);
    setBackgroundWork(false);
    setConsent(true);
  };
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
          } else if (hasLiveAcknowledgement(userId)) start();
          else options();
        }}
      >
        <LiveEntryLabel />
      </button>
      <button type="button" className="talk-tool" disabled={disabled} onClick={options}>
        Voice options
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
            I consent to audio processing and a saved transcript.
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
                saveLiveAcknowledgement(userId);
                start(includeContext && contextApproved, backgroundWork);
              }}
            >
              Start voice
            </button>
            <button
              type="button"
              onClick={() => {
                setConsent(false);
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
  const compact = useRef<HTMLElement>(null);
  const wasImmersive = useRef(false);
  const { moving } = useAppearance();
  const operation = liveMotionOperation(state);
  const [levels, setLevels] = useState<LiveCallLevels>({
    input: 0,
    output: 0,
    source: 'unavailable',
  });
  const [transcript, setTranscript] = useState(true);
  const [dockDetailsOpen, setDockDetailsOpen] = useState(false);
  const [callDetailsOpen, setCallDetailsOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const transcriptLog = useRef<HTMLDivElement>(null);
  const dock = useSyncExternalStore(
    subscribeTalkVoiceDock,
    getTalkVoiceDock,
    getTalkVoiceDockSnapshot,
  );
  const visible = state.phase !== 'idle';
  const active = ['connecting', 'listening', 'speaking'].includes(state.phase);
  const docked = Boolean(dock);
  const readSample = () =>
    active ? levels : { input: 0, output: 0, source: 'unavailable' as const };
  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    if (visible && state.mode === 'immersive' && !node.open) node.showModal();
    else if (node.open) node.close();
  }, [visible, state.mode]);
  useEffect(() => {
    const leaving = wasImmersive.current && visible && state.mode === 'compact';
    wasImmersive.current = visible && state.mode === 'immersive';
    if (!leaving) return;
    const frame = requestAnimationFrame(() => {
      compact.current?.querySelector<HTMLButtonElement>('[aria-label="Expand voice"]')?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [visible, state.mode]);
  useEffect(() => {
    if (!active) return;
    const poller = createLiveLevelPoller({
      read: () => controller.audioLevels(),
      apply: setLevels,
      shouldPoll: () => moving && typeof document !== 'undefined' && !document.hidden,
    });
    poller.sync();
    const onVisibility = () => poller.sync();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      poller.dispose();
    };
  }, [active, controller, moving]);
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
  const canMute = active && state.phase !== 'connecting';
  const canStopPlayback = state.phase === 'speaking' && !state.playbackBlocked;
  const canEnd = active || state.cleanupPending;
  const controlModel = {
    muted: state.muted,
    canMute,
    canStopPlayback,
    canEnd,
    cleanupPending: state.cleanupPending,
    mode: state.mode,
    transcript,
    canClose: !active && !state.cleanupPending,
    docked,
  };
  const openTranscript = () => {
    setTranscript(true);
    if (state.mode === 'immersive') {
      requestAnimationFrame(() => {
        transcriptLog.current?.focus();
        transcriptLog.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      });
      return;
    }
    if (docked && requestTalkTranscriptFocus()) return;
    requestAnimationFrame(() => {
      transcriptLog.current?.focus();
      transcriptLog.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    });
  };
  const controlHandlers = {
    onMute: () => controller.mute(),
    onInterrupt: () => controller.interrupt(),
    onEnd: () => {
      void controller.end();
    },
    onMode: () => controller.mode(state.mode === 'immersive' ? 'compact' : 'immersive'),
    onTranscript: openTranscript,
    onClose: () => controller.dismiss(),
  };
  const identity = (
    <div className="live-call-identity">
      <p className="live-brand">AETHELIOS LIVE</p>
      <ConversationAnnouncer operation={operation} />
      <IntelligenceStatus operation={operation} announce={false} />
    </div>
  );
  const alerts = (
    <>
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
      {!active && state.error && (
        <button type="button" onClick={() => controller.dismiss()}>
          Stay in Talk
        </button>
      )}
    </>
  );
  const approvalJobs = state.jobs.filter((job) => job.status === 'approval');
  const liveLog = (
    <div
      ref={transcriptLog}
      className="live-transcript"
      role="log"
      tabIndex={-1}
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
  );
  const sessionDetails = (includeCreation: boolean) => (
    <>
      <LiveDiagnostics controller={controller} />
      {includeCreation && active && (
        <details className="live-creation">
          <summary>Creation and background work</summary>
          <ArtifactSurface controller={controller} />
        </details>
      )}
      {state.jobs.map((job) => (
        <section className="live-job" key={job.id} aria-label="Background work">
          <h3>
            {job.coworker ? `Council · ${job.coworker}` : 'Research'} · {job.status}
          </h3>
          <IntelligenceActivity operation={liveJobMotionOperation(job)} />
          <p>{job.task}</p>
          {job.status === 'approval' && active && includeCreation && (
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
      <p className="live-privacy">
        Mute keeps the microphone connected. End releases it. Transcript text is provisional until
        it appears in saved Talk history.
      </p>
      {docked && (
        <p className="live-privacy">
          Spoken lines appear in the Talk timeline. Saving is confirmed there.
        </p>
      )}
    </>
  );
  const detailsPanel = (
    open: boolean,
    setOpen: (value: boolean) => void,
    includeCreation: boolean,
  ) => (
    <details
      className="live-dock-details"
      open={open}
      onToggle={(event) => setOpen((event.currentTarget as HTMLDetailsElement).open)}
    >
      <summary>Details</summary>
      <div className="live-dock-details-body" hidden={!open} inert={!open || undefined}>
        {open ? sessionDetails(includeCreation) : null}
      </div>
    </details>
  );
  return (
    <>
      <dialog
        ref={dialog}
        className="live-immersive live-call-stage"
        aria-label="Aethelios Live"
        onCancel={(event) => {
          event.preventDefault();
          controller.mode('compact');
        }}
      >
        <div className="live-call">
          {identity}
          <div className="live-orb">
            <LiveCallGlobe state={state} moving={moving} size="immersive" readSample={readSample} />
          </div>
          <div className="live-content">
            {alerts}
            <LiveCallControls model={controlModel} {...controlHandlers} />
            {transcript ? liveLog : null}
            {active && (
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
            {detailsPanel(callDetailsOpen, setCallDetailsOpen, true)}
          </div>
        </div>
      </dialog>
      {visible &&
        state.mode === 'compact' &&
        (active || state.cleanupPending || (state.phase === 'ended' && !state.error)) &&
        (() => {
          const compactChrome = (
            <section
              ref={compact}
              className={`live-compact live-call-compact${docked ? ' is-docked' : ''}`}
              aria-label="Persistent Aethelios voice controls"
            >
              <div className="live-dock-chrome">
                <div className="live-compact-presence">
                  <LiveCallGlobe
                    state={state}
                    moving={moving}
                    size="compact"
                    readSample={readSample}
                  />
                  {identity}
                </div>
                <LiveCallControls model={controlModel} density="dock" {...controlHandlers} />
              </div>
              <div className="live-dock-recovery">
                {alerts}
                {approvalJobs.length > 0 && active && (
                  <div className="live-dock-approvals" role="status">
                    {approvalJobs.map((job) => (
                      <div key={job.id}>
                        <p className="live-dock-approval-task">{job.task}</p>
                        <div className="live-dock-approval-actions">
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
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {detailsPanel(dockDetailsOpen, setDockDetailsOpen, false)}
              {!docked && transcript ? liveLog : null}
            </section>
          );
          return dock ? createPortal(compactChrome, dock) : compactChrome;
        })()}
    </>
  );
}
