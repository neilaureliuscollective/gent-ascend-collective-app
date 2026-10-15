import Link from 'next/link';
import Image from 'next/image';
import { brand } from '@/platform/brand';
export default function NotFound() {
  return (
    <main className="console">
      <Image src={brand.crest} alt="" width={72} height={72} sizes="72px" />
      <p className="eyebrow">Gent Ascend Collective</p>
      <h1>This space isn’t available.</h1>
      <Link className="button" href="/">
        Return to Gent Ascend
      </Link>
    </main>
  );
}
