import type { ProjectContent } from '@/domains/architect-origin/schema';

/** Lightweight dimensional chambers. Not purchased stock and not a live 3D runtime. */
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

function ChamberDefs({ prefix }: { prefix: string }) {
  return (
    <>
      <linearGradient id={`${prefix}-room`} x1="0" y1="0" x2="0.2" y2="1">
        <stop offset="0%" stopColor="#6a6c60" />
        <stop offset="28%" stopColor="#3c3e36" />
        <stop offset="100%" stopColor="#161814" />
      </linearGradient>
      <linearGradient id={`${prefix}-wall-l`} x1="1" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#7a7c70" />
        <stop offset="100%" stopColor="#2a2c26" />
      </linearGradient>
      <linearGradient id={`${prefix}-wall-r`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#4a4e46" />
        <stop offset="100%" stopColor="#121410" />
      </linearGradient>
      <linearGradient id={`${prefix}-floor`} x1="0.5" y1="0" x2="0.5" y2="1">
        <stop offset="0%" stopColor="#4a4c44" />
        <stop offset="45%" stopColor="#242620" />
        <stop offset="100%" stopColor="#0e100e" />
      </linearGradient>
      <radialGradient id={`${prefix}-lamp`} cx="16%" cy="4%" r="70%">
        <stop offset="0%" stopColor="#fff3c8" stopOpacity=".55" />
        <stop offset="32%" stopColor="#c4912f" stopOpacity=".22" />
        <stop offset="100%" stopColor="#c4912f" stopOpacity="0" />
      </radialGradient>
      <linearGradient id={`${prefix}-slab`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#5a5c54" />
        <stop offset="40%" stopColor="#2c2e2a" />
        <stop offset="100%" stopColor="#121410" />
      </linearGradient>
      <linearGradient id={`${prefix}-glass`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#8fb8a8" />
        <stop offset="28%" stopColor="#3d6a5c" />
        <stop offset="72%" stopColor="#163028" />
        <stop offset="100%" stopColor="#0b1a14" />
      </linearGradient>
    </>
  );
}

function Chamber({ prefix }: { prefix: string }) {
  return (
    <g>
      <rect width="320" height="200" fill={`url(#${prefix}-room)`} />
      <path d="M0 0 L68 26 L68 168 L0 200 Z" fill={`url(#${prefix}-wall-l)`} />
      <path d="M320 0 L252 26 L252 168 L320 200 Z" fill={`url(#${prefix}-wall-r)`} />
      <path d="M0 0 L68 26 L252 26 L320 0 Z" fill="#8a8c80" opacity=".28" />
      <path d="M68 168 L252 168 L320 200 L0 200 Z" fill={`url(#${prefix}-floor)`} />
      <path d="M68 26 L68 168" stroke="#c8c2a8" strokeOpacity=".35" />
      <path d="M252 26 L252 168" stroke="#000" strokeOpacity=".35" />
      <rect width="320" height="200" fill={`url(#${prefix}-lamp)`} />
      <path d="M68 168 L252 168" stroke="#e0b85a" strokeOpacity=".55" />
      <path d="M14 40 L14 158" stroke="#3d6a5c" strokeOpacity=".7" strokeWidth="10" />
      <path d="M306 40 L306 158" stroke="#245b48" strokeOpacity=".5" strokeWidth="10" />
      <path d="M14 70 L14 88" stroke="#8fb8a8" strokeOpacity=".45" strokeWidth="4" />
      <ellipse cx="160" cy="186" rx="108" ry="10" fill="#000" opacity=".55" />
      <path
        d="M54 164 L266 164 L250 182 L70 182 Z"
        fill={`url(#${prefix}-slab)`}
        stroke="#c4912f"
        strokeOpacity=".4"
      />
      <path d="M70 182 L250 182 L244 190 L76 190 Z" fill="#0a0c0b" />
      <path d="M62 166 L258 166 L254 170 L66 170 Z" fill="#f0e2b4" opacity=".2" />
    </g>
  );
}

function BusinessChamber({ className, uid }: { className: string; uid: string }) {
  const prefix = `origin-biz-${uid}`;
  return (
    <svg viewBox="0 0 320 200" className={className} aria-hidden="true">
      <defs>
        <ChamberDefs prefix={prefix} />
        <linearGradient id={`${prefix}-roof`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f3e6b8" />
          <stop offset="36%" stopColor="#c4912f" />
          <stop offset="100%" stopColor="#245b48" />
        </linearGradient>
        <linearGradient id={`${prefix}-gold`} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#8a6420" />
          <stop offset="100%" stopColor="#e0b85a" />
        </linearGradient>
      </defs>
      <Chamber prefix={prefix} />
      <path
        d="M86 162 L86 86 L160 38 L234 86 L234 162 Z"
        fill={`url(#${prefix}-glass)`}
        stroke="#e0b85a"
        strokeWidth="1.4"
      />
      <path d="M86 86 L160 38 L234 86 L160 114 Z" fill={`url(#${prefix}-roof)`} opacity=".92" />
      <path d="M160 38 L160 162" stroke="#e0b85a" strokeOpacity=".32" />
      <g fill={`url(#${prefix}-gold)`}>
        <rect x="102" y="98" width="16" height="18" rx="2" />
        <rect x="124" y="98" width="16" height="18" rx="2" />
        <rect x="180" y="98" width="16" height="18" rx="2" />
        <rect x="202" y="98" width="16" height="18" rx="2" />
        <rect x="102" y="124" width="16" height="18" rx="2" />
        <rect x="202" y="124" width="16" height="18" rx="2" />
      </g>
      <rect x="146" y="124" width="28" height="38" fill="#0d1210" stroke="#e0b85a" />
      <circle cx="108" cy="76" r="3.5" fill="#f3e6b8" />
      <circle cx="212" cy="76" r="3.5" fill="#f3e6b8" opacity=".7" />
    </svg>
  );
}

function ApplicationWindow({ className, uid }: { className: string; uid: string }) {
  const prefix = `origin-app-${uid}`;
  return (
    <svg viewBox="0 0 320 200" className={className} aria-hidden="true">
      <defs>
        <ChamberDefs prefix={prefix} />
        <linearGradient id={`${prefix}-chrome`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#5a625c" />
          <stop offset="40%" stopColor="#2a302c" />
          <stop offset="100%" stopColor="#121614" />
        </linearGradient>
        <linearGradient id={`${prefix}-scene`} x1="0" y1="0" x2=".85" y2="1">
          <stop offset="0%" stopColor="#8fb8a8" />
          <stop offset="38%" stopColor="#245b48" />
          <stop offset="100%" stopColor="#d7a84a" />
        </linearGradient>
      </defs>
      <Chamber prefix={prefix} />
      <g transform="translate(36,28)">
        <rect x="8" y="10" width="232" height="128" rx="14" fill="#000" opacity=".38" />
        <rect width="236" height="124" rx="14" fill={`url(#${prefix}-chrome)`} stroke="#e0b85a" strokeWidth="1.5" />
        <rect x="10" y="10" width="54" height="104" rx="9" fill="#101412" />
        <rect x="20" y="24" width="34" height="6" rx="3" fill="#c4912f" opacity=".7" />
        <rect x="20" y="40" width="28" height="4" rx="2" fill="#6a706a" />
        <rect x="20" y="50" width="32" height="4" rx="2" fill="#4a504a" />
        <rect x="20" y="60" width="24" height="4" rx="2" fill="#4a504a" />
        <rect x="74" y="14" width="150" height="96" rx="9" fill={`url(#${prefix}-scene)`} />
        <path d="M74 72 C110 52 154 88 224 58 L224 110 L74 110 Z" fill="#0b0e0d" opacity=".28" />
        <circle cx="96" cy="32" r="7" fill="#f6f1de" opacity=".4" />
        <rect x="10" y="118" width="36" height="3" rx="1.5" fill="#c4912f" opacity=".45" />
      </g>
    </svg>
  );
}

function ProductCube({ className, uid }: { className: string; uid: string }) {
  const prefix = `origin-cube-${uid}`;
  return (
    <svg viewBox="0 0 320 200" className={className} aria-hidden="true">
      <defs>
        <ChamberDefs prefix={prefix} />
        <linearGradient id={`${prefix}-top`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#9ecbb8" />
          <stop offset="48%" stopColor="#2f6b56" />
          <stop offset="100%" stopColor="#163028" />
        </linearGradient>
        <linearGradient id={`${prefix}-left`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#2a3c34" />
          <stop offset="100%" stopColor="#101614" />
        </linearGradient>
        <linearGradient id={`${prefix}-right`} x1="1" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f0d27a" />
          <stop offset="42%" stopColor="#c4912f" />
          <stop offset="100%" stopColor="#2a2414" />
        </linearGradient>
      </defs>
      <Chamber prefix={prefix} />
      <path d="M160 36 L236 76 L160 116 L84 76 Z" fill={`url(#${prefix}-top)`} stroke="#e0b85a" strokeWidth="1.3" />
      <path d="M84 76 L160 116 L160 166 L84 126 Z" fill={`url(#${prefix}-left)`} stroke="#8a9088" />
      <path d="M236 76 L160 116 L160 166 L236 126 Z" fill={`url(#${prefix}-right)`} stroke="#e0b85a" />
      <path d="M160 36 L180 46 L160 56 L140 46 Z" fill="#fff6d6" opacity=".3" />
    </svg>
  );
}

function OpenInfinity({ className, uid }: { className: string; uid: string }) {
  const prefix = `origin-inf-${uid}`;
  return (
    <svg viewBox="0 0 320 200" className={className} aria-hidden="true">
      <defs>
        <ChamberDefs prefix={prefix} />
        <linearGradient id={`${prefix}-band`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fff8e8" />
          <stop offset="22%" stopColor="#c5d4cc" />
          <stop offset="58%" stopColor="#3d7a64" />
          <stop offset="100%" stopColor="#e0b85a" />
        </linearGradient>
      </defs>
      <Chamber prefix={prefix} />
      <path
        d="M78 96 C78 54 128 54 160 96 C192 138 242 138 242 96 C242 54 192 54 160 96 C128 138 78 138 78 96 Z"
        fill="none"
        stroke="#000"
        strokeWidth="24"
        strokeLinecap="round"
        opacity=".28"
        transform="translate(0 8)"
      />
      <path
        d="M78 96 C78 54 128 54 160 96 C192 138 242 138 242 96 C242 54 192 54 160 96 C128 138 78 138 78 96 Z"
        fill="none"
        stroke={`url(#${prefix}-band)`}
        strokeWidth="18"
        strokeLinecap="round"
      />
      <path
        d="M78 96 C78 54 128 54 160 96 C192 138 242 138 242 96"
        fill="none"
        stroke="#fff"
        strokeWidth="3.5"
        strokeLinecap="round"
        opacity=".32"
      />
    </svg>
  );
}
