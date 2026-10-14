export type AssetBytes = {
  id: string;
  kind: 'version' | 'reference';
  bytes: Uint8Array;
  mediaType: 'image/png' | 'image/jpeg' | 'image/webp';
  widthPx?: number;
  heightPx?: number;
};
