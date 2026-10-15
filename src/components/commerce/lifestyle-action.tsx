import Link from 'next/link';
import { Icon, type IconName } from '@/components/visual/icon';

export function LifestyleAction({
  href,
  children,
  className,
  icon = 'arrow',
  prefetch,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
  icon?: IconName | 'back';
  prefetch?: boolean;
}) {
  const back = icon === 'back';
  return (
    <Link href={href} className={className} prefetch={prefetch}>
      {back ? <Icon name="arrow" className="action-icon lifestyle-icon-back" /> : null}
      {children}
      {back ? null : <Icon name={icon} className="action-icon" />}
    </Link>
  );
}
