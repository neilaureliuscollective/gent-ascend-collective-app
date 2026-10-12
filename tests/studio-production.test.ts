import { describe, it, expect, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { brandKitSchema, defaultBrandKit, readBrandKit } from '../src/domains/studio/brand';
import { imageDirection, projectInput, projectBrief } from '../src/domains/studio/service';
import {
  campaignFrames,
  campaignCopy,
  chooseVideoMime,
  motionFrame,
} from '../src/domains/studio/campaign';
import { exportZip } from '../src/domains/studio/export';
import { readLayoutRecipe } from '../src/domains/studio/recipe';
const id = '10000000-0000-4000-8000-000000000001';
describe('Studio production contracts', () => {
  it('validates brand colors, original logo identity and prompt boundaries without arbitrary style or URLs', () => {
    expect(readBrandKit(undefined)).toEqual(defaultBrandKit);
    expect(() =>
      brandKitSchema.parse({ ...defaultBrandKit, accent: 'url(https://evil.test)' }),
    ).toThrow();
    expect(() =>
      brandKitSchema.parse({ ...defaultBrandKit, logoReferenceId: 'https://evil.test' }),
    ).toThrow();
    expect(() => brandKitSchema.parse({ ...defaultBrandKit, typography: 'remote-font' })).toThrow();
    const brief = projectBrief.parse({
      purpose: 'Launch',
      audience: 'Customers',
      direction: 'Quiet',
      palette: 'Gold',
      avoid: 'Fake claims',
      brand: { ...defaultBrandKit, name: 'Example', voice: 'Clear' },
    });
    const prompt = imageDirection('A product portrait', brief);
    expect(prompt).toContain('Brand: Example');
    expect(prompt).toContain('Brand voice: Clear');
    expect(prompt).toContain('do not add unrequested text or logos');
    expect(projectInput.parse({ title: 'Launch', brief }).brief).toEqual(brief);
  });
  it('retains every campaign beat and does not silently skip unfinished or foreign frames', () => {
    const scenes = [
      {
        id: 's',
        position: 2,
        title: 'Closing',
        message: 'Visit us',
        visual_direction: 'Original',
        motion_note: 'Hold',
        channel: 'social',
        asset_version_id: id,
      },
      {
        id: 'a',
        position: 1,
        title: 'Opening',
        message: 'Hello',
        visual_direction: 'Warm',
        motion_note: 'Still',
        channel: 'social',
        asset_version_id: 'foreign',
      },
    ];
    const frames = campaignFrames(scenes, [{ id, status: 'complete' }]);
    expect(frames.map((f) => f.id)).toEqual(['a', 's']);
    expect(frames.map((f) => f.ready)).toEqual([false, true]);
    expect(campaignCopy('Launch', scenes).indexOf('Opening')).toBeLessThan(
      campaignCopy('Launch', scenes).indexOf('Closing'),
    );
    expect(() =>
      campaignFrames(
        Array.from({ length: 9 }, () => scenes[0]!),
        [],
      ),
    ).toThrow();
  });
  it('bounds render timing and selects an actually supported MIME type', () => {
    expect(chooseVideoMime((m) => m === 'video/mp4')).toBe('video/mp4');
    expect(chooseVideoMime(() => false)).toBeNull();
    expect(motionFrame(3, 2, 2)).toMatchObject({ index: 1, progress: 0.5, complete: false });
    expect(motionFrame(4, 2, 2)).toMatchObject({ index: 1, complete: true });
    expect(() => motionFrame(0, 9, 2)).toThrow();
    expect(() => motionFrame(0, 1, 120)).toThrow();
  });
  it('restores only a validated layout whose original source belongs to the current project', () => {
    const recipe = {
      version: 1,
      sourceVersionId: id,
      brand: defaultBrandKit,
      layout: {
        format: 'portrait',
        treatment: 'editorial',
        brand: 'Example',
        headline: 'A standard',
        supporting: '',
        footer: '',
        focal_x: 50,
        focal_y: 50,
      },
    };
    expect(readLayoutRecipe(JSON.stringify(recipe), [id]).layout.headline).toBe('A standard');
    expect(() => readLayoutRecipe(JSON.stringify(recipe), [])).toThrow('original image');
    expect(() =>
      readLayoutRecipe(JSON.stringify({ ...recipe, layout: { ...recipe.layout, focal_x: 200 } }), [
        id,
      ]),
    ).toThrow();
  });
  it('rejects unsafe archive names and excessive file counts before export', () => {
    const encoded = new TextEncoder().encode('Reviewed copy');
    expect(() => exportZip([{ name: '../secret.json', bytes: encoded }])).toThrow();
    expect(() =>
      exportZip(Array.from({ length: 6 }, () => ({ name: 'copy.md', bytes: encoded }))),
    ).toThrow();
  });
});
