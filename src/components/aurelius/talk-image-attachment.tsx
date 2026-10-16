'use client';
import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  imageRequest,
  uploadTalkImage,
  validateTalkImage,
  type TalkAttachment,
  type UploadTicket,
} from './talk-image-upload';
import './talk-image-attachment.css';
export function TalkImageAttachment({
  value,
  disabled,
  onChange,
  onRemove,
  onBusyChange,
}: {
  value: TalkAttachment | null;
  disabled: boolean;
  onChange: (value: TalkAttachment | null) => void;
  onRemove: () => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const generation = useRef(0);
  const [file, setFile] = useState<File | null>(null);
  const upload = useRef<{ ticket?: UploadTicket }>({});
  const previewUrl = useRef<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [studio, setStudio] = useState<string | null>(null);
  useEffect(
    () => () => {
      generation.current++;
      if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
      onBusyChange(false);
    },
    [onBusyChange],
  );
  async function run(next: File, fresh: boolean) {
    const token = ++generation.current;
    setError('');
    setStudio(null);
    if (fresh) {
      try {
        validateTalkImage(next);
      } catch (cause) {
        setError((cause as Error).message);
        setProgress('');
        onBusyChange(false);
        if (!value) {
          setFile(null);
          upload.current = {};
          if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
          previewUrl.current = null;
          setPreview(null);
        }
        return;
      }
      setFile(next);
      upload.current = {};
      onChange(null);
      if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
      previewUrl.current = URL.createObjectURL(next);
      setPreview(previewUrl.current);
    }
    onBusyChange(true);
    try {
      const saved = await uploadTalkImage(
        next,
        upload.current,
        () => token === generation.current,
        setProgress,
      );
      if (saved && token === generation.current)
        onChange({ ...saved, name: next.name, analysisPending: true });
    } catch (cause) {
      if (token === generation.current)
        setError((cause as Error).message || 'Image upload failed. Retry or choose another image.');
    } finally {
      if (token === generation.current) {
        setProgress('');
        onBusyChange(false);
      }
    }
  }
  async function handoff() {
    if (!value) return;
    const token = ++generation.current;
    setProgress('Selecting the original reference in Studio…');
    setError('');
    onBusyChange(true);
    try {
      const result = await imageRequest<{ href: string }>({
        action: 'studio',
        projectId: value.projectId,
        id: value.id,
      });
      if (token === generation.current) {
        setStudio(result.href);
        router.push(result.href);
      }
    } catch (cause) {
      if (token === generation.current) setError((cause as Error).message);
    } finally {
      if (token === generation.current) {
        setProgress('');
        onBusyChange(false);
      }
    }
  }
  return (
    <div
      className="talk-image-attachment"
      data-expanded={Boolean(preview || value || progress || error)}
    >
      <input
        ref={input}
        type="file"
        aria-label="Choose image for Talk"
        accept="image/png,image/jpeg,image/webp"
        hidden
        onChange={(event) => {
          const next = event.target.files?.[0];
          event.target.value = '';
          if (next) void run(next, true);
        }}
      />
      <div className="talk-image-actions">
        <button
          type="button"
          className="text-button"
          aria-label="Add image"
          title="PNG, JPEG or WebP up to 10 MiB; videos and general files unsupported"
          disabled={disabled}
          onClick={() => input.current?.click()}
        >
          Add image
        </button>
        {preview && !value && (
          <div className="talk-image-preview">
            <Image
              unoptimized
              width={32}
              height={32}
              src={preview}
              alt={`Image attachment: ${file?.name || 'selected image'}`}
            />
            <span title={file?.name}>{file?.name}</span>
          </div>
        )}
        {value && (
          <details className="talk-image-details">
            <summary
              aria-label={
                value.analysisPending === false
                  ? 'Image saved · details'
                  : 'Image attached · details'
              }
            >
              <span className="talk-image-preview">
                <Image
                  unoptimized
                  width={32}
                  height={32}
                  src={preview || `/api/studio/image?kind=reference&id=${value.id}`}
                  alt={`Image attachment: ${value.name}`}
                />
                <span title={value.name}>{value.name}</span>
              </span>
            </summary>
            <div className="talk-image-explanation">
              <p>
                {value.analysisPending === false
                  ? 'Saved for Studio; not attached to your next message.'
                  : 'Attached for analysis with your next text message.'}{' '}
                Inline Talk generation does not use this image or logo.
              </p>
              {value.analysisPending === false && (
                <button
                  type="button"
                  className="text-button"
                  disabled={disabled || Boolean(progress)}
                  onClick={() => onChange({ ...value, analysisPending: true })}
                >
                  Analyze with next message
                </button>
              )}
              {studio && (
                <Link href={studio} prefetch={false}>
                  Open selected Studio reference
                </Link>
              )}
              <p>
                Studio reference guidance may change generated pixels. Exact logo placement requires
                the original in the project brand kit and Finish. Design can place it as an image
                layer. Handoff starts no generation.
              </p>
              <small>
                PNG, JPEG or WebP · up to 10 MiB. Videos and general files are unsupported.
              </small>
            </div>
          </details>
        )}
        {(preview || value || progress) && (
          <button
            type="button"
            className="text-button"
            aria-label="Remove image"
            onClick={() => {
              generation.current++;
              onRemove();
            }}
          >
            Remove
          </button>
        )}
        {value && (
          <button
            type="button"
            className="text-button talk-image-studio"
            aria-label="Use in Studio"
            disabled={Boolean(progress) || disabled}
            onClick={() => void handoff()}
          >
            Use in Studio
          </button>
        )}
      </div>
      {progress && (
        <div className="talk-image-status" role="status">
          <progress aria-label="Image upload and verification" /> {progress}
        </div>
      )}
      {error && (
        <div className="talk-image-error" role="alert">
          <span>{error}</span>
          {!value && file && (
            <button
              type="button"
              className="text-button"
              disabled={Boolean(progress) || disabled}
              onClick={() => void run(file!, false)}
            >
              Retry image upload
            </button>
          )}
        </div>
      )}
    </div>
  );
}
