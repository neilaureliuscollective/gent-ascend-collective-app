import palette from './aether-palette.json';

/** Shared shader constants derived from the same palette as CSS. */
function vector(hex: string) {
  return `vec3(${[1, 3, 5].map((offset) => (parseInt(hex.slice(offset, offset + 2), 16) / 255).toFixed(5)).join(',')})`;
}
export const aetherMaterial = {
  core: vector(palette.obsidian),
  deep: vector(palette.deep),
  atmosphere: vector(palette.petrol),
  edge: vector(palette.luminous),
  highlight: vector(palette['aether-glow']),
  gold: vector(palette['gold-light']),
};
