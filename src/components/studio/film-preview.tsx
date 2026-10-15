'use client';
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import {
  compositionFrame,
  type CompositionDocument,
  type CompositionScene,
} from '@/domains/studio/composition/model';
import {
  activeScenesAt,
  compositionPlaybackMs,
} from '@/domains/studio/composition/timing';

function mediaSrc(scene: CompositionScene) {
  if (scene.kind === 'image')
    return `/api/studio/image?id=${scene.assetId}&kind=${scene.assetKind === 'reference' ? 'reference' : 'version'}`;
  return `/api/studio/footage/video?id=${scene.assetId}`;
}

export function FilmPreview({ document }: { document: CompositionDocument }) {
  const frame = compositionFrame(document.aspect);
  const duration = compositionPlaybackMs(document);
  const [playing, setPlaying] = useState(false);
  const [timeMs, setTimeMs] = useState(0);
  const clock = useRef<number | null>(null);
  const started = useRef(0);
  const videos = useRef(new Map<string, HTMLVideoElement>());
  const narration = useRef<HTMLAudioElement | null>(null);
  const music = useRef<HTMLAudioElement | null>(null);

  const active = useMemo(() => activeScenesAt(document, timeMs), [document, timeMs]);
  const title = document.titles.find((item) => timeMs >= item.startMs && timeMs <= item.endMs);
  const caption = document.captions.find((item) => timeMs >= item.startMs && timeMs <= item.endMs);

  useEffect(() => {
    if (!playing) {
      if (clock.current) cancelAnimationFrame(clock.current);
      narration.current?.pause();
      music.current?.pause();
      return;
    }
    started.current = performance.now() - timeMs;
    const tick = (now: number) => {
      const next = Math.min(duration, now - started.current);
      setTimeMs(next);
      if (next >= duration) {
        setPlaying(false);
        return;
      }
      clock.current = requestAnimationFrame(tick);
    };
    clock.current = requestAnimationFrame(tick);
    return () => {
      if (clock.current) cancelAnimationFrame(clock.current);
    };
    // timeMs is sampled only when playback starts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, duration]);

  useEffect(() => {
    for (const item of active) {
      if (item.scene.kind !== 'video') continue;
      const node = videos.current.get(item.scene.id);
      if (!node) continue;
      const local = item.scene.inMs + item.localMs;
      if (Math.abs(node.currentTime * 1000 - local) > 80) node.currentTime = local / 1000;
      if (playing && node.paused) void node.play().catch(() => undefined);
      if (!playing && !node.paused) node.pause();
    }
  }, [active, playing]);

  useEffect(() => {
    const apply = (node: HTMLAudioElement | null, track: CompositionDocument['narration']) => {
      if (!node || !track) return;
      node.volume = Math.min(1, Math.max(0, 10 ** (track.gainDb / 20)));
      if (playing && node.paused) void node.play().catch(() => undefined);
      if (!playing) node.pause();
    };
    apply(narration.current, document.narration);
    apply(music.current, document.music);
  }, [document.music, document.narration, playing]);

  return (
    <div className="studio-film-preview" style={{ aspectRatio: `${frame.width} / ${frame.height}` }} data-aspect={document.aspect}>
      <div className="studio-film-stage" aria-label="Composed film preview">
        {active.map((item) => (
          <div
            key={item.scene.id}
            className="studio-film-layer"
            style={{
              opacity: item.mix,
              overflow: 'hidden',
              left: `${item.scene.placement.x * 100}%`,
              top: `${item.scene.placement.y * 100}%`,
              width: `${item.scene.placement.width * 100}%`,
              height: `${item.scene.placement.height * 100}%`,
            }}
          >
            {item.scene.kind === 'video' ? (
              <video
                ref={(node) => {
                  if (node) videos.current.set(item.scene.id, node);
                  else videos.current.delete(item.scene.id);
                }}
                src={mediaSrc(item.scene)}
                playsInline
                muted
                style={cropStyle(item.scene)}
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={mediaSrc(item.scene)}
                alt=""
                style={{
                  ...cropStyle(item.scene),
                  transform: item.scene.stillMotion === 'slow-zoom' ? `scale(${1 + item.localMs / item.scene.durationMs * 0.08})` : undefined,
                  transformOrigin: 'center center',
                }}
              />
            )}
          </div>
        ))}
        {title && <p className="studio-film-title">{title.text}</p>}
        {caption && <p className="studio-film-caption">{caption.text}</p>}
      </div>
      {document.narration && (
        <audio ref={narration} src={`/api/studio/narration/audio?id=${document.narration.assetId}`} preload="auto" />
      )}
      {document.music && (
        <audio ref={music} src={`/api/studio/narration/audio?id=${document.music.assetId}`} preload="auto" />
      )}
      <div className="studio-film-transport">
        <button type="button" onClick={() => setPlaying((value) => !value)}>
          {playing ? 'Pause preview' : 'Play composed preview'}
        </button>
        <input
          type="range"
          min={0}
          max={Math.max(1, duration)}
          value={timeMs}
          aria-label="Preview time"
          onChange={(event) => {
            setPlaying(false);
            setTimeMs(Number(event.target.value));
          }}
        />
        <span>
          {(timeMs / 1000).toFixed(1)}s / {(duration / 1000).toFixed(1)}s
        </span>
      </div>
    </div>
  );
}

function cropStyle(scene: CompositionScene): CSSProperties {
  const width = 100 / scene.crop.width;
  const height = 100 / scene.crop.height;
  return {
    width: `${width}%`,
    height: `${height}%`,
    marginLeft: `${-scene.crop.x * width}%`,
    marginTop: `${-scene.crop.y * height}%`,
    objectFit: 'cover',
    maxWidth: 'none',
  };
}
