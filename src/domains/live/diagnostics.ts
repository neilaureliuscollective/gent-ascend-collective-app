import type { LiveEvent } from './contract';
export const metricNames = [
  'connection_event_ms',
  'speech_stop_to_output_event_ms',
  'speech_stop_to_transcript_event_ms',
  'typed_to_output_event_ms',
  'local_cutoff_handler_ms',
] as const;
export type MetricName = (typeof metricNames)[number];
export const liveModels = [
  'gpt-realtime',
  'gpt-realtime-1.5',
  'gpt-realtime-2.1',
  'gpt-realtime-mini',
] as const;
type Model = (typeof liveModels)[number];
const limit = 60;
const safeId = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= 200;
const valid = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0;
export function summarize(values: number[]) {
  const sorted = values.filter(valid).sort((a, b) => a - b);
  const percentile = (p: number) =>
    sorted.length ? sorted[Math.ceil(sorted.length * p) - 1]! : null;
  return { count: sorted.length, p50: percentile(0.5), p95: percentile(0.95) };
}
export type RTCHealth = {
  available: boolean;
  packetsReceived: number | null;
  packetsLost: number | null;
  jitterMs: number | null;
  roundTripMs: number | null;
  averageJitterBufferMs: number | null;
};
export function rtcHealth(stats?: {
  forEach: (fn: (row: Record<string, unknown>) => void) => void;
}): RTCHealth {
  let packetsReceived: number | null = null,
    packetsLost: number | null = null,
    jitterMs: number | null = null,
    roundTripMs: number | null = null,
    bufferSeconds = 0,
    emitted = 0;
  stats?.forEach((row) => {
    if (row.type === 'inbound-rtp' && row.kind === 'audio') {
      if (valid(row.packetsReceived))
        packetsReceived = (packetsReceived ?? 0) + row.packetsReceived;
      if (valid(row.packetsLost)) packetsLost = (packetsLost ?? 0) + row.packetsLost;
      if (valid(row.jitter)) jitterMs = Math.max(jitterMs ?? 0, row.jitter * 1000);
      if (valid(row.jitterBufferDelay) && valid(row.jitterBufferEmittedCount)) {
        bufferSeconds += row.jitterBufferDelay;
        emitted += row.jitterBufferEmittedCount;
      }
    }
    if (
      row.type === 'candidate-pair' &&
      row.state === 'succeeded' &&
      row.nominated === true &&
      valid(row.currentRoundTripTime)
    )
      roundTripMs = Math.max(roundTripMs ?? 0, row.currentRoundTripTime * 1000);
  });
  return {
    available: !!stats,
    packetsReceived,
    packetsLost,
    jitterMs,
    roundTripMs,
    averageJitterBufferMs: emitted > 0 ? (bufferSeconds * 1000) / emitted : null,
  };
}
/** Local bounded diagnostics. Correlation IDs never leave this object or enter exported reports. */
export class VoiceDiagnostics {
  private samples = new Map<MetricName, number[]>(metricNames.map((name) => [name, []]));
  private speech = new Map<string, number>();
  private seen = new Set<string>();
  private responses = new Map<
    string,
    { started: number | null; metric: MetricName; played: boolean }
  >();
  private candidate: number | null = null;
  private typed: number | null = null;
  private started = 0;
  private ended: number | null = null;
  private model: Model | null = null;
  private voice: 'cedar' | 'marin' = 'cedar';
  private counters = {
    connections: 0,
    failures: 0,
    disconnects: 0,
    interruptions: 0,
    uncorrelatedOutputs: 0,
    uncorrelatedTranscripts: 0,
  };
  reset(now: number, voice: 'cedar' | 'marin') {
    this.samples = new Map<MetricName, number[]>(metricNames.map((name) => [name, []]));
    this.speech.clear();
    this.seen.clear();
    this.responses.clear();
    this.candidate = null;
    this.typed = null;
    this.started = now;
    this.ended = null;
    this.model = null;
    this.voice = voice;
    this.counters = {
      connections: 0,
      failures: 0,
      disconnects: 0,
      interruptions: 0,
      uncorrelatedOutputs: 0,
      uncorrelatedTranscripts: 0,
    };
  }
  setModel(value: unknown) {
    if (liveModels.includes(value as Model)) this.model = value as Model;
  }
  record(name: MetricName, duration: number) {
    if (!valid(duration) || duration > 300000) return;
    const samples = this.samples.get(name)!;
    samples.push(Math.round(duration * 10) / 10);
    if (samples.length > limit) samples.shift();
  }
  connected(now: number) {
    if (!this.counters.connections) {
      this.counters.connections++;
      this.record('connection_event_ms', now - this.started);
    }
  }
  failure() {
    this.counters.failures++;
  }
  disconnected() {
    this.counters.disconnects++;
  }
  end(now: number) {
    if (this.ended === null) this.ended = now;
  }
  cutoff(duration: number, responseId: string) {
    this.counters.interruptions++;
    this.record('local_cutoff_handler_ms', duration);
    const response = this.responses.get(responseId);
    if (response) response.played = true;
  }
  typedTurn(now: number) {
    this.typed = now;
    this.candidate = null;
  }
  observe(event: LiveEvent, now: number) {
    if (safeId(event.event_id)) {
      if (this.seen.has(event.event_id)) return;
      this.seen.add(event.event_id);
      if (this.seen.size > 512) this.seen.delete(this.seen.values().next().value!);
    }
    if (
      event.type === 'response.done' &&
      ['cancelled', 'failed'].includes(event.response?.status ?? '')
    ) {
      const response = this.responses.get(event.response?.id ?? '');
      if (response) response.played = true;
    }
    if (event.type === 'input_audio_buffer.speech_started') {
      this.candidate = null;
      this.typed = null;
    }
    if (event.type === 'input_audio_buffer.speech_stopped') {
      if (safeId(event.item_id) && this.speech.has(event.item_id)) return;
      this.candidate = now;
      if (safeId(event.item_id)) {
        this.speech.set(event.item_id, now);
        if (this.speech.size > limit) this.speech.delete(this.speech.keys().next().value!);
      }
    }
    if (
      event.type === 'response.created' &&
      safeId(event.response?.id) &&
      !this.responses.has(event.response.id)
    ) {
      this.responses.set(event.response.id, {
        started: this.candidate ?? this.typed,
        metric:
          this.candidate !== null ? 'speech_stop_to_output_event_ms' : 'typed_to_output_event_ms',
        played: false,
      });
      this.candidate = null;
      this.typed = null;
      if (this.responses.size > limit) this.responses.delete(this.responses.keys().next().value!);
    }
    if (event.type === 'output_audio_buffer.started') {
      const response = event.response_id ? this.responses.get(event.response_id) : undefined;
      if (response && !response.played) {
        response.played = true;
        if (response.started !== null) this.record(response.metric, now - response.started);
        else this.counters.uncorrelatedOutputs++;
      } else if (!response) this.counters.uncorrelatedOutputs++;
    }
    if (event.type === 'conversation.item.input_audio_transcription.completed') {
      const start = event.item_id ? this.speech.get(event.item_id) : undefined;
      if (start !== undefined) {
        this.record('speech_stop_to_transcript_event_ms', now - start);
        this.speech.delete(event.item_id!);
      } else this.counters.uncorrelatedTranscripts++;
    }
  }
  snapshot(now: number, health: RTCHealth) {
    return {
      schemaVersion: 1 as const,
      evidence: 'browser-events' as const,
      engine: 'openai-realtime' as const,
      model: this.model,
      voice: this.voice,
      durationMs: Math.max(0, Math.round((this.ended ?? now) - this.started)),
      metrics: Object.fromEntries(
        metricNames.map((name) => [
          name,
          { samples: [...this.samples.get(name)!], ...summarize(this.samples.get(name)!) },
        ]),
      ),
      counters: { ...this.counters },
      rtc: health,
      limitations: [
        'Browser events do not measure acoustic speech end, first audible response, detector latency or audible silence.',
        'Response timing binds the next response.created to the latest speech stop or typed turn; concurrent backend responses can be ambiguous.',
        'Counters and WebRTC statistics are client diagnostics, not trusted billing, server cleanup or reliability evidence.',
        'No transcripts, audio, record IDs, URLs, device labels or ICE addresses are included.',
      ],
    };
  }
}
