import { z } from 'zod';
const number = z.number().finite().min(0);
const milliseconds = number.max(300000);
const counter = number.int().max(1000000);
const metric = z
  .object({
    samples: z.array(milliseconds).max(60),
    count: counter,
    p50: milliseconds.nullable(),
    p95: milliseconds.nullable(),
  })
  .strict();
const names = z.enum([
  'connection_event_ms',
  'speech_stop_to_output_event_ms',
  'speech_stop_to_transcript_event_ms',
  'typed_to_output_event_ms',
  'local_cutoff_handler_ms',
]);
export const diagnosticReport = z
  .object({
    schemaVersion: z.literal(1),
    evidence: z.literal('browser-events'),
    engine: z.literal('openai-realtime'),
    model: z
      .enum(['gpt-realtime', 'gpt-realtime-1.5', 'gpt-realtime-2.1', 'gpt-realtime-mini'])
      .nullable(),
    voice: z.enum(['cedar', 'marin']),
    durationMs: number.max(3600000),
    metrics: z.record(names, metric),
    counters: z
      .object({
        connections: counter,
        failures: counter,
        disconnects: counter,
        interruptions: counter,
        uncorrelatedOutputs: counter,
        uncorrelatedTranscripts: counter,
      })
      .strict(),
    rtc: z
      .object({
        available: z.boolean(),
        packetsReceived: number.nullable(),
        packetsLost: number.nullable(),
        jitterMs: number.nullable(),
        roundTripMs: number.nullable(),
        averageJitterBufferMs: number.nullable(),
      })
      .strict(),
    rtcSampleAgeMs: number.nullable(),
    limitations: z.array(z.string().max(250)).max(10),
  })
  .strict();
function percentiles(samples: number[]) {
  const values = [...samples].sort((a, b) => a - b);
  const at = (p: number) => (values.length ? values[Math.ceil(values.length * p) - 1]! : null);
  return { count: values.length, p50: at(0.5), p95: at(0.95) };
}
/** Explicitly diagnostic aggregation, never an automatic launch or billing verdict. */
export function summarizeDiagnostics(raw: unknown[]) {
  if (raw.length < 1 || raw.length > 1000) throw new Error('Provide 1–1000 diagnostic reports.');
  const reports = raw.map((value) => diagnosticReport.parse(value));
  const cohorts = new Map<string, typeof reports>();
  for (const report of reports) {
    const key = [report.engine, report.model ?? 'unknown-model', report.voice].join('/');
    const group = cohorts.get(key) ?? [];
    group.push(report);
    cohorts.set(key, group);
  }
  return {
    schemaVersion: 1,
    evidence: 'browser-events',
    launchAcceptance: 'unverified',
    cohorts: [...cohorts].map(([configuration, group]) => ({
      configuration,
      reportCount: group.length,
      metrics: Object.fromEntries(
        names.options.map((name) => [
          name,
          percentiles(group.flatMap((report) => report.metrics[name].samples)),
        ]),
      ),
      failures: group.reduce((total, report) => total + report.counters.failures, 0),
      disconnects: group.reduce((total, report) => total + report.counters.disconnects, 0),
      rtcReports: group.filter((report) => report.rtc.available).length,
    })),
    remainingEvidence: [
      'Externally measured acoustic speech end, first audible response and interruption-to-silence.',
      'Actual authenticated saved results, provider hangup/expiry and billed voice/backend/tool costs.',
      'Physical mobile audio routes, lifecycle, battery and at least 100 representative session attempts.',
    ],
    limitations: [
      'Use exactly one final export per attempted session; exports contain no identifiers, so repeat exports cannot be deduplicated.',
      'Separate device/browser/network/scenario cohorts in separate input batches. Files do not establish real-provider or physical-device provenance.',
      'Percentiles are recomputed from retained bounded samples; event timings cannot pass acoustic acceptance thresholds. Unknown models remain separate.',
    ],
  };
}
