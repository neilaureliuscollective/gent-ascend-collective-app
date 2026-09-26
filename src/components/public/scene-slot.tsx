import { MediaScene, type SceneMedia } from './media-scene';
export function SceneSlot({
  media,
  children,
  className = '',
}: {
  media?: SceneMedia;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`editorial-media-slot ${className}`}>
      {media ? <MediaScene media={media} /> : children}
    </div>
  );
}
