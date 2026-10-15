import { compositionFrame, type CompositionDocument } from './model';

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

function assTime(ms: number) {
  const clamped = Math.max(0, ms);
  const hours = Math.floor(clamped / 3_600_000);
  const minutes = Math.floor((clamped % 3_600_000) / 60_000);
  const seconds = Math.floor((clamped % 60_000) / 1000);
  const centis = Math.floor((clamped % 1000) / 10);
  const pad = (value: number, size = 2) => String(value).padStart(size, '0');
  return `${hours}:${pad(minutes)}:${pad(seconds)}.${pad(centis)}`;
}

function assText(text: string) {
  return text.replace(/\\/g, '\\\\').replace(/\{/g, '\\{').replace(/\}/g, '\\}').replace(/\n/g, '\\N');
}

/** Burn-in overlay matching preview: titles at the top, captions at the bottom. */
export function compositionAss(document: CompositionDocument) {
  const frame = compositionFrame(document.aspect);
  const titleSize = Math.round(frame.height * 0.06);
  const captionSize = Math.round(frame.height * 0.032);
  const titleMargin = Math.round(frame.height * 0.18);
  const captionMargin = Math.round(frame.height * 0.1);
  const events = [
    ...document.titles.map(
      (title) =>
        `Dialogue: 0,${assTime(title.startMs)},${assTime(title.endMs)},Title,,0,0,0,,${assText(title.text)}`,
    ),
    ...document.captions.map(
      (caption) =>
        `Dialogue: 0,${assTime(caption.startMs)},${assTime(caption.endMs)},Caption,,0,0,0,,${assText(caption.text)}`,
    ),
  ];
  return `[Script Info]
ScriptType: v4.00+
PlayResX: ${frame.width}
PlayResY: ${frame.height}
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Title,Inter,${titleSize},&H00E2E7E6,&H000000FF,&H00060705,&H80060705,0,0,0,0,100,100,0,0,1,2,1,8,80,80,${titleMargin},1
Style: Caption,Inter,${captionSize},&H00E2E7E6,&H000000FF,&H00060705,&H80060705,0,0,0,0,100,100,0,0,1,1,1,2,80,80,${captionMargin},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${events.join('\n')}
`;
}
