'use client';
import { useState } from 'react';
import { exerciseCatalog, type CatalogExercise } from '@/domains/performance/catalog';
export function ExercisePicker({
  exclude,
  replacing,
  choose,
  close,
}: {
  exclude: string[];
  replacing?: string;
  choose: (entry: CatalogExercise) => void;
  close: () => void;
}) {
  const [search, setSearch] = useState('');
  const [equipment, setEquipment] = useState('all');
  const [pattern, setPattern] = useState('all');
  const [selected, setSelected] = useState<CatalogExercise | null>(null);
  return (
    <section className="perf-exercise-picker" aria-label="Exercise library">
      <p className="eyebrow">EXERCISE LIBRARY / {exerciseCatalog.length} STARTERS</p>
      <h3>{replacing ? `Replace ${replacing}` : 'Choose a movement'}</h3>
      {selected ? (
        <>
          <p>
            {replacing ?? 'New movement'} → <strong>{selected.name}</strong>
          </p>
          <p>
            Start with 2 sets × 8 reps and zero external load. Review the targets before training.
            This movement has its own identity; past workouts stay unchanged.
          </p>
          <div className="perf-inline">
            <button type="button" className="perf-primary" onClick={() => choose(selected)}>
              Use {selected.name}
            </button>
            <button type="button" onClick={() => setSelected(null)}>
              Back to library
            </button>
          </div>
        </>
      ) : (
        <>
          <label>
            Search exercises
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name, equipment or pattern"
            />
          </label>
          <div className="perf-fields">
            <label>
              Equipment filter
              <select value={equipment} onChange={(e) => setEquipment(e.target.value)}>
                <option value="all">All equipment</option>
                {Array.from(new Set(exerciseCatalog.map((e) => e.equipment))).map((e) => (
                  <option key={e}>{e}</option>
                ))}
              </select>
            </label>
            <label>
              Pattern filter
              <select value={pattern} onChange={(e) => setPattern(e.target.value)}>
                <option value="all">All patterns</option>
                {Array.from(new Set(exerciseCatalog.map((e) => e.pattern))).map((e) => (
                  <option key={e}>{e}</option>
                ))}
              </select>
            </label>
          </div>
          <ul className="perf-catalog-results">
            {exerciseCatalog
              .filter(
                (e) =>
                  (equipment === 'all' || e.equipment === equipment) &&
                  (pattern === 'all' || e.pattern === pattern) &&
                  `${e.name} ${e.equipment} ${e.pattern}`
                    .toLowerCase()
                    .includes(search.toLowerCase()),
              )
              .map((e) => (
                <li key={e.id}>
                  <button
                    type="button"
                    disabled={exclude.includes(e.id)}
                    onClick={() => setSelected(e)}
                  >
                    <strong>{e.name}</strong>
                    <span>
                      {e.equipment} · {e.pattern}
                      {exclude.includes(e.id) ? ' · Already in this session' : ''}
                    </span>
                  </button>
                </li>
              ))}
          </ul>
          <p className="perf-caption">
            Keep using custom movements for anything outside this starter library.
          </p>
        </>
      )}
      <button type="button" onClick={close}>
        Cancel library selection
      </button>
    </section>
  );
}
