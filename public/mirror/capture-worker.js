/* global importScripts, Vision, OffscreenCanvas */
// Camera frames are processed transiently here; no network writes or storage.
let tracker, canvas;
self.onmessage = async ({ data }) => {
  if (data.type === 'init') {
    self.postMessage({ type: 'loading' });
    try {
      importScripts('/mirror/vision-1.0.1/vision_bundle.js');
      const files = await Vision.FilesetResolver.forVisionTasks('/mirror/vision-1.0.1/wasm');
      tracker = await Vision.FaceLandmarker.createFromOptions(files, {
        baseOptions: {
          modelAssetPath: '/mirror/vision-1.0.1/face_landmarker.task',
          delegate: 'CPU',
        },
        runningMode: 'VIDEO',
        numFaces: 2,
      });
      self.postMessage({ type: 'ready' });
    } catch {
      self.postMessage({ type: 'unavailable' });
    }
    return;
  }
  if (data.type === 'frame') {
    const frame = data.frame;
    try {
      canvas ??= new OffscreenCanvas(frame.width, frame.height);
      canvas.width = frame.width;
      canvas.height = frame.height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(frame, 0, 0);
      const faces = tracker.detectForVideo(canvas, data.time).faceLandmarks;
      const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let brightness = 0,
        count = 0;
      for (let i = 0; i < pixels.length; i += 64) {
        brightness += 0.2126 * pixels[i] + 0.7152 * pixels[i + 1] + 0.0722 * pixels[i + 2];
        count++;
      }
      const points = faces.length === 1 ? faces[0] : null;
      const outline = points
        ? [10, 152, 234, 454].map((i) => ({ x: points[i].x, y: points[i].y }))
        : [];
      const left = points?.[234],
        right = points?.[454],
        nose = points?.[1];
      self.postMessage({
        type: 'result',
        faces: faces.length,
        outline,
        brightness: brightness / count,
        turn: left && right && nose ? (nose.x - left.x) / (right.x - left.x) : 0.5,
      });
    } catch {
      self.postMessage({ type: 'unavailable' });
    } finally {
      frame.close();
    }
  }
};
