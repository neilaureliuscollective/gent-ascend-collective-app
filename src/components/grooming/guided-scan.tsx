'use client';
import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { ContextSheet } from '@/components/interaction/context-sheet';
const views = ['front', 'left', 'right', 'hair'] as const;
const instructions = [
  'Face forward',
  'Turn slightly left',
  'Turn slightly right',
  'Hair / scalp · optional',
];
type View = (typeof views)[number];
export function GuidedScan() {
  const router = useRouter();
  const video = useRef<HTMLVideoElement>(null),
    stream = useRef<MediaStream | null>(null),
    generation = useRef(0),
    urls = useRef<Partial<Record<View, string>>>({});
  const [open, setOpen] = useState(false),
    [index, setIndex] = useState(0),
    [photos, setPhotos] = useState<Partial<Record<View, File>>>({}),
    [previews, setPreviews] = useState<Partial<Record<View, string>>>({}),
    [review, setReview] = useState(false),
    [busy, setBusy] = useState(false),
    [starting, setStarting] = useState(false),
    [live, setLive] = useState(false),
    [error, setError] = useState('');
  function stop() {
    generation.current++;
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    if (video.current) video.current.srcObject = null;
  }
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
  }, []);
  function close() {
    stop();
    setLive(false);
    setStarting(false);
    setOpen(false);
  }
  async function start() {
    stop();
    const request = generation.current;
    setStarting(true);
    setError('');
    try {
      const next = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 1280 } },
        audio: false,
      });
      if (request !== generation.current) {
        next.getTracks().forEach((t) => t.stop());
        return;
      }
      stream.current = next;
      if (video.current) {
        video.current.srcObject = next;
        await video.current.play();
      }
      if (request === generation.current) setLive(true);
    } catch {
      if (request === generation.current) {
        stop();
        setError('Camera unavailable. Choose a photo to continue.');
        setLive(false);
      }
    } finally {
      if (request === generation.current || !stream.current) setStarting(false);
    }
  }
  async function prepareImage(file: File) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size < 100)
      throw new Error('Choose a JPEG, PNG or WebP image.');
    if (file.size <= 950000) return file;
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1440 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d');
    if (!context) {
      bitmap.close();
      throw new Error('This photo could not be prepared on your device.');
    }
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.76),
    );
    if (!blob) throw new Error('This photo could not be prepared. Try another image.');
    if (blob.size > 1400000)
      throw new Error('That photo is still too large after preparation. Try a tighter crop.');
    return new File([blob], `${file.name.replace(/\.[^.]+$/, '') || 'grooming-view'}.jpg`, {
      type: 'image/jpeg',
    });
  }
  async function select(file: File, view: View) {
    setError('');
    setBusy(true);
    try {
      const prepared = await prepareImage(file);
      setPhotos((p) => ({ ...p, [view]: prepared }));
      if (urls.current[view]) URL.revokeObjectURL(urls.current[view]!);
      urls.current[view] = URL.createObjectURL(prepared);
      setPreviews({ ...urls.current });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Choose another photo.');
    } finally {
      setBusy(false);
    }
  }
  async function capture() {
    const el = video.current;
    if (!el?.videoWidth || busy) return;
    const view = views[index]!,
      request = generation.current;
    setBusy(true);
    try {
      const canvas = document.createElement('canvas'),
        scale = Math.min(1, 960 / Math.max(el.videoWidth, el.videoHeight));
      canvas.width = Math.round(el.videoWidth * scale);
      canvas.height = Math.round(el.videoHeight * scale);
      canvas.getContext('2d')?.drawImage(el, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/jpeg', 0.79),
      );
      if (request === generation.current) {
        if (blob) await select(new File([blob], `${view}.jpg`, { type: 'image/jpeg' }), view);
        else setError('Capture failed. Try again or choose a photo.');
      }
    } finally {
      setBusy(false);
    }
  }
  function next() {
    if (index < 2) setIndex(index + 1);
    else {
      stop();
      setLive(false);
      setReview(true);
    }
  }
  function retake(i: number) {
    setIndex(i);
    setReview(false);
    setError('');
  }
  async function submit() {
    if (!photos.front || !photos.left || !photos.right || busy) return;
    stop();
    setLive(false);
    setBusy(true);
    setError('');
    const form = new FormData();
    views.forEach((v) => {
      if (photos[v]) form.append(v, photos[v]!);
    });
    form.set('consent', 'yes');
    try {
      const response = await fetch('/api/grooming/scan', { method: 'POST', body: form });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Assessment unavailable.');
      router.push('/app/grooming/scan?result=saved#history');
      router.refresh();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Assessment unavailable. Your selected images are still here.',
      );
      setBusy(false);
    }
  }
  const view = views[index]!;
  return (
    <>
      <div className="groom-scan-launch">
        <div>
          <span className="eyebrow">ASCEND SCAN / GUIDED CAPTURE</span>
          <h3>Three views. One clean read.</h3>
          <p>Use the camera or existing photos. Large images are prepared automatically on your device before upload.</p>
        </div>
        <button className="button" onClick={() => setOpen(true)}>
          {Object.keys(photos).length ? 'Continue scan →' : 'Begin scan →'}
        </button>
      </div>
      <ContextSheet
        open={open}
        title={review ? 'Review your scan' : 'Ascend Scan'}
        fullScreen
        busy={busy}
        onClose={close}
      >
        {review ? (
          <div className="groom-scan-review">
            <p className="eyebrow">
              {busy ? 'Building your appearance assessment…' : 'Ready when you are'}
            </p>
            <h3>Keep these views?</h3>
            <div className="groom-scan-thumbnails">
              {views.map((v, i) =>
                previews[v] ? (
                  <div key={v}>
                    <Image
                      src={previews[v]!}
                      alt={`${v} selected view`}
                      width={240}
                      height={240}
                      unoptimized
                    />
                    <button disabled={busy} onClick={() => retake(i)}>
                      Adjust {v}
                    </button>
                  </div>
                ) : null,
              )}
            </div>
            {!photos.hair && (
              <button className="groom-text-action" disabled={busy} onClick={() => retake(3)}>
                Add optional hair view
              </button>
            )}
            <p>
              Continue to send these selected photos and your saved hair, beard and skin direction
              to OpenAI for a qualitative assessment. Usable scan photos are stored privately in
              Gent Ascend and can be deleted with the scan.
            </p>
            <p className="groom-caption">
              Appearance guidance, not a diagnosis. Lighting and angles affect observations.
            </p>
            <button className="button" disabled={busy} onClick={submit}>
              {busy ? 'Assessing selected views…' : 'Send photos & assess'}
            </button>
          </div>
        ) : (
          <div className="groom-immersive-capture">
            <div className="groom-capture-stage">
              <video ref={video} autoPlay playsInline muted aria-label="Camera preview" />
              {previews[view] && (
                <Image
                  src={previews[view]!}
                  alt={`${view} selected view`}
                  fill
                  unoptimized
                  sizes="100vw"
                />
              )}
              <div className="groom-capture-guide" aria-hidden="true" />
              <div className="groom-capture-prompt">
                <div className="groom-scan-progress" aria-hidden="true">
                  <i style={{ width: `${Math.min(100, ((index + 1) / 3) * 100)}%` }} />
                </div>
                <p className="eyebrow">{index < 3 ? `VIEW ${index + 1} / 3` : 'OPTIONAL VIEW'}</p>
                <h3>{instructions[index]}</h3>
                <p role="status">
                  {photos[view]
                    ? 'Captured · keep or replace'
                    : 'Eye level. Even light. No filters.'}
                </p>
              </div>
            </div>
            <div className="groom-capture-controls">
              {photos[view] ? (
                <>
                  <button className="button" disabled={busy} onClick={next}>
                    {index < 2 ? 'Keep & continue' : 'Review views'}
                  </button>
                  <button
                    className="groom-text-action"
                    disabled={busy}
                    onClick={() => {
                      setPreviews((p) => ({ ...p, [view]: undefined }));
                      setPhotos((p) => ({ ...p, [view]: undefined }));
                    }}
                  >
                    Replace this view
                  </button>
                </>
              ) : (
                <>
                  <button
                    className="button"
                    disabled={busy || starting}
                    onClick={live ? capture : start}
                  >
                    {starting ? 'Opening camera…' : live ? 'Capture view' : 'Enable camera'}
                  </button>
                  <label className="groom-upload">
                    Choose a photo
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      disabled={busy}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void select(file, view);
                        e.target.value = '';
                      }}
                    />
                  </label>
                </>
              )}
              {index > 0 && (
                <button
                  className="groom-text-action"
                  disabled={busy}
                  onClick={() => (index === 3 ? setReview(true) : setIndex(index - 1))}
                >
                  {index === 3 ? 'Skip optional view' : 'Previous view'}
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
