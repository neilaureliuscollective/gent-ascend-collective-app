import path from 'node:path';

export const designFontIds = ['inter', 'sora', 'dejavu'] as const;
export type DesignFontId = (typeof designFontIds)[number];
export type DesignFontWeight = 400 | 600 | 700;

export type DesignFontFile = {
  id: DesignFontId;
  family: string;
  cssFamily: string;
  weights: DesignFontWeight[];
  files: Partial<Record<DesignFontWeight, string>> & { 400: string };
  license: string;
  licenseFile: string;
};

/**
 * Static OFL instances. Inter/Sora 400/600/700 are instantiated from the bundled
 * variable WOFF2 with fontTools.varLib.instancer (scripts/studio-instance-fonts.py).
 * DejaVu remains the existing static Regular TTF. Measurement, SVG, PDF and PNG
 * all load these exact files — never a compressed-PNG ink scan or a single width ratio.
 */
export const designFonts: Record<DesignFontId, DesignFontFile> = {
  inter: {
    id: 'inter',
    family: 'Inter',
    cssFamily: 'Inter, "Helvetica Neue", sans-serif',
    weights: [400, 600, 700],
    files: {
      400: 'src/assets/fonts/inter-400.ttf',
      600: 'src/assets/fonts/inter-600.ttf',
      700: 'src/assets/fonts/inter-700.ttf',
    },
    license: 'SIL Open Font License 1.1',
    licenseFile: 'src/assets/fonts/inter-LICENSE.txt',
  },
  sora: {
    id: 'sora',
    family: 'Sora',
    cssFamily: 'Sora, "Helvetica Neue", sans-serif',
    weights: [400, 600, 700],
    files: {
      400: 'src/assets/fonts/sora-400.ttf',
      600: 'src/assets/fonts/sora-600.ttf',
      700: 'src/assets/fonts/sora-700.ttf',
    },
    license: 'SIL Open Font License 1.1',
    licenseFile: 'src/assets/fonts/sora-LICENSE.txt',
  },
  dejavu: {
    id: 'dejavu',
    family: 'DejaVu Sans',
    cssFamily: '"DejaVu Sans", "company-work", sans-serif',
    weights: [400],
    files: { 400: 'public/fonts/company-work.ttf' },
    license: 'Bitstream Vera / DejaVu',
    licenseFile: 'public/fonts/LICENSE-DejaVu.txt',
  },
};

export function designFont(id: string): DesignFontFile {
  if (!designFontIds.includes(id as DesignFontId))
    throw new Error(`Missing font: ${id}. Studio does not substitute another typeface.`);
  return designFonts[id as DesignFontId];
}

export function designFontPath(id: DesignFontId, weight: DesignFontWeight = 400) {
  if (!fontSupportsWeight(id, weight))
    throw new Error(`${id} does not include a real ${weight} instance. Studio will not substitute another face.`);
  const root = process.cwd();
  if (id === 'dejavu') return path.join(root, 'public', 'fonts', 'company-work.ttf');
  if (id === 'inter') {
    if (weight === 600) return path.join(root, 'src', 'assets', 'fonts', 'inter-600.ttf');
    if (weight === 700) return path.join(root, 'src', 'assets', 'fonts', 'inter-700.ttf');
    return path.join(root, 'src', 'assets', 'fonts', 'inter-400.ttf');
  }
  if (weight === 600) return path.join(root, 'src', 'assets', 'fonts', 'sora-600.ttf');
  if (weight === 700) return path.join(root, 'src', 'assets', 'fonts', 'sora-700.ttf');
  return path.join(root, 'src', 'assets', 'fonts', 'sora-400.ttf');
}

export function fontSupportsWeight(id: DesignFontId, weight: DesignFontWeight) {
  return designFonts[id].weights.includes(weight);
}

export function designFontFaceList() {
  const faces: { id: DesignFontId; weight: DesignFontWeight; path: string }[] = [];
  for (const id of designFontIds) {
    for (const weight of designFonts[id].weights) {
      faces.push({ id, weight, path: designFontPath(id, weight) });
    }
  }
  return faces;
}
