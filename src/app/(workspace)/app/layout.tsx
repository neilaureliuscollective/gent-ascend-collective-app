import { Shell } from '@/components/shell';
import { parseEnvironment } from '@/platform/environment';
export const dynamic = 'force-dynamic';
export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return <Shell founder={parseEnvironment(process.env).harnessEnabled}>{children}</Shell>;
}
