'use client';
import { useId, useMemo, useState } from 'react';
import {
  adjustDesignSwatch,
  selectDesignDirection,
  selectedDirection,
  type DesignBoardContent,
} from '@/domains/talk-creation/design-board';
import Image from 'next/image';
import { designAssetSource, type DesignDirection } from '@/domains/talk-creation/design-board';
import './creation.css';

function AuthorizedDesignImage({ src, alt, width }: { src: string; alt: string; width: number }) {
  const [unavailable, setUnavailable] = useState(false);
  return unavailable ? (
    <div className="talk-campaign-missing">
      Authorized asset unavailable. Select an owned asset.
    </div>
  ) : (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={width}
      unoptimized
      onError={() => setUnavailable(true)}
    />
  );
}

/** A bounded renderer: data can select approved compositions and fonts, never inject CSS or markup. */
export function DirectionCanvas({
  direction,
  product,
}: {
  direction: DesignDirection;
  product: string;
}) {
  const variables = Object.fromEntries(
    direction.tokens.colors.map((color) => [`--board-${color.role}`, color.hex]),
  ) as React.CSSProperties;
  Object.assign(variables, {
    '--board-display-font':
      direction.tokens.typography.display === 'Editorial'
        ? 'Georgia, serif'
        : direction.tokens.typography.display === 'Inter'
          ? "'Campaign Inter', sans-serif"
          : "'Campaign Sora', sans-serif",
    '--board-body-font':
      direction.tokens.typography.body === 'Sora'
        ? "'Campaign Sora', sans-serif"
        : "'Campaign Inter', sans-serif",
  });
  const emblem = direction.assets.find(
    (asset) => asset.source === 'official-crest' && designAssetSource(asset),
  );
  const image = designAssetSource(direction.demo.image);
  return (
    <article
      className="talk-design-hero"
      style={variables}
      data-composition={direction.demo.kind}
      data-material={direction.tokens.material}
      data-type={direction.tokens.typography.display === 'Editorial' ? 'editorial' : 'display'}
      data-scale={direction.tokens.typography.scale}
      data-shape={direction.tokens.shape}
      data-spacing={direction.tokens.spacing}
    >
      <header className="talk-campaign-masthead">
        <span>{product}</span>
        <span>Campaign study · {direction.name}</span>
      </header>
      <div className="talk-campaign-copy">
        <p className="talk-campaign-kicker">{direction.copy.subhead || direction.name}</p>
        <h4>{direction.demo.headline}</h4>
        <p>{direction.demo.supporting}</p>
        <span className="talk-design-cta">{direction.demo.cta}</span>
      </div>
      <figure className="talk-campaign-art">
        {image ? (
          <AuthorizedDesignImage
            key={image}
            src={image}
            alt={direction.demo.image.label}
            width={640}
          />
        ) : emblem ? (
          <AuthorizedDesignImage
            key={designAssetSource(emblem)!}
            src={designAssetSource(emblem)!}
            alt={emblem.label}
            width={360}
          />
        ) : (
          <div className="talk-campaign-missing">Asset not supplied</div>
        )}
        <figcaption>
          {image ? direction.demo.productLabel : 'Product photography not supplied'}
        </figcaption>
      </figure>
      <footer className="talk-campaign-footer">
        <span>{direction.copy.proof}</span>
        <span>Proposed creative · review required</span>
      </footer>
    </article>
  );
}

