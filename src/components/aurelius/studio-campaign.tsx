'use client';
import { useEffect, useRef, useState } from 'react';
import type { BrandKit } from '@/domains/studio/brand';
import { campaignFrames, campaignCopy } from '@/domains/studio/campaign';
import { StudioStoryboard, type StudioScene } from './studio-storyboard';
import { downloadStudio } from './studio-download';
import type { MotionFormat } from './studio-motion-renderer';
type Version = { id: string; status: 'pending' | 'complete' | 'failed'; prompt: string };
export function StudioCampaign({
  projectId,
  title,
  scenes,
  versions,
  brand,
  disabled,
  onChanged,
  onCreateFrame,
  onFinishImage,
}: {
  projectId: string;
  title: string;
  scenes: StudioScene[];
  versions: Version[];
  brand: BrandKit;
  disabled: boolean;
  onChanged: () => Promise<void>;
  onCreateFrame: (scene: StudioScene) => void;
  onFinishImage: (id: string) => void;
}) {
  const frames = campaignFrames(scenes, versions);
  const complete = frames.length > 0 && frames.every((f) => f.ready);
  const [format, setFormat] = useState<MotionFormat>('portrait');
  const [seconds, setSeconds] = useState<2 | 4 | 6>(4);
  const [motion, setMotion] = useState(false);
  const [audio, setAudio] = useState<File | null>(null);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ blob: Blob; extension: string; url: string } | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const controller = useRef<AbortController | null>(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      controller.current?.abort();
    };
  }, []);
  useEffect(
    () => () => {
      if (result) URL.revokeObjectURL(result.url);
    },
    [result],
  );
  async function render() {
    if (!complete || !canvas.current || running || controller.current) return;
    const current = new AbortController();
    controller.current = current;
    setRunning(true);
    setProgress(0);
    setError('');
    setResult(null);
    try {
      const { renderMotionFilm } = await import('./studio-motion-renderer');
      const output = await renderMotionFilm({
        canvas: canvas.current,
        shots: frames.map((f) => ({
          assetVersionId: f.asset_version_id!,
          title: f.title,
          copy: f.message,
        })),
        brand,
        format,
        seconds,
        motion,
        audio,
        signal: current.signal,
        onProgress: (value) => {
          if (alive.current) setProgress(value);
        },
      });
      if (alive.current) setResult({ ...output, url: URL.createObjectURL(output.blob) });
    } catch (cause) {
      if (alive.current) setError((cause as Error).message);
    } finally {
      if (alive.current) setRunning(false);
      controller.current = null;
    }
  }
  return (
    <section className="studio-campaign" aria-label="Campaign production">
      <div className="studio-production-intro">
        <p className="eyebrow">THE CAMPAIGN ROOM</p>
        <h3>One direction. A complete story.</h3>
        <p>
          Write the beats, create or choose each image, finish your formats, then render a motion
          film. Every frame stays linked to this project.
        </p>
        <div className="studio-production-stats">
          <span>{frames.length} scenes</span>
          <span>{frames.filter((f) => f.ready).length} completed frames</span>
          <span>{frames.length * seconds} second film</span>
        </div>
      </div>
      <StudioStoryboard
        projectId={projectId}
        scenes={scenes}
        versions={versions}
        disabled={disabled || running}
        onChanged={onChanged}
        onCreateFrame={onCreateFrame}
        onFinishImage={onFinishImage}
      />
      <section className="studio-motion-room" aria-labelledby="studio-motion-title">
        <div>
          <p className="eyebrow">MOTION PILOT</p>
          <h3 id="studio-motion-title">Give the images movement.</h3>
          <p>
            This film uses your saved images, captions and optional soundtrack. It is not
            AI-generated footage. Rendering happens on this device; keep Studio visible.
          </p>
        </div>
        <div className="studio-motion-controls">
          <label>
            Film format
            <select
              value={format}
              disabled={running}
              onChange={(e) => {
                setFormat(e.target.value as MotionFormat);
                setResult(null);
              }}
            >
              <option value="portrait">Portrait · 720 × 1280</option>
              <option value="landscape">Landscape · 1280 × 720</option>
              <option value="square">Square · 720 × 720</option>
            </select>
          </label>
          <label>
            Seconds per scene
            <select
              value={seconds}
              disabled={running}
              onChange={(e) => {
                setSeconds(Number(e.target.value) as 2 | 4 | 6);
                setResult(null);
              }}
            >
              <option value="2">2 seconds</option>
              <option value="4">4 seconds</option>
              <option value="6">6 seconds</option>
            </select>
          </label>
          <label className="studio-motion-toggle">
            <input
              type="checkbox"
              checked={motion}
              disabled={running}
              onChange={(e) => {
                setMotion(e.target.checked);
                setResult(null);
              }}
            />
            Gentle camera movement
          </label>
          <label>
            Optional soundtrack
            <input
              type="file"
              accept="audio/*"
              aria-label="Optional soundtrack"
              disabled={running}
              onChange={(e) => {
                setAudio(e.target.files?.[0] ?? null);
                setResult(null);
              }}
            />
            <small>Your own file · up to 5 MB / one minute</small>
          </label>
        </div>
        {error && (
          <p role="alert" className="studio-error">
            {error}
          </p>
        )}
        {!complete && (
          <p className="studio-notice">
            Attach a completed image to every scene before rendering. Unfinished scenes are never
            silently skipped.
          </p>
        )}
        <div className="studio-finish-actions">
          <button
            className="button"
            type="button"
            disabled={!complete || disabled || running}
            onClick={() => void render()}
          >
            {running ? 'Rendering film…' : 'Render motion film'}
          </button>
          {running && (
            <button type="button" onClick={() => controller.current?.abort()}>
              Cancel rendering
            </button>
          )}
          <button
            type="button"
            disabled={!scenes.length || running}
            onClick={() =>
              downloadStudio(
                new Blob([campaignCopy(title, scenes)], { type: 'text/markdown' }),
                'campaign-brief.md',
              )
            }
          >
            Export campaign brief ↗
          </button>
        </div>
        {running && (
          <div className="studio-render-status" role="status">
            <progress value={progress} max={1} />
            <span>{Math.round(progress * 100)}% rendered</span>
          </div>
        )}
        <canvas
          ref={canvas}
          className={running ? 'studio-motion-canvas' : 'studio-motion-canvas is-idle'}
          role="img"
          aria-label="Motion film rendering preview"
        />
        {result && (
          <div className="studio-film-result">
            <video
              controls
              playsInline
              preload="metadata"
              src={result.url}
              aria-label="Completed campaign motion film"
            />
            <button
              type="button"
              onClick={() => downloadStudio(result.blob, `campaign-film.${result.extension}`)}
            >
              Download film ↗
            </button>
            <small>
              Film output is local until you download it. Re-rendering uses your current settings.
            </small>
          </div>
        )}
      </section>
    </section>
  );
}
