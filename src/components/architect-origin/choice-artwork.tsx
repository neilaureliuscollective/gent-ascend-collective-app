import type { ProjectContent } from '@/domains/architect-origin/schema';

/** Lightweight dimensional scenes. Not purchased stock and not a live 3D runtime. */
export function ChoiceArtwork({ discipline }: { discipline: ProjectContent['discipline'] }) {
  if (discipline === 'business') return <BusinessChamber />;
  if (discipline === 'application') return <ApplicationPlanes />;
  if (discipline === 'product') return <ProductModule />;
  return <OpenRings />;
}

function BusinessChamber() {
  return (
    <svg viewBox="0 0 320 200" className="origin-choice-art" aria-hidden="true">
      <defs>
        <linearGradient id="origin-biz-face" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#2a2a2a" />
          <stop offset="55%" stopColor="#161616" />
          <stop offset="100%" stopColor="#0d0d0d" />
        </linearGradient>
        <linearGradient id="origin-biz-gold" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#6b4a16" />
          <stop offset="100%" stopColor="#c4912f" />
        </linearGradient>
      </defs>
      <ellipse cx="160" cy="176" rx="92" ry="10" fill="#000" opacity=".45" />
      <g fill="url(#origin-biz-face)" stroke="#3a3a3a" strokeWidth="1">
        <path d="M86 150 L86 78 L148 58 L148 150 Z" />
        <path d="M148 58 L210 78 L210 150 L148 150 Z" />
        <path d="M118 150 L118 42 L180 24 L180 64 L148 58 L148 150 Z" />
        <path d="M180 24 L242 44 L242 118 L210 128 L210 78 L180 64 Z" />
      </g>
      <g fill="url(#origin-biz-gold)" opacity=".9">
        <rect x="98" y="92" width="8" height="10" rx="1" />
        <rect x="114" y="92" width="8" height="10" rx="1" />
        <rect x="98" y="112" width="8" height="10" rx="1" />
        <rect x="162" y="86" width="8" height="10" rx="1" />
        <rect x="178" y="86" width="8" height="10" rx="1" />
        <rect x="194" y="100" width="8" height="10" rx="1" />
        <rect x="132" y="48" width="7" height="9" rx="1" />
        <rect x="148" y="40" width="7" height="9" rx="1" />
        <rect x="196" y="52" width="7" height="9" rx="1" />
      </g>
      <path d="M118 150 L242 118" stroke="#c4912f" strokeWidth=".6" opacity=".35" />
    </svg>
  );
}

function ApplicationPlanes() {
  return (
    <svg viewBox="0 0 320 200" className="origin-choice-art" aria-hidden="true">
      <defs>
        <linearGradient id="origin-app-glass" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#2b3330" />
          <stop offset="45%" stopColor="#151515" />
          <stop offset="100%" stopColor="#0c0c0c" />
        </linearGradient>
        <linearGradient id="origin-app-scene" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#245b48" />
          <stop offset="55%" stopColor="#1a1a1a" />
          <stop offset="100%" stopColor="#c4912f" stopOpacity=".35" />
        </linearGradient>
      </defs>
      <ellipse cx="168" cy="178" rx="100" ry="9" fill="#000" opacity=".4" />
      <g transform="translate(36,38) rotate(-8)">
        <rect
          width="148"
          height="104"
          rx="10"
          fill="url(#origin-app-glass)"
          stroke="#c4912f"
          strokeWidth="1.2"
        />
        <rect x="10" y="12" width="36" height="6" rx="2" fill="#3a3a3a" />
        <rect x="10" y="24" width="52" height="4" rx="2" fill="#2a2a2a" />
        <rect x="10" y="34" width="44" height="4" rx="2" fill="#2a2a2a" />
      </g>
      <g transform="translate(78,28) rotate(-2)">
        <rect
          width="156"
          height="112"
          rx="10"
          fill="url(#origin-app-glass)"
          stroke="#6a6a6a"
          strokeWidth="1"
        />
        <rect x="12" y="14" width="40" height="6" rx="2" fill="#3a3a3a" />
        <rect x="78" y="22" width="64" height="72" rx="6" fill="url(#origin-app-scene)" />
      </g>
      <g transform="translate(128,22) rotate(6)">
        <rect
          width="150"
          height="108"
          rx="10"
          fill="url(#origin-app-glass)"
          stroke="#c4912f"
          strokeWidth="1.4"
        />
        <rect x="14" y="16" width="122" height="76" rx="6" fill="url(#origin-app-scene)" />
        <circle cx="36" cy="28" r="4" fill="#e8e9e2" opacity=".35" />
      </g>
    </svg>
  );
}

function ProductModule() {
  return (
    <svg viewBox="0 0 320 200" className="origin-choice-art" aria-hidden="true">
      <defs>
        <linearGradient id="origin-prod-top" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#3a3a3a" />
          <stop offset="100%" stopColor="#161616" />
        </linearGradient>
        <linearGradient id="origin-prod-side" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#1f1f1f" />
          <stop offset="100%" stopColor="#0a0a0a" />
        </linearGradient>
      </defs>
      <ellipse cx="160" cy="176" rx="86" ry="10" fill="#000" opacity=".45" />
      <path d="M160 36 L230 70 L160 104 L90 70 Z" fill="url(#origin-prod-top)" stroke="#c4912f" />
      <path d="M90 70 L160 104 L160 164 L90 128 Z" fill="url(#origin-prod-side)" stroke="#565856" />
      <path d="M230 70 L160 104 L160 164 L230 128 Z" fill="#141414" stroke="#c4912f" />
      <path d="M160 36 L160 104" stroke="#c4912f" strokeWidth="1.2" />
      <path d="M125 88 L160 104 L195 88" stroke="#c4912f" opacity=".5" fill="none" />
      <circle cx="160" cy="70" r="4" fill="#c4912f" />
      <circle cx="124" cy="118" r="3" fill="#245b48" />
      <circle cx="196" cy="118" r="3" fill="#245b48" />
    </svg>
  );
}

function OpenRings() {
  return (
    <svg viewBox="0 0 320 200" className="origin-choice-art" aria-hidden="true">
      <defs>
        <linearGradient id="origin-ring-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#e0bb6a" />
          <stop offset="45%" stopColor="#c4912f" />
          <stop offset="100%" stopColor="#6b4a16" />
        </linearGradient>
        <linearGradient id="origin-ring-steel" x1="1" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#8a8e8a" />
          <stop offset="40%" stopColor="#2a2a2a" />
          <stop offset="100%" stopColor="#111" />
        </linearGradient>
      </defs>
      <ellipse cx="168" cy="176" rx="90" ry="10" fill="#000" opacity=".4" />
      <ellipse
        cx="132"
        cy="108"
        rx="58"
        ry="22"
        fill="none"
        stroke="url(#origin-ring-steel)"
        strokeWidth="14"
        transform="rotate(-28 132 108)"
      />
      <ellipse
        cx="186"
        cy="96"
        rx="58"
        ry="22"
        fill="none"
        stroke="url(#origin-ring-gold)"
        strokeWidth="14"
        transform="rotate(18 186 96)"
      />
      <ellipse
        cx="154"
        cy="118"
        rx="50"
        ry="18"
        fill="none"
        stroke="#1a1a1a"
        strokeWidth="10"
        transform="rotate(-8 154 118)"
      />
    </svg>
  );
}
