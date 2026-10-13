const explicitCreate =
  /\b((create|generate|make|draw|render|design|produce|paint)\b.{0,40}\b(an? |the )?(image|picture|illustration|visual|photo|mockup|logo|poster|hero)\b|\b(image|picture|illustration|mockup|logo)\b.{0,20}\b(please|now|for me)\b)/i;
const explicitEdit =
  /\b((make|change|edit|adjust|revise|update|darken|lighten|recolor|replace)\b.{0,40}\b(this|the|selected|current)\b.{0,20}\b(image|picture|photo|background|version)\b|\b(darker|lighter|background|palette)\b.{0,20}\b(this|the)\b.{0,12}\b(image|picture|version)\b)/i;
const discussion =
  /\b(how (do|would|should) (i|we|you).{0,40}(image|visual|picture)|what (images?|visuals?|pictures?)|should (i|we) (use|create|generate) (an? )?(image|visual)|talk about (images?|visuals?)|image generation)\b/i;

export function isExplicitImageRequest(text: string) {
  const value = text.trim();
  if (!value || discussion.test(value)) return false;
  return explicitCreate.test(value) || explicitEdit.test(value);
}

export function imageOperationFromText(text: string): 'image.create' | 'image.edit' | null {
  if (!isExplicitImageRequest(text)) return null;
  return explicitEdit.test(text) ? 'image.edit' : 'image.create';
}

const fence = /```talk-(brief|plan|palette|image)\s*\n([\s\S]*?)```/gi;

export function stripCreationFences(text: string) {
  return text.replace(fence, '').replace(/\n{3,}/g, '\n\n').trim();
}

export function extractCreationFences(text: string) {
  const found: Array<{ kind: 'brief' | 'plan' | 'palette' | 'image'; raw: string }> = [];
  for (const match of text.matchAll(fence)) {
    if (found.length >= 4) break;
    const kind = match[1] as 'brief' | 'plan' | 'palette' | 'image';
    found.push({ kind, raw: match[2]?.trim() ?? '' });
  }
  return found;
}
