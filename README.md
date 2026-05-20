# The Lofi SET Overlay Studio

Standalone desktop tool for generating transparent reusable overlays for rain, sleep, study, and lofi ambience videos.

## What It Generates

- Cinematic progress bar overlays with timer, percentage, glow, rounded corners, and moving dot.
- Soft audio visualizer overlays tuned for rain and lofi instead of aggressive EDM motion.
- Optional The Lofi SET branding, labels, and ambience tags.
- Transparent exports for CapCut, Premiere Pro, and DaVinci Resolve.

## Export Formats

- `Combined`, `Progress`, and `UI Only`: MOV ProRes 4444 with alpha.
- `Visualizer`: WebM VP9 with alpha.
- `PNG Seq`: transparent PNG sequence.

## Setup

Install Node dependencies:

```powershell
npm install
```

Install Python dependencies:

```powershell
python -m pip install -r backend/requirements.txt
```

Install ffmpeg and make sure both `ffmpeg` and `ffprobe` are available on `PATH`.

## Run

```powershell
npm start
```

For production-style local launch:

```powershell
npm run desktop
```

## Notes

Long exports can be large and slow because alpha video is expensive. For 1-10 hour tracks, start with 30 fps and export individual overlay layers so video editors can reuse them across multiple projects.
