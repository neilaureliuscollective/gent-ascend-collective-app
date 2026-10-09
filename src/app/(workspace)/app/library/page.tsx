import Link from 'next/link';
import { SavedWork } from '@/components/workspace/saved-work';
import '../work/work.css';
export const metadata = { title: 'Saved work' };
export default function LibraryPage() {
  return (
    <section className="company-work">
      <Link href="/app/work">← Work</Link>
      <h1>Your saved work</h1>
      <SavedWork />
    </section>
  );
}
