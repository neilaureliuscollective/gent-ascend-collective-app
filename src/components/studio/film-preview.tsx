'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { compositionFrame, type CompositionDocument, type CompositionScene } from '@/domains/studio/composition/model';
import {
  activeScenesAt,
  compositionPlaybackMs,
} from '@/domains/studio/composition/timing';
import { elementVolume, trackGainAt } from '@/domains/studio/composition/audio';
import { cropPreviewStyle } from '@/domains/studio/composition/crop';

function mediaSrc(scene: CompositionScene) {
  if (scene.kind === 'image')
    return `/api/studio/image?id=${scene.assetId}&kind=${scene.assetKind === 'reference' ? 'reference' : 'version'}`;
  return `/api/studio/footage/video?id=${scene.assetId}`;
}

export function FilmPreview({
  document,
  selectedSceneId = null,
}: {
  document: CompositionDocument;
  selectedSceneId?: string | null;
}) {
  const frame = compositionFrame(document.aspect);
  const duration = compositionPlaybackMs(document);
  const [playing, setPlaying] = useState(false);
  const [timeMs, setTimeMs] = useState(0);
  const clock = useRef<number | null>(null);
  const started = useRef(0);
  const videos = useRef(new Map<string, HTMLVideoElement>());
  const narration = useRef<HTMLAudioElement | null>(null);
  const music = useRef<HTMLAudioElement | null>(null);
  const narrationGain = useRef<GainNode | null>(null);
  const musicGain = useRef<GainNode | null>(null);
  const audioCtx = useRef<AudioContext | null>(null);
  const audioSources = useRef(new WeakMap<HTMLAudioElement, MediaElementAudioSourceNode>());

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
    void audioCtx.current?.resume();
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
    const apply = (
      node: HTMLAudioElement | null,
      track: CompositionDocument['narration'],
      gainNode: { current: GainNode | null },
    ) => {
      if (!node || !track) return;
      const linear = trackGainAt(timeMs, duration, track);
      if (gainNode.current) gainNode.current.gain.value = linear;
      else node.volume = elementVolume(linear);
      if (Math.abs(node.currentTime * 1000 - timeMs) > 80) node.currentTime = Math.max(0, timeMs / 1000);
      if (playing && node.paused) void node.play().catch(() => undefined);
      if (!playing) node.pause();
    };
    apply(narration.current, document.narration, narrationGain);
    apply(music.current, document.music, musicGain);
  }, [document.music, document.narration, playing, timeMs, duration]);

  function attachGain(node: HTMLAudioElement | null, gainRef: { current: GainNode | null }) {
    if (typeof AudioContext === 'undefined') return;
    if (!node) {
      if (gainRef.current) {
        try {
          gainRef.current.disconnect();
        } catch {
          /* already gone */
        }
        gainRef.current = null;
      }
      return;
    }
    if (gainRef.current) return;
    try {
      if (!audioCtx.current) audioCtx.current = new AudioContext();
      const ctx = audioCtx.current;
      let source = audioSources.current.get(node);
      if (!source) {
        source = ctx.createMediaElementSource(node);
        audioSources.current.set(node, source);
      }
      const gain = ctx.createGain();
      source.connect(gain).connect(ctx.destination);
      gainRef.current = gain;
    } catch {
      gainRef.current = null;
    }
  }

  return (
    <div className="studio-film-preview" style={{ aspectRatio: `${frame.width} / ${frame.height}` }} data-aspect={document.aspect}>
      <div className="studio-film-stage" aria-label="Composed film preview">
        {active.map((item) => (
          <div
            key={item.scene.id}
            className="studio-film-layer"
            data-selected={item.scene.id === selectedSceneId ? 'true' : 'false'}
            style={{
              opacity: item.mix,
              overflow: 'hidden',
              left: `${item.scene.placement.x * 100}%`,
              top: `${item.scene.placement.y * 100}%`,
              width: `${item.scene.placement.width * 100}%`,
              height: `${item.scene.placement.height * 100}%`,
              outline: item.scene.id === selectedSceneId ? '2px solid #C4912F' : undefined,
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
                style={cropPreviewStyle(item.scene.crop)}
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={mediaSrc(item.scene)}
                alt=""
                style={{
                  ...cropPreviewStyle(item.scene.crop),
                  transform:
                    item.scene.stillMotion === 'slow-zoom'
                      ? `scale(${1 + (item.localMs / Math.max(1, item.scene.durationMs)) * 0.08})`
                      : undefined,
                  transformOrigin: 'center center',
                }}
              />
            )}
          </div>
        ))}
        {title && (
          <p className="studio-film-title" data-overlay="title">
            {title.text}
          </p>
        )}
        {caption && (
          <p className="studio-film-caption" data-overlay="caption">
            {caption.text}
          </p>
        )}
      </div>
      {document.narration && (
        <audio
          ref={(node) => {
            narration.current = node;
            attachGain(node, narrationGain);
          }}
          src={`/api/studio/narration/audio?id=${document.narration.assetId}`}
          preload="auto"
        />
      )}
      {document.music && (
        <audio
          ref={(node) => {
            music.current = node;
            attachGain(node, musicGain);
          }}
          src={`/api/studio/narration/audio?id=${document.music.assetId}`}
          preload="auto"
        />
      )}
      <div className="studio-film-transport">
        <button
          type="button"
          onClick={() => {
            void audioCtx.current?.resume();
            setPlaying((value) => !value);
          }}
          aria-pressed={playing}
        >
          {playing ? 'Pause preview' : 'Play composed preview'}
        </button>
        <input
          type="range"
          min={0}
          max={Math.max(1, duration)}
          value={timeMs}
          aria-label="Preview time"
          aria-valuetext={`${(timeMs / 1000).toFixed(1)} seconds`}
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

