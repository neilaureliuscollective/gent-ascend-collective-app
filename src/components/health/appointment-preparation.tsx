'use client';
import { useState } from 'react';
const prompts = [
  ['purpose', 'Clarify the main question you want to discuss.'],
  ['changes', 'Think about when any change began and how it affects everyday life.'],
  ['medicines', 'Bring an up-to-date medicine and supplement list directly to your clinician.'],
  ['results', 'Ask which existing results are relevant and what their limits are.'],
  ['options', 'Ask about options, benefits, uncertainties and when to seek help.'],
  ['followup', 'Confirm the next step, follow-up timing and whom to contact.'],
] as const;
export function AppointmentPreparation() {
  const [selected, setSelected] = useState<string[]>([]);
  return (
    <section className="health-preparation" aria-labelledby="preparation-title">
      <p className="eyebrow">A practical starting point</p>
      <h2 id="preparation-title">Prepare for a better conversation.</h2>
      <p>
        Select general reminders for your next appointment. This checklist stays in this page,
        disappears on reload and is never sent to Aethelios or an Entity.
      </p>
      <fieldset>
        <legend>Appointment reminders</legend>
        {prompts.map(([id, text]) => (
          <label key={id}>
            <input
              type="checkbox"
              checked={selected.includes(id)}
              onChange={(e) =>
                setSelected(e.target.checked ? [...selected, id] : selected.filter((x) => x !== id))
              }
            />
            <span>{text}</span>
          </label>
        ))}
      </fieldset>
      <p role="status">
        {selected.length} of {prompts.length} reminders selected. Nothing saved to your account.
      </p>
      <div className="health-actions">
        <button type="button" onClick={() => window.print()}>
          Print checklist
        </button>
        <button type="button" disabled={!selected.length} onClick={() => setSelected([])}>
          Clear selections
        </button>
      </div>
      <p className="muted">
        Do not enter or upload medical information here. Take personal notes privately and share
        them directly with your qualified professional.
      </p>
    </section>
  );
}
