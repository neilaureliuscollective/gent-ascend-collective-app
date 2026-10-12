import { describe, expect, it } from 'vitest';
import { approvedProductMedia } from '../src/domains/commerce/product-media';
import { readProductStory } from '../src/domains/commerce/product-story';
import { commerceFixture } from './component-fixture/commerce';
const approved = {
  version: 1,
  status: 'approved',
  mediaApproved: true,
  videoTranscript: 'Synthetic approved transcript, not merchandise.',
  videoCaptions: {
    url: 'https://cdn.shopify.com/fixture/captions.vtt',
    language: 'en',
    label: 'English',
  },
};
const product = {
  ...commerceFixture,
  media: {
    nodes: [
      {
        mediaContentType: 'VIDEO',
        videoSources: [
          {
            url: 'https://cdn.shopify.com/fixture/film.mp4',
            format: 'mp4',
            mimeType: 'video/mp4',
            height: 720,
            width: 1280,
          },
          {
            url: 'https://external.test/film.mp4',
            format: 'mp4',
            mimeType: 'video/mp4',
            height: 480,
            width: 640,
          },
        ],
      },
      {
        mediaContentType: 'MODEL_3D',
        sources: [
          { url: 'https://cdn.shopify.com/fixture/model.glb', format: 'glb', filesize: 1000 },
        ],
      },
    ],
  },
};
describe('approved product atelier media', () => {
  it('keeps videos and models closed without approval', () => {
    expect(approvedProductMedia(product, null)).toEqual({ model: undefined, film: undefined });
    expect(
      approvedProductMedia(
        product,
        readProductStory({ value: JSON.stringify({ ...approved, mediaApproved: false }) }),
      ).film,
    ).toBeUndefined();
  });
  it('selects Shopify media and requires accessible merchant-provided alternatives', () => {
    const media = approvedProductMedia(
      product,
      readProductStory({ value: JSON.stringify(approved) }),
    );
    expect(media.film?.url).toBe('https://cdn.shopify.com/fixture/film.mp4');
    expect(media.film?.captions.language).toBe('en');
    expect(media.model).toBe('https://cdn.shopify.com/fixture/model.glb');
    for (const field of ['videoTranscript', 'videoCaptions']) {
      const missing = { ...approved, [field]: undefined };
      expect(
        approvedProductMedia(product, readProductStory({ value: JSON.stringify(missing) })).film,
      ).toBeUndefined();
    }
  });
  it('rejects unsafe captions, oversized model assets and unsupported video sources', () => {
    expect(
      readProductStory({
        value: JSON.stringify({
          ...approved,
          videoCaptions: { ...approved.videoCaptions, url: 'javascript:alert(1)' },
        }),
      }),
    ).toBeNull();
    const unsafe = {
      ...product,
      media: {
        nodes: [
          {
            mediaContentType: 'MODEL_3D',
            sources: [
              {
                url: 'https://cdn.shopify.com/fixture/model.glb',
                format: 'glb',
                filesize: 10000001,
              },
            ],
          },
          {
            mediaContentType: 'VIDEO',
            videoSources: [
              {
                url: 'https://cdn.shopify.com/fixture/film.mp4',
                format: 'mp4',
                mimeType: 'video/mp4',
                height: 2160,
                width: 3840,
              },
            ],
          },
        ],
      },
    };
    expect(
      approvedProductMedia(unsafe, readProductStory({ value: JSON.stringify(approved) })),
    ).toEqual({ model: undefined, film: undefined });
  });
});
