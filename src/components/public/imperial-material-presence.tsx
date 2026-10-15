import Image from 'next/image';
import { brand } from '@/platform/brand';

/** Decorative material study, not a simulated intelligence state or product control. */
export function ImperialMaterialPresence() {
  return (
    <div className="imperial-presence" aria-hidden="true">
      <div className="imperial-presence-architecture">
        <span className="imperial-plate imperial-plate-steel" />
        <span className="imperial-plate imperial-plate-green" />
        <span className="imperial-plate imperial-plate-carbon" />
        <Image
          className="imperial-presence-mark"
          src={brand.lockup}
          alt=""
          width={1254}
          height={1254}
          sizes="(max-width: 900px) 70vw, 420px"
          preload
        />
      </div>
      <div className="imperial-presence-caption">
        <span>AETHELIOS</span>
        <span>THE HUMAN ASCENDANCE</span>
      </div>
    </div>
  );
}
