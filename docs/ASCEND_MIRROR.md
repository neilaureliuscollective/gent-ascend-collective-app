# Ascend Mirror — camera-first grooming capture

Founder-approved research/build, October 4, 2026 (America/Chicago).

## Finding and implementation

The live app served `Permissions-Policy: camera=()` even though GuidedScan already called getUserMedia. This blocked capture before any analysis provider mattered. Set camera=(self); leave microphone and geolocation denied. The allowance must apply to entry documents too: client navigation retains document policy. This does not grant camera permission. Only the member's explicit Start scan/Continue scan and camera retry actions start a camera stream. No audio is requested.

Replace the scan's large introductory hero and multi-step keep/continue flow with Ascend Mirror. One start action opens a full-screen camera. Capture front, left, right directly into one review; retakes preserve other views. Optional hair remains manual. Existing photos are a fallback. Distinguish denied permission, missing hardware and busy camera. Camera and worker stop on close, review, hidden document and unmount; late camera streams are discarded. Selected draft photos remain local until the explicit Send photos & assess action. Existing authenticated ownership, consent, quotas, private storage, analysis and deletion paths are preserved. No database migration or streaming provider.

Pinned MediaPipe Tasks Vision 1.0.1 FaceLandmarker runs in a classic web worker with CPU inference, one outstanding low-resolution frame at 4 Hz, and disposable ImageBitmaps. Two-face detection blocks auto-capture. Normalized face bounds, rough turn, frame illumination and consecutive steady positioning gate 1.4-second automatic capture. These are framing heuristics, not validated facial measurements, biometric identity, clinical findings, blur guarantees or skin scores. Optional auto-capture can be disabled; manual capture remains available on slow/unsupported devices and guidance errors. Mirror guidance is not proof that a provider will accept an image.

NPM code/WASM and the Google-hosted model are self-hosted under /mirror at build time. The versioned model SHA256 is 64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff; build fails if download/hash verification fails. Assets are generated, ignored in git, lazy-loaded only after camera activation, and reproducible through scripts/prepare-mirror.mjs. There are no runtime camera-frame requests to Google/CDNs. Model package license Apache-2.0. Development build requires network once to retrieve the pinned model; existing valid model is reused. Raw camera frames and positioning outputs are never saved or sent to the server.

## Evidence and remaining acceptance

Local production build and strict types pass. Nine targeted browser checks pass: manual capture/review/retake/recovery at 360/768/1440, permission denial, automatic steady advancement with a clearly labeled tracker fixture, a REAL self-hosted MediaPipe worker detecting an existing brand portrait, and camera header/hosted-harness checks on the production runtime, a native synthetic Chromium camera under that policy, and late-stream cleanup after closing during delayed permission. Screenshots inspected. The camera stream fixture is not physical hardware or a signed-in hosted analysis test.

During UTC midnight, inherited Performance SQL tests exposed their UTC-day/seeded-Chicago-day mismatch. Correct only that test fixture to derive the person's actual database calendar day; production progression rules stay unchanged. Local lint, strict types, production build, recorded migration ledger and all 326 unit/SQL tests pass. The full hosted CI and release receipt belong in the PR.

Physical Fold/iPhone camera permissions, left/right tuning across actual faces, PWA suspend/resume, sustained battery/latency, assistive technology, and a real hosted owner-approved image assessment remain unverified. Provider code already exists; this phase does not claim live-model success from configuration or simulated replies. Model initialization timeout falls back to manual capture.

## Research

Official docs checked October 4, 2026:
- https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia — HTTPS, user permission, exceptions, track cleanup.
- https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Permissions-Policy/camera — empty allowance blocks getUserMedia.
- https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker/web_js — VIDEO mode, local landmarks, synchronous inference belongs off the UI thread.
- Installed Next 16.3.5 next.config headers guide — matching header override semantics and Permissions-Policy.

Visual direction: live imagery is the working surface; obsidian/deep-green surroundings, fine gold alignment guide, true camera/status labels, reachable capture controls, and one clear consent review. No synthetic scan beam or simulated analysis progress.
