import Image from 'next/image';
import { brand } from '@/platform/brand';
export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`brand-lockup ${compact ? 'brand-compact' : ''}`}>
      <Image src={brand.crest} width={64} height={64} sizes="64px" alt="" className="brand-seal" />
      <span className="brand-type">
        GENT ASCEND<small>COLLECTIVE</small>
      </span>
    </span>
  );
}
