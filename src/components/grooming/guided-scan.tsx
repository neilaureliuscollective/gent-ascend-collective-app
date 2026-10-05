'use client';
import { useCallback, useEffect, useEffectEvent, useRef, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { ContextSheet } from '@/components/interaction/context-sheet';
import {
  cameraError,
  mirrorGuidance,
  type MirrorReading,
} from '@/domains/grooming/mirror-guidance';
const views = ['front', 'left', 'right', 'hair'] as const;
type View = (typeof views)[number];
const names = ['Face forward', 'Turn slightly left', 'Turn slightly right', 'Hair / scalp'];
export function GuidedScan() {
  const router = useRouter();
  const video = useRef<HTMLVideoElement>(null),
    stream = useRef<MediaStream | null>(null);
  const generation = useRef(0),
    urls = useRef<Partial<Record<View, string>>>({});
  const capturing = useRef(false);
  const [open, setOpen] = useState(false),
    [index, setIndex] = useState(0);
  const [photos, setPhotos] = useState<Partial<Record<View, File>>>({});
  const [previews, setPreviews] = useState<Partial<Record<View, string>>>({});
  const [review, setReview] = useState(false),
    [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false),
    [saved, setSaved] = useState(false);
  const [starting, setStarting] = useState(false),
    [live, setLive] = useState(false);
  const [automatic, setAutomatic] = useState(true),
    [tracking, setTracking] = useState(false);
  const [guidance, setGuidance] = useState('Eye level. Even light. No filters.');
  const [hold, setHold] = useState(0),
    [error, setError] = useState('');
  const view = views[index]!;
  const stop = useCallback(() => {
    generation.current++;
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    if (video.current) video.current.srcObject = null;
  }, []);
  const start = useCallback(async () => {
    stop();
    const request = generation.current;
    setStarting(true);
    setTracking(false);
    setHold(0);
    setError('');
    setLive(false);
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera unsupported');
      const next = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 1280 } },
        audio: false,
      });
      if (request !== generation.current) {
        next.getTracks().forEach((t) => t.stop());
        return;
      }
      stream.current = next;
      if (!video.current) {
        stop();
        return;
      }
      video.current.srcObject = next;
      await video.current.play();
      if (request === generation.current) setLive(true);
    } catch (caught) {
      if (request === generation.current) {
        stop();
        setError(cameraError(caught));
        setLive(false);
      }
    } finally {
      if (request === generation.current || !stream.current) setStarting(false);
    }
  }, [stop]);
  useEffect(() => {
    const timer = open && !review && !saved ? setTimeout(() => void start(), 0) : undefined;
    return () => {
      clearTimeout(timer);
      stop();
    };
  }, [open, review, saved, start, stop]);
  useEffect(() => {
    const previewUrls = urls.current;
    const pause = () => {
      if (document.hidden) {
        stop();
        setLive(false);
        setStarting(false);
      }
    };
    document.addEventListener('visibilitychange', pause);
    return () => {
      document.removeEventListener('visibilitychange', pause);
      stop();
      Object.values(previewUrls).forEach((url) => URL.revokeObjectURL(url));
    };
  }, [stop]);
  function close() {
    stop();
    setLive(false);
    setStarting(false);
    setOpen(false);
    if (saved) {
      Object.values(urls.current).forEach((url) => URL.revokeObjectURL(url));
      urls.current = {};
      setPhotos({});
      setPreviews({});
      setIndex(0);
      setReview(false);
      setSaved(false);
    }
  }
  async function prepare(file: File) {
    if (
      !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
      file.size < 100 ||
      file.size > 20000000
    )
      throw new Error('Choose a JPEG, PNG or WebP image.');
    const url = URL.createObjectURL(file);
    try {
      const image = new window.Image();
      image.src = url;
      await image.decode();
      const scale = Math.min(1, 1440 / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Photo preparation unavailable.');
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.76));
      if (!blob || blob.size > 950000)
        throw new Error('This photo is too large. Try a tighter crop.');
      return new File([blob], `${view}.jpg`, { type: 'image/jpeg' });
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  async function accept(file: File, capturedView: View, request: number) {
    const prepared = await prepare(file);
    if (request !== generation.current) return;
    if (urls.current[capturedView]) URL.revokeObjectURL(urls.current[capturedView]!);
    urls.current[capturedView] = URL.createObjectURL(prepared);
    setPreviews({ ...urls.current });
    setPhotos((p) => ({ ...p, [capturedView]: prepared }));
    setHold(0);
    const missing = views.slice(0, 3).findIndex((v) => v !== capturedView && !photos[v]);
    if (missing >= 0 && capturedView !== 'hair') setIndex(missing);
    else {
      stop();
      setLive(false);
      setReview(true);
    }
  }
  async function select(file: File) {
    if (capturing.current) return;
    capturing.current = true;
    setBusy(true);
    setError('');
    const request = generation.current;
    try {
      await accept(file, view, request);
    } catch (caught) {
      if (request === generation.current)
        setError(caught instanceof Error ? caught.message : 'Try another photo.');
    } finally {
      capturing.current = false;
      setBusy(false);
    }
  }
  async function capture() {
    const el = video.current;
    if (!el?.videoWidth || capturing.current || photos[view]) return;
    capturing.current = true;
    setBusy(true);
    setError('');
    const request = generation.current;
    try {
      const canvas = document.createElement('canvas');
      const scale = Math.min(1, 960 / Math.max(el.videoWidth, el.videoHeight));
      canvas.width = Math.round(el.videoWidth * scale);
      canvas.height = Math.round(el.videoHeight * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Capture unavailable.');
      ctx.drawImage(el, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.79));
      if (!blob) throw new Error('Capture failed. Try again.');
      await accept(new File([blob], `${view}.jpg`, { type: 'image/jpeg' }), view, request);
    } catch (caught) {
      if (request === generation.current)
        setError(caught instanceof Error ? caught.message : 'Try again.');
    } finally {
      capturing.current = false;
      setBusy(false);
    }
  }
  const autoCapture = useEffectEvent(() => {
    if (!busy) void capture();
  });
  useEffect(() => {
    if (!live || !open || review || view === 'hair') return;
    let ended = false,
      pending = false,
      ready = false,
      stableSince = 0;
    let previous: MirrorReading | null = null;
    const worker = new Worker('/mirror/capture-worker.js');
    const fallback = () => {
      if (ended) return;
      ready = false;
      setTracking(false);
      setHold(0);
      setGuidance('Guidance unavailable. Position yourself and capture manually.');
      worker.terminate();
    };
    const timeout = setTimeout(fallback, 20000);
    worker.onerror = fallback;
    worker.onmessage = ({ data }) => {
      if (ended) return;
      if (data.type === 'loading') {
        setTracking(false);
        setHold(0);
        setGuidance('Preparing on-device guidance…');
        return;
      }
      if (data.type === 'ready') {
        clearTimeout(timeout);
        ready = true;
        setTracking(true);
        return;
      }
      if (data.type === 'unavailable') {
        clearTimeout(timeout);
        fallback();
        return;
      }
      if (data.type !== 'result') return;
      pending = false;
      const reading = data as MirrorReading;
      const instruction = mirrorGuidance(reading, view);
      setGuidance(instruction.text);
      const steady =
        previous?.outline.length === 4 &&
        reading.outline.length === 4 &&
        reading.outline.every(
          (p, i) =>
            Math.abs(p.x - previous!.outline[i]!.x) < 0.025 &&
            Math.abs(p.y - previous!.outline[i]!.y) < 0.025,
        ) &&
        Math.abs(reading.turn - previous.turn) < 0.035;
      const now = performance.now();
      if (instruction.ready && steady && automatic) {
        stableSince ||= now;
        setHold(Math.min(1, (now - stableSince) / 1400));
        if (now - stableSince >= 1400) {
          stableSince = 0;
          ready = false;
          autoCapture();
        }
      } else {
        stableSince = 0;
        setHold(0);
      }
      previous = reading;
    };
    worker.postMessage({ type: 'init' });
    const timer = setInterval(async () => {
      const el = video.current;
      if (!ready || pending || !el?.videoWidth || el.readyState < 2 || document.hidden) return;
      pending = true;
      try {
        const frame = await createImageBitmap(el, {
          resizeWidth: 320,
          resizeHeight: Math.round((320 * el.videoHeight) / el.videoWidth),
        });
        if (ended) {
          frame.close();
          return;
        }
        worker.postMessage({ type: 'frame', frame, time: performance.now() }, [frame]);
      } catch {
        pending = false;
        fallback();
      }
    }, 250);
    return () => {
      ended = true;
      clearTimeout(timeout);
      clearInterval(timer);
      worker.terminate();
    };
  }, [live, open, review, view, automatic]);
  function retake(i: number) {
    const v = views[i]!;
    if (urls.current[v]) URL.revokeObjectURL(urls.current[v]!);
    delete urls.current[v];
    setPreviews({ ...urls.current });
    setPhotos((p) => ({ ...p, [v]: undefined }));
    setIndex(i);
    setReview(false);
    setError('');
  }
  async function submit() {
    if (!photos.front || !photos.left || !photos.right || sending) return;
    stop();
    setLive(false);
    setSending(true);
    setError('');
    const form = new FormData();
    views.forEach((v) => {
      if (photos[v]) form.append(v, photos[v]!);
    });
    form.set('consent', 'yes');
    try {
      const response = await fetch('/api/grooming/scan', {
        method: 'POST',
        body: form,
        signal: AbortSignal.timeout(130000),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Assessment unavailable.');
      setSaved(true);
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error && caught.name !== 'TimeoutError'
          ? caught.message
          : 'Assessment could not be confirmed. Check your history before trying again.',
      );
    } finally {
      setSending(false);
    }
  }
  const completed = views.slice(0, 3).filter((v) => photos[v]).length;
  return (
    <>
      <div className="mirror-entry">
        <span className="eyebrow">GENT ASCEND / PRIVATE CAMERA</span>
        <h1>
          Ascend <em>Mirror.</em>
        </h1>
        <p>
          Face forward. Turn left. Turn right.
          <br />A clear look at your next move.
        </p>
        <button className="button" onClick={() => setOpen(true)}>
          {completed ? 'Continue scan' : 'Start scan'}
        </button>
        <small>Your camera stays on this device. You choose what to send.</small>
      </div>
      <ContextSheet
        open={open}
        title={saved ? 'Assessment saved' : review ? 'Review your scan' : 'Ascend Mirror'}
        fullScreen
        busy={sending}
        onClose={close}
      >
        {saved ? (
          <div className="mirror-review">
            <p role="status">Your assessment is saved in your private history.</p>
            <button
              className="button"
              onClick={() => {
                close();
                requestAnimationFrame(() => {
                  const heading = document.getElementById('scan-history-title');
                  heading?.scrollIntoView({ block: 'start' });
                  heading?.focus({ preventScroll: true });
                });
              }}
            >
              View assessment
            </button>
          </div>
        ) : review ? (
          <div className="mirror-review">
            <p className="eyebrow">
              {sending ? 'ANALYZING SELECTED PHOTOS' : 'YOUR VIEWS / YOUR APPROVAL'}
            </p>
            <h3>Ready for a closer look?</h3>
            <div className="mirror-thumbnails">
              {views.map((v, i) =>
                previews[v] ? (
                  <div key={v}>
                    <Image
                      src={previews[v]!}
                      alt={`${v} selected view`}
                      width={240}
                      height={320}
                      unoptimized
                    />
                    <button disabled={sending} onClick={() => retake(i)}>
                      Retake {v}
                    </button>
                  </div>
                ) : null,
              )}
            </div>
            {!photos.hair && (
              <button className="groom-text-action" disabled={sending} onClick={() => retake(3)}>
                Add optional hair view
              </button>
            )}
            <p>
              Send these photos and your saved hair, beard and skin direction to OpenAI for
              appearance guidance. Usable photos are saved privately and can be deleted with the
              scan.
            </p>
            <p className="groom-caption">Grooming observations, not a diagnosis or a skin score.</p>
            <button className="button" disabled={sending || busy} onClick={submit}>
              {sending ? 'Assessing your views…' : 'Send photos & assess'}
            </button>
          </div>
        ) : (
          <div className="mirror-capture">
            <div className="mirror-stage" data-live={live}>
              <video ref={video} autoPlay playsInline muted aria-label="Camera preview" />
              {!live && (
                <div className="mirror-offline">
                  <span className="mirror-aperture" aria-hidden="true" />
                  <p>{starting ? 'Opening your camera…' : 'Your mirror is ready.'}</p>
                </div>
              )}
              <div className="mirror-top">
                <span className="eyebrow">
                  {index < 3 ? `VIEW ${index + 1} OF 3` : 'OPTIONAL HAIR VIEW'}
                </span>
                <span>{live ? 'CAMERA ON' : 'CAMERA OFF'}</span>
              </div>
              <div
                className="mirror-guide"
                aria-hidden="true"
                data-ready={hold > 0}
                style={{ '--hold': `${hold * 100}%` } as React.CSSProperties}
              >
                <span />
              </div>
              <div className="mirror-instruction">
                <h3>{names[index]}</h3>
                <p role="status">
                  {busy
                    ? 'Capturing…'
                    : live
                      ? view === 'hair'
                        ? 'Frame your hair or scalp. Capture when ready.'
                        : guidance
                      : 'Allow camera access to begin.'}
                </p>
              </div>
            </div>
            <div className="mirror-controls">
              <div className="mirror-views" aria-label="Captured views">
                {views.slice(0, 3).map((v, i) => (
                  <button
                    key={v}
                    disabled={!photos[v] || busy}
                    onClick={() => retake(i)}
                    aria-label={`Retake ${v}`}
                    data-complete={!!photos[v]}
                  >
                    {previews[v] ? (
                      <Image src={previews[v]!} alt="" width={48} height={48} unoptimized />
                    ) : (
                      <span>{i + 1}</span>
                    )}
                    <small>{v}</small>
                  </button>
                ))}
              </div>
              <button
                className="button mirror-shutter"
                disabled={busy || starting}
                onClick={live ? capture : start}
              >
                {starting ? 'Opening camera…' : live ? 'Capture now' : 'Try camera again'}
              </button>
              {view !== 'hair' && (
                <label className="mirror-auto">
                  <input
                    type="checkbox"
                    checked={automatic}
                    onChange={(e) => setAutomatic(e.target.checked)}
                  />
                  Auto-capture when steady
                </label>
              )}
              <small className="mirror-local">
                {live
                  ? tracking && view !== 'hair'
                    ? 'Positioning guidance runs on your device.'
                    : 'Camera ready. Manual capture is available.'
                  : 'No photos are sent until you approve.'}
              </small>
              <label className="groom-upload">
                Use existing photo
                <input
                  type="file"
                  aria-label="Use existing photo"
                  accept="image/jpeg,image/png,image/webp"
                  disabled={busy}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void select(file);
                    e.target.value = '';
                  }}
                />
              </label>
              {index === 3 && (
                <button
                  className="groom-text-action"
                  disabled={busy}
                  onClick={() => {
                    stop();
                    setLive(false);
                    setReview(true);
                  }}
                >
                  Skip optional view
                </button>
              )}
            </div>
          </div>
        )}
        {error && (
          <p className="groom-capture-error" role="alert">
            {error}
          </p>
        )}
      </ContextSheet>
    </>
  );
}
