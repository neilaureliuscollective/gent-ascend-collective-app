#!/usr/bin/env python3
"""Instantiate static Inter/Sora 400/600/700 TTF faces from the bundled OFL WOFF2 files.

Runtime measurement and export load the committed TTF files. Re-run this script only
when replacing the source variable fonts. Requires fonttools and brotli.
"""
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

ROOT = Path(__file__).resolve().parents[1] / "src" / "assets" / "fonts"
JOBS = [("inter.woff2", "inter", [400, 600, 700]), ("sora.woff2", "sora", [400, 600, 700])]

def main() -> None:
    for src_name, stem, weights in JOBS:
        src = ROOT / src_name
        for wght in weights:
            font = instantiateVariableFont(TTFont(str(src)), {"wght": wght}, inplace=False)
            for table in ("fvar", "avar", "gvar", "HVAR", "MVAR", "STAT", "cvar"):
                if table in font:
                    del font[table]
            dest = ROOT / f"{stem}-{wght}.ttf"
            font.save(str(dest))
            print(f"wrote {dest} ({dest.stat().st_size} bytes, wght={wght})")

if __name__ == "__main__":
    main()
