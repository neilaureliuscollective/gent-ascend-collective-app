import type { ArtifactWorkspace } from '@/domains/artifacts/contract';
import type {
  ReviewedActionDraft,
  ReviewedActionPreparation,
} from '@/domains/artifacts/daily-action';
import { readLiveEvent, type LiveJob } from './contract';
import { VoiceDiagnostics, rtcHealth } from './diagnostics';
export type LiveState = {
  phase: 'idle' | 'connecting' | 'listening' | 'speaking' | 'ended' | 'error';
  mode: 'immersive' | 'compact';
  muted: boolean;
  error: string;
  conversationId: string | null;
  sessionId: string | null;
  jobs: LiveJob[];
  artifactWorkspace: ArtifactWorkspace;
  artifactBusy: boolean;
  reviewedAction: ReviewedActionDraft | null;
  expiresAt: string | null;
  transcript: { id: string; role: 'user' | 'assistant'; text: string }[];
  playbackBlocked: boolean;
  cleanupPending: boolean;
};
/** One transport per workspace. Presentation changes never create a transport. */
export class LiveController {
  private state: LiveState = {
    phase: 'idle',
    mode: 'immersive',
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
    playbackBlocked: false,
    cleanupPending: false,
  };
  private listeners = new Set<() => void>();
  private pc: RTCPeerConnection | null = null;
  private stream: MediaStream | null = null;
  private channel: RTCDataChannel | null = null;
  private audio: HTMLAudioElement | null = null;
  private id: string | null = null;
  private epoch = 0;
  private starting = false;
  private expiry: ReturnType<typeof setTimeout> | undefined;
  private audioFence = false;
  private diagnostics = new VoiceDiagnostics();
  private health = rtcHealth();
  private healthAt: number | null = null;
  private interruptedResponse = '';
  private currentResponse = '';
  private generating = false;
  private pendingCreate = false;
  private artifactReading = false;
  private artifactWriting = false;
  private interruptedItems = new Set<string>();
  async audioLevels() {
    const epoch = this.epoch;
    const stats = await this.pc?.getStats();
    if (stats && epoch === this.epoch) {
      this.health = rtcHealth(stats);
      this.healthAt = performance.now();
    }
    let input = 0,
      output = 0;
    stats?.forEach((report) => {
      const level = typeof report.audioLevel === 'number' ? report.audioLevel : 0;
      if (report.type === 'media-source' && report.kind === 'audio') input = Math.max(input, level);
      if (report.type === 'inbound-rtp' && report.kind === 'audio')
        output = Math.max(output, level);
    });
    return { input: Math.min(1, input), output: Math.min(1, output) };
  }
  async exportDiagnostics() {
    const epoch = this.epoch;
    const pc = this.pc;
    try {
      const stats = await pc?.getStats();
      if (epoch !== this.epoch) throw new Error('The voice session changed. Export again.');
      if (stats) {
        this.health = rtcHealth(stats);
        this.healthAt = performance.now();
      }
    } catch {
      if (epoch !== this.epoch) throw new Error('The voice session changed. Export again.');
    }
    const now = performance.now();
    return {
      ...this.diagnostics.snapshot(now, this.health),
      rtcSampleAgeMs: this.healthAt === null ? null : Math.max(0, Math.round(now - this.healthAt)),
    };
  }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private update(patch: Partial<LiveState>) {
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener();
  }
  mode(mode: LiveState['mode']) {
    this.update({ mode });
  }
  private release() {
    clearTimeout(this.expiry);
    this.channel?.close();
    this.channel = null;
    this.pc?.close();
    this.pc = null;
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    if (this.audio) {
      this.audio.pause();
      this.audio.srcObject = null;
      this.audio.remove();
      this.audio = null;
    }
  }
  async start(
    conversationId: string,
    includeContext: boolean,
    voice: 'cedar' | 'marin' = 'cedar',
    backgroundWork = false,
  ) {
    if (this.starting || this.id || this.state.cleanupPending) return;
    const epoch = ++this.epoch;
    this.diagnostics.reset(performance.now(), voice);
    this.health = rtcHealth();
    this.healthAt = null;
    this.interruptedItems.clear();
    this.audioFence = false;
    this.interruptedResponse = '';
    this.currentResponse = '';
    this.generating = false;
    this.pendingCreate = false;
    const id = crypto.randomUUID();
    this.id = id;
    this.starting = true;
    this.update({
      phase: 'connecting',
      mode: 'immersive',
      muted: false,
      error: '',
      conversationId,
      reviewedAction:
        this.state.conversationId === conversationId ? this.state.reviewedAction : null,
      artifactWorkspace:
        this.state.conversationId === conversationId
          ? this.state.artifactWorkspace
          : { artifacts: [], selectedId: null, projects: [] },
      sessionId: id,
      jobs: [],
      expiresAt: null,
      transcript: [],
      playbackBlocked: false,
    });
    try {
      if (
        !window.isSecureContext ||
        !navigator.mediaDevices?.getUserMedia ||
        !globalThis.RTCPeerConnection
      )
        throw new Error('Use a supported browser over a secure connection.');
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: false,
      });
      if (epoch !== this.epoch) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      this.stream = stream;
      stream.getAudioTracks().forEach((track) =>
        track.addEventListener(
          'ended',
          () => {
            if (epoch === this.epoch) {
              this.diagnostics.disconnected();
              void this.end('The microphone disconnected. Start again to reconnect.');
            }
          },
          { once: true },
        ),
      );
      const pc = new RTCPeerConnection();
      this.pc = pc;
      for (const track of stream.getTracks()) pc.addTrack(track, stream);
      const audio = document.createElement('audio');
      audio.autoplay = true;
      audio.setAttribute('playsinline', '');
      this.audio = audio;
      pc.ontrack = (event) => {
        if (epoch !== this.epoch) return;
        audio.srcObject = event.streams[0] ?? new MediaStream([event.track]);
        void audio.play().catch(() => {
          if (epoch === this.epoch) this.update({ playbackBlocked: true });
        });
      };
      pc.onconnectionstatechange = () => {
        if (epoch !== this.epoch) return;
        if (['failed', 'disconnected', 'closed'].includes(pc.connectionState)) {
          this.diagnostics.disconnected();
          void this.end('The voice connection stopped. Start again to resume this conversation.');
        }
      };
      const channel = pc.createDataChannel('oai-events');
      this.channel = channel;
      channel.onmessage = (event) => {
        if (epoch === this.epoch) this.event(event.data);
      };
      channel.onclose = () => {
        if (epoch === this.epoch) {
          this.diagnostics.disconnected();
          void this.end('The voice connection ended.');
        }
      };
      channel.onopen = () => {
        if (epoch === this.epoch) {
          this.diagnostics.connected(performance.now());
          this.update({ phase: 'listening' });
        }
      };
      await pc.setLocalDescription(await pc.createOffer());
      if (epoch !== this.epoch) return;
      const response = await fetch('/api/aethelios/live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: id,
          conversationId,
          sdp: pc.localDescription?.sdp,
          saveTranscript: true,
          includeContext,
          voice,
          backgroundWork,
        }),
      });
      const result = (await response.json()) as {
        answer?: string;
        expiresAt?: string;
        model?: string;
        error?: string;
      };
      if (epoch !== this.epoch) {
        await this.revoke(id);
        return;
      }
      if (!response.ok || !result.answer || !result.expiresAt)
        throw new Error(result.error ?? 'The voice connection could not be started.');
      const remaining = new Date(result.expiresAt).getTime() - Date.now();
      if (!Number.isFinite(remaining) || remaining <= 0)
        throw new Error('The voice admission expired. Start again.');
      this.update({ expiresAt: result.expiresAt });
      this.diagnostics.setModel(result.model);
      await pc.setRemoteDescription({ type: 'answer', sdp: result.answer });
      this.expiry = setTimeout(() => {
        void this.end('The two-minute pilot session ended. You can resume this conversation.');
      }, remaining);
    } catch (error) {
      if (epoch === this.epoch) {
        this.diagnostics.failure();
        const message =
          error instanceof Error ? error.message : 'The voice connection could not be started.';
        await this.end(message);
        this.update({ phase: 'error' });
      }
    } finally {
      this.starting = false;
    }
  }
  private async revoke(id: string) {
    this.update({ cleanupPending: true });
    try {
      const response = await fetch('/api/aethelios/live', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: id }),
        keepalive: true,
      });
      if (!response.ok) throw new Error('Cleanup unconfirmed');
      if (this.id === id) this.id = null;
      this.update({ cleanupPending: false });
    } catch {
      this.id = id;
      this.update({
        cleanupPending: true,
        error: 'Audio stopped locally. Server cleanup is pending; retry End before starting again.',
      });
    }
  }
  async end(message = '') {
    if (this.state.phase === 'idle' && !this.id) return;
    ++this.epoch;
    this.diagnostics.end(performance.now());
    this.release();
    this.update({
      phase: 'ended',
      muted: false,
      expiresAt: null,
      error: message,
      playbackBlocked: false,
    });
    if (this.id) await this.revoke(this.id);
  }
  mute() {
    const muted = !this.state.muted;
    this.stream?.getAudioTracks().forEach((track) => {
      track.enabled = !muted;
    });
    this.update({ muted });
  }
  interrupt() {
    const started = performance.now();
    const playing = this.state.phase === 'speaking';
    const cuttingOff = playing || this.generating;
    if (playing || this.generating) {
      this.interruptedResponse = this.currentResponse;
      if (this.audio) {
        this.audio.volume = 0;
        this.audioFence = true;
      }
    }
    if (this.generating) {
      this.send({ type: 'response.cancel' });
      this.generating = false;
    }
    if (playing) this.send({ type: 'output_audio_buffer.clear' });
    this.update({ phase: 'listening' });
    if (cuttingOff) this.diagnostics.cutoff(performance.now() - started, this.currentResponse);
  }
  text(text: string) {
    const value = text.trim();
    if (!value || value.length > 4000 || this.channel?.readyState !== 'open') return;
    const pending = this.generating;
    this.interrupt();
    this.diagnostics.typedTurn(performance.now());
    this.send({
      type: 'conversation.item.create',
      item: { type: 'message', role: 'user', content: [{ type: 'input_text', text: value }] },
    });
    if (pending) this.pendingCreate = true;
    else this.send({ type: 'response.create' });
  }
  private send(value: unknown) {
    if (this.channel?.readyState === 'open') this.channel.send(JSON.stringify(value));
  }
  async enablePlayback() {
    try {
      await this.audio?.play();
      this.update({ playbackBlocked: false });
    } catch {
      this.update({ playbackBlocked: true });
    }
  }
  private event(raw: unknown) {
    const event = readLiveEvent(raw);
    if (!event) return;
    this.diagnostics.observe(event, performance.now());
    if (event.type === 'error') {
      this.diagnostics.failure();
      void this.end('The voice provider stopped responding. Resume when ready.');
      return;
    }
    if (event.type === 'input_audio_buffer.speech_started') this.interrupt();
    if (
      event.type === 'response.done' &&
      (!event.response?.id || event.response.id === this.currentResponse)
    ) {
      this.generating = false;
      if (this.pendingCreate) {
        this.pendingCreate = false;
        this.send({ type: 'response.create' });
      }
    }
    if (event.type === 'response.created') {
      this.generating = true;
      this.currentResponse = event.response?.id ?? '';
    }
    if (event.type === 'output_audio_buffer.started') {
      if (event.response_id === this.interruptedResponse) return;
      if (this.audioFence && this.audio) {
        this.audio.volume = 1;
        this.audioFence = false;
      }
      this.update({ phase: 'speaking' });
    }
    if (event.type === 'conversation.item.truncated' && event.item_id) {
      this.interruptedItems.add(event.item_id);
      this.line(event.item_id, 'assistant', '[Interrupted]', false);
    }
    if (
      event.type === 'response.output_audio_transcript.delta' &&
      event.item_id &&
      this.interruptedItems.has(event.item_id)
    )
      return;
    if (
      event.type === 'response.output_audio_transcript.done' &&
      event.item_id &&
      this.interruptedItems.has(event.item_id)
    )
      return;
    if (['output_audio_buffer.stopped', 'output_audio_buffer.cleared'].includes(event.type))
      this.update({ phase: 'listening' });
    if (
      event.type === 'conversation.item.input_audio_transcription.completed' &&
      typeof event.transcript === 'string'
    ) {
      this.line(event.item_id ?? crypto.randomUUID(), 'user', event.transcript, false);
    }
    if (
      event.type === 'conversation.item.input_audio_transcription.delta' &&
      typeof event.delta === 'string'
    )
      this.line(event.item_id ?? 'input', 'user', event.delta, true);
    if (event.type === 'response.output_audio_transcript.delta' && typeof event.delta === 'string')
      this.line(event.item_id ?? event.response_id ?? 'output', 'assistant', event.delta, true);
    if (
      event.type === 'response.output_audio_transcript.done' &&
      typeof event.transcript === 'string'
    )
      this.line(
        event.item_id ?? event.response_id ?? 'output',
        'assistant',
        event.transcript,
        false,
      );
    if (
      ['conversation.item.added', 'conversation.item.created'].includes(event.type) &&
      event.item?.role === 'user'
    ) {
      const text = event.item.content?.map((part) => part.text ?? '').join('');
      if (text) this.line(event.item.id ?? 'typed', 'user', text, false);
    }
  }
  private line(id: string, role: 'user' | 'assistant', text: string, append: boolean) {
    const lines = [...this.state.transcript];
    const index = lines.findIndex((line) => line.id === id);
    const line = {
      id,
      role,
      text: ((append && index >= 0 ? lines[index]!.text : '') + text).slice(0, 20000),
    };
    if (index < 0) lines.push(line);
    else lines[index] = line;
    this.update({ transcript: lines.slice(-60) });
  }
  bindConversation(conversationId: string) {
    if (
      ['connecting', 'listening', 'speaking'].includes(this.state.phase) ||
      this.state.conversationId === conversationId
    )
      return;
    this.update({
      conversationId,
      artifactWorkspace: { artifacts: [], selectedId: null, projects: [] },
      reviewedAction: null,
    });
  }
  async refreshArtifacts() {
    const id = this.state.conversationId;
    if (!id || this.artifactReading) return;
    this.artifactReading = true;
    try {
      const response = await fetch(
        '/api/aethelios/artifacts?conversationId=' + encodeURIComponent(id),
        { cache: 'no-store' },
      );
      if (!response.ok) return;
      const result = (await response.json()) as ArtifactWorkspace;
      if (this.state.conversationId === id && Array.isArray(result.artifacts))
        this.update({ artifactWorkspace: result });
    } finally {
      this.artifactReading = false;
    }
  }
  async prepareDailyAction(reviewId: string) {
    const conversationId = this.state.conversationId;
    if (
      !conversationId ||
      this.state.reviewedAction?.phase === 'saving' ||
      this.state.reviewedAction?.phase === 'uncertain'
    )
      return;
    try {
      const prepared = await this.readDailyAction(conversationId, reviewId);
      if (
        this.state.conversationId !== conversationId ||
        ['saving', 'uncertain'].includes(this.state.reviewedAction?.phase ?? '')
      )
        return;
      this.update({
        reviewedAction: {
          ...prepared,
          id: prepared.receipt?.id ?? crypto.randomUUID(),
          title:
            prepared.receipt?.title ??
            (this.state.reviewedAction?.reviewId === reviewId
              ? this.state.reviewedAction.title
              : ''),
          phase: prepared.receipt ? 'receipt' : 'editing',
          error: '',
        },
      });
    } catch (error) {
      if (this.state.conversationId === conversationId)
        this.update({
          error: error instanceof Error ? error.message : 'Daily action preparation unavailable.',
        });
    }
  }
  editDailyAction(title: string) {
    const draft = this.state.reviewedAction;
    if (draft?.phase === 'editing')
      this.update({ reviewedAction: { ...draft, title: title.slice(0, 100) } });
  }
  closeDailyAction() {
    if (
      this.state.reviewedAction?.phase === 'editing' ||
      this.state.reviewedAction?.phase === 'receipt'
    )
      this.update({ reviewedAction: null });
  }
  private async readDailyAction(conversationId: string, reviewId: string) {
    const response = await fetch(
      '/api/aethelios/reviewed-action?conversationId=' +
        encodeURIComponent(conversationId) +
        '&reviewId=' +
        encodeURIComponent(reviewId),
      { cache: 'no-store' },
    );
    const value = (await response.json()) as ReviewedActionPreparation & { error?: string };
    if (!response.ok) throw new Error(value.error ?? 'Saved action status unavailable.');
    return value;
  }
  async checkDailyAction() {
    const draft = this.state.reviewedAction;
    if (!draft || draft.phase === 'saving') return;
    try {
      const saved = await this.readDailyAction(draft.conversationId, draft.reviewId);
      if (this.state.reviewedAction !== draft || this.state.conversationId !== draft.conversationId)
        return;
      this.update({
        reviewedAction: saved.receipt
          ? { ...draft, receipt: saved.receipt, phase: 'receipt', error: '' }
          : {
              ...draft,
              error:
                draft.phase === 'uncertain'
                  ? 'No saved receipt is visible yet. The confirmation remains locked; check again or inspect your daily actions.'
                  : 'No saved action receipt was found. Review the exact title and day before confirming.',
            },
      });
    } catch (error) {
      if (this.state.reviewedAction === draft)
        this.update({
          reviewedAction: {
            ...draft,
            error: error instanceof Error ? error.message : 'Receipt unavailable.',
          },
        });
    }
  }
  async confirmDailyAction() {
    const draft = this.state.reviewedAction;
    if (
      !draft ||
      draft.phase !== 'editing' ||
      !draft.title.trim() ||
      draft.conversationId !== this.state.conversationId
    )
      return;
    this.update({ reviewedAction: { ...draft, phase: 'saving', error: '' } });
    let rejected = false;
    try {
      const response = await fetch('/api/aethelios/reviewed-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: draft.id,
          conversationId: draft.conversationId,
          reviewId: draft.reviewId,
          title: draft.title.trim(),
          day: draft.day,
          version: draft.version,
          timezone: draft.timezone,
          confirm: true,
        }),
      });
      const value = (await response.json()) as ReviewedActionPreparation & { error?: string };
      rejected = [400, 403, 404, 409].includes(response.status);
      if (
        !response.ok ||
        !value.receipt?.verified ||
        value.receipt.id !== draft.id ||
        value.receipt.title !== draft.title.trim() ||
        value.receipt.day !== draft.day
      )
        throw new Error(value.error ?? 'Saved action receipt is unconfirmed.');
      if (
        this.state.reviewedAction?.id === draft.id &&
        this.state.conversationId === draft.conversationId
      )
        this.update({
          reviewedAction: { ...draft, receipt: value.receipt, phase: 'receipt', error: '' },
        });
    } catch (error) {
      if (
        this.state.reviewedAction?.id === draft.id &&
        this.state.conversationId === draft.conversationId
      )
        this.update({
          reviewedAction: {
            ...draft,
            phase: rejected ? 'editing' : 'uncertain',
            error: error instanceof Error ? error.message : 'Save unconfirmed. Check saved status.',
          },
        });
    }
  }
  async artifactAction(body: unknown, method: 'POST' | 'PATCH') {
    if (this.artifactWriting) return;
    this.artifactWriting = true;
    this.update({ artifactBusy: true, error: '' });
    try {
      const response = await fetch('/api/aethelios/artifacts', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const value = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(value.error ?? 'Artifact operation was not confirmed.');
      await this.refreshArtifacts();
    } catch (error) {
      this.update({
        error:
          error instanceof Error
            ? error.message
            : 'Artifact operation not confirmed. Refresh before retrying.',
      });
    } finally {
      this.artifactWriting = false;
      this.update({ artifactBusy: false });
    }
  }
  async refreshJobs() {
    const id = this.state.sessionId;
    if (!id) return;
    try {
      const response = await fetch(`/api/aethelios/live?sessionId=${encodeURIComponent(id)}`, {
        cache: 'no-store',
      });
      if (!response.ok) return;
      const result = (await response.json()) as { jobs: LiveJob[] };
      if (this.state.sessionId === id && Array.isArray(result.jobs))
        this.update({ jobs: result.jobs.slice(0, 2) });
    } catch {
      /* Provisional status is never a save confirmation. */
    }
  }
  async reviewJob(jobId: string, approve: boolean) {
    if (!this.state.sessionId) return;
    try {
      const response = await fetch('/api/aethelios/live', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: this.state.sessionId, jobId, approve }),
      });
      if (!response.ok) throw new Error('Review unavailable');
      await this.refreshJobs();
    } catch {
      this.update({
        error: 'Background review was not confirmed. Refresh the result before retrying.',
      });
    }
  }
  dismiss() {
    if (!this.id && !this.starting && !this.state.cleanupPending)
      this.update({ phase: 'idle', transcript: [], jobs: [], sessionId: null, error: '' });
  }
  dispose() {
    void this.end();
    this.listeners.clear();
  }
}
