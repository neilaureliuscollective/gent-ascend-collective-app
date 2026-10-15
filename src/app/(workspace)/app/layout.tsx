import { currentIdentity } from '@/domains/identity/current';
import { Shell } from '@/components/shell';
import { parseEnvironment } from '@/platform/environment';
import { currentFounderAccess } from '@/domains/access/founder';
export const dynamic = 'force-dynamic';
export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const signedIn = Boolean(await currentIdentity());
  const founderOffice = await currentFounderAccess().catch(() => false);
  return (
    <Shell
      signedIn={signedIn}
      founder={parseEnvironment(process.env).harnessEnabled}
      founderOffice={founderOffice}
    >
      {children}
    </Shell>
  );
}
