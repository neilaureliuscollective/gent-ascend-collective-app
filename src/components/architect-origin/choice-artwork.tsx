import type { ProjectContent } from '@/domains/architect-origin/schema';

/** Lightweight dimensional scenes. Not purchased stock and not a live 3D runtime. */
export function ChoiceArtwork({
  discipline,
  compact = false,
  featured = false,
}: {
  discipline: ProjectContent['discipline'];
  compact?: boolean;
  featured?: boolean;
}) {
  const className = [
    'origin-choice-art',
    compact ? 'origin-choice-art-compact' : '',
    featured ? 'origin-choice-art-featured' : '',
  ]
    .filter(Boolean)
    .join(' ');
  const uid = featured ? 'feat' : compact ? 'compact' : 'card';
  if (discipline === 'business') return <BusinessChamber className={className} uid={uid} />;
  if (discipline === 'application') return <ApplicationWindow className={className} uid={uid} />;
  if (discipline === 'product') return <ProductCube className={className} uid={uid} />;
  return <OpenInfinity className={className} uid={uid} />;
}

function Slab({ prefix }: { prefix: string }) {
  return (
    <g>
      <ellipse cx="160" cy="184" rx="108" ry="12" fill="#000" opacity=".55" />
      <path d="M52 168 L268 168 L252 186 L68 186 Z" fill={`url(#${prefix}-slab)`} stroke="#c4912f" strokeOpacity=".35" />
      <path d="M68 186 L252 186 L246 194 L74 194 Z" fill="#0a0c0b" />
      <path d="M60 170 L260 170 L256 174 L64 174 Z" fill="#f0e2b4" opacity=".18" />
    </g>
  );
}

