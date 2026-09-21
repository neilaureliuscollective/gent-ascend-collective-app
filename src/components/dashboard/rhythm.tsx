'use client';
import { useState } from 'react';
import { daysEnding, dayLabel, energyLabels, type DayEntry } from '@/domains/daily/model';
export function Rhythm({ today, entries }: { today: string; entries: DayEntry[] }) {
  const [range, setRange] = useState(7);
  const days = daysEnding(today, range);
  const values = days.map((day) => ({ day, entry: entries.find((e) => e.day === day) }));
  const count = values.filter(({ entry }) => entry?.energy != null).length;
  return (
    <section id="rhythm" className="daily-card rhythm-card" aria-labelledby="rhythm-title">
      <div className="daily-card-heading">
        <div>
          <p className="eyebrow">THE LONGER VIEW</p>
          <h2 id="rhythm-title">Your rhythm.</h2>
        </div>
        <div className="segmented" aria-label="History range">
          {[7, 30].map((n) => (
            <button key={n} aria-pressed={range === n} onClick={() => setRange(n)}>
              {n} days
            </button>
          ))}
        </div>
      </div>
      <div className="rhythm-summary">
        <strong>
          {count}
          <span> / {range}</span>
        </strong>
        <p>
          days with an energy check-in
          <br />
          <span>A record, not a score.</span>
        </p>
      </div>
      <div
        className="energy-chart"
        aria-label={`Self-reported energy over ${range} days`}
        role="img"
      >
        <div className="chart-grid" aria-hidden="true">
          <span>5</span>
          <span>3</span>
          <span>1</span>
        </div>
        <div className="chart-bars" aria-hidden="true">
          {values.map(({ day, entry }, i) => (
            <div className={`chart-day ${day === today ? 'is-today' : ''}`} key={day}>
              <div className="bar-track">
                {entry?.energy != null ? (
                  <span style={{ height: `${entry.energy * 20}%` }} />
                ) : (
                  <i />
                )}
              </div>
              <small>
                {range === 7
                  ? new Intl.DateTimeFormat('en', { weekday: 'narrow', timeZone: 'UTC' }).format(
                      new Date(day + 'T12:00:00Z'),
                    )
                  : i % 5 === 0
                    ? day.slice(-2)
                    : ''}
              </small>
            </div>
          ))}
        </div>
      </div>
      <p className="chart-caption">
        {count
          ? 'Energy, as you reported it. Gaps mean no entry.'
          : 'Your first check-in gives this view a beginning.'}
      </p>
      <details className="rhythm-details">
        <summary>Read the daily values</summary>
        <div className="daily-table-scroll">
          <table>
            <caption>Self-reported observations; sleep is entered manually</caption>
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Energy</th>
                <th scope="col">Sleep</th>
              </tr>
            </thead>
            <tbody>
              {values.map(({ day, entry }) => (
                <tr key={day}>
                  <th scope="row">{dayLabel(day, true)}</th>
                  <td>
                    {entry?.energy != null
                      ? `${entry.energy}/5 · ${energyLabels[entry.energy - 1]}`
                      : 'Not recorded'}
                  </td>
                  <td>
                    {entry?.sleep_minutes != null
                      ? `${Math.floor(entry.sleep_minutes / 60)}h ${entry.sleep_minutes % 60}m`
                      : 'Not recorded'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
