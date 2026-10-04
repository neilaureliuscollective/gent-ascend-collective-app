import '../../../(public)/world.css';
import '../../../(public)/commerce-experience.css';
import './collection-world.css';
import { MemberCartLauncher } from '@/components/commerce/member-cart-launcher';
import { commerceConfigured } from '@/domains/commerce/shopify';
export default function CollectionLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="member-collection public-world">
      {children}
      {commerceConfigured() && <MemberCartLauncher />}
    </div>
  );
}
