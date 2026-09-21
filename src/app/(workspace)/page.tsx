import { PersonalCommand } from '@/components/personal-command';
import { readGoals } from '@/domains/goals/service';
import { currentPerson } from '@/domains/person/current';
export default async function Command() {
  const person = await currentPerson();
  const goals = person ? await readGoals() : null;
  return (
    <PersonalCommand
      person={person ?? undefined}
      goal={goals?.find((goal) => goal.status === 'active') ?? null}
    />
  );
}
