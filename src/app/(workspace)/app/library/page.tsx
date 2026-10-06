import { libraryOverview } from '@/domains/workspace/overview';
import { IntelligenceLibrary } from '@/components/workspace/intelligence-library';
export const metadata = { title: 'Library' };
export default async function Library() {
  return <div className="intelligence-overview"><header><p className="eyebrow">AETHELIOS / LIBRARY</p><h1>What you carry forward.</h1><p>Conversations, explicitly confirmed memory and saved Studio work.</p></header><IntelligenceLibrary initial={await libraryOverview()} /></div>;
}
