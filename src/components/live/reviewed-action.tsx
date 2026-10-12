'use client';
import Link from 'next/link';
import type { LiveController } from '@/domains/live/controller';
import type { ReviewedActionDraft } from '@/domains/artifacts/daily-action';
export function ReviewedDailyAction({
  controller,
  draft,
}: {
  controller: LiveController;
  draft: ReviewedActionDraft;
}) {
  const locked = draft.phase !== 'editing';
  return (
    <section className="live-artifact-job" aria-label="Reviewed personal daily action">
      <h3>Your daily action</h3>
      <p>Source review: {draft.sourceTitle}</p>
      <p>A coworker suggestion stays a suggestion. Choose your own commitment below.</p>
      {draft.error && <p role="alert">{draft.error}</p>}
      {draft.phase === 'receipt' && draft.receipt ? (
        <>
          <p role="status">
            {draft.receipt.verified
              ? 'Verified saved action'
              : 'Previously saved; the action has since changed or been removed'}{' '}
            · {draft.receipt.day}
          </p>
          <p>{draft.receipt.title}</p>
        </>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void controller.confirmDailyAction();
          }}
        >
          <label>
            Your exact action title
            <input
              value={draft.title}
              maxLength={100}
              disabled={locked}
              onChange={(event) => controller.editDailyAction(event.target.value)}
            />
          </label>
          <p>
            Day: {draft.day} · {draft.timezone}. This phase supports your current local day.
          </p>
          <p>
            Confirming adds this title to your personal daily actions. It does not perform the task.
          </p>
          <button disabled={locked || !draft.title.trim()}>
            {draft.phase === 'saving' ? 'Verifying save…' : 'Confirm and add to my day'}
          </button>
        </form>
      )}
      {draft.phase === 'uncertain' && (
        <p role="status">Save unconfirmed. Confirmation is locked to prevent duplicate actions.</p>
      )}
      <button
        type="button"
        disabled={draft.phase === 'saving'}
        onClick={() => {
          void controller.checkDailyAction();
        }}
      >
        Check saved action status
      </button>
      <Link href="/app/daily">View my daily actions ↗</Link>
      {!locked && (
        <button
          type="button"
          onClick={() => {
            void controller.prepareDailyAction(draft.reviewId);
          }}
        >
          Reload day and source review
        </button>
      )}
      {!locked || draft.phase === 'receipt' ? (
        <button type="button" onClick={() => controller.closeDailyAction()}>
          Close action review
        </button>
      ) : null}
    </section>
  );
}
