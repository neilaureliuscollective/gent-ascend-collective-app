import { expect, it } from 'vitest';
import { VoiceDiagnostics, rtcHealth, summarize } from '@/domains/live/diagnostics';
import { summarizeDiagnostics } from '@/domains/live/acceptance';
const report = (diagnostics: VoiceDiagnostics, now = 2000) => ({
  ...diagnostics.snapshot(now, rtcHealth()),
  rtcSampleAgeMs: null,
});
it('correlates delayed/out-of-order transcripts by item and output by response, accepting a zero clock start', () => {
  const diagnostics = new VoiceDiagnostics();
  diagnostics.reset(0, 'cedar');
  diagnostics.connected(200);
  diagnostics.observe({ type: 'input_audio_buffer.speech_stopped', item_id: 'private-first' }, 300);
  diagnostics.observe({ type: 'response.created', response: { id: 'private-r1' } }, 350);
  diagnostics.observe(
    { type: 'input_audio_buffer.speech_stopped', item_id: 'private-second' },
    500,
  );
  diagnostics.observe({ type: 'response.created', response: { id: 'private-r2' } }, 550);
  diagnostics.observe(
    {
      type: 'conversation.item.input_audio_transcription.completed',
      item_id: 'private-first',
      transcript: 'PERSONAL SECRET',
    },
    900,
  );
  diagnostics.observe({ type: 'output_audio_buffer.started', response_id: 'private-r1' }, 1000);
  diagnostics.observe({ type: 'output_audio_buffer.started', response_id: 'private-r1' }, 1100);
  diagnostics.observe({ type: 'output_audio_buffer.started', response_id: 'private-r2' }, 1200);
  const result = report(diagnostics);
  expect(result.metrics.connection_event_ms?.samples).toEqual([200]);
  expect(result.metrics.speech_stop_to_transcript_event_ms?.samples).toEqual([600]);
  expect(result.metrics.speech_stop_to_output_event_ms?.samples).toEqual([700, 700]);
  expect(JSON.stringify(result)).not.toMatch(
    /private-first|private-second|private-r1|PERSONAL SECRET/,
  );
});
it('never turns typed turns, interrupted responses or missing correlations into speech latency', () => {
  const d = new VoiceDiagnostics();
  d.reset(0, 'marin');
  d.setModel('gpt-realtime');
  d.setModel('PRIVATE MALFORMED MODEL');
  d.observe({ type: 'input_audio_buffer.speech_stopped', item_id: 'old' }, 100);
  d.typedTurn(200);
  d.observe({ type: 'response.created', response: { id: 'typed' } }, 210);
  d.observe({ type: 'output_audio_buffer.started', response_id: 'typed' }, 500);
  d.observe({ type: 'input_audio_buffer.speech_stopped', item_id: 'new' }, 600);
  d.observe({ type: 'response.created', response: { id: 'cancelled' } }, 700);
  d.cutoff(2, 'cancelled');
  d.observe({ type: 'output_audio_buffer.started', response_id: 'cancelled' }, 900);
  d.observe({ type: 'output_audio_buffer.started', response_id: 'missing' }, 950);
  const result = report(d);
  expect(result.metrics.speech_stop_to_output_event_ms?.count).toBe(0);
  expect(result.metrics.typed_to_output_event_ms?.samples).toEqual([300]);
  expect(result.counters.uncorrelatedOutputs).toBe(1);
  expect(result.model).toBe('gpt-realtime');
});
it('bounds memory, isolates attempts, freezes duration on End and rejects invalid numeric samples', () => {
  const d = new VoiceDiagnostics();
  d.reset(100, 'cedar');
  for (let i = 0; i < 80; i++) d.record('local_cutoff_handler_ms', i);
  d.record('local_cutoff_handler_ms', NaN);
  d.record('local_cutoff_handler_ms', -1);
  d.record('local_cutoff_handler_ms', Infinity);
  d.end(200);
  expect(report(d, 100000).durationMs).toBe(100);
  expect(report(d).metrics.local_cutoff_handler_ms?.count).toBe(60);
  const exported = report(d);
  exported.metrics.local_cutoff_handler_ms?.samples.push(999);
  expect(report(d).metrics.local_cutoff_handler_ms?.count).toBe(60);
  d.reset(200, 'marin');
  expect(report(d).metrics.local_cutoff_handler_ms?.count).toBe(0);
});
it('exports only allowlisted RTC numbers, converts seconds to milliseconds and preserves unavailable fields', () => {
  const stats = new Map([
    [
      'secret',
      {
        type: 'candidate-pair',
        state: 'succeeded',
        nominated: true,
        currentRoundTripTime: 0.1,
        remoteCandidateId: 'private-ip',
      },
    ],
    [
      'audio',
      {
        type: 'inbound-rtp',
        kind: 'audio',
        packetsReceived: 90,
        packetsLost: 10,
        jitter: 0.01,
        jitterBufferDelay: 0.4,
        jitterBufferEmittedCount: 20,
        trackIdentifier: 'Bluetooth secret',
      },
    ],
  ]);
  expect(rtcHealth(stats)).toEqual({
    available: true,
    packetsReceived: 90,
    packetsLost: 10,
    jitterMs: 10,
    roundTripMs: 100,
    averageJitterBufferMs: 20,
  });
  expect(JSON.stringify(rtcHealth(stats))).not.toMatch(/secret|Candidate|Bluetooth/);
  expect(rtcHealth().jitterMs).toBeNull();
});
it('recomputes honest cohort percentiles, refuses private fields and never grants launch acceptance', () => {
  const d = new VoiceDiagnostics();
  d.reset(0, 'cedar');
  d.setModel('gpt-realtime');
  d.record('speech_stop_to_output_event_ms', 800);
  const first = report(d);
  d.reset(0, 'marin');
  d.setModel('gpt-realtime');
  d.record('speech_stop_to_output_event_ms', 1400);
  const second = report(d);
  const summary = summarizeDiagnostics([first, second]);
  expect(summary.cohorts).toHaveLength(2);
  expect(summary.launchAcceptance).toBe('unverified');
  expect(summary.cohorts[0]?.metrics.speech_stop_to_output_event_ms).toEqual({
    count: 1,
    p50: 800,
    p95: 800,
  });
  expect(() => summarizeDiagnostics([{ ...first, transcript: 'SECRET' }])).toThrow();
  expect(() => summarizeDiagnostics([])).toThrow();
  expect(summarize([1, 2, 3, 4])).toEqual({ count: 4, p50: 2, p95: 4 });
});
