'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { brand } from '@/platform/brand';
import { AmbientHorizon } from '@/components/visual/ambient-horizon';
import {
  exampleIntent,
  exampleIntents,
  spaceHref,
  type ExampleIntent,
} from '@/domains/ecosystem/example-intents';
import { fitCadences, fitGoals, recommendPresentation, type FitCadence, type FitGoal } from '@/domains/ecosystem/fit';
import {
  presentationPlans,
  presentationPrice,
  type PresentationPlan,
} from '@/domains/ecosystem/presentation-catalog';
import {
  parseEcosystemSelection,
  presentationJourney,
  readStoredSelection,
  selectionSearch,
  writeStoredSelection,
  type JourneyGate,
  type EcosystemSelection,
} from '@/domains/ecosystem/selection';
import './ecosystem-experience.css';

const goalCopy: Record<FitGoal, string> = {
  explore: 'I want to look around first',
  daily: 'I want everyday intelligence',
  produce: 'I want to make reusable work',
  applications: 'I want to build a working tool',
  coordinate: 'I want to keep several initiatives moving',
};

const cadenceCopy: Record<FitCadence, string> = {
  occasional: 'When a specific idea needs attention',
  ongoing: 'As a regular part of my work',
};

function applyNote(intent: ExampleIntent, note: string) {
  const trimmed = note.trim();
  if (!trimmed) return intent.defaultNote;
  return trimmed;
}

