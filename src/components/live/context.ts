'use client';
import { createContext } from 'react';
import type { LiveController } from '@/domains/live/controller';
export const LiveContext = createContext<LiveController | null>(null);
export const LiveAvailabilityContext = createContext<string | null>(
  'Aethelios Live is unavailable on this deployment.',
);
