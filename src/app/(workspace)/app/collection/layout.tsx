import '../../../(public)/world.css';
import '../../../(public)/commerce-experience.css';
import './collection-world.css';
export default function CollectionLayout({ children }: { children: React.ReactNode }) {
  return <div className="member-collection public-world">{children}</div>;
}
