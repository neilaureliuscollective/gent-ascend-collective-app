'use client';
import type { PaletteContent } from '@/domains/talk-creation/schema';

export function PaletteSwatches({
  palette,
  detailed = false,
}: {
  palette: PaletteContent;
  detailed?: boolean;
}) {
  if (detailed) {
    return (
      <div>
        {palette.swatches.map((swatch) => (
          <div className="talk-swatch-row" key={`${swatch.hex}-${swatch.name}`}>
            <span
              className="talk-swatch"
              style={{ background: swatch.hex }}
              title={`${swatch.name} ${swatch.hex}`}
            />
            <div className="talk-swatch-meta">
              <strong>{swatch.name}</strong>
              <span>
                {swatch.hex} · {swatch.role}
              </span>
            </div>
          </div>
        ))}
        {palette.contrast.length > 0 && (
          <ul className="talk-contrast">
            {palette.contrast.map((pair) => (
              <li key={pair.pair}>
                {pair.pair}: {pair.ratio}:1{pair.passesAa ? ' · AA' : ''}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }
  return (
    <div className="talk-swatches" aria-label={`${palette.title} swatches`}>
      {palette.swatches.map((swatch) => (
        <span
          key={`${swatch.hex}-${swatch.name}`}
          className="talk-swatch"
          style={{ background: swatch.hex }}
          title={`${swatch.name} ${swatch.hex}`}
        >
          <span className="sr-only">
            {swatch.name} {swatch.hex} {swatch.role}
          </span>
        </span>
      ))}
    </div>
  );
}
