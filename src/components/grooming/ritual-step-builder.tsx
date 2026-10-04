'use client';
import { useRef, useState } from 'react';

/** Edits the existing newline contract; rearranging never saves a routine. */
export function RitualStepBuilder({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const rows = value.split('\n');
  const fields = useRef<Array<HTMLInputElement | null>>([]);
  const [announcement, setAnnouncement] = useState('');
  function update(next: string[], message: string, focus?: number) {
    const text = next.join('\n');
    if (text.length > 1000) {
      setAnnouncement('Keep the whole ritual within 1,000 characters.');
      return;
    }
    onChange(text);
    setAnnouncement(message);
    if (focus !== undefined) requestAnimationFrame(() => fields.current[focus]?.focus());
  }
  function move(index: number, direction: -1 | 1) {
    const next = [...rows],
      destination = index + direction;
    [next[index], next[destination]] = [next[destination]!, next[index]!];
    update(next, `Step ${index + 1} moved to position ${destination + 1}.`, destination);
  }
  return (
    <details className="ritual-step-builder">
      <summary>Arrange individual steps</summary>
      <p>Keep the order deliberate. Edit, move or remove a step; saving comes after review.</p>
      <ol>
        {rows.map((text, index) => (
          <li key={index}>
            <label>
              Step {index + 1}
              <input
                ref={(element) => {
                  fields.current[index] = element;
                }}
                value={text}
                maxLength={1000}
                onChange={(event) =>
                  update(
                    rows.map((row, i) => (i === index ? event.target.value : row)),
                    '',
                  )
                }
              />
            </label>
            <div className="ritual-step-actions">
              <button
                type="button"
                aria-label={`Move step ${index + 1} up`}
                disabled={index === 0}
                onClick={() => move(index, -1)}
              >
                ↑ Up
              </button>
              <button
                type="button"
                aria-label={`Move step ${index + 1} down`}
                disabled={index === rows.length - 1}
                onClick={() => move(index, 1)}
              >
                ↓ Down
              </button>
              <button
                type="button"
                aria-label={`Remove step ${index + 1}`}
                disabled={rows.length === 1}
                onClick={() =>
                  update(
                    rows.filter((_, i) => i !== index),
                    `Step ${index + 1} removed.`,
                    Math.max(0, index - 1),
                  )
                }
              >
                Remove
              </button>
            </div>
          </li>
        ))}
      </ol>
      <button
        type="button"
        disabled={value.length >= 1000}
        onClick={() => update([...rows, ''], 'New step added.', rows.length)}
      >
        Add a step +
      </button>
      <p role="status">{announcement}</p>
    </details>
  );
}
