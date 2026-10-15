'use client';
import Link from 'next/link';
import Image from 'next/image';
import { brand } from '@/platform/brand';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="console">
      <Image src={brand.crest} alt="" width={72} height={72} sizes="72px" />
      <p className="eyebrow">Gent Ascend Collective</p>
      <h1>A moment to reconnect.</h1>
      <p>Your workspace could not be loaded. Please try again.</p>
      <button className="button" onClick={reset}>
        Try again
      </button>
      <Link className="text-link" href="/support">
        Get account help →
      </Link>
    </main>
  );
}
