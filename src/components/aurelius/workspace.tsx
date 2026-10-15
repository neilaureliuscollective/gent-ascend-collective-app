'use client';
import { Icon } from '@/components/visual/icon';
import { ConversationArtifacts } from '@/components/live/artifacts';
import { LiveVoiceEntry, useLiveBusy, useLiveSession } from '@/components/live/provider';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useConversationDraft } from './draft-handoff';
import { MissionCapture } from '@/components/missions/mission-capture';
import { CouncilPanel } from './council-panel';
import {
  councilFromVersion,
  councilPromptVersion,
  councilLabel,
  specialistStarters,
  type CouncilSelection,
} from '@/domains/intelligence/council';
import type { Turn, WorkspaceData } from '@/domains/intelligence/types';
import { MemoryEditor, jsonRequest } from './memory-editor';
import { ConversationTurn } from './message';
import { frameText } from './frame-text';
import { useReadingAnchor } from './reading-anchor';
import { readConversationStream } from '@/platform/conversation/read-stream';
import { conversationTiming } from '@/platform/conversation/timing';
import { readTalkDraft, writeTalkDraft, clearTalkDrafts } from '@/platform/conversation/drafts';
import { TalkDrawer, TalkInput, retainComposerFocus } from './talk-controls';
import { BplusMaterial, BplusTalkTools } from '../visual/bplus-material';
import { observedOperation } from '@/platform/visual/operation-adapters';
import {
  intelligenceStatus,
  type IntelligenceOperation,
} from '@/platform/visual/intelligence-motion';
import {
  IntelligenceActivity,
  IntelligenceResponse,
  IntelligencePresence,
} from '../intelligence-motion/presence';
import { TalkPresence } from './talk-presence';
import { AppearanceControls } from '../visual/appearance';
import { ConversationLibrary } from './conversation-library';
import { ContextPanel } from './context-panel';
import { disconnectedWorkspace } from './preview';
import { AureliusPresence } from '../visual/aurelius-presence';
import { routeCapability } from '@/domains/intelligence/capabilities';
import {
  creationsOnTurn,
  readTalkCreationWorkspace,
  type TalkCreationWorkspace,
} from '@/domains/talk-creation/schema';
import { describeSelectedWork, selectionChipLabel } from '@/domains/work-items';
import { attachTalkVoiceDock } from '@/components/live/voice-dock';
import {
  bindTalkSave,
  clearTalkSave,
  matchesTalkSave,
  readTalkSave,
} from '@/domains/talk-creation/pending';
import { idleCreationScope, shouldApplyCreation, shouldContinueWatch, shouldRecoverPending } from '@/domains/talk-creation/scope';
import { CreationDetail } from './creation-detail';
import { liveComposerLimit, liveTextRejection } from '@/domains/live/limits';
import {
  matchesVoiceReconcile,
  voiceWorkspaceApplyAllowed,
  voiceItemsAcknowledged,
  type VoicePersistenceReceipt,
  type VoiceReconcileIdentity,
} from '@/domains/live/receipt';
function priorVersions(turn: Turn, turns: Turn[]) {
  const versions: Turn[] = [];
  let parent = turn.parent_turn_id;
  while (parent && versions.length < 20) {
    const previous = turns.find((item) => item.id === parent);
    if (!previous) break;
    versions.push(previous);
    parent = previous.parent_turn_id;
  }
  return versions;
}

