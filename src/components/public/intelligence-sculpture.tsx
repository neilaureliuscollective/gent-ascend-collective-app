'use client';
import { AureliusPresence } from '@/components/visual/aurelius-presence';
import { useWorldStill } from './cinematic-world';

/** The same presentation-only renderer and fallback used by member Aethelios. */
export function IntelligenceSculpture() {
  const still = useWorldStill();
  return (
    <div className="estate-sculpture" aria-hidden="true">
      <AureliusPresence enhanced state="ready" motionEnabled={!still} loadAhead />
    </div>
  );
}
