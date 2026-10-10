import '../collection/collection-world.css';
import '../../../(public)/world.css';
import '../../../(public)/commerce-experience.css';
import './lifestyle.css';
import { MemberCartLauncher } from '@/components/commerce/member-cart-launcher';
export default function LifestyleLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="member-collection public-world imperial-obsidian">
      {children}
      <MemberCartLauncher />
    </div>
  );
}
