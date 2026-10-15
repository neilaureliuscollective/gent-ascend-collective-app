import '../../../(public)/world.css';
import '../../../(public)/commerce-experience.css';
import './collection-world.css';
import '../lifestyle/lifestyle.css';
import '../lifestyle/member-lifestyle.css';
import { MemberCartLauncher } from '@/components/commerce/member-cart-launcher';
export default function CollectionLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="member-collection public-world imperial-obsidian">
      {children}
      <MemberCartLauncher />
    </div>
  );
}
