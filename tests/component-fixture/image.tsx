/* eslint-disable @next/next/no-img-element -- Native adapter is restricted to the Vite test fixture. */
import type { ImageProps } from 'next/image';
/** Native image adapter for the Vite-only fixture; real routes use next/image. */
export default function FixtureImage({ src, alt, width, height, className, style }: ImageProps) {
  const source = typeof src === 'string' ? src : 'default' in src ? src.default.src : src.src;
  return (
    <img src={source} alt={alt} width={width} height={height} className={className} style={style} />
  );
}
