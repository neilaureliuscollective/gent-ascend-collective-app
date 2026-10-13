import { describe, expect, it } from 'vitest';
import {
  bindPreviewIdentity,
  decideConstructPreview,
  looksLikeHtml,
  rejectPreviewUrl,
} from '@/domains/architect-origin/preview-contract';
import {
  isolateStaticHtml,
  LABELLED_DEMONSTRATION_HTML,
  documentPreviewMode,
} from '@/domains/architect-origin/static-preview';
import { decideFromLibrary } from '@/components/architect-origin/construct-preview-adapter';

const identity = bindPreviewIdentity({
  projectId: '11111111-1111-4111-8111-111111111111',
  ownerId: '22222222-2222-4222-8222-222222222222',
  revision: 3,
  sourceHash: 'a'.repeat(64),
  resultHash: 'b'.repeat(64),
})!;

describe('preview contract', () => {
  it('binds revision identity and rejects incomplete hashes', () => {
    expect(identity.revision).toBe(3);
    expect(
      bindPreviewIdentity({
        projectId: identity.projectId,
        ownerId: identity.ownerId,
        revision: 1,
        sourceHash: 'not-a-hash',
      }),
    ).toBeNull();
  });

  it('rejects foreign or credentialed preview URLs', () => {
    expect(rejectPreviewUrl('https://evil.example/preview')).toMatch(/configured|trusted origin/);
    expect(rejectPreviewUrl('javascript:alert(1)')).toMatch(/scriptable/);
    expect(rejectPreviewUrl('https://user:pass@example.com')).toMatch(/credentials/);
    expect(rejectPreviewUrl('https://preview.example/app', ['https://preview.example'])).toBeNull();
  });

  it('does not accept another owner or project construct preview', () => {
    const foreign = decideConstructPreview({
      identity,
      preview: {
        path: 'index.html',
        body: '<html><body>Hi</body></html>',
        unavailable_reason: null,
      },
      ownerMatches: false,
      projectMatches: true,
    });
    expect(foreign.kind).toBe('unavailable');
    const otherProject = decideFromLibrary(
      {
        runs: [
          {
            person_id: identity.ownerId!,
            project_id: '33333333-3333-4333-8333-333333333333',
            project_revision: 3,
            result: {
              preview: {
                path: 'index.html',
                body: '<html><body>Foreign</body></html>',
                unavailable_reason: null,
              },
            },
          },
        ],
      },
      identity,
    );
    expect(otherProject.kind).toBe('unavailable');
  });

  it('keeps a labelled demonstration distinct from live artifacts', () => {
    expect(LABELLED_DEMONSTRATION_HTML).toMatch(/Labelled demonstration/);
    expect(looksLikeHtml(LABELLED_DEMONSTRATION_HTML)).toBe(true);
    expect(documentPreviewMode('# Heading')).toBe('markdown');
  });
});

describe('isolated static HTML', () => {
  it('strips scripts, handlers and javascript URLs', () => {
    const isolated = isolateStaticHtml(
      `<html><body><script>window.pwned=true</script><a href="javascript:alert(1)" onclick="alert(2)">Go</a><iframe src="https://evil"></iframe></body></html>`,
    );
    expect(isolated.srcDoc).not.toMatch(/<script/i);
    expect(isolated.srcDoc).not.toMatch(/javascript:/i);
    expect(isolated.srcDoc).not.toMatch(/onclick/i);
    expect(isolated.srcDoc).not.toMatch(/<iframe/i);
    expect(isolated.srcDoc).toMatch(/Content-Security-Policy/);
    expect(isolated.blocked).toEqual(
      expect.arrayContaining(['forbidden-tags', 'event-handlers', 'dangerous-urls']),
    );
  });
});
