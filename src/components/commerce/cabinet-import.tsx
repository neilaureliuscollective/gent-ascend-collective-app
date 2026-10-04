'use client';
import Link from 'next/link';
import { useActionState, useState } from 'react';
import { useSavedCollection } from './saved-selection-store';
import type { CabinetImportReview } from '@/domains/commerce/cabinet-model';
type Result = { error: string; message: string };
type ReviewAction = (previous: CabinetImportReview, form: FormData) => Promise<CabinetImportReview>;
type ImportAction = (previous: Result, form: FormData) => Promise<Result>;
const initial: CabinetImportReview = { owner: '', items: [], unavailable: [], error: '' };
function ConfirmImport({ review, action }: { review: CabinetImportReview; action: ImportAction }) {
  const [result, submit, pending] = useActionState(action, { error: '', message: '' });
  return (
    <form action={submit} onReset={(event) => event.preventDefault()}>
      <input type="hidden" name="owner" value={review.owner} />
      <input
        type="hidden"
        name="items"
        value={JSON.stringify(review.items.map(({ handle, id }) => ({ handle, id })))}
      />
      <h3>Review your Cabinet import</h3>
      <p>
        Add these products to your signed-in account as saved interests. This does not record
        ownership or purchase.
      </p>
      <ul>
        {review.items.map((item) => (
          <li key={item.handle}>{item.title}</li>
        ))}
      </ul>
      {!result.message && (
        <button className="secondary-button" disabled={pending}>
          {pending ? 'Importing…' : 'Confirm import to my Cabinet'}
        </button>
      )}
      {result.error && <p role="alert">{result.error}</p>}
      {result.message && (
        <p role="status">{result.message} Your browser selection remains available.</p>
      )}
      {result.message && <Link href="/app/collection/cabinet">Review my Cabinet →</Link>}
    </form>
  );
}
export function CabinetImport({
  reviewAction,
  importAction,
}: {
  reviewAction: ReviewAction;
  importAction: ImportAction;
}) {
  const browser = useSavedCollection();
  const [selected, setSelected] = useState<string[]>([]);
  const [review, submit, pending] = useActionState(reviewAction, initial);
  return (
    <section className="cabinet-import" aria-label="Bring your browser selection into your Cabinet">
      <h2>Keep your selection across devices.</h2>
      <p>
        Browser saves can belong to anyone who used this device. Choose only the products you want
        in your account. Review up to twenty at a time.
      </p>
      {!browser.length ? (
        <p>No saved selection on this browser. Save a published product from its page instead.</p>
      ) : (
        <form action={submit} onReset={(event) => event.preventDefault()}>
          <fieldset disabled={pending}>
            <legend>Products saved on this browser</legend>
            {browser.map((handle) => (
              <label key={handle}>
                <input
                  type="checkbox"
                  name="handle"
                  value={handle}
                  checked={selected.includes(handle)}
                  onChange={(event) =>
                    setSelected((current) =>
                      event.target.checked
                        ? [...current, handle]
                        : current.filter((value) => value !== handle),
                    )
                  }
                />
                {handle}
              </label>
            ))}
          </fieldset>
          <p>{selected.length} selected · maximum 20 per review</p>
          <button
            className="secondary-button"
            disabled={pending || !selected.length || selected.length > 20}
          >
            {pending ? 'Checking the collection…' : 'Review selected products'}
          </button>
        </form>
      )}
      {review.error && <p role="alert">{review.error}</p>}
      {!!review.unavailable.length && (
        <p role="status">
          Unavailable for account import: {review.unavailable.join(', ')}. Preview products stay in
          your browser selection.
        </p>
      )}
      {!!review.items.length && (
        <ConfirmImport key={JSON.stringify(review)} review={review} action={importAction} />
      )}
    </section>
  );
}
