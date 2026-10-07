import Link from 'next/link';
export const metadata = { title: 'About Aethelios' };
export default function About() {
  return (
    <section className="company-arrival">
      <p className="eyebrow">Aethelios · Personal Intelligence OS</p>
      <h1>Intelligence that stays with the work.</h1>
      <p>
        Aethelios brings conversation, specialist perspectives, saved direction and creative work
        into one environment. Start with what you want to accomplish, whether it belongs to your
        life, your work or your business.
      </p>
      <h2>One conversation. A clear next move.</h2>
      <p>
        Talk through the question. Bring in a specialist when useful. Keep meaningful work as a
        Mission, review its direction, and return to the conversation when you are ready to
        continue.
      </p>
      <h2>Your decisions remain yours.</h2>
      <p>
        Saved direction and confirmed memory stay distinct from AI suggestions. You choose which
        personal context to use and when to create. External actions and background execution are
        not implied by a conversation.
      </p>
      <p>Founded by Neil Stutes.</p>
      <Link className="button" href="/enter">
        Open Aethelios ↗
      </Link>
    </section>
  );
}
