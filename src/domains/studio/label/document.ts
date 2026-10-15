import { emptyDocument, parseDesignDocument, type DesignDocument, type DesignLayer } from '../design/document';
import { type BrandKit } from '../brand';
import { labelBriefSchema, labelLayoutSchema, parseSupplierProfile, overlaps, type LabelBrief, type LabelLayout, type SupplierProfile } from './contract';
import { sanitizeSvg } from '../design/sanitize';
import { groupWorldBounds } from '../design/geometry';

const base = { parentId: null, visible: true, locked: false, opacity: 1, rotation: 0 } as const;
export function protectedLayers(profile: SupplierProfile): DesignLayer[] {
  return profile.protected.map(item => item.format === 'svg' ? {
    ...base, ...item.box, id:item.id,name:item.name,locked:true,type:'svg',markup:sanitizeSvg(item.markup!),
  } : ({
    ...base, ...item.box, id: item.id, name: item.name, locked: true,
    type: 'text', content: item.content, fontId: 'inter', fontSize: item.fontSize,
    fontWeight: 400, align: 'left', lineHeight: 1.15, letterSpacing: 0, fill: '#000000',
  }));
}

export function createLabelDocument(input: {
  id: string; profile: SupplierProfile; brief: LabelBrief; brand: BrandKit;
  logo: string; layout: LabelLayout; generation: 'deterministic' | 'model';
}): DesignDocument {
  const profile = parseSupplierProfile(input.profile);
  const brief = labelBriefSchema.parse(input.brief);
  const layout = labelLayoutSchema.parse(input.layout);
  const logo = sanitizeSvg(input.logo);
  const doc = emptyDocument({ id: input.id, title: brief.productName, ...profile.trim, unit: 'mm', dimensionSource: 'supplied', dimensionNote: `${profile.supplier} ${profile.sku}; template ${profile.template.revision}. User supplied; supplier approval not established.` });
  doc.page = { ...doc.page, background: '#FFFFFF', bleed: profile.bleed,
    safe: { left: profile.safe.x, top: profile.safe.y, right: profile.trim.width-profile.safe.x-profile.safe.width, bottom: profile.trim.height-profile.safe.y-profile.safe.height } };
  doc.label = { profile, brief, brand: input.brand, generation: input.generation, layout };
  const area = profile.artwork;
  const pad = Math.min(area.width, area.height)*0.06;
  const logoSide = Math.min(area.width, area.height)*layout.logoFraction;
  const x = layout.alignment === 'left' ? area.x+pad : area.x+(area.width-logoSide)/2;
  const layer = (name: string) => ({ ...base, id: crypto.randomUUID(), name });
  doc.layers = [
    { ...layer('Brand field'), ...area, type: 'rect', fill: input.brand.background, stroke: null, strokeWidth: 0, cornerRadius: 0 },
    { ...layer('Approved logo'), type: 'svg', markup: logo, x, y: area.y+pad, width: logoSide, height: logoSide },
    { ...layer('Product name'), type: 'text', x: area.x+pad, y: area.y+area.height*0.52, width: area.width-pad*2, height: area.height*0.38,
      content: brief.productName, fontId: input.brand.typography === 'editorial' ? 'sora' : 'inter', fontSize: layout.titleSize, fontWeight: 600, align: layout.alignment, lineHeight: 1.15, letterSpacing: 0, fill: input.brand.foreground },
    ...(layout.accent === 'rule' ? [{ ...layer('Gold rule'), type: 'rect' as const, x: area.x+pad, y: area.y+area.height*0.46, width: area.width-pad*2, height: 0.4, fill: input.brand.accent, stroke: null, strokeWidth: 0, cornerRadius: 0 }] : []),
    ...protectedLayers(profile),
  ];
  return parseDesignDocument(doc);
}

/** Profile and fact revisions are immutable for this design. Import a new design for a new supplier revision. */
export function assertLabelRevision(previous: DesignDocument, next: DesignDocument) {
  if (JSON.stringify(previous.label) !== JSON.stringify(next.label)) throw new Error('Supplier profile, facts, brief and brand provenance are immutable. Create a new label for a new revision.');
  if (!next.label) return;
  if (JSON.stringify(previous.page) !== JSON.stringify(next.page)) throw new Error('Supplier page geometry is protected. Import a new profile to change it.');
  const errors = protectedLabelErrors(next);
  if (errors.length) throw new Error(errors[0]);
}

export function protectedLabelErrors(doc: DesignDocument): string[] {
  if (!doc.label) return [];
  const errors: string[] = [];
  for (const expected of protectedLayers(doc.label.profile)) {
    const actual = doc.layers.find(l => l.id === expected.id);
    if (JSON.stringify(actual) !== JSON.stringify(parseDesignDocument({ ...doc, label: undefined, layers: [expected] }).layers[0])) errors.push(`Protected supplier copy “${expected.name}” changed or is missing.`);
  }
  return errors;
}

export function labelGeometryErrors(doc: DesignDocument): string[] {
  if (!doc.label) return [];
  const profile = doc.label.profile;
  const errors = protectedLabelErrors(doc);
  const protectedIds = new Set(profile.protected.map(p=>p.id));
  for (const layer of doc.layers) {
    if (protectedIds.has(layer.id) || layer.type === 'group' || !layer.visible || layer.opacity === 0) continue;
    const bounds = groupWorldBounds([layer]);
    const area = profile.artwork;
    if (bounds.x < area.x-0.001 || bounds.y < area.y-0.001 || bounds.x+bounds.width > area.x+area.width+0.001 || bounds.y+bounds.height > area.y+area.height+0.001) errors.push(`“${layer.name}” leaves the designated artwork region.`);
    if (overlaps(bounds,profile.matrix)) errors.push(`“${layer.name}” covers the supplier matrix-code area.`);
    for (const region of profile.protected) if (overlaps(bounds,region.box)) errors.push(`“${layer.name}” overlaps protected supplier copy.`);
  }
  return errors;
}
