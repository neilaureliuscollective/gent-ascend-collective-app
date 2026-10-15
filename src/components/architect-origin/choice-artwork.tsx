import { useId } from 'react';
import type { ProjectContent } from '@/domains/architect-origin/schema';

/** One architectural material study, reconfigured by path. No photographic plates. */
export function ChoiceArtwork({ discipline, compact = false, featured = false }: {
  discipline: ProjectContent['discipline']; compact?: boolean; featured?: boolean;
}) {
  const id = useId().replaceAll(':', '');
  const levels = discipline === 'business' ? [0, 1, 2] : discipline === 'product' ? [0, 1] : [0];
  return (
    <svg viewBox="0 0 320 200" className={`origin-choice-art${compact ? ' origin-choice-art-compact' : ''}${featured ? ' origin-choice-art-featured' : ''}`} aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-glass`} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#4b7866" stopOpacity=".85" />
          <stop offset="1" stopColor="#0b2620" />
        </linearGradient>
        <linearGradient id={`${id}-edge`} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#e8c980" /><stop offset="1" stopColor="#315345" />
        </linearGradient>
      </defs>
      <path d="M20 154 160 84 300 154 160 224Z" fill="#080d0b" stroke="#294236" />
      <path d="M20 154 160 224M160 84v140M300 154H20" stroke="#294236" opacity=".5" />
      {levels.map((level) => (
        <g key={level} transform={`translate(0 ${-level * 24})`}>
          <path d="M72 133 160 89 248 133 160 177Z" fill={`url(#${id}-glass)`} stroke={`url(#${id}-edge)`} />
          <path d="M72 133v9l88 44 88-44v-9l-88 44Z" fill="#14251e" stroke="#315345" />
        </g>
      ))}
      {discipline === 'application' ? (
        <g transform="translate(88 42) skewY(26)">
          <rect width="144" height="88" rx="4" fill={`url(#${id}-glass)`} stroke={`url(#${id}-edge)`} />
          <path d="M0 18h144M34 18v70" stroke="#aac2ad" opacity=".5" />
          <path d="M46 32h72M46 45h48M46 62h62" stroke="#dce9d6" strokeWidth="3" opacity=".7" />
          <path d="M10 32h14M10 44h14" stroke="#e8c980" strokeWidth="3" />
        </g>
      ) : null}
      {discipline === 'custom' ? <path d="m104 117 56-28 56 28-56 28Zm0-28 56-28 56 28M160 61V37" fill="none" stroke={`url(#${id}-edge)`} strokeWidth="2" strokeDasharray="5 4" /> : null}
      <path d="m72 133 88 44" stroke="#e8c980" strokeWidth="2" />
    </svg>
  );
}
