import Link from 'next/link';
import { listCaptures, CaptureError } from '@/domains/capture/service';
export default async function Captures() {
  let captures;
  try { captures = await listCaptures(); } catch (error) {
    if (error instanceof CaptureError && error.status === 401) return <section className="panel"><h1>Your capture inbox</h1><p>Sign in to keep your thoughts across days.</p><Link href="/you">Your account →</Link></section>;
    throw error;
  }
  return <><p className="eyebrow">YOUR OPEN LOOPS</p><h1>Capture inbox.</h1><p className="lead">Thoughts you saved without forcing a decision about them.</p>
    <div className="loop-history">{captures.length ? captures.map((capture) => <section className="panel" key={capture.id}><span className="eyebrow">{new Date(capture.created_at).toLocaleDateString()}</span><p>{capture.content}</p></section>) : <section className="panel"><h2>A clear inbox.</h2><p>Capture is available from the top of every screen.</p></section>}</div>
  </>;
}
