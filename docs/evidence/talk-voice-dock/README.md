# Talk voice dock — mocked layout evidence (2026-10-16)

Chromium Playwright fixtures on the component server (`:3102`), fake `RTCPeerConnection` / `getUserMedia`. Not a physical Fold/phone, native IME, or paid OpenAI Live call.

| File                              | Viewport              | State                                                 |
| --------------------------------- | --------------------- | ----------------------------------------------------- |
| `phone-compact.png`               | 390×844               | Persistent dock above composer                        |
| `phone-expanded.png`              | 390×844               | Full-screen Live, Minimize labelled                   |
| `fold-compact.png`                | 884×690               | Horizontal dock, truncated attachment + selected work |
| `fold-expanded.png`               | 884×690               | Immersive call                                        |
| `desktop-compact.png`             | 1440×900              | Horizontal dock                                       |
| `desktop-expanded.png`            | 1440×900              | Immersive call                                        |
| `fold-details-approval.png`       | 884×690               | Details open, long approval job, solid material       |
| `fold-blocked-playback.png`       | 884×690               | Enable voice playback recovery                        |
| `fold-speaking.png`               | 884×690               | Speaking / Stop                                       |
| `fold-cleanup-retry.png`          | 884×690               | Retry end session                                     |
| `mocked-compact-expand-tour.webm` | 390 then Fold/desktop | Expand / Escape minimize, same session                |

Combined layout in the compact shots: selected-work chip, long attachment name, empty textarea, Mute / End / Expand fully in view. Stress shots are captured with Details, approvals, blocked playback, speaking and cleanup retry — not only idle listening.
