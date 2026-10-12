'use client';
import type { BrandKit } from '@/domains/studio/brand';
export function StudioBrandKit({
  value,
  onChange,
  references,
  disabled,
}: {
  value: BrandKit;
  onChange: (value: BrandKit) => void;
  references: { id: string }[];
  disabled: boolean;
}) {
  return (
    <fieldset className="studio-brand-kit" disabled={disabled}>
      <legend>Project brand kit</legend>
      <p>
        Keep your identity with this project. Original logos are placed in finished assets;
        generated lettering needs your review.
      </p>
      <div className="studio-brand-grid">
        <label>
          Brand name
          <input
            value={value.name}
            maxLength={60}
            onChange={(e) => onChange({ ...value, name: e.target.value })}
          />
        </label>
        <label>
          Typography
          <select
            value={value.typography}
            onChange={(e) =>
              onChange({ ...value, typography: e.target.value as BrandKit['typography'] })
            }
          >
            <option value="editorial">Editorial serif</option>
            <option value="modern">Modern sans</option>
          </select>
        </label>
        <label>
          Brand voice
          <textarea
            value={value.voice}
            maxLength={300}
            onChange={(e) => onChange({ ...value, voice: e.target.value })}
            placeholder="The way this brand speaks"
          />
        </label>
        <label>
          Original logo
          <select
            value={value.logoReferenceId ?? ''}
            onChange={(e) => onChange({ ...value, logoReferenceId: e.target.value || null })}
          >
            <option value="">No logo</option>
            {references.map((reference, index) => (
              <option value={reference.id} key={reference.id}>
                Project reference {index + 1}
              </option>
            ))}
          </select>
        </label>
        {(['background', 'foreground', 'accent'] as const).map((key) => (
          <label key={key}>
            {key === 'background' ? 'Background' : key === 'foreground' ? 'Text' : 'Accent'}
            <input
              aria-label={`${key} color`}
              type="color"
              value={value[key]}
              onChange={(e) => onChange({ ...value, [key]: e.target.value })}
            />
            <small>{value[key]}</small>
          </label>
        ))}
      </div>
      <div
        className="studio-brand-swatch"
        style={{ background: value.background, color: value.foreground, borderColor: value.accent }}
      >
        <span style={{ color: value.accent }}>YOUR SIGNATURE</span>
        <strong
          style={{
            fontFamily: value.typography === 'editorial' ? 'Georgia, serif' : 'Arial, sans-serif',
          }}
        >
          {value.name || 'A world of your own.'}
        </strong>
      </div>
    </fieldset>
  );
}