export function DesignBoardView({
  board,
  editable = false,
  expanded = false,
  onChange,
  onCommit,
  onExpand,
}: {
  board: DesignBoardContent;
  editable?: boolean;
  expanded?: boolean;
  onChange?: (next: DesignBoardContent) => void;
  onCommit?: (next: DesignBoardContent) => void;
  onExpand?: () => void;
}) {
  const [draft, setDraft] = useState(board);
  const panelId = useId();
  const [source, setSource] = useState(board);
  if (source !== board) {
    setSource(board);
    setDraft(board);
  }
  const current = useMemo(() => selectedDirection(draft), [draft]);
  const variables = Object.fromEntries(
    current.tokens.colors.map((color) => [`--board-${color.role}`, color.hex]),
  ) as React.CSSProperties;

  function update(next: DesignBoardContent, persist = false) {
    setDraft(next);
    onChange?.(next);
    if (persist) onCommit?.(next);
  }

  return (
    <section
      className="talk-design-board"
      data-expanded={expanded || undefined}
      data-material={current.tokens.material}
      style={variables}
    >
      {expanded ? (
        <header className="talk-design-board-head">
          <p className="eyebrow">{draft.product} · design board</p>
          <h3>{draft.title}</h3>
          <p>{draft.notes}</p>
        </header>
      ) : null}
      <div className="talk-design-directions" role="tablist" aria-label="Design directions">
        {draft.directions.map((direction) => (
          <button
            key={direction.id}
            type="button"
            role="tab"
            id={`${panelId}-${direction.id}`}
            tabIndex={direction.id === draft.selectedDirectionId ? 0 : -1}
            aria-selected={direction.id === draft.selectedDirectionId}
            onKeyDown={(event) => {
              const index = draft.directions.findIndex((item) => item.id === direction.id);
              const next =
                event.key === 'Home'
                  ? 0
                  : event.key === 'End'
                    ? draft.directions.length - 1
                    : event.key === 'ArrowRight'
                      ? (index + 1) % draft.directions.length
                      : event.key === 'ArrowLeft'
                        ? (index + draft.directions.length - 1) % draft.directions.length
                        : null;
              if (next === null) return;
              event.preventDefault();
              const target = draft.directions[next]!;
              update(selectDesignDirection(draft, target.id), Boolean(editable && onCommit));
              document.getElementById(`${panelId}-${target.id}`)?.focus();
            }}
            aria-controls={panelId}
            className="talk-design-direction"
            data-selected={direction.id === draft.selectedDirectionId || undefined}
            onClick={() =>
              update(selectDesignDirection(draft, direction.id), Boolean(editable && onCommit))
            }
          >
            <strong>{direction.name}</strong>
            <span>{direction.tokens.material}</span>
          </button>
        ))}
      </div>
      <div
        id={panelId}
        role="tabpanel"
        aria-labelledby={`${panelId}-${draft.selectedDirectionId}`}
        aria-live="polite"
      >
        <DirectionCanvas direction={current} product={draft.product} />
      </div>
      <details className="talk-design-details">
        <summary>{editable ? 'Edit colors & design details' : 'Design details'}</summary>
        {expanded && editable && (
          <div className="talk-direction-editor">
            <label>
              Campaign headline
              <input
                maxLength={80}
                value={current.demo.headline}
                onChange={(event) =>
                  update({
                    ...draft,
                    rendererVersion: 'premium/v2',
                    directions: draft.directions.map((item) =>
                      item.id === current.id
                        ? {
                            ...item,
                            demo: { ...item.demo, headline: event.target.value },
                            copy: { ...item.copy, headline: event.target.value },
                          }
                        : item,
                    ),
                  })
                }
              />
            </label>
            <label>
              Composition
              <select
                value={current.demo.kind}
                onChange={(event) =>
                  update({
                    ...draft,
                    rendererVersion: 'premium/v2',
                    directions: draft.directions.map((item) =>
                      item.id === current.id
                        ? {
                            ...item,
                            demo: {
                              ...item.demo,
                              kind: event.target.value as DesignDirection['demo']['kind'],
                            },
                          }
                        : item,
                    ),
                  })
                }
              >
                <option value="hero-product">Classic split</option>
                <option value="editorial">Editorial</option>
                <option value="split-campaign">Split campaign</option>
                <option value="statement">Statement</option>
              </select>
            </label>
            <label>
              Display type
              <select
                value={current.tokens.typography.display}
                onChange={(event) =>
                  update({
                    ...draft,
                    rendererVersion: 'premium/v2',
                    directions: draft.directions.map((item) =>
                      item.id === current.id
                        ? {
                            ...item,
                            tokens: {
                              ...item.tokens,
                              typography: {
                                ...item.tokens.typography,
                                display: event.target.value,
                              },
                            },
                          }
                        : item,
                    ),
                  })
                }
              >
                <option value="Sora">Sora · loaded</option>
                <option value="Inter">Inter · loaded</option>
                <option value="Editorial">Editorial · native serif</option>
              </select>
            </label>
          </div>
        )}
        <ul className="talk-design-swatches">
          {current.tokens.colors.map((color) => (
            <li key={color.role}>
              <label>
                <span
                  className="talk-design-swatch"
                  style={{ background: color.hex }}
                  title={`${color.name} ${color.hex}`}
                />
                <strong>{color.name}</strong>
                <code>{color.hex}</code>
                {editable ? (
                  <input
                    type="color"
                    aria-label={`${color.name} swatch`}
                    value={color.hex}
                    onChange={(event) =>
                      update(
                        adjustDesignSwatch(draft, {
                          directionId: current.id,
                          role: color.role,
                          hex: event.target.value,
                        }),
                      )
                    }
                  />
                ) : null}
              </label>
            </li>
          ))}
        </ul>
        {expanded ? (
          <>
            <dl className="talk-design-meta">
              <div>
                <dt>Type</dt>
                <dd>
                  {current.tokens.typography.display} / {current.tokens.typography.body} ·{' '}
                  {current.tokens.typography.scale}
                </dd>
              </div>
              <div>
                <dt>Space / shape</dt>
                <dd>
                  {current.tokens.spacing} · {current.tokens.shape}
                </dd>
              </div>
              <div>
                <dt>Material</dt>
                <dd>{current.tokens.material}</dd>
              </div>
            </dl>
            <blockquote>
              <p>{current.copy.headline}</p>
              <p>{current.copy.subhead}</p>
              <p>{current.copy.proof}</p>
              <p className="talk-creation-status">{current.copy.disclaimer}</p>
            </blockquote>
            <ul className="talk-design-assets">
              {current.assets.map((asset) => (
                <li key={asset.id}>
                  {asset.label} · {asset.kind} · {asset.provenance}
                  {asset.referenced ? ' · referenced' : ''}
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </details>
      {editable && onCommit && (
        <div className="talk-creation-actions">
          <button type="button" className="button" onClick={() => onCommit(draft)}>
            Save this version
          </button>
          {onExpand && !expanded && (
            <button type="button" className="text-button" onClick={onExpand}>
              Expand board
            </button>
          )}
        </div>
      )}
    </section>
  );
}
