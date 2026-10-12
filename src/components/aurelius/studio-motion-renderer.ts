'use client';
import { chooseVideoMime, motionFrame } from '@/domains/studio/campaign';
import type { BrandKit } from '@/domains/studio/brand';
export type MotionShot = { assetVersionId: string; title: string; copy: string };
export type MotionFormat = 'landscape' | 'portrait' | 'square';
function boundedWait<T>(job: Promise<T>, signal: AbortSignal, timeout = 15000): Promise<T> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error?: unknown, value?: T) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal.removeEventListener('abort', fail);
      if (error) reject(error);
      else resolve(value as T);
    };
    const fail = () => finish(new Error('Film rendering cancelled.'));
    const timer = setTimeout(
      () =>
        finish(
          new Error('A media operation timed out. Try another file or remove the soundtrack.'),
        ),
      timeout,
    );
    signal.addEventListener('abort', fail, { once: true });
    if (signal.aborted) fail();
    job.then(
      (value) => finish(undefined, value),
      (error) => finish(error),
    );
  });
}
export async function renderMotionFilm({
  canvas,
  shots,
  brand,
  format,
  seconds,
  motion,
  audio,
  signal,
  onProgress,
}: {
  canvas: HTMLCanvasElement;
  shots: MotionShot[];
  brand: BrandKit;
  format: MotionFormat;
  seconds: 2 | 4 | 6;
  motion: boolean;
  audio: File | null;
  signal: AbortSignal;
  onProgress: (value: number) => void;
}) {
  if (typeof MediaRecorder === 'undefined' || !canvas.captureStream)
    throw new Error(
      'Video export is unavailable in this browser. Your images and campaign copy remain exportable.',
    );
  const mime = chooseVideoMime((type) => MediaRecorder.isTypeSupported(type), Boolean(audio));
  if (!mime) throw new Error('No supported video format is available in this browser.');
  if (shots.length < 1 || shots.length > 8)
    throw new Error('Choose one to eight completed campaign frames.');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('The film canvas could not open.');
  canvas.width = format === 'landscape' ? 1280 : 720;
  canvas.height = format === 'portrait' ? 1280 : 720;
  const images: HTMLImageElement[] = [];
  let recorder: MediaRecorder | undefined;
  let stream: MediaStream | undefined;
  let context: AudioContext | undefined;
  let source: AudioBufferSourceNode | undefined;
  let frame = 0;
  let interrupted = false;
  let timelineComplete = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const abort = () => {
    if (recorder?.state === 'recording') recorder.stop();
  };
  const visibility = () => {
    if (document.hidden) {
      interrupted = true;
      abort();
    }
  };
  const check = () => {
    if (signal.aborted) throw new Error('Film rendering cancelled.');
    if (document.hidden)
      throw new Error('Keep Studio visible while rendering. Nothing has been published.');
  };
  try {
    check();
    await boundedWait(document.fonts.ready, signal);
    for (const shot of shots) {
      check();
      if (!/^[0-9a-f-]{36}$/i.test(shot.assetVersionId))
        throw new Error('Choose a saved campaign frame.');
      const response = await fetch(`/api/studio/image?id=${shot.assetVersionId}&kind=version`, {
        cache: 'no-store',
        signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]),
      });
      if (!response.ok)
        throw new Error('A campaign image could not be loaded. Refresh the project.');
      const blob = await response.blob();
      if (blob.size > 10_485_760) throw new Error('A campaign image exceeds the export limit.');
      const url = URL.createObjectURL(blob);
      const image = new Image();
      try {
        image.src = url;
        await boundedWait(image.decode(), signal);
        if (image.naturalWidth * image.naturalHeight > 16_000_000)
          throw new Error('A frame is too large to render safely.');
        images.push(image);
      } finally {
        URL.revokeObjectURL(url);
      }
    }
    stream = canvas.captureStream(24);
    if (audio) {
      if (audio.size > 5_242_880)
        throw new Error('Choose a soundtrack smaller than 5 MB and no longer than one minute.');
      const url = URL.createObjectURL(audio);
      const metadata = new Audio();
      try {
        await boundedWait(
          new Promise<void>((resolve, reject) => {
            metadata.preload = 'metadata';
            metadata.onloadedmetadata = () => resolve();
            metadata.onerror = () =>
              reject(new Error('This soundtrack format could not be opened.'));
            metadata.src = url;
          }),
          signal,
        );
        if (!Number.isFinite(metadata.duration) || metadata.duration > 60)
          throw new Error('The soundtrack must be no longer than one minute.');
      } finally {
        metadata.removeAttribute('src');
        metadata.load();
        URL.revokeObjectURL(url);
      }
      context = new AudioContext();
      await boundedWait(context.resume(), signal, 5000);
      const buffer = await boundedWait(context.decodeAudioData(await audio.arrayBuffer()), signal);
      if (buffer.numberOfChannels > 2 || buffer.sampleRate > 48000)
        throw new Error('Choose a mono or stereo soundtrack at 48 kHz or below.');
      source = context.createBufferSource();
      source.buffer = buffer;
      const destination = context.createMediaStreamDestination();
      source.connect(destination);
      const audioTrack = destination.stream.getAudioTracks()[0];
      if (!audioTrack) throw new Error('The soundtrack could not be prepared.');
      stream.addTrack(audioTrack);
    }
    const chunks: Blob[] = [];
    let bytes = 0;
    recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 3_000_000 });
    const completed = new Promise<Blob>((resolve, reject) => {
      recorder!.ondataavailable = (e) => {
        if (e.data.size) {
          chunks.push(e.data);
          bytes += e.data.size;
          if (bytes > 30_000_000) {
            reject(new Error('The film exceeds the export limit.'));
            abort();
          }
        }
      };
      recorder!.onerror = () => reject(new Error('This device could not finish the video export.'));
      recorder!.onstop = () => {
        try {
          check();
          if (interrupted || !timelineComplete)
            throw new Error('Rendering was interrupted. Keep Studio visible and render again.');
          if (!chunks.length) throw new Error('No video was recorded.');
          resolve(new Blob(chunks, { type: mime }));
        } catch (error) {
          reject(error);
        }
      };
      signal.addEventListener('abort', abort, { once: true });
      document.addEventListener('visibilitychange', visibility);
      const start = performance.now();
      let lastPaint = -100;
      const paint = () => {
        try {
          check();
          const now = performance.now();
          if (now - lastPaint < 1000 / 24) {
            frame = requestAnimationFrame(paint);
            return;
          }
          lastPaint = now;
          const value = motionFrame((performance.now() - start) / 1000, shots.length, seconds);
          const image = images[value.index],
            shot = shots[value.index];
          if (!image || !shot) throw new Error('A campaign frame became unavailable.');
          const { width, height } = canvas;
          ctx.fillStyle = brand.background;
          ctx.fillRect(0, 0, width, height);
          ctx.save();
          ctx.globalAlpha = value.fade;
          const scale =
            Math.max(width / image.naturalWidth, height / image.naturalHeight) *
            (motion ? 1 + 0.045 * value.progress : 1);
          const w = image.naturalWidth * scale,
            h = image.naturalHeight * scale;
          ctx.drawImage(image, (width - w) / 2, (height - h) / 2, w, h);
          const gradient = ctx.createLinearGradient(0, height * 0.4, 0, height);
          gradient.addColorStop(0, '#00000000');
          gradient.addColorStop(1, '#000000dc');
          ctx.fillStyle = gradient;
          ctx.fillRect(0, 0, width, height);
          const inset = width * 0.075;
          ctx.fillStyle = brand.accent;
          ctx.font = `600 ${Math.round(width * 0.025)}px Arial, sans-serif`;
          ctx.fillText(brand.name.toUpperCase(), inset, inset, width - inset * 2);
          ctx.fillStyle = brand.foreground;
          ctx.font = `${Math.round(width * 0.045)}px ${brand.typography === 'modern' ? 'Arial, sans-serif' : 'Georgia, serif'}`;
          ctx.fillText(shot.title, inset, height * 0.68, width - inset * 2);
          const words = shot.copy.split(/\s+/);
          const lines: string[] = [];
          let line = '';
          ctx.font = `${Math.round(width * 0.026)}px Arial, sans-serif`;
          for (const word of words) {
            const next = line ? `${line} ${word}` : word;
            if (ctx.measureText(next).width > width - inset * 2 && line) {
              lines.push(line);
              line = word;
            } else line = next;
          }
          if (line) lines.push(line);
          if (lines.length > 6)
            throw new Error(
              'A scene caption is too long for this film format. Shorten it before rendering.',
            );
          lines.forEach((text, index) =>
            ctx.fillText(text, inset, height * 0.75 + index * width * 0.035, width - inset * 2),
          );
          ctx.fillStyle = brand.accent;
          ctx.fillRect(inset, height - inset, width * 0.15, 2);
          ctx.restore();
          onProgress(Math.min(1, (performance.now() - start) / 1000 / (shots.length * seconds)));
          if (value.complete) {
            timelineComplete = true;
            if (recorder!.state === 'recording') recorder!.stop();
          } else frame = requestAnimationFrame(paint);
        } catch (error) {
          reject(error);
          abort();
        }
      };
      recorder!.start(250);
      source?.start();
      paint();
      timer = setTimeout(
        () => {
          reject(new Error('Rendering timed out. Keep Studio visible and try fewer scenes.'));
          abort();
        },
        shots.length * seconds * 1000 + 15000,
      );
    });
    const blob = await completed;
    check();
    return { blob, extension: mime.startsWith('video/mp4') ? 'mp4' : 'webm' };
  } catch (error) {
    if (signal.aborted) throw new Error('Film rendering cancelled.');
    throw error;
  } finally {
    cancelAnimationFrame(frame);
    if (timer) clearTimeout(timer);
    signal.removeEventListener('abort', abort);
    document.removeEventListener('visibilitychange', visibility);
    if (recorder?.state === 'recording') recorder.stop();
    stream?.getTracks().forEach((track) => track.stop());
    try {
      source?.stop();
    } catch {
      /* The source may not have started. */
    }
    if (context) await context.close();
  }
}
