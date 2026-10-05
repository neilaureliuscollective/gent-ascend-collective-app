'use client';
import { useEffect } from 'react';
import { useReportWebVitals } from 'next/web-vitals';
import { performancePayload } from '@/domains/release/performance';

// One stable callback; document-level vitals describe the initial navigation, not SPA routes.
let initialPath: string | null = null;
const emitted = new Set<string>();
const report: Parameters<typeof useReportWebVitals>[0] = (metric) => {
  if (
    navigator.doNotTrack === '1' ||
    (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl
  )
    return;
  if (emitted.has(metric.id) || emitted.size >= 36) return;
  const payload = performancePayload(metric, initialPath ?? '/', window.innerWidth);
  if (!payload) return;
  emitted.add(metric.id);
  void fetch('/api/monitoring/performance', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    credentials: 'omit',
    keepalive: true,
  }).catch(() => undefined);
};
export function PerformanceReporting() {
  // Hook callbacks only run after hydration. Capture the first document path once.
  useEffect(() => {
    if (initialPath === null) initialPath = window.location.pathname;
  }, []);
  useReportWebVitals(report);
  return null;
}