export function EcosystemExperience({
  gate,
  surface,
}: {
  gate: JourneyGate;
  surface: 'public' | 'member';
}) {
  const params = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const formId = useId();
  const fromUrl = parseEcosystemSelection({
    intent: params.get('intent'),
    plan: params.get('plan'),
    note: params.get('note'),
    goal: params.get('goal'),
    cadence: params.get('cadence'),
  });
  const urlKey = selectionSearch(fromUrl);
  const [selection, setSelection] = useState(fromUrl);
  const [seenUrl, setSeenUrl] = useState(urlKey);
  if (urlKey !== seenUrl) {
    setSeenUrl(urlKey);
    setSelection(fromUrl);
  }
  const restored = params.get('restored') === '1';
  const restoreAttempted = useRef(false);

  useEffect(() => {
    if (restoreAttempted.current) return;
    restoreAttempted.current = true;
    if (params.get('intent') || params.get('plan')) {
      writeStoredSelection(fromUrl);
      return;
    }
    const stored = readStoredSelection();
    if (stored) {
      router.replace(`${path}?${selectionSearch(stored)}&restored=1`, { scroll: false });
      return;
    }
    writeStoredSelection(fromUrl);
  }, [fromUrl, params, path, router]);

  const intent = exampleIntent(selection.intent);
  const projectNote = applyNote(intent, selection.note);
  const recommendation =
    selection.goal && selection.cadence
      ? recommendPresentation(selection.goal, selection.cadence)
      : null;
  const selectedPlan =
    presentationPlans.find((plan) => plan.id === selection.plan) ?? recommendation?.plan ?? null;
  const journey = presentationJourney(selectedPlan?.id ?? null, gate);

  const stageLabel = useMemo(
    () => `${intent.project} — labelled illustrative example`,
    [intent.project],
  );

  function update(patch: Partial<EcosystemSelection>) {
    const next = { ...selection, ...patch };
    setSelection(next);
    writeStoredSelection(next);
    const query = selectionSearch(next);
    if (typeof window !== 'undefined' && window.location.search.slice(1) !== query) {
      router.replace(`${path}?${query}`, { scroll: false });
    }
  }

  return (
    <section className={`eco eco-${surface}`} aria-labelledby="ecosystem-title">
      <header className="eco-open io-ecosystem-hero io-hero">
        <AmbientHorizon />
        <div className="eco-open-copy">
          <p className="eco-kicker">
            <Image src={brand.crest} alt="" width={36} height={36} />
            Aethelios / One world
          </p>
          <h1 id="ecosystem-title">
            One world.
            <br />
            <em>Greater possibility.</em>
          </h1>
          <p className="eco-benefit">
            A living place to think, make and continue. Launch your next idea, then watch it move
            through Talk, Studio and Architect as a labelled example — not a simulated build.
          </p>
          <p className="eco-example-label">Illustrative preview. No live provider work is running.</p>
        </div>
        <form className="eco-invite" aria-labelledby={`${formId}-invite`}>
          <h2 id={`${formId}-invite`} className="eco-invite-title">
            Shape an idea
          </h2>
          <fieldset>
            <legend>What are you here to begin?</legend>
            <div className="eco-intents" role="radiogroup" aria-label="Example intent">
              {exampleIntents.map((item) => (
                <label key={item.id} className={selection.intent === item.id ? 'is-selected' : undefined}>
                  <input
                    type="radio"
                    name="intent"
                    value={item.id}
                    checked={selection.intent === item.id}
                    onChange={() => update({ intent: item.id })}
                  />
                  <span>{item.label}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <label className="eco-note">
            <span>Example purpose (stays on this page)</span>
            <input
              type="text"
              maxLength={160}
              value={selection.note}
              placeholder={intent.defaultNote}
              onChange={(event) => update({ note: event.target.value })}
            />
          </label>
          <div className="eco-invite-actions">
            <a className="eco-primary" href="#ecosystem-stage">
              Inspect the example
            </a>
            <a className="eco-secondary" href="#ecosystem-membership">
              Compare memberships
            </a>
          </div>
        </form>
      </header>

      <section className="eco-stage" id="ecosystem-stage" aria-labelledby="ecosystem-stage-title">
        <div className="eco-stage-copy">
          <p className="eco-kicker">Example project</p>
          <h2 id="ecosystem-stage-title">{intent.project}</h2>
          <p>{intent.invitation}</p>
          <p className="eco-brief">{intent.brief}</p>
          <p>
            <strong>Purpose in this preview:</strong> {projectNote}
          </p>
          <ul className="eco-artifacts">
            {intent.artifacts.map((artifact) => (
              <li key={artifact.title}>
                <span>{artifact.kind}</span>
                <strong>{artifact.title}</strong>
                <p>{artifact.detail}</p>
              </li>
            ))}
          </ul>
        </div>
        <figure className={`eco-monitor eco-monitor-${intent.id}`} aria-label={stageLabel}>
          <figcaption>Illustrative project · not a customer result</figcaption>
          <div className="eco-screen" data-intent={intent.id}>
            <header>
              <Image src={brand.crest} alt="" width={28} height={28} />
              <span>{intent.project}</span>
              <small>Example</small>
            </header>
            <div className="eco-screen-hero">
              <p>{projectNote}</p>
              <em>{intent.label}</em>
            </div>
            <ol>
              {intent.path.map((step) => (
                <li key={step.space}>
                  <strong>{step.label}</strong>
                  <span>{step.action}</span>
                </li>
              ))}
            </ol>
          </div>
        </figure>
        <nav className="eco-path" aria-label="Supported next spaces">
          {intent.path.map((step) => {
            const available =
              step.space === 'talk' ||
              (step.space === 'studio' && intent.studioAvailable) ||
              (step.space === 'architect' && intent.architectAvailable);
            const href = available
              ? gate.signedIn
                ? spaceHref(step.space, intent.talkStarter)
                : '/enter'
              : null;
            return (
              <article key={step.space}>
                <h3>{step.label}</h3>
                <p>{step.action}</p>
                {href ? (
                  <Link href={href}>
                    {gate.signedIn
                      ? `Open ${step.label}`
                      : `Sign in to open ${step.label}`}
                  </Link>
                ) : (
                  <p className="eco-unavailable">{step.label} is not a handoff from this example.</p>
                )}
                {step.space !== 'talk' ? (
                  <p className="eco-transfer-note">
                    The example brief stays here. {step.label} opens the real workspace; it does
                    not receive a simulated transfer.
                  </p>
                ) : (
                  <p className="eco-transfer-note">
                    Talk opens with a labelled starter for this example. It does not call a model
                    from this page.
                  </p>
                )}
              </article>
            );
          })}
        </nav>
      </section>

      <div className="io-division-grid eco-chambers">
        <article className="io-division io-division-intelligence">
          <span className="io-division-number" aria-hidden="true">
            01 / INTELLIGENCE
          </span>
          <h2>Aethelios Intelligence</h2>
          <p className="io-division-promise">Think clearly. Build deliberately.</p>
          <p>
            Talk, Work and Studio already exist. The example above shows how one idea can move
            through them. Those destinations are not rebuilt here.
          </p>
          <nav className="io-division-links" aria-label="Intelligence environments">
            <Link href={gate.signedIn ? '/app/aethelios' : '/enter'}>Talk ↗</Link>
            <Link href={gate.signedIn ? '/app/work' : '/enter'}>Work ↗</Link>
            <Link href={gate.signedIn ? '/app/studio' : '/enter'}>Studio ↗</Link>
          </nav>
        </article>
        <article className="io-division">
          <span className="io-division-number" aria-hidden="true">
            02 / HEALTH
          </span>
          <h2>Aethelios Health</h2>
          <p className="io-division-promise">Know More. Live Better.</p>
          <p>
            Private records and source-led wellness stay in Health. Membership never authorizes
            clinical care.
          </p>
          <p className="io-division-boundary">
            Educational and personal planning experiences. No prescribing or clinical care is
            offered here.
          </p>
          <nav className="io-division-links" aria-label="Available health and performance tools">
            <Link href={gate.signedIn ? '/app/health' : '/enter'} prefetch={false}>
              Health Command ↗
            </Link>
            <Link href={gate.signedIn ? '/app/daily' : '/enter'}>Personal check-ins ↗</Link>
          </nav>
        </article>
        <article className="io-division">
          <span className="io-division-number" aria-hidden="true">
            03 / LIFESTYLE
          </span>
          <h2>Aethelios Lifestyle</h2>
          <p className="io-division-promise">The personal standard.</p>
          <p>
            Physical products are separate purchases. Membership does not include Lifestyle goods
            or a human-service website build.
          </p>
          <nav className="io-division-links" aria-label="Lifestyle destinations">
            <Link href="/lifestyle">Lifestyle ↗</Link>
            <Link href={gate.signedIn ? '/app/lifestyle' : '/enter'}>Member collection ↗</Link>
          </nav>
        </article>
      </div>

      <section
        className="eco-membership io-membership"
        id="ecosystem-membership"
        aria-labelledby="membership-title"
      >
        <p className="eco-kicker">Find your membership</p>
        <h2 id="membership-title">A membership that fits the work, not a louder card.</h2>
        <p>
          This is a planning catalog. Existing founding billing still uses Essential, Signature and
          Reserve. Lifestyle products are separate purchases and are not included.
        </p>
        {restored ? (
          <p className="eco-restored" role="status">
            Restored your previous example and membership selection from this browser session.
          </p>
        ) : null}

        <form className="eco-fit" aria-labelledby={`${formId}-fit`}>
          <h3 id={`${formId}-fit`}>Find your fit</h3>
          <fieldset>
            <legend>What do you want first?</legend>
            <div className="eco-fit-options">
              {fitGoals.map((goal) => (
                <label key={goal} className={selection.goal === goal ? 'is-selected' : undefined}>
                  <input
                    type="radio"
                    name="goal"
                    value={goal}
                    checked={selection.goal === goal}
                    onChange={() => update({ goal, plan: recommendPresentation(goal, selection.cadence ?? 'occasional').plan.id })}
                  />
                  <span>{goalCopy[goal]}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>How often will you use it?</legend>
            <div className="eco-fit-options">
              {fitCadences.map((cadence) => (
                <label key={cadence} className={selection.cadence === cadence ? 'is-selected' : undefined}>
                  <input
                    type="radio"
                    name="cadence"
                    value={cadence}
                    checked={selection.cadence === cadence}
                    onChange={() =>
                      update({
                        cadence,
                        plan: selection.goal
                          ? recommendPresentation(selection.goal, cadence).plan.id
                          : selection.plan,
                      })
                    }
                  />
                  <span>{cadenceCopy[cadence]}</span>
                </label>
              ))}
            </div>
          </fieldset>
        </form>

        {recommendation ? (
          <aside className="eco-recommend" aria-live="polite">
            <p className="eco-kicker">Recommended</p>
            <h3>
              {recommendation.plan.name}
              <span>{presentationPrice(recommendation.plan)}</span>
            </h3>
            <p>{recommendation.reason}</p>
            {recommendation.availableAlternative ? (
              <p>
                Available alternative while Continuum is coming soon:{' '}
                <strong>{recommendation.availableAlternative.name}</strong>, the least expensive
                preview that already has a working workspace.
              </p>
            ) : null}
          </aside>
        ) : (
          <p className="eco-fit-hint">Answer both questions to see the least expensive suitable membership.</p>
        )}

        <div className="eco-compare-wrap">
          <h3>Compare every membership</h3>
          <table className="eco-compare">
            <caption>Preview catalog. None of these names open checkout from this page.</caption>
            <thead>
              <tr>
                <th scope="col">Membership</th>
                <th scope="col">Monthly</th>
                <th scope="col">Intended use</th>
                <th scope="col">Availability</th>
                <th scope="col">Choose</th>
              </tr>
            </thead>
            <tbody>
              {presentationPlans.map((plan) => (
                <tr
                  key={plan.id}
                  className={[
                    plan.lifecycle === 'coming_soon' ? 'is-soon' : '',
                    selectedPlan?.id === plan.id ? 'is-selected' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  <th scope="row">{plan.name}</th>
                  <td>{presentationPrice(plan)}{plan.monthlyCents ? ' / month' : ''}</td>
                  <td>{plan.intendedUse}</td>
                  <td>{plan.availability}</td>
                  <td>
                    <button
                      type="button"
                      aria-pressed={selectedPlan?.id === plan.id}
                      onClick={() => update({ plan: plan.id })}
                    >
                      {selectedPlan?.id === plan.id ? 'Selected' : `Select ${plan.name}`}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="eco-plan-chambers" aria-label="Membership detail">
          {presentationPlans.map((plan) => (
            <PlanChamber
              key={plan.id}
              plan={plan}
              selected={selectedPlan?.id === plan.id}
              onSelect={() => update({ plan: plan.id })}
            />
          ))}
        </div>

        <div className="eco-next">
          <h3>Your next available step</h3>
          <p>{journey.explanation}</p>
          {journey.purchase ? (
            <p role="status">Purchase is not available for this preview catalog.</p>
          ) : journey.href ? (
            <Link className="eco-primary" href={appendSelection(journey.href, selection)}>
              {journey.label}
            </Link>
          ) : (
            <p className="eco-soon-banner" role="status">
              {journey.label}
            </p>
          )}
          {surface === 'member' ? (
            <Link className="eco-secondary" href="/app/membership">
              Your membership ↗
            </Link>
          ) : (
            <Link className="eco-secondary" href="/membership">
              Current founding billing preview
            </Link>
          )}
        </div>
      </section>
    </section>
  );
}

function PlanChamber({
  plan,
  selected,
  onSelect,
}: {
  plan: PresentationPlan;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <article
      className={`eco-chamber eco-chamber-${plan.id} eco-chamber-${plan.lifecycle} ${selected ? 'is-selected' : ''}`}
    >
      <header>
        <h3>{plan.name}</h3>
        <p>
          {presentationPrice(plan)}
          {plan.monthlyCents ? <span> / month</span> : null}
        </p>
        {plan.lifecycle === 'coming_soon' ? <p className="eco-soon">Coming soon</p> : null}
        {plan.lifecycle === 'preview' ? <p className="eco-preview-flag">Preview catalog</p> : null}
      </header>
      <p>{plan.intendedUse}</p>
      <ul>
        {plan.benefits.map((benefit) => (
          <li key={benefit}>{benefit}</li>
        ))}
      </ul>
      <p className="eco-availability">{plan.availability}</p>
      <button type="button" aria-pressed={selected} onClick={onSelect}>
        {selected ? `${plan.name} selected` : `Select ${plan.name}`}
      </button>
    </article>
  );
}

function appendSelection(href: string, selection: EcosystemSelection) {
  if (href.startsWith('#')) return href;
  const url = new URL(href, 'https://www.gentascend.com');
  url.searchParams.set('from', 'ecosystem');
  url.searchParams.set('intent', selection.intent);
  if (selection.plan) url.searchParams.set('plan', selection.plan);
  return `${url.pathname}${url.search}${url.hash}`;
}
