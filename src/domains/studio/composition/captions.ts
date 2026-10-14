import type { CompositionDocument } from './model';

function stamp(ms: number) {
  const clamped = Math.max(0, ms);
  const hours = Math.floor(clamped / 3_600_000);
  const minutes = Math.floor((clamped % 3_600_000) / 60_000);
  const seconds = Math.floor((clamped % 60_000) / 1000);
  const millis = clamped % 1000;
  const pad = (value: number, size = 2) => String(value).padStart(size, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}.${pad(millis, 3)}`;
}

export function compositionVtt(document: CompositionDocument) {
  const cues = [
    ...document.titles.map((title) => ({
      startMs: title.startMs,
      endMs: title.endMs,
      text: title.text,
    })),
    ...document.captions,
  ].sort((a, b) => a.startMs - b.startMs);
  return (
    'WEBVTT\n\n' +
    cues.map((cue, index) => `${index + 1}\n${stamp(cue.startMs)} --> ${stamp(cue.endMs)}\n${cue.text}\n`).join('\n')
  );
}

export function compositionSrt(document: CompositionDocument) {
  const cues = [...document.titles, ...document.captions].sort((a, b) => a.startMs - b.startMs);
  const srtStamp = (ms: number) => stamp(ms).replace('.', ',');
  return cues
    .map((cue, index) => `${index + 1}\n${srtStamp(cue.startMs)} --> ${srtStamp(cue.endMs)}\n${cue.text}\n`)
    .join('\n');
}
