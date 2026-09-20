import { AureliusWorkspace } from '@/components/aurelius/workspace';
export default function AureliusPage() {
  return (
    <>
      <div className="page-heading compact-heading aurelius-page-heading">
        <div>
          <p className="eyebrow">Your personal intelligence</p>
          <h1>Aurelius.</h1>
        </div>
        <p className="muted">
          A considered perspective.
          <br />A deliberate next step.
        </p>
      </div>
      <section className="aurelius-surface">
        <AureliusWorkspace />
      </section>
    </>
  );
}
