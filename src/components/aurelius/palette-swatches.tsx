'use client';
import type { PaletteContent, SwatchRole } from '@/domains/talk-creation/schema';
import { swatchRoles } from '@/domains/talk-creation/schema';

export function PaletteSwatches({
  palette,
  detailed = false,
  canEdit = false,
  onChange,
}: {
  palette: PaletteContent;
  detailed?: boolean;
  canEdit?: boolean;
  onChange?: (palette: PaletteContent) => void;
}) {
  if (detailed) {
    return (
      <div>
        <label>
          Title
          <input
            value={palette.title}
            disabled={!canEdit}
            onChange={(event) => onChange?.({ ...palette, title: event.target.value })}
          />
        </label>
        <label>
          Notes
          <textarea
            value={palette.notes}
            disabled={!canEdit}
            onChange={(event) => onChange?.({ ...palette, notes: event.target.value })}
          />
        </label>
        {palette.swatches.map((swatch, index) => (
          <div className="talk-swatch-row" key={`${swatch.hex}-${swatch.name}-${index}`}>
            <span
              className="talk-swatch"
              style={{ background: /^#[0-9a-fA-F]{6}$/.test(swatch.hex) ? swatch.hex : '#080D0D' }}
              title={`${swatch.name} ${swatch.hex}`}
            />
            <div className="talk-swatch-meta">
              {canEdit && onChange ? (
                <>
                  <input
                    aria-label={`Swatch ${index + 1} name`}
                    value={swatch.name}
                    onChange={(event) => {
                      const swatches = palette.swatches.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, name: event.target.value } : item,
                      );
                      onChange({ ...palette, swatches });
                    }}
                  />
                  <input
                    aria-label={`Swatch ${index + 1} hex`}
                    value={swatch.hex}
                    onChange={(event) => {
                      const swatches = palette.swatches.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, hex: event.target.value } : item,
                      );
                      onChange({ ...palette, swatches });
                    }}
                  />
                  <select
                    aria-label={`Swatch ${index + 1} role`}
                    value={swatch.role}
                    onChange={(event) => {
                      const swatches = palette.swatches.map((item, itemIndex) =>
                        itemIndex === index
                          ? { ...item, role: event.target.value as SwatchRole }
                          : item,
                      );
                      onChange({ ...palette, swatches });
                    }}
                  >
                    {swatchRoles.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                </>
              ) : (
                <>
                  <strong>{swatch.name}</strong>
                  <span>
                    {swatch.hex} · {swatch.role}
                  </span>
                </>
              )}
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
