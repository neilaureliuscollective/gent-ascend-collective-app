import { cabinetLabels } from '@/domains/commerce/cabinet-model';
import { GroomingDirectionEditor } from '@/components/grooming/direction';
import { GroomingTask } from '@/components/grooming/focus-task';
import Link from 'next/link';
import Image from 'next/image';
import { currentPerson } from '@/domains/person/current';
import { groomingWorkspace } from '@/domains/grooming/service';
import { commerceConfigured, listProducts } from '@/domains/commerce/shopify';
import {
  saveDirectionAction,
  goalAction,
  finishGoalAction,
  ritualAction,
  checkinAction,
  productAction,
  lookAction,
  eventAction,
  photoAction,
  deletePhotoAction,
} from './actions';
import './grooming.css';
export const metadata = { title: 'Grooming Concierge | Gent Ascend' };
export default async function Grooming({
  searchParams,
}: {
  searchParams: Promise<{ result?: string }>;
}) {
  const person = await currentPerson();
  if (!person)
    return (
      <main className="grooming">
        <h1>Grooming Concierge.</h1>
        <p>Sign in to begin your private grooming history.</p>
        <Link href="/enter">Sign in →</Link>
      </main>
    );
  const [data, params, catalog] = await Promise.all([
      groomingWorkspace(),
      searchParams,
      commerceConfigured() ? listProducts().catch(() => []) : Promise.resolve([]),
    ]),
    { profile, goals, rituals, checkins, products, looks, events, photos } = data,
    active = rituals.filter((r) => r.active),
    goal = goals.find((g) => g.status === 'active'),
    event = events.find((e) => e.event_date >= new Date().toISOString().slice(0, 10));
  const owned = new Set(
    products
      .filter((p) => ['owned','favorite','in_use','running_low'].includes(p.relation))
      .map((p) => p.shopify_handle),
  );
  const discovery = catalog
    .filter((p) => !owned.has(p.handle) && p.collections.nodes.some((c) => c.handle === 'grooming'))
    .slice(0, 3);
  return (
    <main className="grooming">
      <header className="groom-hero groom-hero-v2">
        <div className="groom-hero-copy">
          <p className="eyebrow">GENT ASCEND / GROOMING CONCIERGE</p>
          <h1>
            Your standard.
            <br />
            <em>Sharper every time.</em>
          </h1>
          <p>Observe. Decide. Practice. Remember what actually works.</p>
        </div>
        <div className="groom-hero-signal" aria-hidden="true">
          <span>STANDARD</span>
          <strong>{active.length || '—'}</strong>
          <small>live rituals</small>
        </div>
      </header>

      <section className="groom-command-deck" aria-label="Grooming command">
        <div className="groom-command-primary">
          <span className="eyebrow">AETHELIOS / NEXT MOVE</span>
          <h2>{goal?.title ?? 'Choose the detail worth refining.'}</h2>
          <p>
            {profile?.preferred_look
              ? `Current direction · ${profile.preferred_look}`
              : 'Set the direction once. Then let your scans, rituals, looks and service history make it smarter.'}
          </p>
          <div className="groom-command-actions">
            <Link className="button" href="/app/grooming/scan">Run Ascend Scan →</Link>
            <Link className="secondary-button" href="/app/aethelios?starter=grooming">Ask Aethelios</Link>
          </div>
        </div>
        <div className="groom-command-status">
          <div>
            <span>Direction</span>
            <strong>{profile?.preferred_look || 'Not calibrated'}</strong>
          </div>
          <div>
            <span>Routine</span>
            <strong>{active.length ? `${active.length} active` : 'Build your first'}</strong>
          </div>
          <div>
            <span>Next occasion</span>
            <strong>{event?.title || 'Nothing scheduled'}</strong>
          </div>
        </div>
      </section>

      <GroomingDirectionEditor profile={profile} saveAction={saveDirectionAction} />

      <nav className="groom-quick groom-quick-v2" aria-label="Grooming actions">
        <Link href="/app/grooming/scan"><span>01</span><strong>Scan</strong><small>See what changed</small></Link>
        <a href="#ritual"><span>02</span><strong>Ritual</strong><small>Practice the standard</small></a>
        <Link href="/app/grooming/look"><span>03</span><strong>My Look</strong><small>Explore a direction</small></Link>
        <Link href="/app/grooming/professional"><span>04</span><strong>Professional</strong><small>Carry it forward</small></Link>
      </nav>
      {params.result && (
        <p className="groom-notice" role="status">
          {params.result === 'saved'
            ? 'Saved to your private grooming history.'
            : 'That change could not be saved. Check the fields and try again.'}
        </p>
      )}
      <nav className="groom-nav" aria-label="Grooming areas">
        <Link href="/app/collection/cabinet">Your Cabinet</Link>
        <Link href="/app/grooming/scan">Scan</Link>
        <Link href="/app/grooming/look">My Look</Link>
        <a href="#direction">Direction</a>
        <a href="#ritual">Ritual</a>
        <a href="#progress">Progress</a>
        <a href="#vault">Vault</a>
        <a href="#occasion">Occasion</a>
      </nav>
      <aside className="groom-insight groom-insight-v2">
        <div>
          <p className="eyebrow">AETHELIOS / CONTEXT</p>
          <p>{goal ? 'Your active grooming goal is in view.' : 'No active grooming goal yet. Your history can still guide the next move.'}</p>
        </div>
        <Link href="/app/aethelios?starter=grooming">Open grooming conversation →</Link>
      </aside>
      <details className="groom-disclosure">
        <summary>Goals & direction history</summary>
        <GroomingTask title="Set a grooming goal">
          <form action={goalAction} className="groom-form">
            <label>
              What are you working toward?
              <input name="title" minLength={3} maxLength={160} required />
            </label>
            <label>
              Target date, if useful
              <input name="target_date" type="date" />
            </label>
            <button className="button">Add goal</button>
          </form>
        </GroomingTask>
        {goals.slice(0, 6).map((g) => (
          <article className="groom-record" key={g.id}>
            <strong>{g.title}</strong>
            <small>{g.status}</small>
            {g.status === 'active' && (
              <form action={finishGoalAction}>
                <input type="hidden" name="id" value={g.id} />
                <button>Mark complete</button>
              </form>
            )}
          </article>
        ))}
      </details>
      <section id="ritual" className="groom-section">
        <p className="eyebrow">02 / LIVE RITUAL</p>
        <h2>Practice the standard. Don’t manage a checklist.</h2>
        <p>Keep the routine small, visible and easy to record. Refinement belongs behind the action.</p>
        <div className="groom-three">
          {(['morning', 'evening', 'weekly'] as const).map((kind) => {
            const r = active.find((x) => x.kind === kind),
              latest = r ? checkins.find((c) => c.ritual_id === r.id) : null;
            return (
              <article className="groom-panel groom-ritual-card" key={kind}>
                <p className="eyebrow">
                  {kind} / {r ? `Version ${r.version}` : 'Not set'}
                </p>
                <h3>{r?.title ?? `Build your ${kind} ritual`}</h3>
                <p className="groom-lines">
                  {r?.steps ?? 'Give it a name and a few practical steps.'}
                </p>
                {r && <section aria-label={`Products linked to ${r.title}`}>
                  <p className="eyebrow">YOUR LINKED PRODUCTS / MEMBER RECORDED</p>
                  {products.filter(product=>product.ritual_id===r.id).length ? <ul>
                    {products.filter(product=>product.ritual_id===r.id).slice(0,6).map(product=><li key={product.id}>{product.name} · {cabinetLabels[product.relation]}</li>)}
                  </ul> : <p>No linked products in this view.</p>}
                  <small>Showing up to six links from your latest eighty Cabinet records. Linking is your choice, not a product recommendation.</small>
                  <p><Link href="/app/collection/cabinet">Review products and ritual links →</Link></p>
                </section>}
                {r && (
                  <form action={checkinAction} className="groom-form">
                    <input type="hidden" name="ritual_id" value={r.id} />
                    <label>
                      Optional note
                      <input name="note" maxLength={300} placeholder="What felt different?" />
                    </label>
                    <button className="secondary-button">Record today’s practice</button>
                    {latest && (
                      <small>
                        Last recorded {new Date(latest.occurred_at).toLocaleDateString()}.
                      </small>
                    )}
                  </form>
                )}
              </article>
            );
          })}
        </div>
        <GroomingTask title="Edit ritual structure">
          <form action={ritualAction} className="groom-panel groom-form groom-wide">
            <h3>Set or refine a ritual</h3>
            <label>
              When
              <select name="kind">
                <option value="morning">Morning</option>
                <option value="evening">Evening</option>
                <option value="weekly">Weekly</option>
              </select>
            </label>
            <label>
              Name
              <input name="title" minLength={3} maxLength={100} required />
            </label>
            <label>
              Steps
              <textarea name="steps" minLength={3} maxLength={1000} required />
            </label>
            <button className="button">Save ritual</button>
            <small>Editing creates a new version. Earlier practice stays in history.</small>
          </form>
        </GroomingTask>
      </section>
      <details id="progress" className="groom-disclosure">
        <summary>Visual history</summary>
        <p className="eyebrow">03 / Progress</p>
        <h2>Evidence, in your own light.</h2>
        <p>
          Use similar lighting, distance and angles. Scan observations are qualitative, never
          calibrated scores.
        </p>
        <Link href="/app/grooming/scan">Review scan history →</Link>
        <div className="groom-grid">
          <GroomingTask title="Record a moment">
            <form
              action={photoAction}
              encType="multipart/form-data"
              className="groom-panel groom-form"
            >
              <h3>Record a moment</h3>
              <label>
                Photo
                <input type="file" name="image" accept="image/jpeg,image/png,image/webp" required />
              </label>
              <label>
                View
                <select name="view">
                  <option value="front">Front</option>
                  <option value="left">Left profile</option>
                  <option value="right">Right profile</option>
                  <option value="hair">Hair / scalp</option>
                </select>
              </label>
              <label>
                Date
                <input
                  type="date"
                  name="captured_on"
                  defaultValue={new Date().toISOString().slice(0, 10)}
                  required
                />
              </label>
              <label>
                Note
                <input name="note" maxLength={300} />
              </label>
              <button className="button">Save private photo</button>
              <small>JPEG, PNG or WebP · 5 MB maximum.</small>
            </form>
          </GroomingTask>
          <div className="groom-panel">
            <h3>Your visual history</h3>
            <div className="groom-photo-grid">
              {photos.slice(0, 6).map((p) => (
                <figure key={p.id}>
                  <Image
                    src={`/api/grooming/image?kind=photo&id=${p.id}`}
                    alt={`${p.view} view from ${p.captured_on}`}
                    width={260}
                    height={260}
                    unoptimized
                  />
                  <figcaption>
                    {p.captured_on} · {p.view}
                  </figcaption>
                  <form action={deletePhotoAction}>
                    <input type="hidden" name="id" value={p.id} />
                    <button>Delete photo</button>
                  </form>
                </figure>
              ))}
            </div>
          </div>
        </div>
      </details>
      <details id="vault" className="groom-disclosure">
        <summary>Your Vault</summary>
        <p className="eyebrow">04 / Vault</p>
        <h2>Remember what worked.</h2>
        <p>
          Products, target looks and real service outcomes belong together, regardless of where you
          bought or received them.
        </p>
        <div className="groom-grid">
          <div className="groom-stack">
            <GroomingTask title="Record a product">
              <form action={productAction} className="groom-panel groom-form">
                <h3>Record a product</h3>
                <label>
                  Name
                  <input name="name" maxLength={120} required />
                </label>
                <label>
                  Area
                  <select name="category">
                    <option value="beard">Beard</option>
                    <option value="hair">Hair</option>
                    <option value="skin">Skin</option>
                    <option value="other">Other</option>
                  </select>
                </label>
                <label>
                  Experience
                  <select name="relation">
                    <option value="owned">Owned</option>
                    <option value="tried">Tried</option>
                    <option value="favorite">Favorite</option>
                    <option value="stopped">Stopped using</option>
                  </select>
                </label>
                <label>
                  Shop handle, if known
                  <input name="shopify_handle" maxLength={120} />
                </label>
                <label>
                  Note
                  <input name="note" maxLength={400} />
                </label>
                <button className="secondary-button">Add to Vault</button>
              </form>
            </GroomingTask>
            {products.slice(0, 10).map((p) => (
              <article className="groom-record" key={p.id}>
                <strong>{p.name}</strong>
                <small>
                  {p.category} · {p.relation}
                </small>
                <p>{p.note}</p>
                {p.shopify_handle && <Link href={`/shop/${p.shopify_handle}`}>View product ↗</Link>}
              </article>
            ))}
          </div>
          <div className="groom-stack">
            <GroomingTask title="Save a look or service">
              <form action={lookAction} className="groom-panel groom-form">
                <h3>Save a look or service</h3>
                <label>
                  Record type
                  <select name="kind">
                    <option value="target">Target look</option>
                    <option value="service">Service result</option>
                  </select>
                </label>
                <label>
                  Service date, if applicable
                  <input name="service_date" type="date" />
                </label>
                <label>
                  Name
                  <input name="title" minLength={3} maxLength={100} required />
                </label>
                <label>
                  Details
                  <textarea name="detail" maxLength={700} />
                </label>
                <button className="secondary-button">Keep this record</button>
              </form>
            </GroomingTask>
            {looks.slice(0, 10).map((l) => (
              <article className="groom-record" key={l.id}>
                <strong>{l.title}</strong>
                <small>
                  {l.kind}
                  {l.service_date ? ` · ${l.service_date}` : ''}
                </small>
                <p>{l.detail}</p>
              </article>
            ))}
            <Link href="/app/grooming/brief" className="button">
              Open printable brief ↗
            </Link>
            <Link href="/app/grooming/professional" className="secondary-button">
              Create a professional handoff →
            </Link>
          </div>
        </div>
        {discovery.length > 0 && (
          <div className="groom-panel groom-discovery">
            <h3>From the grooming collection.</h3>
            <p>
              Explore only if it fits your routine. These are category matches, not personal
              efficacy claims.
            </p>
            {discovery.map((p) => (
              <Link key={p.id} href={`/shop/${p.handle}`}>
                {p.title} ↗
              </Link>
            ))}
          </div>
        )}
      </details>
      <details id="occasion" className="groom-disclosure">
        <summary>Upcoming occasion</summary>
        <p className="eyebrow">05 / Occasion</p>
        <h2>Arrive prepared.</h2>
        <div className="groom-grid">
          <GroomingTask title="Plan an occasion">
            <form action={eventAction} className="groom-panel groom-form">
              <h3>Plan an occasion</h3>
              <label>
                Occasion
                <input name="title" minLength={3} maxLength={100} required />
              </label>
              <label>
                Date
                <input name="event_date" type="date" required />
              </label>
              <label>
                What matters about your look?
                <input name="note" maxLength={300} />
              </label>
              <button className="button">Make a plan</button>
            </form>
          </GroomingTask>
          <article className="groom-panel">
            <h3>{event?.title ?? 'Your next event begins here.'}</h3>
            <p>
              {event
                ? `${event.event_date} · ${event.note}`
                : 'Record the date, then refine the timing with Aethelios and your grooming professional.'}
            </p>
            {event && (
              <ol>
                <li>Three to four weeks: decide the target look and service timing.</li>
                <li>
                  One week: keep the routine familiar; discuss adjustments with your professional.
                </li>
                <li>Day of: follow a simple, practiced routine.</li>
              </ol>
            )}
            <Link href="/app/aethelios?starter=grooming-event">Refine with Aethelios →</Link>
          </article>
        </div>
      </details>
    </main>
  );
}
