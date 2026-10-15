import { ChoiceArtwork } from './choice-artwork';
import type { ProjectContent } from '@/domains/architect-origin/schema';

export const creationChoices = [
  {
    discipline: 'business' as const,
    title: 'Create a Business',
    detail: 'Turn your vision into a structured, scalable business.',
  },
  {
    discipline: 'application' as const,
    title: 'Design an Application',
    detail: 'Create intelligent, beautiful software experiences.',
  },
  {
    discipline: 'product' as const,
    title: 'Develop a Product',
    detail: 'Bring your idea to life from concept to creation.',
  },
  {
    discipline: 'custom' as const,
    title: 'Start without limits',
    detail: 'Explore new possibilities beyond conventional boundaries.',
  },
] as const;

export function ChoiceCard({
  discipline,
  title,
  detail,
  selected,
  disabled,
  onSelect,
}: {
  discipline: ProjectContent['discipline'];
  title: string;
  detail: string;
  selected: boolean;
  disabled?: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className="origin-choice"
      data-discipline={discipline}
      aria-pressed={selected}
      onClick={onSelect}
      disabled={disabled}
    >
      <span className="origin-choice-stage">
        <ChoiceArtwork discipline={discipline} />
      </span>
      <strong>{title}</strong>
      <span>{detail}</span>
    </button>
  );
}
