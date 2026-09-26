import Link from 'next/link';
import { readDaily } from '@/domains/daily/service';
export default async function Ascend() {
  const daily = await readDaily();
  return <><div className="page-heading"><div><p className="eyebrow">Your Ascend Loop</p><h1>Give your direction a daily life.</h1></div></div><p className="lead">Begin from where you are. Choose what matters. Let what you learn shape your next step.</p><div className="ascend-path">{([
    ['01','Where am I?','Your baseline, preferences, and current context.','/app/ascend-profile','Review your baseline'],
    ['02','What matters?','A direction you chose and one goal worth acting on.','/app/goals','Set your direction'],
    ['03','What should I do?','Think it through with Aethelios, then confirm your next action.','/app/aethelios?starter=plan','Plan with Aethelios'],
    ['04','What did I do?','Record your check-in and the actions you actually completed.','/app','Open today'],
    ['05','What did I learn?','Reflect on what moved forward and what got in the way.','/app#evening-review','Review your day'],
    ['06','What changes next?','Look at your recorded history and carry forward what still matters.','/app/progress','See your progress'],
  ] as const).map(([n,title,copy,href,label])=><section className="panel" key={n}><span className="eyebrow">{n}</span><h2>{title}</h2><p>{copy}</p><Link className="text-link" href={href}>{label} →</Link></section>)}</div>{daily.profileDirection && <aside className="panel pilot-section"><p className="eyebrow">In your words</p><h2>{daily.profileDirection}</h2><Link href="/app/ascend-profile" className="text-link">Refine your direction →</Link></aside>}</>;
}
