'use client';
import type { z } from 'zod';
import type { pagesSchema } from '@/domains/technology/schema';
type Pages = z.infer<typeof pagesSchema>;
export function PageComposer({
  pages,
  onChange,
}: {
  pages: Pages;
  onChange: (pages: Pages) => void;
}) {
  function update(index: number, value: Partial<Pages[number]>) {
    onChange(pages.map((p, i) => (i === index ? { ...p, ...value } : p)));
  }
  function move(index: number, step: number) {
    const next = [...pages];
    [next[index], next[index + step]] = [next[index + step]!, next[index]!];
    onChange(next);
  }
  return (
    <details>
      <summary>Additional pages</summary>
      <p>
        Add up to three informational pages. Sections use your reviewed text; they do not connect
        forms, payments or other services. Changes are saved as a new website version.
      </p>
      {pages.map((p, i) => (
        <div className="technology-page-editor" key={i}>
          <h3>Page {i + 1}</h3>
          <label>
            Page {i + 1} title
            <input
              maxLength={60}
              value={p.title}
              onChange={(e) => update(i, { title: e.target.value })}
            />
          </label>
          <label>
            Page {i + 1} address
            <input
              maxLength={48}
              value={p.slug}
              onChange={(e) => update(i, { slug: e.target.value })}
            />
            <small>Lowercase words separated by hyphens. Use a unique address.</small>
          </label>
          <label>
            Page {i + 1} layout
            <select
              value={p.layout}
              onChange={(e) => update(i, { layout: e.target.value as Pages[number]['layout'] })}
            >
              <option value="stacked">Editorial sections</option>
              <option value="cards">Cards</option>
            </select>
          </label>
          {p.sections.map((s, n) => (
            <div key={n}>
              <label>
                Page {i + 1} section {n + 1} heading
                <input
                  maxLength={80}
                  value={s.heading}
                  onChange={(e) =>
                    update(i, {
                      sections: p.sections.map((v, j) =>
                        j === n ? { ...v, heading: e.target.value } : v,
                      ),
                    })
                  }
                />
              </label>
              <label>
                Page {i + 1} section {n + 1} text
                <textarea
                  maxLength={600}
                  value={s.body}
                  onChange={(e) =>
                    update(i, {
                      sections: p.sections.map((v, j) =>
                        j === n ? { ...v, body: e.target.value } : v,
                      ),
                    })
                  }
                />
              </label>
              {p.sections.length > 1 && (
                <button
                  onClick={() => update(i, { sections: p.sections.filter((_, j) => j !== n) })}
                >
                  Remove page {i + 1} section {n + 1}
                </button>
              )}
            </div>
          ))}
          <div className="technology-page-actions">
            <button
              disabled={p.sections.length >= 3}
              onClick={() => update(i, { sections: [...p.sections, { heading: '', body: '' }] })}
            >
              Add section to page {i + 1}
            </button>
            <button disabled={i === 0} onClick={() => move(i, -1)}>
              Move page {i + 1} earlier
            </button>
            <button disabled={i === pages.length - 1} onClick={() => move(i, 1)}>
              Move page {i + 1} later
            </button>
            <button onClick={() => onChange(pages.filter((_, j) => j !== i))}>
              Remove page {i + 1}
            </button>
          </div>
        </div>
      ))}
      <button
        disabled={pages.length >= 3}
        onClick={() => {
          let n = 1;
          while (pages.some((p) => p.slug === `page-${n}`)) n++;
          onChange([
            ...pages,
            {
              slug: `page-${n}`,
              title: '',
              layout: 'stacked',
              sections: [{ heading: '', body: '' }],
            },
          ]);
        }}
      >
        Add informational page
      </button>
    </details>
  );
}
