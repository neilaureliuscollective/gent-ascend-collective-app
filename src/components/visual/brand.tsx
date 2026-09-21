import Image from 'next/image';
export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`brand-lockup ${compact ? 'brand-compact' : ''}`}>
      <Image
        src="/brand/aurelius-seal.png"
        width={64}
        height={64}
        sizes="64px"
        alt=""
        className="brand-seal"
      />
      <span className="brand-type">
        AURELIUS<small>COLLECTIVE</small>
      </span>
    </span>
  );
}
