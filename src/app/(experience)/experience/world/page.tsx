import { connection } from 'next/server';
import { WholeManWorld } from '@/components/world/whole-man-world';
export default async function WorldPage() {
  // Render the URL-selected scene and image hint in the first response instead of a JS-only shell.
  await connection();
  return <WholeManWorld />;
}
