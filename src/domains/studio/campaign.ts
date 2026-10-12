export type CampaignScene = {
  id: string;
  position: number;
  title: string;
  message: string;
  visual_direction: string;
  motion_note: string;
  channel: string;
  asset_version_id: string | null;
};
export type CampaignVersion = { id: string; status: string };
export function campaignFrames(scenes: CampaignScene[], versions: CampaignVersion[]) {
  if (scenes.length > 8) throw new Error('A campaign supports at most eight scenes.');
  const ready = new Set(versions.filter((v) => v.status === 'complete').map((v) => v.id));
  return [...scenes]
    .sort((a, b) => a.position - b.position)
    .map((scene) => ({
      ...scene,
      ready: Boolean(scene.asset_version_id && ready.has(scene.asset_version_id)),
    }));
}
export function campaignCopy(title: string, scenes: CampaignScene[]) {
  return (
    `# ${title}\n\nCampaign draft — review facts, names and usage rights before sharing.\n\n` +
    [...scenes]
      .sort((a, b) => a.position - b.position)
      .map(
        (s, i) =>
          `## ${i + 1}. ${s.title}\n\nChannel: ${s.channel}\n\nCopy: ${s.message || 'Not written yet'}\n\nVisual: ${s.visual_direction || 'Not written yet'}\n\nMotion: ${s.motion_note || 'Not written yet'}\n`,
      )
      .join('\n')
  );
}
export function chooseVideoMime(supported: (mime: string) => boolean) {
  return (
    ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/mp4', 'video/webm'].find(supported) ??
    null
  );
}
export function motionFrame(elapsed: number, frames: number, seconds: number) {
  if (
    !Number.isFinite(elapsed) ||
    elapsed < 0 ||
    !Number.isInteger(frames) ||
    frames < 1 ||
    frames > 8 ||
    ![2, 4, 6].includes(seconds)
  )
    throw new Error('Invalid film timing.');
  const index = Math.min(frames - 1, Math.floor(elapsed / seconds));
  const progress = Math.min(1, Math.max(0, (elapsed - index * seconds) / seconds));
  const fade = Math.min(1, progress * 6, (1 - progress) * 6);
  return { index, progress, fade: Math.max(0, fade), complete: elapsed >= frames * seconds };
}
