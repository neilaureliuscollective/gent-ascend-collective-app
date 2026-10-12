import { useEffect, useState } from 'react';
import { ArtifactSurface } from '@/components/live/artifacts';
import { LiveController } from '@/domains/live/controller';
export function LiveArtifactsFixture() {
  const [controller] = useState(() => new LiveController());
  useEffect(() => {
    controller.bindConversation('ed000000-0000-4000-8000-000000000001');
  }, [controller]);
  return (
    <>
      <p>Synthetic artifact fixture; no real account or provider generation.</p>
      <ArtifactSurface controller={controller} />
    </>
  );
}
