import path from 'node:path';

export const designFontIds = ['inter', 'sora', 'dejavu'] as const;
export type DesignFontId = (typeof designFontIds)[number];
export type DesignFontWeight = 400 | 600 | 700;

export type DesignFontFile = {
  id: DesignFontId;
  family: string;
  cssFamily: string;
  weights: DesignFontWeight[];
  file: string;
  license: string;
  licenseFile: string;
};

export const designFonts: Record<DesignFontId, DesignFontFile> = {
  inter: {
    id: 'inter',
    family: 'Inter',
    cssFamily: 'Inter, "Helvetica Neue", sans-serif',
    weights: [400, 600, 700],
    file: 'src/assets/fonts/inter.woff2',
    license: 'SIL Open Font License 1.1',
    licenseFile: 'src/assets/fonts/inter-LICENSE.txt',
  },
  sora: {
    id: 'sora',
    family: 'Sora',
    cssFamily: 'Sora, "Helvetica Neue", sans-serif',
    weights: [400, 600, 700],
    file: 'src/assets/fonts/sora.woff2',
    license: 'SIL Open Font License 1.1',
    licenseFile: 'src/assets/fonts/sora-LICENSE.txt',
  },
  dejavu: {
    id: 'dejavu',
    family: 'DejaVu Sans',
    cssFamily: '"DejaVu Sans", "company-work", sans-serif',
    weights: [400],
    file: 'public/fonts/company-work.ttf',
    license: 'Bitstream Vera / DejaVu',
    licenseFile: 'public/fonts/LICENSE-DejaVu.txt',
  },
};

export function designFont(id: string): DesignFontFile {
  if (!designFontIds.includes(id as DesignFontId))
    throw new Error(`Missing font: ${id}. Studio does not substitute another typeface.`);
  return designFonts[id as DesignFontId];
}

export function designFontPath(id: DesignFontId) {
  if (id === 'dejavu') return path.join(process.cwd(), 'public', 'fonts', 'company-work.ttf');
  if (id === 'inter') return path.join(process.cwd(), 'src', 'assets', 'fonts', 'inter.woff2');
  return path.join(process.cwd(), 'src', 'assets', 'fonts', 'sora.woff2');
}

export function fontSupportsWeight(id: DesignFontId, weight: DesignFontWeight) {
  return designFonts[id].weights.includes(weight);
}
