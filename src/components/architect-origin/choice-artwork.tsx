import type { ProjectContent } from '@/domains/architect-origin/schema';

/** Lightweight dimensional scenes. Not purchased stock and not a live 3D runtime. */
export function ChoiceArtwork({
  discipline,
  compact = false,
}: {
  discipline: ProjectContent['discipline'];
  compact?: boolean;
}) {
  const className = compact ? 'origin-choice-art origin-choice-art-compact' : 'origin-choice-art';
  if (discipline === 'business') return <BusinessChamber className={className} />;
  if (discipline === 'application') return <ApplicationWindow className={className} />;
  if (discipline === 'product') return <ProductCube className={className} />;
  return <OpenInfinity className={className} />;
}

function BusinessChamber({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 320 200" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="origin-biz-glass" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#3d5c52" />
          <stop offset="40%" stopColor="#1a2420" />
          <stop offset="100%" stopColor="#0b0e0d" />
        </linearGradient>
        <linearGradient id="origin-biz-gold" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#6b4a16" />
          <stop offset="100%" stopColor="#c4912f" />
        </linearGradient>
        <linearGradient id="origin-biz-light" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#e8e4d4" stopOpacity=".35" />
          <stop offset="100%" stopColor="#c4912f" stopOpacity="0" />
        </linearGradient>
      </defs>
      <ellipse cx="160" cy="180" rx="78" ry="8" fill="#000" opacity=".5" />
      <path d="M96 168 L96 92 L160 58 L224 92 L224 168 Z" fill="url(#origin-biz-glass)" stroke="#c4912f" strokeWidth="1.1" />
      <path d="M96 92 L160 58 L224 92 L160 118 Z" fill="url(#origin-biz-light)" />
      <g fill="url(#origin-biz-gold)" opacity=".85">
        <rect x="118" y="108" width="10" height="12" rx="1" />
        <rect x="136" y="108" width="10" height="12" rx="1" />
        <rect x="174" y="108" width="10" height="12" rx="1" />
        <rect x="192" y="108" width="10" height="12" rx="1" />
        <rect x="118" y="132" width="10" height="12" rx="1" />
        <rect x="192" y="132" width="10" height="12" rx="1" />
      </g>
      <rect x="148" y="140" width="24" height="28" fill="#0b0e0d" stroke="#c4912f" />
    </svg>
  );
}

function ApplicationWindow({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 320 200" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="origin-app-chrome" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2a2e2c" />
          <stop offset="100%" stopColor="#121412" />
        </linearGradient>
        <linearGradient id="origin-app-scene" x1="0" y1="0" x2=".8" y2="1">
          <stop offset="0%" stopColor="#245b48" />
          <stop offset="70%" stopColor="#111814" />
          <stop offset="100%" stopColor="#c4912f" stopOpacity=".28" />
        </linearGradient>
      </defs>
      <ellipse cx="168" cy="180" rx="92" ry="8" fill="#000" opacity=".45" />
      <g transform="translate(48,36)">
        <rect width="224" height="132" rx="12" fill="url(#origin-app-chrome)" stroke="#c4912f" strokeWidth="1.3" />
        <rect x="10" y="10" width="48" height="112" rx="6" fill="#0c0f0e" />
        <rect x="18" y="22" width="28" height="4" rx="2" fill="#3a3a3a" />
        <rect x="18" y="34" width="22" height="3" rx="1" fill="#2a2a2a" />
        <rect x="68" y="18" width="144" height="96" rx="8" fill="url(#origin-app-scene)" />
        <circle cx="86" cy="36" r="5" fill="#e8e9e2" opacity=".28" />
      </g>
    </svg>
  );
}

function ProductCube({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 320 200" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="origin-cube-top" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#3d6a5c" />
          <stop offset="100%" stopColor="#163028" />
        </linearGradient>
        <linearGradient id="origin-cube-left" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#1b2a24" />
          <stop offset="100%" stopColor="#0a100e" />
        </linearGradient>
        <linearGradient id="origin-cube-right" x1="1" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#c4912f" stopOpacity=".45" />
          <stop offset="100%" stopColor="#141414" />
        </linearGradient>
      </defs>
      <ellipse cx="160" cy="178" rx="70" ry="8" fill="#000" opacity=".5" />
      <path d="M160 44 L226 78 L160 112 L94 78 Z" fill="url(#origin-cube-top)" stroke="#c4912f" />
      <path d="M94 78 L160 112 L160 168 L94 134 Z" fill="url(#origin-cube-left)" stroke="#565856" />
      <path d="M226 78 L160 112 L160 168 L226 134 Z" fill="url(#origin-cube-right)" stroke="#c4912f" />
    </svg>
  );
}

function OpenInfinity({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 320 200" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="origin-inf-glass" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#d7ddd8" />
          <stop offset="35%" stopColor="#8aa39a" />
          <stop offset="70%" stopColor="#245b48" />
          <stop offset="100%" stopColor="#c4912f" />
        </linearGradient>
      </defs>
      <ellipse cx="160" cy="178" rx="86" ry="8" fill="#000" opacity=".45" />
      <path
        d="M92 108 C92 72 132 72 160 108 C188 144 228 144 228 108 C228 72 188 72 160 108 C132 144 92 144 92 108 Z"
        fill="none"
        stroke="url(#origin-inf-glass)"
        strokeWidth="16"
        strokeLinecap="round"
      />
    </svg>
  );
}