function BusinessChamber({ className, uid }: { className: string; uid: string }) {
  const prefix = `origin-biz-${uid}`;
  return (
    <svg viewBox="0 0 320 200" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={`${prefix}-slab`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#3a3c38" />
          <stop offset="55%" stopColor="#1c1e1c" />
          <stop offset="100%" stopColor="#101210" />
        </linearGradient>
        <linearGradient id={`${prefix}-glass`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#7ea394" />
          <stop offset="35%" stopColor="#2d4a40" />
          <stop offset="100%" stopColor="#14221c" />
        </linearGradient>
        <linearGradient id={`${prefix}-roof`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f3e6b8" />
          <stop offset="40%" stopColor="#c4912f" />
          <stop offset="100%" stopColor="#245b48" />
        </linearGradient>
        <linearGradient id={`${prefix}-gold`} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#8a6420" />
          <stop offset="100%" stopColor="#e0b85a" />
        </linearGradient>
      </defs>
      <Slab prefix={prefix} />
      <path d="M78 166 L78 88 L160 36 L242 88 L242 166 Z" fill={`url(#${prefix}-glass)`} stroke="#e0b85a" strokeWidth="1.6" />
      <path d="M78 88 L160 36 L242 88 L160 118 Z" fill={`url(#${prefix}-roof)`} opacity=".9" />
      <path d="M160 36 L160 166" stroke="#e0b85a" strokeOpacity=".35" />
      <g fill={`url(#${prefix}-gold)`}>
        <rect x="96" y="100" width="18" height="20" rx="2" />
        <rect x="122" y="100" width="18" height="20" rx="2" />
        <rect x="180" y="100" width="18" height="20" rx="2" />
        <rect x="206" y="100" width="18" height="20" rx="2" />
        <rect x="96" y="128" width="18" height="20" rx="2" />
        <rect x="206" y="128" width="18" height="20" rx="2" />
      </g>
      <rect x="142" y="128" width="36" height="38" fill="#0d1210" stroke="#e0b85a" />
      <circle cx="102" cy="78" r="4" fill="#f3e6b8" />
      <circle cx="218" cy="78" r="4" fill="#f3e6b8" opacity=".75" />
    </svg>
  );
}

function ApplicationWindow({ className, uid }: { className: string; uid: string }) {
  const prefix = `origin-app-${uid}`;
  return (
    <svg viewBox="0 0 320 200" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={`${prefix}-slab`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#3a3c38" />
          <stop offset="100%" stopColor="#101210" />
        </linearGradient>
        <linearGradient id={`${prefix}-chrome`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4a524c" />
          <stop offset="100%" stopColor="#1a1e1c" />
        </linearGradient>
        <linearGradient id={`${prefix}-scene`} x1="0" y1="0" x2=".85" y2="1">
          <stop offset="0%" stopColor="#6d9a88" />
          <stop offset="42%" stopColor="#245b48" />
          <stop offset="100%" stopColor="#d7a84a" />
        </linearGradient>
      </defs>
      <Slab prefix={prefix} />
      <g transform="translate(28,22)">
        <rect x="10" y="12" width="244" height="140" rx="16" fill="#000" opacity=".35" />
        <rect width="248" height="136" rx="16" fill={`url(#${prefix}-chrome)`} stroke="#e0b85a" strokeWidth="1.6" />
        <rect x="12" y="12" width="58" height="112" rx="10" fill="#121614" />
        <rect x="22" y="26" width="38" height="7" rx="3" fill="#8a8e88" />
        <rect x="22" y="42" width="30" height="5" rx="2" fill="#4a4e4a" />
        <rect x="22" y="54" width="34" height="5" rx="2" fill="#4a4e4a" />
        <rect x="22" y="66" width="26" height="5" rx="2" fill="#4a4e4a" />
        <rect x="80" y="16" width="154" height="104" rx="10" fill={`url(#${prefix}-scene)`} />
        <path d="M80 78 C118 54 164 96 234 62 L234 120 L80 120 Z" fill="#0b0e0d" opacity=".28" />
        <circle cx="104" cy="36" r="8" fill="#f6f1de" opacity=".45" />
      </g>
    </svg>
  );
}

function ProductCube({ className, uid }: { className: string; uid: string }) {
  const prefix = `origin-cube-${uid}`;
  return (
    <svg viewBox="0 0 320 200" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={`${prefix}-slab`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#3a3c38" />
          <stop offset="100%" stopColor="#101210" />
        </linearGradient>
        <linearGradient id={`${prefix}-top`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#8fbfac" />
          <stop offset="50%" stopColor="#2f6b56" />
          <stop offset="100%" stopColor="#163028" />
        </linearGradient>
        <linearGradient id={`${prefix}-left`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#2a3c34" />
          <stop offset="100%" stopColor="#101614" />
        </linearGradient>
        <linearGradient id={`${prefix}-right`} x1="1" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f0d27a" />
          <stop offset="45%" stopColor="#c4912f" />
          <stop offset="100%" stopColor="#2a2414" />
        </linearGradient>
      </defs>
      <Slab prefix={prefix} />
      <path d="M160 28 L242 72 L160 116 L78 72 Z" fill={`url(#${prefix}-top)`} stroke="#e0b85a" strokeWidth="1.4" />
      <path d="M78 72 L160 116 L160 172 L78 128 Z" fill={`url(#${prefix}-left)`} stroke="#8a9088" />
      <path d="M242 72 L160 116 L160 172 L242 128 Z" fill={`url(#${prefix}-right)`} stroke="#e0b85a" />
      <path d="M160 28 L182 40 L160 52 L138 40 Z" fill="#fff6d6" opacity=".28" />
    </svg>
  );
}

function OpenInfinity({ className, uid }: { className: string; uid: string }) {
  const prefix = `origin-inf-${uid}`;
  return (
    <svg viewBox="0 0 320 200" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={`${prefix}-slab`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#3a3c38" />
          <stop offset="100%" stopColor="#101210" />
        </linearGradient>
        <linearGradient id={`${prefix}-glass`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fff8e8" />
          <stop offset="22%" stopColor="#c5d4cc" />
          <stop offset="58%" stopColor="#3d7a64" />
          <stop offset="100%" stopColor="#e0b85a" />
        </linearGradient>
      </defs>
      <Slab prefix={prefix} />
      <path
        d="M74 98 C74 52 128 52 160 98 C192 144 246 144 246 98 C246 52 192 52 160 98 C128 144 74 144 74 98 Z"
        fill="none"
        stroke="#000"
        strokeWidth="26"
        strokeLinecap="round"
        opacity=".3"
        transform="translate(0 8)"
      />
      <path
        d="M74 98 C74 52 128 52 160 98 C192 144 246 144 246 98 C246 52 192 52 160 98 C128 144 74 144 74 98 Z"
        fill="none"
        stroke={`url(#${prefix}-glass)`}
        strokeWidth="20"
        strokeLinecap="round"
      />
      <path
        d="M74 98 C74 52 128 52 160 98 C192 144 246 144 246 98"
        fill="none"
        stroke="#fff"
        strokeWidth="4"
        strokeLinecap="round"
        opacity=".35"
      />
    </svg>
  );
}
