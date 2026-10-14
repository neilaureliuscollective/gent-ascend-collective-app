import Link from 'next/link';
import type { AttentionItem } from '@/domains/command-home/model';

export function CommandAttention({ items }: { items: AttentionItem[] }) {
  if (!items.length) return null;
  return (
    <section className="command-needs" aria-labelledby="command-needs-title">
      <header>
        <p className="eyebrow">Attention from saved records</p>
        <h2 id="command-needs-title">Needs you</h2>
      </header>
      <p className="command-needs-note">
        Only recorded items. A review suggestion is not a formal approval and not a running job.
      </p>
      <ul>
        {items.map((item) => (
          <li key={item.id}>
            <Link href={item.href}>
              <span className="command-needs-kind">{item.kindLabel}</span>
              <strong>{item.title}</strong>
              <small>
                {item.source} · {item.state}
              </small>
              <span>{item.detail}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
