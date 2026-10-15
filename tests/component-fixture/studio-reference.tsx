import { StudioWorkspace } from '@/components/aurelius/studio-workspace';
import '@/app/(workspace)/app/studio/studio-production.css';
/** Isolated synthetic reference handoff fixture, not an application identity or provider. */
export function StudioReferenceFixture() {
  const params = new URLSearchParams(window.location.search);
  return (
    <StudioWorkspace
      initialProject={params.get('project') ?? undefined}
      initialReference={params.get('reference') ?? undefined}
    />
  );
}
