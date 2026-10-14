#!/usr/bin/env node
/**
 * Local/host Studio film worker. Not deployed with this assignment.
 * Requires FFmpeg 6.1+ with libx264 and aac, plus the same Supabase session
 * environment used by the Architect construct worker.
 *
 * STUDIO_RENDER_WORKER=true
 * STUDIO_FFMPEG_PATH=/usr/bin/ffmpeg (optional)
 * NEXT_PUBLIC_SUPABASE_URL
 * SUPABASE_SERVICE_ROLE_KEY
 */
console.error(
  'Studio render worker: hosted rendering is not activated in this assignment. Run the application locally so /api/studio/film/render can execute FFmpeg with the owner session. Do not mark jobs complete without a verified MP4.',
);
process.exit(0);
