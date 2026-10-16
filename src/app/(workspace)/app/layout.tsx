import { Shell } from '@/components/shell';
import { parseEnvironment } from '@/platform/environment';
import { currentFounderAccess } from '@/domains/access/founder';
import { currentIdentity } from '@/domains/identity/current';
export const dynamic = 'force-dynamic';
export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const identity = await currentIdentity().catch(() => null);
  const founderOffice = await currentFounderAccess().catch(() => false);
  return (
    <Shell
      authUserId={identity?.authUserId ?? null}
      founder={parseEnvironment(process.env).harnessEnabled}
      founderOffice={founderOffice}
    >
      {children}
    </Shell>
  );
}
