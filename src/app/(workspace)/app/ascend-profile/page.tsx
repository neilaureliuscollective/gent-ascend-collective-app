import Link from 'next/link';
import { AscendBaseline } from '@/components/profile/ascend-baseline';
import { readAscendProfile, ProfileStateError } from '@/domains/ascend-profile/service';
export default async function AscendProfile() {
  let facts;
  try { facts=await readAscendProfile(); }
  catch(error) {if(error instanceof ProfileStateError&&error.status===401)return <section className="panel"><h1>Your Ascend Profile</h1><p>Sign in to build your personal baseline with Aethelios.</p><Link href="/app/you">Your account →</Link></section>;throw error;}
  return <AscendBaseline initial={facts} />;
}
