import { describe, expect, it } from 'vitest';
import {
  assertOneSelectionPerKind,
  boundText,
  describeHandoffTransfer,
  exceedsBound,
  projectFromResolvedHandoff,
  uniqueKindSelectionMessage,
  utf16Length,
  type ResolvedArchitectPackage,
} from '@/domains/talk-creation/origin-import';
import { originProjectIdentity, originSaveIdentity } from '@/domains/talk-creation/persist';

const conversation = '30000000-0000-4000-8000-000000000001';
const briefId = '50000000-0000-4000-8000-000000000011';
const planId = '50000000-0000-4000-8000-000000000012';
const paletteId = '50000000-0000-4000-8000-000000000013';
const imageId = '60000000-0000-4000-8000-000000000014';
const imageVersion = '60000000-0000-4000-8000-000000000015';
const studioProject = '60000000-0000-4000-8000-000000000016';

const resolved = (): ResolvedArchitectPackage => ({
  handoff: {
    schema: 'talk-architect-handoff/v1',
    conversationId: conversation,
    preparedAt: '2026-10-14T00:00:00.000Z',
    discipline: 'business',
    idea: 'A premium brand and website.',
    description: '',
    decisions: 'Keep emerald restrained.',
    selections: [
      { kind: 'brief', lineageId: briefId, versionId: briefId, version: 1, title: 'Reserve site' },
      { kind: 'plan', lineageId: planId, versionId: planId, version: 1, title: 'Launch plan' },
      { kind: 'palette', lineageId: paletteId, versionId: paletteId, version: 1, title: 'Imperial palette' },
    ],
    images: [
      { artifactId: imageId, versionId: imageVersion, projectId: studioProject, prompt: 'Crest on obsidian' },
    ],
    imported: false,
  },
  sourceTurnId: null,
  brief: {
    title: 'Reserve site',
    purpose: 'A premium brand and website.',
    audience: 'Founders',
    visualDirection: 'Obsidian and gold',
    requirements: ['Phone first'],
    unresolved: ['Typeface'],
  },
  plan: {
    title: 'Launch plan',
    summary: 'Ship the reserve site.',
    steps: [{ id: 'review', title: 'Review', detail: 'Confirm the brief.', dependsOn: [] }],
  },
  palette: {
    title: 'Imperial palette',
    notes: 'Exact hex roles.',
    swatches: [
      { hex: '#080D0D', name: 'Obsidian', role: 'background' },
      { hex: '#C4912F', name: 'Reserve Gold', role: 'accent' },
    ],
    contrast: [
      { foreground: '#C4912F', background: '#080D0D', ratio: 7, pair: 'Gold on obsidian', passesAa: true },
    ],
  },
  selections: [
    {
      kind: 'brief',
      lineageId: briefId,
      versionId: briefId,
      version: 1,
      title: 'Reserve site',
      content: {
        title: 'Reserve site',
        purpose: 'A premium brand and website.',
        audience: 'Founders',
        visualDirection: 'Obsidian and gold',
        requirements: ['Phone first'],
        unresolved: ['Typeface'],
      },
    },
    {
      kind: 'plan',
      lineageId: planId,
      versionId: planId,
      version: 1,
      title: 'Launch plan',
      content: {
        title: 'Launch plan',
        summary: 'Ship the reserve site.',
        steps: [{ id: 'review', title: 'Review', detail: 'Confirm the brief.', dependsOn: [] }],
      },
    },
    {
      kind: 'palette',
      lineageId: paletteId,
      versionId: paletteId,
      version: 1,
      title: 'Imperial palette',
      content: {
        title: 'Imperial palette',
        notes: 'Exact hex roles.',
        swatches: [
          { hex: '#080D0D', name: 'Obsidian', role: 'background' },
          { hex: '#C4912F', name: 'Reserve Gold', role: 'accent' },
        ],
        contrast: [
          { foreground: '#C4912F', background: '#080D0D', ratio: 7, pair: 'Gold on obsidian', passesAa: true },
        ],
      },
    },
  ],
  images: [
    { artifactId: imageId, versionId: imageVersion, projectId: studioProject, prompt: 'Crest on obsidian' },
  ],
});

