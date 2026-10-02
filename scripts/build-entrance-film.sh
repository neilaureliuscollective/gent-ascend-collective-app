#!/usr/bin/env bash
# Usage: bash scripts/build-entrance-film.sh /path/to/1487.mp4 /path/to/1475.mp4
# Founder-provided Hydros and Vitalis source films. Originals remain unchanged.
set -euo pipefail
mkdir -p public/media/entrance
ffmpeg -hide_banner -loglevel error -i "$1" -i "$2" -filter_complex \
  '[0:v]trim=start=0:end=2.8,setpts=PTS-STARTPTS,scale=720:1280,fps=24,setsar=1,fade=t=out:st=2.5:d=0.3[a];[1:v]trim=start=0.3:end=3.5,setpts=PTS-STARTPTS,scale=720:1280,fps=24,setsar=1,fade=t=in:st=0:d=0.3,fade=t=out:st=2.9:d=0.3[b];[0:v]trim=start=11.5:end=14.3,setpts=PTS-STARTPTS,scale=720:1280,fps=24,setsar=1,fade=t=in:st=0:d=0.3,fade=t=out:st=2.5:d=0.3[c];[a][b][c]concat=n=3:v=1:a=0[v]' \
  -map '[v]' -an -c:v libx264 -preset slow -crf 25 -pix_fmt yuv420p -movflags +faststart \
  public/media/entrance/collective-journey-v1.mp4 -y
