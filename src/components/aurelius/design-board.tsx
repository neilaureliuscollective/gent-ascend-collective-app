'use client';
import { useMemo, useState } from 'react';
import {
  adjustDesignSwatch,
  selectDesignDirection,
  selectedDirection,
  type DesignBoardContent,
} from '@/domains/talk-creation/design-board';
import './creation.css';

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
            aria-selected={direction.id === draft.selectedDirectionId}
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
      <article className="talk-design-hero" data-shape={current.tokens.shape} data-spacing={current.tokens.spacing}>
        <p className="eyebrow">{current.name}</p>
        <h4 style={{ fontFamily: current.tokens.typography.display }}>{current.demo.headline}</h4>
        <p style={{ fontFamily: current.tokens.typography.body }}>{current.demo.supporting}</p>
        <div className="talk-design-pack" aria-label={current.demo.productLabel}>
          <span className="talk-design-bottle" />
          <small>{current.demo.productLabel}</small>
        </div>
        <p className="talk-design-cta">{current.demo.cta}</p>
      </article>
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
