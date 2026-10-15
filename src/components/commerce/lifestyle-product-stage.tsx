'use client';
import Link from 'next/link';
import Image from 'next/image';
import { memberLifestylePhotography } from '@/domains/commerce/member-lifestyle';
import { LifestyleAction } from './lifestyle-action';

export function LifestyleProductStage({
  compact = false,
  status,
}: {
  compact?: boolean;
  status?: 'ready' | 'empty' | 'unconfigured' | 'error';
}) {
  const focal = memberLifestylePhotography.find((entry) => entry.role === 'focal')!;
  const companions = memberLifestylePhotography.filter((entry) => entry.role === 'secondary');
  return (
    <section
      className={`member-lifestyle-stage${compact ? ' member-lifestyle-stage--compact' : ''}`}
      aria-label="Aethelios Lifestyle products"
    >
      <Link href={focal.href} className="member-lifestyle-focal">
        <Image
          src={focal.src}
          alt={focal.alt}
          width={720}
          height={900}
          sizes={compact ? '(max-width: 700px) 70vw, 28vw' : '(max-width: 700px) 80vw, 42vw'}
          preload={!compact}
        />
        <span>
          <strong>{focal.name}</strong>
          <small>{focal.kind}</small>
        </span>
      </Link>
      <div className="member-lifestyle-stage-aside">
        <div className="member-lifestyle-companions">
          {companions.map((entry) => (
            <Link key={entry.id} href={entry.href} className="member-lifestyle-companion">
              <Image
                src={entry.src}
                alt={entry.alt}
                width={360}
                height={450}
                sizes="(max-width: 700px) 40vw, 16vw"
              />
              <span>
                <strong>{entry.name}</strong>
                <small>{entry.kind}</small>
              </span>
            </Link>
          ))}
        </div>
        {!compact && (
          <>
            <p
              className="member-lifestyle-stage-status"
              role={status && status !== 'ready' ? 'status' : undefined}
            >
              {status === 'error'
                ? 'The collection could not refresh. Current prices and availability could not be verified.'
                : status === 'unconfigured'
                  ? 'Live product availability is not connected yet. Products are not available to order here until the catalog is connected.'
                  : status === 'empty'
                    ? 'The collection is being prepared. House photography is shown until published products are available.'
                    : 'Aethelios Human Ascendance products. Availability is confirmed in the collection.'}
            </p>
            <LifestyleAction className="world-button" href="/app/collection">
              Explore the collection
            </LifestyleAction>
          </>
        )}
      </div>
    </section>
  );
}
