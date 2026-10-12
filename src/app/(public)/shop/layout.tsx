import '../../(workspace)/app/collection/collection-world.css';
import '../../(workspace)/app/lifestyle/lifestyle.css';
import { MemberCartLauncher } from '@/components/commerce/member-cart-launcher';
export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="public-world imperial-obsidian">
      {children}
      <MemberCartLauncher basePath="/shop" />
    </div>
  );
}
