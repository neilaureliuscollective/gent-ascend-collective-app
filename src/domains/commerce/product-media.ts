import type { Product } from './shopify';
import type { ProductStory } from './product-story';
import { shopifyMediaUrl } from './product-story';

export type ProductFilm = {
  url: string;
  poster?: string;
  transcript: string;
  captions: NonNullable<ProductStory['videoCaptions']>;
};
/** Only explicitly approved Shopify-hosted media. No external embeds or inferred claims. */
export function approvedProductMedia(product: Product | undefined, story: ProductStory | null) {
  if (!story?.mediaApproved) return { model: undefined, film: undefined };
  const media = product?.media?.nodes ?? [];
  const model = media
    .filter((item) => item.mediaContentType === 'MODEL_3D')
    .flatMap((item) => item.sources ?? [])
    .find(
      (source) =>
        source.format.toLowerCase() === 'glb' &&
        source.filesize > 0 &&
        source.filesize <= 10000000 &&
        shopifyMediaUrl(source.url),
    )?.url;
  let film: ProductFilm | undefined;
  if (story.videoTranscript && story.videoCaptions) {
    for (const item of media.filter((item) => item.mediaContentType === 'VIDEO')) {
      const source = (item.videoSources ?? [])
        .filter(
          (source) =>
            source.mimeType === 'video/mp4' &&
            source.format.toLowerCase() === 'mp4' &&
            source.height > 0 &&
            source.height <= 1080 &&
            source.width > 0 &&
            source.width <= 1920 &&
            shopifyMediaUrl(source.url),
        )
        .sort((a, b) => a.height - b.height)[0];
      if (!source) continue;
      film = {
        url: source.url,
        transcript: story.videoTranscript,
        captions: story.videoCaptions,
        poster:
          item.previewImage && shopifyMediaUrl(item.previewImage.url)
            ? item.previewImage.url
            : undefined,
      };
      break;
    }
  }
  return { model, film };
}
