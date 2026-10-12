'use client';
import { createContext } from 'react';
import type { LiveController } from '@/domains/live/controller';
export const LiveContext = createContext<LiveController | null>(null);
