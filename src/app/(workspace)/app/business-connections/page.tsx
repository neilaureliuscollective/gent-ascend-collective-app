import { BusinessConnections } from '@/components/business-connections/workspace';
import './connections.css';
export const metadata = { title: 'Business Connections' };
export default function Page() {
  return (
    <section className="business-connections">
      <p className="eyebrow">AETHELIOS / YOUR BUSINESS</p>
      <h1>Business Connections</h1>
      <p>
        Your personal intelligence remains yours. Connect a company room to its authorized Legacy
        Reserve schedule.
      </p>
      <BusinessConnections />
    </section>
  );
}