import { TodayActions } from './today-actions';
export function AureliusWorkspace({
  compact = false,
  initialDraft = '',
  initialConversation = null,
}: {
  compact?: boolean;
  initialDraft?: string;
  initialConversation?: string | null;
}) {
  const [preview, setPreview] = useState(false);
  const router = useRouter();
  const composer = useRef<HTMLTextAreaElement>(null);
  const tableReview = useRef<{ open: (asTable?: boolean) => void }>(null);
  const [data, setData] = useState<WorkspaceData | null>(null);
  const [selected, setSelected] = useState<string | null>(initialConversation);
  const handoff = useConversationDraft();
  const [homeDraft] = useState(() =>
    !compact &&
    !initialDraft &&
    !handoff?.peek()?.target &&
    (handoff?.peek()?.conversationId ?? null) === initialConversation
      ? (handoff?.peek() ?? null)
      : null,
  );
  const [draft, setDraft] = useState(initialDraft || homeDraft?.text || '');
  // Incoming handoffs are private in-memory drafts unless explicitly staged by Talk.
  const memoryOnlyDraft = useRef(!!homeDraft && homeDraft.recovery !== 'tab');
  const verifiedDraftOwner = useRef('');
  const voiceReconcile = useRef(0);
  useEffect(() => {
    if (homeDraft && handoff?.peek() === homeDraft) handoff.take(undefined, homeDraft.ownerId);
  }, [homeDraft, handoff]);
  const draftSnapshot = useRef({
    text: draft,
    ownerId: '',
    conversationId: initialConversation,
    memoryOnly: !!homeDraft && homeDraft.recovery !== 'tab',
  });
  useEffect(() => {
    draftSnapshot.current = {
      text: draft,
      ownerId: data?.ownerId ?? '',
      conversationId: selected,
      memoryOnly: memoryOnlyDraft.current,
    };
    if (!compact && data?.ownerId && verifiedDraftOwner.current === data.ownerId)
      writeTalkDraft(data.ownerId, selected, memoryOnlyDraft.current ? '' : draft);
  }, [draft, data?.ownerId, selected, compact]);
  useEffect(
    () => () => {
      const snapshot = draftSnapshot.current;
      if (!compact && snapshot.text && snapshot.ownerId && !handoff?.peek()?.target)
        handoff?.stage({
          text: snapshot.text,
          recovery: snapshot.memoryOnly ? 'memory' : 'tab',
          ownerId: snapshot.ownerId,
          conversationId: snapshot.conversationId ?? undefined,
        });
    },
    [compact, handoff],
  );
  const [councilSelection, setCouncilSelection] = useState<CouncilSelection | null>(null);
  const [busy, setBusy] = useState(false);
  const [operation, setOperation] = useState<IntelligenceOperation>(
    observedOperation('talk-idle', 'ready'),
  );
  const streamTiming = useRef<ReturnType<typeof conversationTiming> | null>(null);
  useLayoutEffect(() => {
    const turn = data?.turns.find((item) => item.id === operation.id);
    if (!turn) return;
    streamTiming.current?.mark('acknowledgement-render');
    if (turn.assistant_text) streamTiming.current?.mark('first-render');
  }, [data?.turns, operation.id]);
  const liveBusy = useLiveBusy();
  const { controller: liveController, state: liveState } = useLiveSession();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [needsReload, setNeedsReload] = useState(false);
  const [tab, setTab] = useState<'conversation' | 'memory' | 'context'>('conversation');
  const [includeContext, setIncludeContext] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [orchestrating, setOrchestrating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [revision, setRevision] = useState<{ sourceTurnId: string; revisionKind: 'edit' } | null>(
    null,
  );
  const generation = useRef<AbortController | null>(null);
  const cancelReply = useRef<(() => void) | null>(null);
  const reading = useRef<AbortController | null>(null);
  const scroll = useRef<HTMLDivElement>(null);
  const follow = useRef(true);
  const rememberReadingPosition = useReadingAnchor(scroll, follow, data !== null);
  const [awayFromLatest, setAwayFromLatest] = useState(false);
  const [creationWorkspace, setCreationWorkspace] = useState<TalkCreationWorkspace | null>(null);
  const [openWorkId, setOpenWorkId] = useState<string | null>(null);
  const [creationError, setCreationError] = useState('');
  const [creationNotice, setCreationNotice] = useState('');
  const [creationBusy, setCreationBusy] = useState(false);
  const [inlineBoardStatus, setInlineBoardStatus] = useState<{
    id: string;
    state: 'pending' | 'saved' | 'failed' | 'stale';
  } | null>(null);
  const [historyCreations, setHistoryCreations] = useState<
    import('@/domains/talk-creation/schema').TalkCreation[]
  >([]);
  const rememberHistory = useCallback(
    (versions: import('@/domains/talk-creation/schema').TalkCreation[]) => {
      setHistoryCreations(versions);
    },
    [],
  );
  const [widePanel, setWidePanel] = useState(false);
  const [workTarget, setWorkTarget] = useState<{ creationId: string; field: string } | null>(null);
  const [attachment, setAttachment] = useState<{
    id: string;
    name: string;
    projectId: string;
  } | null>(null);
  const detailDialog = useRef<HTMLDialogElement>(null);
  const attachInput = useRef<HTMLInputElement>(null);
  const creationRead = useRef<AbortController | null>(null);
  const creationGeneration = useRef(0);
  const imageWatch = useRef(0);
  const imageTimer = useRef<number | null>(null);
  const recoverGeneration = useRef(0);
  const creationScope = useRef(idleCreationScope());
  const stopImageWatch = useCallback(() => {
    imageWatch.current += 1;
    if (imageTimer.current) {
      window.clearTimeout(imageTimer.current);
      imageTimer.current = null;
    }
  }, []);
  const applyCreationWorkspace = useCallback(
    (conversationId: string, owner: string, workspace: TalkCreationWorkspace | null) => {
      if (!shouldApplyCreation(creationScope.current, owner, conversationId)) return;
      setCreationWorkspace(workspace);
    },
    [],
  );
  const watchImages = useCallback(
    (conversationId: string, owner: string) => {
      stopImageWatch();
      const generation = imageWatch.current;
      let delay = 1500;
      const tick = async () => {
        if (
          !shouldContinueWatch(
            imageWatch.current,
            generation,
            creationScope.current,
            owner,
            conversationId,
          )
        )
          return;
        try {
          const response = await fetch(
            `/api/aurelius/creations?conversationId=${conversationId}`,
            { cache: 'no-store' },
          );
          if (
            !shouldContinueWatch(
              imageWatch.current,
              generation,
              creationScope.current,
              owner,
              conversationId,
            )
          )
            return;
          if (!response.ok) return;
          const workspace = readTalkCreationWorkspace(await response.json());
          applyCreationWorkspace(conversationId, owner, workspace);
          const unfinished = (workspace?.images ?? []).filter((item) =>
            ['approval', 'running', 'uncertain'].includes(item.status),
          );
          if (!unfinished.length) return;
        } catch {
          /* A missed poll is not a failed job. Resume while this conversation is open. */
        }
        if (
          !shouldContinueWatch(
            imageWatch.current,
            generation,
            creationScope.current,
            owner,
            conversationId,
          )
        )
          return;
        delay = Math.min(delay * 1.4, 8000);
        imageTimer.current = window.setTimeout(() => void tick(), delay);
      };
      void tick();
    },
    [applyCreationWorkspace, stopImageWatch],
  );
  const loadCreations = useCallback(
    async (conversationId: string | null) => {
      const generation = ++creationGeneration.current;
      const owner = verifiedDraftOwner.current;
      creationScope.current = { owner, conversation: conversationId };
      creationRead.current?.abort();
      const controller = new AbortController();
      creationRead.current = controller;
      if (!conversationId) {
        recoverGeneration.current += 1;
        stopImageWatch();
        setCreationWorkspace(null);
        return;
      }
      try {
        const response = await fetch(`/api/aurelius/creations?conversationId=${conversationId}`, {
          cache: 'no-store',
          signal: controller.signal,
        });
        if (controller.signal.aborted || generation !== creationGeneration.current) return;
        if (verifiedDraftOwner.current && verifiedDraftOwner.current !== owner) return;
        if (!response.ok) {
          applyCreationWorkspace(conversationId, owner, null);
          return;
        }
        const workspace = readTalkCreationWorkspace(await response.json());
        applyCreationWorkspace(conversationId, owner, workspace);
        if (
          workspace?.images.some((item) => ['approval', 'running', 'uncertain'].includes(item.status))
        )
          watchImages(conversationId, owner);
        else stopImageWatch();
      } catch {
        if (!controller.signal.aborted && generation === creationGeneration.current)
          applyCreationWorkspace(conversationId, owner, null);
      }
    },
    [applyCreationWorkspace, stopImageWatch, watchImages],
  );
  const recoverPendingSaves = useCallback(
    async (conversationId: string, owner: string) => {
      const generation = ++recoverGeneration.current;
      const bound = () =>
        shouldRecoverPending(
          creationScope.current,
          owner,
          conversationId,
          recoverGeneration.current,
          generation,
        ) &&
        (!verifiedDraftOwner.current || verifiedDraftOwner.current === owner);
      if (!bound()) return;
      for (const intent of ['revision', 'handoff', 'import'] as const) {
        const pending = readTalkSave(owner, conversationId, intent);
        if (!pending) continue;
        if (!bound()) return;
        setCreationNotice(
          intent === 'import'
            ? 'Finishing the Architect import…'
            : intent === 'handoff'
              ? 'Finishing a prepared Architect package…'
              : 'Finishing a previous save…',
        );
        try {
          await jsonRequest('/api/aurelius/creations', 'POST', {
            ...pending.payload,
            id: pending.id,
          });
          if (!bound()) return;
          if (!matchesTalkSave(owner, conversationId, intent, pending.id)) {
            if (bound()) await loadCreations(conversationId);
            continue;
          }
          if (!bound()) return;
          clearTalkSave(owner, conversationId, intent);
          setCreationNotice(
            intent === 'import'
              ? 'Saved in Architect. Open the project when you are ready.'
              : intent === 'handoff'
                ? 'Prepared for Architect. Review the package, then create the project.'
                : 'Recovered the previous save.',
          );
          if (!bound()) return;
          await loadCreations(conversationId);
        } catch (error) {
          if (!bound()) return;
          const message = error instanceof Error ? error.message : '';
          setCreationNotice(
            /changed|already used|different content/i.test(message)
              ? 'A recovered save conflicts with newer work. Open the work to resolve it.'
              : 'A previous save did not confirm. It is still pending.',
          );
        }
      }
    },
    [loadCreations],
  );
  function rememberConversation(id: string | null) {
    if (compact || !window.location.pathname.endsWith('/aethelios')) return;
    const url = new URL(window.location.href);
    url.searchParams.delete('starter');
    if (id) url.searchParams.set('conversation', id);
    else url.searchParams.delete('conversation');
    window.history.replaceState(window.history.state, '', url);
  }
  const load = useCallback(
    async (id: string | null = null) => {
      recoverGeneration.current += 1;
      reading.current?.abort();
      const controller = new AbortController();
      reading.current = controller;
      try {
        const response = await fetch('/api/aurelius' + (id ? `?conversationId=${id}` : ''), {
          cache: 'no-store',
          signal: controller.signal,
        });
        const result = await response.json();
        if (controller.signal.aborted) return null;
        setError('');
        if (response.status === 401) {
          recoverGeneration.current += 1;
          clearTalkDrafts();
          verifiedDraftOwner.current = '';
          memoryOnlyDraft.current = false;
          setPreview(true);
          setCouncilSelection(null);
          setData(disconnectedWorkspace);
          setSelected(null);
          setDraft('');
          setNeedsReload(false);
          void loadCreations(null);
          return null;
        }
        if (!response.ok) throw new Error(result.error ?? 'Your workspace could not be loaded.');
        setPreview(false);
        const knownOwner = draftSnapshot.current.ownerId || homeDraft?.ownerId;
        const owner = (result as WorkspaceData).ownerId ?? '';
        if (knownOwner && owner !== knownOwner) {
          clearTalkDrafts();
          memoryOnlyDraft.current = false;
          setDraft('');
        }
        verifiedDraftOwner.current = owner;
        if (!compact && id !== draftSnapshot.current.conversationId) {
          memoryOnlyDraft.current = false;
          setDraft(readTalkDraft(owner, id));
        }
        setData(result as WorkspaceData);
        setCouncilSelection(
          councilFromVersion((result as WorkspaceData).turns.at(-1)?.prompt_version ?? ''),
        );
        setSelected(id);
        const boundRecover = recoverGeneration.current;
        void loadCreations(id).then(() => {
          if (recoverGeneration.current !== boundRecover) return;
          if (!id || !owner) return;
          if (!shouldRecoverPending(creationScope.current, owner, id)) return;
          if (verifiedDraftOwner.current && verifiedDraftOwner.current !== owner) return;
          void recoverPendingSaves(id, owner);
        });
        if (!compact && window.location.pathname.endsWith('/aethelios')) {
          const url = new URL(window.location.href);
          if (id) url.searchParams.set('conversation', id);
          else url.searchParams.delete('conversation');
          window.history.replaceState(window.history.state, '', url);
        }
        const unresolved = (result as WorkspaceData).turns.some(
          (turn) => turn.status === 'pending',
        );
        setNeedsReload(unresolved);
        if (unresolved)
          setError(
            'An earlier reply is still unresolved. Reload saved state before sending again.',
          );
        setConfirmDelete(false);
        return result as WorkspaceData;
      } catch (e) {
        if (!controller.signal.aborted) {
          setError(e instanceof Error ? e.message : 'Your workspace could not be loaded.');
          throw e;
        }
        return null;
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    },
    [compact, homeDraft, loadCreations, recoverPendingSaves],
  );
  useEffect(() => {
    const media = window.matchMedia('(min-width: 900px)');
    const sync = () => setWidePanel(media.matches);
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);
  useEffect(() => {
    if (!openWorkId || widePanel) {
      detailDialog.current?.close();
      return;
    }
    if (!detailDialog.current?.open) detailDialog.current?.showModal();
  }, [openWorkId, widePanel]);
  useEffect(() => () => stopImageWatch(), [stopImageWatch]);
  async function refreshMetadata(id: string) {
    reading.current?.abort();
    const controller = new AbortController();
    reading.current = controller;
    try {
      const response = await fetch(`/api/aurelius?conversationId=${id}`, {
        cache: 'no-store',
        signal: controller.signal,
      });
      if (!response.ok) return; // The turn is saved; metadata failure never makes it uncertain.
      const result = (await response.json()) as WorkspaceData;
      if (controller.signal.aborted) return;
      setData((previous) =>
        previous && previous.ownerId === result.ownerId
          ? {
              ...previous,
              conversations: result.conversations,
              currentConversation: result.currentConversation,
              nextConversationCursor: result.nextConversationCursor,
            }
          : previous,
      );
    } catch {
      /* A later explicit read refreshes metadata. Never replay a saved turn. */
    }
  }
  function reload(id: string | null = null) {
    setLoading(true);
    setError('');
    return load(id).then(() => undefined);
  }
  async function updateConversation(id: string, title: string | null, archived: boolean | null) {
    try {
      await jsonRequest('/api/aurelius', 'PATCH', { id, title, archived });
      await reload(selected);
      setNotice(
        archived === true
          ? 'Conversation archived.'
          : archived === false
            ? 'Conversation restored.'
            : 'Title saved.',
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Conversation could not be updated.');
      throw e;
    }
  }
  const olderScroll = useRef<{ height: number; top: number } | null>(null);
  useEffect(() => {
    const el = scroll.current,
      before = olderScroll.current;
    if (el && before) {
      el.scrollTop = before.top + el.scrollHeight - before.height;
      olderScroll.current = null;
    }
  }, [data?.turns, busy, operation.id]);
  async function loadOlder() {
    const first = data?.turns[0];
    if (!selected || !first || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const response = await fetch(
        `/api/aurelius?conversationId=${selected}&before=${encodeURIComponent(first.created_at)}`,
        { cache: 'no-store' },
      );
      const older = (await response.json()) as WorkspaceData;
      if (!response.ok) throw new Error('Older messages could not be loaded.');
      if (scroll.current)
        olderScroll.current = {
          height: scroll.current.scrollHeight,
          top: scroll.current.scrollTop,
        };
      setData((previous) =>
        previous
          ? {
              ...previous,
              turns: [...older.turns, ...previous.turns],
              hasOlderTurns: older.hasOlderTurns,
            }
          : previous,
      );
      follow.current = false;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Older messages could not be loaded.');
    } finally {
      setLoadingOlder(false);
    }
  }
  async function loadMoreConversations() {
    if (!data?.nextConversationCursor) return;
    const response = await fetch(
      `/api/aurelius?listBefore=${encodeURIComponent(data.nextConversationCursor)}`,
      { cache: 'no-store' },
    );
    const more = (await response.json()) as WorkspaceData;
    if (!response.ok) {
      setError('More conversations could not be loaded.');
      return;
    }
    setData((previous) =>
      previous
        ? {
            ...previous,
            conversations: [
              ...previous.conversations,
              ...more.conversations.filter(
                (c) => !previous.conversations.some((p) => p.id === c.id),
              ),
            ],
            nextConversationCursor: more.nextConversationCursor,
          }
        : previous,
    );
  }
  useEffect(() => {
    const controller = new AbortController();
    reading.current = controller;
    void fetch(
      '/api/aurelius' + (initialConversation ? `?conversationId=${initialConversation}` : ''),
      { cache: 'no-store', signal: controller.signal },
    )
      .then(async (response) => {
        if (response.status === 401) return null;
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? 'Your workspace could not be loaded.');
        return result as WorkspaceData;
      })
      .then((result) => {
        if (controller.signal.aborted) return;
        if (!result?.ownerId) {
          clearTalkDrafts();
          verifiedDraftOwner.current = '';
          memoryOnlyDraft.current = false;
          if (homeDraft) setDraft('');
        } else {
          verifiedDraftOwner.current = result.ownerId;
          const stored = !compact ? readTalkDraft(result.ownerId, initialConversation) : '';
          if (homeDraft && result.ownerId !== homeDraft.ownerId) {
            memoryOnlyDraft.current = false;
            setDraft(stored);
          } else if (!initialDraft && !homeDraft) setDraft((current) => current || stored);
          if (result.turns.some((turn) => turn.status === 'pending')) {
            setNeedsReload(true);
            setError(
              'An earlier reply is still unresolved. Reload saved state before sending again.',
            );
          }
        }
        setPreview(result === null);
        if (result === null) setSelected(null);
        setData(result ?? disconnectedWorkspace);
        setCouncilSelection(councilFromVersion(result?.turns.at(-1)?.prompt_version ?? ''));
        const conversation = result && initialConversation ? initialConversation : null;
        const owner = result?.ownerId ?? '';
        const boundRecover = recoverGeneration.current;
        void loadCreations(conversation).then(() => {
          if (controller.signal.aborted) return;
          if (recoverGeneration.current !== boundRecover) return;
          if (!conversation || !owner) return;
          if (!shouldRecoverPending(creationScope.current, owner, conversation)) return;
          if (verifiedDraftOwner.current && verifiedDraftOwner.current !== owner) return;
          void recoverPendingSaves(conversation, owner);
        });
        setLoading(false);
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setError(error instanceof Error ? error.message : 'Your workspace could not be loaded.');
          setLoading(false);
        }
      });
    return () => {
      reading.current?.abort();
      generation.current?.abort();
      creationRead.current?.abort();
      creationGeneration.current += 1;
      recoverGeneration.current += 1;
      stopImageWatch();
      creationScope.current = idleCreationScope();
    };
  }, [initialConversation, homeDraft, initialDraft, compact, loadCreations, recoverPendingSaves, stopImageWatch]);
  useEffect(() => {
    if (follow.current && scroll.current)
      scroll.current.scrollTop = data?.turns.length ? scroll.current.scrollHeight : 0;
  }, [data?.turns, busy, operation.id]);
  async function sendMessage(
    messageText: string,
    replace?: { sourceTurnId: string; revisionKind: 'retry' | 'regenerate' | 'edit' } | null,
    requestedCouncil: CouncilSelection | null = councilSelection,
  ) {
    if (
      generation.current ||
      preview ||
      !data?.configured ||
      !data.canChat ||
      !messageText.trim() ||
      needsReload ||
      data.currentConversation?.archived_at
    )
      return;
    if (liveBusy && liveController) {
      if (['listening', 'speaking'].includes(liveState.phase)) {
        const sent = liveController.text(messageText);
        if (sent.accepted) setDraft('');
        else setError(liveTextRejection(sent.reason));
        return;
      }
      if (liveState.phase === 'connecting') {
        setError('Voice is still connecting. Your draft is unchanged.');
      }
      return;
    }
    reading.current?.abort();
    const id = selected ?? crypto.randomUUID();
    const requestId = crypto.randomUUID();
    const text = messageText.trim();
    const timing = conversationTiming();
    streamTiming.current = timing;
    const controller = new AbortController();
    generation.current = controller;
    setBusy(true);
    setOperation(observedOperation(requestId, 'waiting', 'pending'));
    setError('');
    setNotice(
      requestedCouncil?.kind === 'table'
        ? 'Waiting for the selected Entities…'
        : `Waiting for ${councilLabel(requestedCouncil)}…`,
    );
    follow.current = true;
    timing.mark('acknowledged');
    let accepted = false;
    let saved = false;
    cancelReply.current = () => {
      // Read the request's acknowledgement directly, even before React commits it.
      if (saved) return;
      setOperation(observedOperation(requestId, 'cancelled', 'uncertain'));
      controller.abort();
    };
    const painted = frameText((reply) => {
      setData((previous) =>
        previous
          ? {
              ...previous,
              turns: previous.turns.map((turn) =>
                turn.id === requestId && turn.status === 'pending'
                  ? { ...turn, assistant_text: reply }
                  : turn,
              ),
            }
          : previous,
      );
    });
    const pending: Turn = {
      id: requestId,
      person_id: '',
      conversation_id: id,
      user_text: text,
      assistant_text: '',
      status: 'pending',
      model: data.model,
      context_included: includeContext,
      prompt_version: requestedCouncil ? councilPromptVersion(requestedCouncil) : '',
      feedback: null,
      created_at: new Date().toISOString(),
      finished_at: null,
      parent_turn_id: replace?.sourceTurnId ?? null,
      revision_kind: replace?.revisionKind ?? null,
    };
    setData((previous) =>
      previous ? { ...previous, turns: [...previous.turns, pending] } : previous,
    );
    try {
      const response = await fetch('/api/aurelius/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Aethelios-Motion': '1',
          ...(timing.enabled ? { 'X-Aethelios-Diagnostics': '1' } : {}),
        },
        body: JSON.stringify({
          conversationId: id,
          requestId,
          text,
          includeContext,
          ...replace,
          ...(requestedCouncil ? { council: requestedCouncil } : {}),
          ...(attachment ? { attachmentId: attachment.id } : {}),
          ...(workTarget ? { workTarget } : {}),
        }),
        signal: controller.signal,
      });
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error ?? 'The message could not be sent.');
      }
      accepted = true;
      if (draftSnapshot.current.text === messageText) memoryOnlyDraft.current = false;
      if (!compact && data.ownerId) writeTalkDraft(data.ownerId, selected, '');
      timing.mark('accepted');
      setDraft((current) => (current === messageText ? '' : current));
      setSelected(id);
      rememberConversation(id);
      for await (const item of readConversationStream(response.body)) {
        timing.mark('first-event');
        if (item.type === 'timing') {
          if (timing.enabled)
            window.dispatchEvent(
              new CustomEvent('aethelios:timing', {
                detail: { source: 'server', stage: item.stage, elapsedMs: item.elapsedMs },
              }),
            );
        } else if (item.type === 'activity') {
          if (item.phase === 'saving') painted.finish(true);
          setOperation(observedOperation(requestId, item.phase, 'pending'));
          setNotice(`${intelligenceStatus(observedOperation(requestId, item.phase))}…`);
        } else if (item.type === 'creation') {
          setNotice('Preparing reviewed work…');
        } else if (item.type === 'delta') {
          setNotice('Aethelios is responding…');
          setOperation((previous) =>
            previous.id === requestId && ['searching', 'generating'].includes(previous.phase)
              ? previous
              : observedOperation(requestId, 'generating', 'pending'),
          );
          timing.mark('first-text');
          painted.append(item.text);
        } else if (item.type === 'saved') {
          painted.finish();
          saved = true;
          timing.mark('saved');
          setOperation(observedOperation(requestId, 'complete', 'confirmed'));
          setData((previous) =>
            previous
              ? {
                  ...previous,
                  turns: previous.turns.map((turn) => (turn.id === requestId ? item.turn : turn)),
                }
              : previous,
          );
          if (item.creations?.some((creation) => creation.status === 'stale'))
            setCreationNotice(
              'A newer version was saved while this reply was generating. The proposal was kept for review.',
            );
          if (item.creations?.some((creation) => creation.status === 'stale-lost'))
            setCreationNotice(
              'A newer version was saved while this reply was generating. The proposal could not be stored.',
            );
          break; // A durable receipt is terminal; do not wait for transport EOF.
        } else if (item.type === 'error') throw new Error(item.message);
      }
      if (!saved) throw new Error('The connection ended before the save was confirmed.');
      setRevision(null);
      setNotice('Reply saved.');
      setAttachment(null);
      void loadCreations(id);
      // The saved receipt owns completion. Metadata refresh cannot hold the next request.
      void refreshMetadata(id);
    } catch (e) {
      if (accepted && !saved) setDraft((current) => current || messageText);
      if (!accepted)
        setData((previous) =>
          previous
            ? { ...previous, turns: previous.turns.filter((turn) => turn.id !== requestId) }
            : previous,
        );
      setOperation(
        observedOperation(
          requestId,
          saved ? 'complete' : controller.signal.aborted ? 'cancelled' : 'failed',
          saved ? 'confirmed' : 'uncertain',
        ),
      );
      setError(
        saved
          ? 'Reply saved. Reload to refresh the conversation.'
          : controller.signal.aborted
            ? 'Reply stopped. Reload to check what was saved.'
            : e instanceof Error
              ? e.message
              : 'The reply could not be confirmed.',
      );
      setNeedsReload(true);
      setNotice('');
    } finally {
      timing.mark('ended');
      painted.finish(!saved);
      if (generation.current === controller) {
        generation.current = null;
        cancelReply.current = null;
        setBusy(false);
      }
    }
  }
  async function feedback(id: string, value: 'helpful' | 'needs_work') {
    try {
      await jsonRequest('/api/aurelius/feedback', 'POST', { id, feedback: value });
      setData((previous) =>
        previous
          ? {
              ...previous,
              turns: previous.turns.map((t) => (t.id === id ? { ...t, feedback: value } : t)),
            }
          : previous,
      );
      setNotice('Feedback saved for review. This does not retrain the model automatically.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Feedback could not be saved.');
    }
  }
  async function deleteConversation() {
    if (!selected) return;
    setDeleting(true);
    try {
      await jsonRequest('/api/aurelius', 'DELETE', { id: selected });
      if (data?.ownerId) writeTalkDraft(data.ownerId, selected, '');
      await reload();
      memoryOnlyDraft.current = false;
      setDraft('');
      setNotice(
        'Conversation deleted. Confirmed memories and daily actions remain in their own records.',
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Deletion could not be confirmed.');
    } finally {
      setDeleting(false);
    }
  }
  function adoptLiveConversation(id: string) {
    setSelected(id);
    rememberConversation(id);
  }
  const liveOwner = useRef<string>('');
  useEffect(() => {
    if (liveBusy && liveState.conversationId && selected && liveState.conversationId !== selected)
      void liveController?.end('Voice ended because you opened another conversation.');
    if (liveState.conversationId && selected && liveState.conversationId !== selected)
      voiceReconcile.current += 1;
  }, [liveBusy, liveState.conversationId, selected, liveController]);
  useEffect(() => {
    if (preview && liveBusy)
      void liveController?.end('Voice ended because the session is no longer signed in.');
  }, [preview, liveBusy, liveController]);
  useEffect(() => {
    const owner = data?.ownerId ?? '';
    const previous = liveOwner.current;
    if (owner) liveOwner.current = owner;
    if (previous && owner && previous !== owner) {
      voiceReconcile.current += 1;
      if (liveBusy) void liveController?.end('Voice ended because the signed-in account changed.');
      liveController?.invalidateTranscript();
    }
  }, [data?.ownerId, liveBusy, liveController]);
  useEffect(() => {
    if (compact) return;
    const onPop = () => {
      if (!window.location.pathname.endsWith('/aethelios')) return;
      const raw = new URL(window.location.href).searchParams.get('conversation');
      const next =
        raw &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(raw)
          ? raw
          : null;
      if (next === selected) return;
      if (liveBusy && liveState.conversationId && liveState.conversationId !== next)
        void liveController?.end('Voice ended because you opened another conversation.');
      void load(next).catch(() => {});
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [compact, selected, liveBusy, liveState.conversationId, liveController, load]);
  const previousLivePhase = useRef(liveState.phase);
  const ownerId = data?.ownerId;
  useEffect(() => {
    voiceReconcile.current += 1;
  }, [ownerId, liveState.conversationId, liveState.sessionId, liveState.persistenceEpoch]);
  const reconcileVoiceHistory = useCallback(
    async (input: VoiceReconcileIdentity & { itemIds: string[] }) => {
      const token = ++voiceReconcile.current;
      const stillCurrent = () =>
        token === voiceReconcile.current &&
        matchesVoiceReconcile(ownerId && liveController ? liveController.voiceIdentity(ownerId) : null, input);
      if (!stillCurrent()) return;
      liveController?.markPersistence('pending', input);
      setNotice('Saving the voice turns…');
      for (let attempt = 0; attempt < 8; attempt++) {
        if (!stillCurrent()) return;
        try {
          const response = await fetch(
            `/api/aethelios/live/receipt?conversationId=${input.conversationId}&sessionId=${input.sessionId}`,
            { cache: 'no-store' },
          );
          if (!stillCurrent()) return;
          if (response.ok) {
            const receipt = (await response.json()) as VoicePersistenceReceipt;
            if (!stillCurrent()) return;
            if (
              receipt.ownerId !== input.ownerId ||
              receipt.conversationId !== input.conversationId ||
              receipt.sessionId !== input.sessionId
            )
              return;
            liveController?.markSavedItems(
              receipt.bindings.map((item) => item.providerItemId),
              input,
            );
            if (voiceItemsAcknowledged(input.itemIds, receipt.bindings)) {
              if (!stillCurrent()) return;
              liveController?.acknowledgePersistence(input.sessionId, input.epoch);
              setNotice('');
              if (selected === input.conversationId && ownerId === input.ownerId) {
                const workspace = await fetch(
                  `/api/aurelius?conversationId=${input.conversationId}`,
                  { cache: 'no-store' },
                );
                if (!stillCurrent()) return;
                if (workspace.ok) {
                  const next = (await workspace.json()) as WorkspaceData;
                  if (!stillCurrent()) return;
                  if (
                    !voiceWorkspaceApplyAllowed(
                      ownerId && liveController ? liveController.voiceIdentity(ownerId) : null,
                      input,
                      selected,
                      next.ownerId,
                    )
                  )
                    return;
                  setData((current) =>
                    stillCurrent() &&
                    voiceWorkspaceApplyAllowed(
                      ownerId && liveController ? liveController.voiceIdentity(ownerId) : null,
                      input,
                      selected,
                      next.ownerId,
                    ) &&
                    current &&
                    selected === input.conversationId
                      ? { ...current, turns: next.turns, conversations: next.conversations }
                      : current,
                  );
                }
              }
              return;
            }
          }
        } catch {
          /* Keep polling until the timeout. */
        }
        await new Promise((resolve) => setTimeout(resolve, 750));
      }
      if (!stillCurrent()) return;
      liveController?.markPersistence('uncertain', input);
      setNotice('Voice ended. Some turns may still be saving. Reload if they appear later.');
    },
    [liveController, ownerId, selected],
  );
  useEffect(() => {
    const wasActive = ['connecting', 'listening', 'speaking'].includes(previousLivePhase.current);
    previousLivePhase.current = liveState.phase;
    if (!wasActive || !['ended', 'error', 'idle'].includes(liveState.phase)) return;
    const conversationId = liveState.conversationId;
    const sessionId = liveState.sessionId;
    if (!conversationId || !sessionId || !ownerId) return;
    const itemIds = liveState.transcript
      .filter((line) => line.role === 'user' && line.text)
      .map((line) => line.id);
    const epoch = liveState.persistenceEpoch;
    const timer = window.setTimeout(() => {
      void reconcileVoiceHistory({
        ownerId,
        conversationId,
        sessionId,
        epoch,
        itemIds,
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [
    ownerId,
    liveState.conversationId,
    liveState.persistenceEpoch,
    liveState.phase,
    liveState.sessionId,
    liveState.transcript,
    reconcileVoiceHistory,
  ]);
  useEffect(() => {
    return () => {
      voiceReconcile.current += 1;
    };
  }, []);
  function newConversation() {
    voiceReconcile.current += 1;
    if (liveBusy) void liveController?.end('Voice ended because you started a new conversation.');
    liveController?.invalidateTranscript();
    recoverGeneration.current += 1;
    creationGeneration.current += 1;
    creationRead.current?.abort();
    stopImageWatch();
    creationScope.current = idleCreationScope(verifiedDraftOwner.current);
    memoryOnlyDraft.current = false;
    if (!compact && data?.ownerId) writeTalkDraft(data.ownerId, selected, '');
    setOperation(observedOperation('talk-idle', 'ready'));
    setSelected(null);
    setCouncilSelection(null);
    rememberConversation(null);
    setAwayFromLatest(false);
    setData((previous) =>
      previous ? { ...previous, turns: [], currentConversation: null } : previous,
    );
    setDraft('');
    setNeedsReload(false);
    setConfirmDelete(false);
    setError('');
    setNotice('');
    setTab('conversation');
    setRevision(null);
    void loadCreations(null);
    setOpenWorkId(null);
    setAttachment(null);
    follow.current = true;
    composer.current?.focus();
  }
  async function openWork(id: string) {
    setOpenWorkId(id);
    setCreationError('');
    setCreationNotice('');
  }
  async function saveOpenCreation(kind: 'brief' | 'plan' | 'palette' | 'board' | 'handoff', content: unknown) {
    if (!selected || !openWorkId || !data?.ownerId) return;
    const current = creationWorkspace?.creations.find(
      (item) =>
        item.kind === kind &&
        (item.lineage_id === openCreation?.lineage_id || item.id === openWorkId) &&
        !item.superseded_by &&
        !item.candidate,
    );
    const payload = {
      conversationId: selected,
      kind,
      predecessorId: current?.id ?? null,
      sourceTurnId: current?.source_turn_id ?? openCreation?.source_turn_id ?? null,
      content,
    };
    const bound = bindTalkSave(data.ownerId, selected, 'revision', payload);
    recoverGeneration.current += 1;
    setCreationBusy(true);
    setCreationError('');
    try {
      const saved = (await jsonRequest('/api/aurelius/creations', 'POST', {
        ...bound.payload,
        id: bound.id,
      })) as { id: string };
      if (matchesTalkSave(data.ownerId, selected, 'revision', bound.id))
        clearTalkSave(data.ownerId, selected, 'revision');
      setOpenWorkId(saved.id);
      setCreationNotice('New version saved.');
      await loadCreations(selected);
    } catch (error) {
      setCreationError(error instanceof Error ? error.message : 'This work could not be saved.');
    } finally {
      setCreationBusy(false);
    }
  }
  async function commitInlineBoard(
    creationId: string,
    content: import('@/domains/talk-creation/design-board').DesignBoardContent,
  ) {
    if (!selected || !data?.ownerId) return;
    const current = creationWorkspace?.creations.find(
      (item) => item.id === creationId && item.kind === 'board' && !item.superseded_by && !item.candidate,
    );
    if (!current) {
      setInlineBoardStatus({ id: creationId, state: 'failed' });
      return;
    }
    const payload = {
      conversationId: selected,
      kind: 'board' as const,
      predecessorId: current.id,
      sourceTurnId: current.source_turn_id,
      content,
    };
    const bound = bindTalkSave(data.ownerId, selected, 'revision', payload);
    setInlineBoardStatus({ id: creationId, state: 'pending' });
    setCreationBusy(true);
    try {
      const saved = (await jsonRequest('/api/aurelius/creations', 'POST', {
        ...bound.payload,
        id: bound.id,
      })) as { id: string };
      if (matchesTalkSave(data.ownerId, selected, 'revision', bound.id))
        clearTalkSave(data.ownerId, selected, 'revision');
      setInlineBoardStatus({ id: saved.id, state: 'saved' });
      await loadCreations(selected);
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      setInlineBoardStatus({
        id: creationId,
        state: /stale|changed/i.test(message) ? 'stale' : 'failed',
      });
      setCreationError(message || 'The selected direction could not be saved.');
    } finally {
      setCreationBusy(false);
    }
  }
  async function keepProposal(id = openWorkId) {
    if (!selected || !id || !data?.ownerId) return;
    const candidate = creationWorkspace?.creations.find((item) => item.id === id && item.candidate);
    if (!candidate || candidate.kind === 'handoff') {
      setCreationError('This proposal is no longer available.');
      return;
    }
    const current = creationWorkspace?.creations.find(
      (item) => item.kind === candidate.kind && !item.superseded_by && !item.candidate,
    );
    if (!current) {
      setCreationError('The current version is no longer available. The proposal was not applied.');
      return;
    }
    const payload = {
      conversationId: selected,
      kind: candidate.kind,
      predecessorId: current.id,
      sourceTurnId: candidate.source_turn_id,
      content: candidate.content,
    };
    const bound = bindTalkSave(data.ownerId, selected, 'revision', payload);
    recoverGeneration.current += 1;
    setCreationBusy(true);
    setCreationError('');
    try {
      const saved = (await jsonRequest('/api/aurelius/creations', 'POST', {
        ...bound.payload,
        id: bound.id,
      })) as { id: string };
      if (matchesTalkSave(data.ownerId, selected, 'revision', bound.id))
        clearTalkSave(data.ownerId, selected, 'revision');
      setOpenWorkId(saved.id);
      setCreationNotice('Proposal kept as a new version.');
      await loadCreations(selected);
    } catch (error) {
      setCreationError(
        error instanceof Error ? error.message : 'This proposal could not be applied to the current version.',
      );
    } finally {
      setCreationBusy(false);
    }
  }
  async function selectOpenCreation(id = openWorkId) {
    if (!selected || !id) return;
    setOpenWorkId(id);
    setCreationBusy(true);
    try {
      const image = creationWorkspace?.images.find((item) => item.id === id);
      if (image) {
        await jsonRequest('/api/aethelios/artifacts', 'PATCH', {
          conversationId: selected,
          artifactId: id,
        });
      } else {
        await jsonRequest('/api/aurelius/creations', 'PATCH', {
          conversationId: selected,
          creationId: id,
        });
      }
      setCreationNotice('This version is selected.');
      await loadCreations(selected);
    } catch (error) {
      setCreationError(error instanceof Error ? error.message : 'Selection could not be saved.');
    } finally {
      setCreationBusy(false);
    }
  }
  async function approveTalkImage(id: string, approve: boolean) {
    setCreationBusy(true);
    setCreationError('');
    try {
      await jsonRequest('/api/aurelius/creations', 'PATCH', {
        id,
        approve,
        acknowledgeCost: true,
      });
      setCreationNotice(
        approve
          ? 'Generation reserved. The image is saved only after Studio finishes.'
          : 'Image request declined.',
      );
      await loadCreations(selected);
      if (approve && selected && data?.ownerId) watchImages(selected, data.ownerId);
    } catch (error) {
      setCreationError(error instanceof Error ? error.message : 'Image review could not be saved.');
    } finally {
      setCreationBusy(false);
    }
  }
  async function prepareArchitectPackage(input: {
    idea: string;
    discipline: 'business' | 'application' | 'product' | 'custom';
    decisions: string;
  }) {
    if (!selected || !data?.ownerId) return;
    const selectedIds = Object.entries(creationWorkspace?.selected ?? {})
      .filter(([kind, id]) => Boolean(id) && kind !== 'board')
      .map(([, id]) => id as string);
    if (!selectedIds.length) {
      setCreationError(
        creationWorkspace?.selected.board
          ? 'Design boards transfer through the Architect design-direction review, not v1 text import.'
          : 'Select a brief, plan or palette before preparing Architect.',
      );
      return;
    }
    const payload = {
      conversationId: selected,
      discipline: input.discipline,
      idea: input.idea,
      decisions: input.decisions,
      creationIds: selectedIds,
      imageIds: creationWorkspace?.selectedImageId ? [creationWorkspace.selectedImageId] : [],
    };
    const bound = bindTalkSave(data.ownerId, selected, 'handoff', payload);
    recoverGeneration.current += 1;
    setCreationBusy(true);
    setCreationError('');
    try {
      const saved = (await jsonRequest('/api/aurelius/creations', 'POST', {
        ...bound.payload,
        id: bound.id,
      })) as { id?: string; content?: { imported?: boolean } };
      if (matchesTalkSave(data.ownerId, selected, 'handoff', bound.id))
        clearTalkSave(data.ownerId, selected, 'handoff');
      setCreationNotice(
        saved.content?.imported
          ? 'Saved in Architect. Open the project when you are ready.'
          : 'Prepared for Architect. Review the package, then create the project.',
      );
      handoff?.stage({
        text: input.idea,
        ownerId: data.ownerId,
        target: 'architect',
        conversationId: selected,
        payload: saved,
      });
      await loadCreations(selected);
    } catch (error) {
      setCreationError(error instanceof Error ? error.message : 'The Architect package could not be saved.');
    } finally {
      setCreationBusy(false);
    }
  }
  async function importArchitectPackage(handoffId: string) {
    if (!selected || !data?.ownerId) return;
    const payload = {
      action: 'import-origin' as const,
      handoffId,
      conversationId: selected,
    };
    const bound = bindTalkSave(data.ownerId, selected, 'import', payload);
    recoverGeneration.current += 1;
    setCreationBusy(true);
    setCreationError('');
    try {
      const saved = (await jsonRequest('/api/aurelius/creations', 'POST', {
        ...bound.payload,
        id: bound.id,
      })) as { imported?: boolean; projectId?: string };
      if (matchesTalkSave(data.ownerId, selected, 'import', bound.id))
        clearTalkSave(data.ownerId, selected, 'import');
      setCreationNotice(
        saved.imported
          ? 'Saved in Architect. Open the project when you are ready.'
          : 'The package is still prepared. Architect did not confirm a project.',
      );
      await loadCreations(selected);
    } catch (error) {
      setCreationError(
        error instanceof Error ? error.message : 'Architect could not save this project.',
      );
    } finally {
      setCreationBusy(false);
    }
  }
  async function attachImage(file: File) {
    const mediaType =
      file.type === 'image/png' || file.type === 'image/jpeg' || file.type === 'image/webp'
        ? file.type
        : null;
    if (!mediaType) {
      setError('Choose a PNG, JPEG, or WebP image smaller than 10 MB.');
      return;
    }
    try {
      const prepared = (await jsonRequest('/api/aurelius/attachments', 'POST', {
        action: 'prepare',
        mediaType,
        byteSize: file.size,
      })) as {
        id: string;
        projectId: string;
        path: string;
        token: string;
        url: string;
        publishableKey: string;
      };
      const { createClient } = await import('@supabase/supabase-js');
      const transferred = await createClient(prepared.url, prepared.publishableKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
        .storage.from('aethelios-studio')
        .uploadToSignedUrl(prepared.path, prepared.token, file, {
          contentType: mediaType,
          upsert: false,
        });
      if (transferred.error) throw new Error('The image could not be uploaded.');
      await jsonRequest('/api/aurelius/attachments', 'POST', {
        action: 'complete',
        projectId: prepared.projectId,
        id: prepared.id,
        mediaType,
      });
      setAttachment({ id: prepared.id, name: file.name, projectId: prepared.projectId });
      setNotice('Image attached for analysis. Generation still requires an explicit request.');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'The image could not be attached.');
      setAttachment(null);
    }
  }
  const blocked = busy || loading || deleting || orchestrating || creationBusy;
  const openCreation =
    creationWorkspace?.creations.find((item) => item.id === openWorkId) ??
    historyCreations.find((item) => item.id === openWorkId) ??
    null;
  const openImage = creationWorkspace?.images.find((item) => item.id === openWorkId) ?? null;
  const capability = routeCapability(draft.trim() || data?.turns.at(-1)?.user_text || '');

  async function prepareCapability() {
    if (
      !capability ||
      !data?.ownerId ||
      !['performance', 'studio', 'presence'].includes(capability.id) ||
      orchestrating
    )
      return;
    const text = draft.trim() || data.turns.at(-1)?.user_text || '';
    if (!text) return;
    setOrchestrating(true);
    setOperation(observedOperation('talk-prepare', 'processing'));
    setError('');
    setNotice(`Preparing ${capability.label}…`);
    try {
      const response = await fetch('/api/aurelius/orchestrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target: capability.id,
          text,
          conversationId: selected ?? undefined,
          creationIds: Object.values(creationWorkspace?.selected ?? {}).filter(Boolean),
        }),
        signal: AbortSignal.timeout(30000),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error ?? `${capability.label} could not be prepared.`);
      if (result.ownerId !== data.ownerId)
        throw new Error('Account changed. Reopen Aethelios before continuing.');
      setOperation(observedOperation('talk-prepare', 'complete'));
      handoff?.stage({ text, ownerId: data.ownerId, target: capability.id, payload: result });
      router.push(capability.href);
    } catch (cause) {
      setOperation(observedOperation('talk-prepare', 'failed'));
      setError(
        cause instanceof Error ? cause.message : `${capability.label} could not be prepared.`,
      );
      setNotice('');
    } finally {
      setOrchestrating(false);
    }
  }
  if (!data)
    return (
      <div className="aurelius-unavailable">
        <span className="orb large" aria-hidden="true" />
        <h3>A clearer perspective.</h3>
        {error ? (
          <p role="alert">{error}</p>
        ) : (
          <IntelligenceActivity operation={observedOperation('talk-load', 'loading')} />
        )}
        {!loading && (
          <>
            <Link href="/app/you" className="button">
              Your account
            </Link>
            <button className="text-button" onClick={() => void reload().catch(() => {})}>
              Try again
            </button>
          </>
        )}
      </div>
    );
  return (
    <div
      data-bplus={compact ? undefined : 'talk'}
      className={`aurelius-layout talk-layout ${compact ? 'compact-layout' : ''} ${
        !data.turns.length && !busy ? 'is-new-conversation' : 'is-active-conversation'
      }`}
    >
      <div className={`aurelius-workspace ${compact ? 'compact' : ''}`}>
        <div className="talk-toolbar imperial-control-surface">
          <LiveVoiceEntry
            conversationId={selected}
            includeContext={includeContext}
            disabled={busy || preview || !data.canChat}
            onAdoptConversation={adoptLiveConversation}
          />
          <TalkPresence
            operation={loading ? observedOperation('talk-load', 'loading') : operation}
            state={
              busy
                ? 'working'
                : needsReload
                  ? 'stopped'
                  : preview || !data.configured
                    ? 'disconnected'
                    : 'ready'
            }
          />
          {!compact && (
            <TalkDrawer label="Conversations" triggerContent={<span aria-hidden="true">☰</span>}>
              {(close) => (
                <>
                  <ConversationLibrary
                    conversations={data.conversations}
                    selected={selected}
                    disabled={blocked}
                    preview={preview}
                    onSelect={(id) => {
                      setTab('conversation');
                      if (
                        draft.trim() &&
                        !confirm('Discard the unsent draft and switch conversations?')
                      )
                        return;
                      close();
                      memoryOnlyDraft.current = false;
                      if (data.ownerId) writeTalkDraft(data.ownerId, selected, '');
                      setDraft('');
                      follow.current = true;
                      void reload(id).catch(() => {});
                    }}
                    onNew={() => {
                      if (
                        draft.trim() &&
                        !confirm('Discard the unsent draft and start a new conversation?')
                      )
                        return;
                      newConversation();
                      close();
                    }}
                    onRename={(id, title) => updateConversation(id, title, null)}
                    onArchive={(id, archived) => updateConversation(id, null, archived)}
                    nextCursor={data.nextConversationCursor}
                    onMore={loadMoreConversations}
                  />
                </>
              )}
            </TalkDrawer>
          )}
          <div className="talk-title">
            {!compact && <h1>Aethelios</h1>}
            <span>
              {selected ? data.currentConversation?.title || 'Conversation' : 'New conversation'}
            </span>
          </div>
          <BplusTalkTools enabled={!compact}>
            <button
              type="button"
              className="talk-tool"
              disabled={blocked}
              onClick={() => {
                if (
                  !draft.trim() ||
                  confirm('Discard the unsent draft and start a new conversation?')
                )
                  newConversation();
              }}
            >
              New
            </button>
            <TalkDrawer
              label="Tools & context"
              triggerContent={<span aria-hidden="true">•••</span>}
            >
              <nav className="talk-destinations" aria-label="Aethelios destinations">
                {[
                  ['/app', 'Home'],
                  ['/app/work', 'Work'],
                  ['/app/architect', 'Architect'],
                  ['/app/studio', 'Studio'],
                  ['/app/missions', 'Missions'],
                  ['/app/entities', 'Council'],
                  ['/app/health', 'Health'],
                  ['/app/lifestyle', 'Lifestyle'],
                  ['/app/ecosystem', 'Ecosystem'],
                  ['/app/you', 'Your account'],
                  ['/app/aethelios/meet', 'Meet Aethelios'],
                ].map(([href, label]) => (
                  <Link key={href} href={href!} prefetch={false}>
                    {label}
                  </Link>
                ))}
              </nav>
              <ConversationArtifacts conversationId={selected} />
              <div className="talk-attachment-tools">
                <input
                  ref={attachInput}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  hidden
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = '';
                    if (file) void attachImage(file);
                  }}
                />
                <button
                  type="button"
                  className="text-button"
                  disabled={blocked || preview || !data.canChat}
                  onClick={() => attachInput.current?.click()}
                >
                  Attach an image for analysis
                </button>
                <p className="quiet-label">
                  PNG, JPEG or WebP under 10 MB. Pixels are sent only with the next message, for
                  analysis, not automatic generation.
                </p>
              </div>
              <AppearanceControls />
              {!preview && (
                <div className="intelligence-work-access">
                  <MissionCapture
                    conversationId={selected}
                    objective={data.turns.find((t) => t.status === 'complete')?.user_text ?? ''}
                    disabled={
                      blocked || needsReload || Boolean(data.currentConversation?.archived_at)
                    }
                  />
                </div>
              )}
              {!preview && (
                <div className="talk-council-access">
                  <button
                    type="button"
                    className="text-button"
                    disabled={blocked}
                    onClick={() => tableReview.current?.open(false)}
                  >
                    Meet the Intelligence Team
                  </button>
                  <button
                    type="button"
                    className="text-button"
                    disabled={blocked || !draft.trim()}
                    onClick={() => tableReview.current?.open(true)}
                  >
                    Assemble Around This
                  </button>
                  {councilSelection && (
                    <button
                      type="button"
                      className="text-button"
                      disabled={blocked}
                      onClick={() => setCouncilSelection(null)}
                    >
                      Return to Aethelios
                    </button>
                  )}
                </div>
              )}

              <div className="aurelius-tabs" role="group" aria-label="Aethelios workspace">
                <button
                  aria-pressed={tab === 'conversation'}
                  onClick={() => setTab('conversation')}
                >
                  Conversation
                </button>
                <button aria-pressed={tab === 'memory'} onClick={() => setTab('memory')}>
                  Memory
                </button>
                <button aria-pressed={tab === 'context'} onClick={() => setTab('context')}>
                  Context
                </button>
              </div>
              {tab === 'memory' ? (
                <MemoryEditor
                  memories={data.memories}
                  onChanged={() => reload(selected)}
                  disabled={blocked || preview}
                  preview={preview}
                />
              ) : tab === 'context' ? (
                <ContextPanel data={data} preview={preview} included={includeContext} />
              ) : (
                <>
                  <div
                    className={`conversation-controls ${compact ? '' : 'full-conversation-controls'}`}
                  >
                    {compact ? (
                      <>
                        <label className="sr-only" htmlFor="conversation-choice">
                          Saved conversations
                        </label>
                        <select
                          id="conversation-choice"
                          value={selected ?? ''}
                          disabled={blocked}
                          onChange={(e) => {
                            follow.current = true;
                            void reload(e.target.value || null).catch(() => {});
                          }}
                        >
                          <option value="">New conversation</option>
                          {selected && !data.conversations.some((c) => c.id === selected) && (
                            <option value={selected}>Current conversation</option>
                          )}
                          {data.conversations.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.title}
                            </option>
                          ))}
                        </select>
                        <button
                          className="secondary-button"
                          disabled={blocked}
                          onClick={newConversation}
                        >
                          New
                        </button>
                      </>
                    ) : (
                      <span className="conversation-title">
                        {selected
                          ? data.currentConversation?.title ||
                            data.conversations.find((c) => c.id === selected)?.title ||
                            'Current conversation'
                          : 'A space to think clearly.'}
                      </span>
                    )}
                    {selected && (
                      <button
                        className="text-button"
                        disabled={blocked}
                        onClick={() => setConfirmDelete(true)}
                      >
                        Delete conversation
                      </button>
                    )}
                  </div>
                  {confirmDelete && (
                    <div className="confirm-row">
                      <p>
                        Delete this conversation and its messages? Confirmed memories and daily
                        actions remain separate.
                      </p>
                      <button
                        className="secondary-button"
                        disabled={blocked}
                        onClick={() => void deleteConversation()}
                      >
                        Confirm delete
                      </button>
                      <button className="text-button" onClick={() => setConfirmDelete(false)}>
                        Keep conversation
                      </button>
                    </div>
                  )}
                  {!preview && (
                    <TodayActions
                      brief={data.context.dailyBrief}
                      disabled={blocked}
                      onChanged={() => reload(selected)}
                    />
                  )}
                </>
              )}
              <label className="context-toggle">
                <input
                  type="checkbox"
                  checked={includeContext}
                  disabled={blocked}
                  onChange={(e) => setIncludeContext(e.target.checked)}
                />
                Use personal context
              </label>
              {!compact && !preview && (
                <p className="quiet-label">
                  Drafts started in Talk can recover in this tab for up to 24 hours, only for the
                  same signed-in account and conversation. Home drafts and their edits stay in
                  memory and disappear on reload. Nothing is sent automatically. Signing out or
                  changing account clears local recovery drafts. Browser storage may be unavailable.
                </p>
              )}
              <details className="composer-privacy">
                <summary>What Aethelios receives</summary>
                <p className="composer-disclosure">
                  {preview ? (
                    'Explore the workspace. Drafts stay in this open view; sending and saving require sign-in and a model connection.'
                  ) : (
                    <>
                      Sending shares this conversation’s recent messages
                      {councilSelection ? ' with the selected specialists' : ''}
                      {includeContext
                        ? `, profile, active goal, confirmed memories, daily records and relevant training summaries and Presence records`
                        : ''}{' '}
                      with our AI service. Read-only web research may consult public sources;
                      returned sources are linked in saved replies. Nothing is automatically added
                      to memory.
                    </>
                  )}
                </p>
              </details>
            </TalkDrawer>
          </BplusTalkTools>
        </div>
        {!preview && (
          <CouncilPanel
            hideAccess
            founder={Boolean(data.founderAccess)}
            reviewRef={tableReview}
            question={draft.trim() || data.turns.at(-1)?.user_text || ''}
            selection={councilSelection}
            disabled={
              blocked ||
              needsReload ||
              !data.canChat ||
              !data.configured ||
              Boolean(data.currentConversation?.archived_at)
            }
            includeContext={includeContext}
            onSelect={setCouncilSelection}
            onFocused={(id) => {
              newConversation();
              setCouncilSelection({ kind: 'specialist', specialists: [id] });
              setDraft(specialistStarters[id]);
              composer.current?.focus();
            }}
            onAssemble={(question, selection) => {
              setCouncilSelection(selection);
              void sendMessage(question, revision, selection);
            }}
          />
        )}
        {preview && (
          <div className="workspace-preview-note">
            <p>Sign in to use your Aethelios workspace.</p>
            <Link href="/app/you">Your account →</Link>
          </div>
        )}
        {error && (
          <div role="alert" className="form-feedback error">
            <p>{error}</p>
            <button
              className="text-button"
              disabled={busy}
              onClick={() => void reload(selected).catch(() => {})}
            >
              Reload saved state
            </button>
          </div>
        )}
        <>
          <div className="talk-creation-stage">
          <div
            className="conversation-scroll"
            ref={scroll}
            onScroll={() => {
              const el = scroll.current;
              if (el) {
                follow.current = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
                setAwayFromLatest(!follow.current);
                rememberReadingPosition();
              }
            }}
            aria-label="Conversation messages"
            aria-busy={busy}
          >
            {data.hasOlderTurns && (
              <button
                type="button"
                className="secondary-button older-messages"
                disabled={loadingOlder}
                onClick={() => void loadOlder()}
              >
                {loadingOlder ? 'Loading…' : 'Load older messages'}
              </button>
            )}
            {!data.turns.length && !busy ? (
              <div className="aurelius-welcome">
                <div className="welcome-heading">
                  {compact ? (
                    <AureliusPresence
                      state={
                        busy ? 'working' : preview || !data.configured ? 'disconnected' : 'ready'
                      }
                    />
                  ) : (
                    <div
                      className="talk-welcome-presence"
                      data-state={preview || !data.configured ? 'disconnected' : 'ready'}
                      aria-hidden="true"
                    >
                      <IntelligencePresence
                        variant="signal"
                        size="large"
                        operation={observedOperation('talk-welcome', 'ready')}
                      />
                    </div>
                  )}

                  <div>
                    <p className="eyebrow">Aethelios · Your central intelligence</p>
                    <h2>What would you like to move forward?</h2>
                    <Link
                      className="text-link aethelios-meet-link"
                      href="/app/aethelios/meet"
                      onClick={(event) => {
                        if (compact) event.currentTarget.closest('dialog')?.close();
                      }}
                    >
                      Meet Aethelios →
                    </Link>
                  </div>
                </div>
                <p>Share an idea, a question or the work ahead. We’ll find the next useful step.</p>
                <div className="conversation-starters">
                  {[
                    {
                      label: 'Pressure-test an idea',
                      draft:
                        'I have an idea to pressure-test. Help me turn it into a clear decision.',
                    },
                    {
                      label: 'Shape a creative brief',
                      draft:
                        'I need to create something. Help me shape the brief and a useful first draft.',
                    },
                    {
                      label: 'Move a project forward',
                      draft:
                        'I have a project to move forward. Help me identify the next concrete action.',
                    },
                    {
                      label: 'Develop a brand',
                      draft: 'Help me develop a premium brand and website.',
                    },
                  ].map((suggestion) => (
                    <button
                      key={suggestion.label}
                      onClick={() => {
                        setDraft(suggestion.draft);
                        composer.current?.focus();
                      }}
                      disabled={blocked}
                    >
                      {suggestion.label}
                      <span aria-hidden="true">
                        <Icon name="arrow-up-right" className="action-icon" />
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              data.turns
                .filter((turn) => !data.turns.some((newer) => newer.parent_turn_id === turn.id))
                .map((turn) => (
                  <ConversationTurn
                    key={turn.id}
                    turn={turn}
                    operation={turn.id === operation.id ? operation : undefined}
                    onFeedback={(id, value) => void feedback(id, value)}
                    disabled={blocked}
                    versions={priorVersions(turn, data.turns)}
                    onCopy={() => void navigator.clipboard.writeText(turn.assistant_text)}
                    onRevise={
                      turn.id === data.turns.at(-1)?.id && !data.currentConversation?.archived_at
                        ? (kind) => {
                            if (kind === 'edit') {
                              setDraft(turn.user_text);
                              setRevision({ sourceTurnId: turn.id, revisionKind: 'edit' });
                              composer.current?.focus();
                            } else
                              void sendMessage(
                                turn.user_text,
                                { sourceTurnId: turn.id, revisionKind: kind },
                                councilFromVersion(turn.prompt_version),
                              );
                          }
                        : undefined
                    }
                    action={
                      turn.id ===
                        data.turns.filter((item) => item.status === 'complete').at(-1)?.id &&
                      data.canChat
                        ? {
                            proposal: data.actionProposals?.find(
                              (item) => item.source_turn_id === turn.id,
                            ),
                            onChanged: () => reload(selected),
                          }
                        : undefined
                    }
                    creations={creationsOnTurn(
                      turn.id,
                      data.turns
                        .filter((item) => !data.turns.some((newer) => newer.parent_turn_id === item.id))
                        .at(-1)?.id,
                      creationWorkspace?.creations,
                      data.turns.map((item) => item.id),
                    )}
                    images={
                      turn.id ===
                      data.turns.filter((item) => !data.turns.some((newer) => newer.parent_turn_id === item.id)).at(-1)?.id
                        ? creationWorkspace?.images
                        : undefined
                    }
                    selectedCreationId={
                      creationWorkspace?.selected.brief ||
                      creationWorkspace?.selected.plan ||
                      creationWorkspace?.selected.palette ||
                      creationWorkspace?.selected.board
                    }
                    onBoardCommit={(id, board) => void commitInlineBoard(id, board)}
                    boardStatus={inlineBoardStatus ?? undefined}
                    selectedImageId={creationWorkspace?.selectedImageId}
                    canApproveImages={creationWorkspace?.canCreateImages}
                    onOpenCreation={(id) => void openWork(id)}
                    onApproveImage={(id, approve) => void approveTalkImage(id, approve)}
                    onSelectImage={(id) => void selectOpenCreation(id)}
                  />
                ))
            )}
            {liveState.conversationId === selected
              ? liveState.transcript
                  .filter(
                    (line) =>
                      line.text &&
                      !liveState.savedItemIds.includes(line.id) &&
                      !data.turns.some((turn) => turn.id === line.id),
                  )
                  .map((line) => (
                    <p
                      key={line.id}
                      className="live-provisional"
                      data-live-status="provisional"
                      data-conversation={liveState.conversationId ?? undefined}
                    >
                      <strong>{line.role === 'user' ? 'You' : 'Aethelios'}</strong> {line.text}
                    </p>
                  ))
              : null}
            {busy && !data.turns.some((turn) => turn.id === operation.id) && (
              <IntelligenceResponse operation={operation} name={councilLabel(councilSelection)} />
            )}
          </div>
          {widePanel && openWorkId && (openCreation || openImage) && (
            <aside className="talk-creation-panel" aria-label="Reviewed work">
              <CreationDetail
                key={openWorkId ?? 'panel'}
                creation={openCreation}
                image={openImage}
                images={creationWorkspace?.images ?? []}
                canEdit={!preview && data.canChat}
                busy={creationBusy}
                error={creationError}
                notice={creationNotice}
                onClose={() => setOpenWorkId(null)}
                onSave={(kind, content) => void saveOpenCreation(kind, content)}
                onCopy={(text) => void navigator.clipboard.writeText(text)}
                onSelect={() => void selectOpenCreation()}
                onKeepProposal={() => void keepProposal()}
                onHandoff={(input) => void prepareArchitectPackage(input)}
                onImport={(id) => void importArchitectPackage(id)}
                onOpenVersion={(id) => setOpenWorkId(id)}
                onHistory={rememberHistory}
                targetField={
                  workTarget && workTarget.creationId === openCreation?.id ? workTarget.field : null
                }
                onTargetField={(field) =>
                  setWorkTarget(openCreation && field ? { creationId: openCreation.id, field } : null)
                }
              />
            </aside>
          )}
          </div>
          {!preview && (!data.configured || !data.canChat) && (
            <p className="connection-note">
              {!data.configured
                ? 'Aethelios is waiting for its model connection. Saved conversations and memory remain available.'
                : 'Conversation access is not enabled for this account. If you were invited, confirm your access in the founding member guide.'}
            </p>
          )}
          <div className="aurelius-compose-region">
            {liveState.error && (
              <p className="connection-note" role="alert">
                {liveState.error} Text remains available.{' '}
                {!liveBusy && (
                  <button
                    type="button"
                    className="text-button"
                    onClick={() =>
                      document
                        .querySelector<HTMLButtonElement>('[aria-label="Aethelios Live"]')
                        ?.click()
                    }
                  >
                    Retry voice
                  </button>
                )}
              </p>
            )}
            {awayFromLatest && (
              <button
                className="latest-message"
                onClick={() => {
                  follow.current = true;
                  setAwayFromLatest(false);
                  scroll.current?.scrollTo({
                    top: scroll.current.scrollHeight,
                    behavior: 'instant',
                  });
                }}
              >
                Latest message ↓
              </button>
            )}
            <form
              className="aurelius-composer"
              data-bplus-surface={compact ? undefined : 'composer'}
              onSubmit={(event) => {
                event.preventDefault();
                if (councilSelection?.kind === 'table') {
                  tableReview.current?.open();
                  return;
                }
                void sendMessage(draft, revision);
              }}
            >
              {!compact && <BplusMaterial radius={19} />}
              {capability && !councilSelection && (
                <div className="revision-notice" aria-live="polite">
                  <span>
                    Aethelios is routing this through <strong>{capability.label}</strong>{' '}
                    intelligence.
                  </span>{' '}
                  {['performance', 'studio', 'presence'].includes(capability.id) ? (
                    <button
                      type="button"
                      className="text-button"
                      disabled={orchestrating}
                      onClick={() => void prepareCapability()}
                    >
                      {orchestrating ? (
                        `Preparing ${capability.label}…`
                      ) : (
                        <>
                          Prepare in {capability.label}{' '}
                          <Icon name="arrow-up-right" className="action-icon" />
                        </>
                      )}
                    </button>
                  ) : (
                    <Link
                      href={capability.href}
                      onClick={() => {
                        if (data.ownerId)
                          handoff?.stage({
                            text: draft.trim() || data.turns.at(-1)?.user_text || '',
                            ownerId: data.ownerId,
                            target: capability.id,
                          });
                      }}
                    >
                      Open {capability.label} only if you want depth{' '}
                      <Icon name="arrow-up-right" className="action-icon" />
                    </Link>
                  )}
                </div>
              )}
              {revision && (
                <div className="revision-notice">
                  Editing your last message{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setRevision(null);
                      setDraft('');
                    }}
                  >
                    Cancel
                  </button>
                </div>
              )}
              {attachment && (
                <div className="talk-attachment-chip">
                  <span>Attached for analysis: {attachment.name}</span>
                  <button type="button" className="text-button" onClick={() => setAttachment(null)}>
                    Remove
                  </button>
                </div>
              )}
              {(() => {
                const selectedWork = describeSelectedWork(creationWorkspace, workTarget);
                return selectedWork ? (
                  <p className="talk-selection-chip" aria-live="polite">
                    Changing this: {selectionChipLabel(selectedWork)}
                  </p>
                ) : null;
              })()}
              <div id="talk-voice-dock" className="talk-voice-dock" ref={attachTalkVoiceDock} />
              <TalkInput
                id="aurelius-message"
                label="Message Aethelios"
                inputRef={composer}
                value={draft}
                onChange={setDraft}
                disabled={loading || deleting || orchestrating}
                maxLength={liveComposerLimit(liveState.phase)}
                placeholder={
                  councilSelection?.kind === 'specialist'
                    ? `Message ${councilLabel(councilSelection)}…`
                    : 'Message Aethelios…'
                }
              />
              <div className="composer-controls">
                <span className="quiet-label">
                  {includeContext ? 'Personal context on' : 'Private conversation'}
                </span>
                {busy ? (
                  <button
                    type="button"
                    className="secondary-button"
                    disabled={operation.persistence === 'confirmed'}
                    onPointerDown={(event) => retainComposerFocus(event, composer.current)}
                    onClick={() => cancelReply.current?.()}
                  >
                    Stop reply
                  </button>
                ) : (
                  <button
                    className="button"
                    disabled={
                      blocked ||
                      liveState.phase === 'connecting' ||
                      !data.configured ||
                      !data.canChat ||
                      !draft.trim() ||
                      needsReload ||
                      Boolean(data.currentConversation?.archived_at)
                    }
                    type="submit"
                    onPointerDown={(event) => retainComposerFocus(event, composer.current)}
                  >
                    {councilSelection?.kind === 'table' ? 'Review The Table' : 'Send'}{' '}
                    <span aria-hidden="true">↑</span>
                  </button>
                )}
              </div>
            </form>
          </div>
        </>
        <p className="aurelius-notice" role="status">
          {notice}
          {creationNotice && !(openWorkId && (openCreation || openImage))
            ? ` ${creationNotice}`
            : ''}
          {creationWorkspace?.imageAccess === 'unavailable' && selected
            ? ' Image generation is unavailable; text work remains available.'
            : ''}
        </p>
        {creationError && !(openWorkId && (openCreation || openImage)) ? (
          <p role="alert">{creationError}</p>
        ) : null}
        <dialog
          ref={detailDialog}
          className="talk-drawer talk-creation-dialog"
          aria-label="Reviewed work"
          onClose={() => {
            if (!widePanel) setOpenWorkId(null);
          }}
        >
          {!widePanel && (openCreation || openImage) && (
            <CreationDetail
              key={openWorkId ?? 'dialog'}
              creation={openCreation}
              image={openImage}
              images={creationWorkspace?.images ?? []}
              canEdit={!preview && data.canChat}
              busy={creationBusy}
              error={creationError}
              notice={creationNotice}
              onClose={() => detailDialog.current?.close()}
              onSave={(kind, content) => void saveOpenCreation(kind, content)}
              onCopy={(text) => void navigator.clipboard.writeText(text)}
              onSelect={() => void selectOpenCreation()}
              onKeepProposal={() => void keepProposal()}
              onHandoff={(input) => void prepareArchitectPackage(input)}
              onImport={(id) => void importArchitectPackage(id)}
              onOpenVersion={(id) => setOpenWorkId(id)}
              onHistory={rememberHistory}
              targetField={workTarget && workTarget.creationId === openCreation?.id ? workTarget.field : null}
              onTargetField={(field) =>
                setWorkTarget(openCreation && field ? { creationId: openCreation.id, field } : null)
              }
            />
          )}
        </dialog>
      </div>
    </div>
  );
}
