# Studio Design PNG/PDF raster + Film H.264 worker.
# Long-running process. Do not deploy this image to a request-driven web runtime
# (Vercel) and expect polling to work. Not commissioned from this assignment.
FROM node:24-bookworm-slim
RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY src ./src
COPY scripts ./scripts
COPY public/fonts ./public/fonts
COPY src/assets/fonts ./src/assets/fonts
RUN node scripts/studio-render-bundle.mjs && npm prune --omit=dev
ENV STUDIO_FFMPEG_PATH=/usr/bin/ffmpeg
ENV STUDIO_RENDER_WORKER_MODE=supervised
ENV STUDIO_RENDER_HEALTH_PORT=8080
ENV STUDIO_RENDER_HEALTH_BIND=0.0.0.0
ENV STUDIO_RENDER_CONCURRENCY=1
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8080/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/studio-worker.mjs", "--supervised"]
