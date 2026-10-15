import { describe, expect, it } from 'vitest';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { inflateSync } from 'node:zlib';
import { PDFDocument } from 'pdf-lib';
import { createLabelDocument, assertLabelRevision, labelGeometryErrors } from '../src/domains/studio/label/document';
import { parseSupplierProfile, labelBriefSchema, labelLayoutSchema } from '../src/domains/studio/label/contract';
import { parseDesignDocument } from '../src/domains/studio/design/document';
import { commitDesign, emptyHistory, undoDesign, redoDesign } from '../src/domains/studio/design/commands';
import { sanitizeSvg } from '../src/domains/studio/design/sanitize';
import { vectorSvg } from '../src/domains/studio/design/svg-vector';
import { validateDesign, blockingIssues } from '../src/domains/studio/design/validate';
import { exportPdf } from '../src/domains/studio/design/pdf-export';
import { renderDesignBytes } from '../src/domains/studio/render/design-job';
const root='tests/fixtures/labels/';
async function fixture() {
 const profile=parseSupplierProfile(JSON.parse(await readFile(root+'supplier-profile.json','utf8')));
 const brief=labelBriefSchema.parse(JSON.parse(await readFile(root+'talk-brief.json','utf8')));
 return createLabelDocument({id:'b0000000-0000-4000-8000-000000000001',profile,brief,brand:{name:'Aethelios',voice:'',background:'#0B3B32',foreground:'#FFFFFF',accent:'#C4912F',typography:'editorial',logoReferenceId:null},logo:await readFile(root+'approved-fixture-logo.svg','utf8'),layout:labelLayoutSchema.parse({alignment:'center',titleSize:16,logoFraction:.32,accent:'rule'}),generation:'deterministic'});
}
describe('supplier labels',()=>{
 it('creates exact geometry with preserved source and fact revisions, editable logo and type',async()=>{
  const doc=await fixture();expect(doc.page.width).toBe(120);expect(doc.label?.profile.template.sha256).toHaveLength(64);
  expect(labelGeometryErrors(doc)).toEqual([]);expect(blockingIssues(await validateDesign(doc,[]))).toEqual([]);
  const title=doc.layers.find(l=>l.name==='Product name')!;
  const edit=commitDesign(doc,emptyHistory(),{type:'update',id:title.id,patch:{x:title.x+1}});
  assertLabelRevision(doc,edit.document);
  const undo=undoDesign(edit.document,edit.history);expect(undo.document).toEqual(doc);
  expect(redoDesign(undo.document,undo.history).document).toEqual(edit.document);
  expect(parseDesignDocument(JSON.parse(JSON.stringify(edit.document)))).toEqual(edit.document);
 });
 it('rejects missing supplier copy, modified facts, overlapping regions and changed geometry',async()=>{
  const doc=await fixture();const altered=structuredClone(doc);altered.layers.pop();expect(()=>assertLabelRevision(doc,altered)).toThrow(/copy/);
  const facts=structuredClone(doc);facts.label!.profile.facts.revision='changed';expect(()=>assertLabelRevision(doc,facts)).toThrow(/immutable/);
  const geometry=structuredClone(doc);geometry.page.width=100;expect(()=>assertLabelRevision(doc,geometry)).toThrow(/geometry/);
  const profile=structuredClone(doc.label!.profile);profile.matrix=profile.artwork;expect(()=>parseSupplierProfile(profile)).toThrow(/overlap/);
 });
 it('blocks rotated/outside artwork and overflowing type at actual export boundary',async()=>{
  const doc=await fixture();const title=doc.layers.find(l=>l.type==='text'&&!l.locked)!;title.width=1;
  expect(blockingIssues(await validateDesign(doc,[])).length).toBeGreaterThan(0);
  await expect(renderDesignBytes(doc,[],'pdf')).rejects.toThrow(/overflows/);
  title.x=0;title.rotation=45;expect(labelGeometryErrors(doc).length).toBeGreaterThan(0);
 });
 it('exports exact media/trim/bleed, outlined text and vector logo without images/fonts',async()=>{
  const doc=await fixture();const bytes=await exportPdf(doc,[]);const pdf=await PDFDocument.load(bytes);const page=pdf.getPages()[0]!;
  expect(page.getMediaBox().width).toBeCloseTo(124*72/25.4,4);expect(page.getMediaBox().height).toBeCloseTo(64*72/25.4,4);
  expect(page.getTrimBox().width).toBeCloseTo(120*72/25.4,4);expect(page.getTrimBox().x).toBeCloseTo(2*72/25.4,4);
  const raw=Buffer.from(bytes).toString('latin1');expect(raw).not.toContain('/Subtype /Image');expect(raw).not.toContain('/Type /Font');expect(bytes.length).toBeLessThan(10_000_000);
  const streams=[...raw.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)].map(m=>{try{return inflateSync(Buffer.from(m[1]!,'latin1')).toString('latin1');}catch{return m[1]!;}}).join('\n');
  expect(streams).toContain('50 8 m');expect(streams).not.toMatch(/\bBT\b/);
  await mkdir('docs/evidence/studio-labels',{recursive:true});await writeFile('docs/evidence/studio-labels/synthetic-label.pdf',bytes);await writeFile('docs/evidence/studio-labels/synthetic-design.json',JSON.stringify(doc,null,2));
 });
 it.each(['<svg><path onclick="alert(1)"/></svg>','<svg><path fill="url(&#104;ttps://evil.test/a)"/></svg>','<svg><path style="fill:url(\\68 ttps://evil.test)"/></svg>','<!DOCTYPE svg [<!ENTITY e SYSTEM "file:///etc/passwd">]><svg/>','<svg><image href="https://evil.test"/></svg>','<svg><path d="M0 0"></svg>'])('rejects hostile XML %s',svg=>expect(()=>sanitizeSvg(svg)).toThrow());
 it('rejects unsupported vector features rather than rasterizing',()=>expect(()=>vectorSvg('<svg viewBox="0 0 10 10"><text x="1" y="2">No substitution</text></svg>')).toThrow(/Outline/));
 it('rejects invented model keys and invalid handoff',()=>{
  expect(()=>labelLayoutSchema.parse({alignment:'center',titleSize:16,logoFraction:.3,accent:'rule',claims:'cures'})).toThrow();
  expect(()=>labelBriefSchema.parse({productName:'Name'})).toThrow();
 });
});