describe('Talk Origin handoff transfer', () => {
  it('copies bounded text and palette hex, and only references selected images', () => {
    const packageForImport = resolved();
    const transfer = describeHandoffTransfer(packageForImport);
    const project = projectFromResolvedHandoff(packageForImport);
    expect(project.name).toBe('Reserve site');
    expect(project.blueprint.deliverables).toContain('#080D0D');
    expect(project.blueprint.deliverables).toContain('#C4912F');
    expect(project.blueprint.deliverables).not.toMatch(/background|accent|contrast/i);
    expect(project.blueprint.state).toMatch(/Copied into this Origin project as text only/);
    expect(project.blueprint.state).toMatch(/Referenced and retained in Talk only/);
    expect(project.blueprint.state).toContain(imageId);
    expect(project.blueprint.state).toContain(imageVersion);
    expect(project.sources).toEqual([]);
    expect(project.documents).toEqual([]);
    expect(
      JSON.stringify({ ...project, blueprint: { ...project.blueprint, state: '' } }),
    ).not.toContain(imageId);
    expect(transfer.mappingVersion).toBe('talk-origin-import/v1');
    expect(transfer.imagesCopied).toBe(false);
    expect(transfer.paletteRolesCopied).toBe(false);
    expect(transfer.contrastCopied).toBe(false);
    expect(transfer.referenced.some((item) => item.kind === 'image' && item.artifactId === imageId)).toBe(
      true,
    );
    expect(transfer.referenced.some((item) => item.kind === 'brief' && item.versionId === briefId)).toBe(
      true,
    );
  });

  it('truncates by UTF-16 units without splitting surrogate pairs', () => {
    const diamond = '💎';
    const combining = 'e\u0301';
    expect(utf16Length(diamond)).toBe(2);
    expect(utf16Length(combining)).toBe(2);
    expect(boundText('A'.repeat(100), 100)).toBe('A'.repeat(100));
    expect(boundText('A'.repeat(101), 100)).toBe('A'.repeat(100));
    expect(boundText(diamond.repeat(50), 100)).toBe(diamond.repeat(50));
    expect(boundText(diamond.repeat(51), 100)).toBe(diamond.repeat(50));
    expect(boundText(diamond.repeat(50) + 'X', 101)).toBe(diamond.repeat(50) + 'X');
    expect(boundText(`${diamond.repeat(50)}${diamond}`, 101)).toBe(diamond.repeat(50));
    expect(boundText(combining.repeat(50), 100)).toBe(combining.repeat(50));
    expect(boundText(combining.repeat(51), 100)).toBe(combining.repeat(50));
    expect(boundText(`${'x'.repeat(99)}\ny`, 100)).toBe(`${'x'.repeat(99)}\n`);
    expect(boundText(`${'x'.repeat(1999)}\ny`, 2000)).toBe(`${'x'.repeat(1999)}\n`);
    expect(boundText(`${'x'.repeat(2999)}\ny`, 3000)).toBe(`${'x'.repeat(2999)}\n`);
    expect(exceedsBound(diamond.repeat(51), 100)).toBe(true);
    expect(exceedsBound(diamond.repeat(50), 100)).toBe(false);
  });

  it('derives truncation flags from the bound decision and rejects two of one kind', () => {
    const longTitle = `${'💎'.repeat(51)} Reserve`;
    const packageForImport = resolved();
    packageForImport.brief = { ...packageForImport.brief!, title: longTitle };
    const transfer = describeHandoffTransfer(packageForImport);
    expect(transfer.copied.find((field) => field.into === 'name')).toEqual({
      into: 'name',
      from: 'brief.title',
      truncated: true,
    });
    expect(transfer.copied.every((field) => typeof field.truncated === 'boolean')).toBe(true);
    expect(transfer.copied.find((field) => field.into === 'description')?.truncated).toBe(false);
    expect(projectFromResolvedHandoff(packageForImport).name).toBe(boundText(longTitle, 100));
    const missingOptional = resolved();
    missingOptional.plan = undefined;
    missingOptional.palette = undefined;
    missingOptional.handoff = {
      ...missingOptional.handoff,
      selections: [missingOptional.handoff.selections[0]!],
      images: [],
    };
    missingOptional.selections = [missingOptional.selections[0]!];
    missingOptional.images = [];
    const briefOnly = describeHandoffTransfer(missingOptional);
    expect(briefOnly.copied.some((field) => field.into === 'blueprint.solution')).toBe(false);
    expect(briefOnly.copied.some((field) => field.into === 'blueprint.deliverables')).toBe(false);
    expect(briefOnly.referenced.some((item) => item.kind === 'image')).toBe(false);
    expect(briefOnly.imagesCopied).toBe(false);
    expect(() =>
      assertOneSelectionPerKind([
        { kind: 'brief' },
        { kind: 'brief' },
        { kind: 'plan' },
      ]),
    ).toThrow(uniqueKindSelectionMessage);
    expect(() =>
      projectFromResolvedHandoff({
        ...packageForImport,
        selections: [
          packageForImport.selections[0]!,
          { ...packageForImport.selections[0]!, versionId: paletteId, title: 'Other brief' },
        ],
      }),
    ).toThrow(uniqueKindSelectionMessage);
  });

  it('derives one project and one save identity from the owner and package', () => {
    const person = '00000000-0000-4000-8000-000000000001';
    const handoff = '70000000-0000-4000-8000-000000000011';
    expect(originProjectIdentity(person, handoff)).not.toBe(originSaveIdentity(person, handoff));
    expect(originProjectIdentity(person, handoff)).toBe(originProjectIdentity(person, handoff));
    expect(originProjectIdentity(person, '70000000-0000-4000-8000-000000000099')).not.toBe(
      originProjectIdentity(person, handoff),
    );
  });
});
