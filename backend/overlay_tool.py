import json
import math
import os
import subprocess
import sys
import time
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[1]


def respond(payload):
    print(json.dumps(payload))
    sys.stdout.flush()


def progress(export_id, frame, total, started, path=None, stage="rendering"):
    elapsed = max(0.001, time.time() - started)
    percent = 0 if total <= 0 else min(100.0, frame / total * 100.0)
    fps_rate = frame / elapsed
    remaining = 0 if fps_rate <= 0 else max(0.0, (total - frame) / fps_rate)
    respond(
        {
            "type": "progress",
            "exportId": export_id,
            "stage": stage,
            "frame": frame,
            "totalFrames": total,
            "percent": percent,
            "elapsed": elapsed,
            "eta": remaining,
            "path": path,
        }
    )


def fail(message, code=1):
    print(json.dumps({"error": message}), file=sys.stderr)
    sys.exit(code)


def duration_with_ffprobe(audio_path):
    try:
        result = subprocess.run(
            [
                "ffprobe",
                "-v",
                "error",
                "-show_entries",
                "format=duration",
                "-of",
                "default=noprint_wrappers=1:nokey=1",
                str(audio_path),
            ],
            capture_output=True,
            text=True,
            check=True,
        )
        return float(result.stdout.strip())
    except Exception:
        return None


def get_duration(audio_path):
    try:
        import librosa

        return float(librosa.get_duration(path=str(audio_path)))
    except Exception:
        probed = duration_with_ffprobe(audio_path)
        if probed:
            return probed
    fail("Could not read audio duration. Install librosa or ensure ffprobe is available.")


def read_audio_mono(audio_path, sample_rate=22050):
    result = subprocess.run(
        [
            "ffmpeg",
            "-v",
            "error",
            "-i",
            str(audio_path),
            "-f",
            "f32le",
            "-acodec",
            "pcm_f32le",
            "-ac",
            "1",
            "-ar",
            str(sample_rate),
            "-",
        ],
        capture_output=True,
        check=True,
    )
    audio = np.frombuffer(result.stdout, dtype=np.float32)
    if audio.size == 0:
        raise ValueError("Decoded audio is empty.")
    return audio, sample_rate


def load_envelope(audio_path, duration, fps, bars):
    frame_count = max(1, int(math.ceil(duration * fps)))
    try:
        from scipy import signal
        from scipy.ndimage import gaussian_filter1d

        y, sr = read_audio_mono(audio_path)
        hop = max(128, int(sr / fps))
        nperseg = 2048
        noverlap = max(0, min(nperseg - 1, nperseg - hop))
        freqs, _, stft = signal.stft(
            y,
            fs=sr,
            window="hann",
            nperseg=nperseg,
            noverlap=noverlap,
            boundary=None,
            padded=False,
        )
        mag = np.abs(stft)
        if mag.size == 0:
            return np.zeros((frame_count, bars), dtype=np.float32)

        edges = np.geomspace(35, 8500, bars + 1)
        band_rows = []
        for low, high in zip(edges[:-1], edges[1:]):
            mask = (freqs >= low) & (freqs < high)
            if not np.any(mask):
                nearest = np.argmin(np.abs(freqs - ((low + high) * 0.5)))
                mask[nearest] = True
            band_rows.append(np.mean(mag[mask], axis=0))
        bands = np.asarray(band_rows)
        bands = 20.0 * np.log10(np.maximum(bands, 1e-7))
        bands = np.clip((bands + 64.0) / 64.0, 0.0, 1.0)

        # Normalize each band with a shared floor so rain beds stay visible while
        # bass/beat changes still create distinct movement.
        floor = np.percentile(bands, 18, axis=1, keepdims=True)
        peak = np.percentile(bands, 96, axis=1, keepdims=True)
        bands = np.clip((bands - floor) / np.maximum(peak - floor, 1e-4), 0.0, 1.0)
        band_delta = np.maximum(0.0, np.diff(bands, axis=1, prepend=bands[:, :1]))
        flux = np.mean(band_delta, axis=0)
        flux = flux / max(float(np.percentile(flux, 97)), 1e-6)
        flux = np.clip(flux, 0.0, 1.0)

        window = max(hop * 2, 256)
        squared = y * y
        kernel = np.ones(window, dtype=np.float32) / window
        rms_full = np.sqrt(np.convolve(squared, kernel, mode="same"))
        rms_positions = np.linspace(0, len(rms_full) - 1, bands.shape[1])
        rms = np.interp(rms_positions, np.arange(len(rms_full)), rms_full)
        rms = rms / max(float(np.percentile(rms, 97)), 1e-6)
        rms = np.clip(rms, 0.0, 1.0)

        source_x = np.arange(bands.shape[1])
        target_x = np.linspace(0, bands.shape[1] - 1, frame_count)
        band_delta = np.vstack([np.interp(target_x, source_x, band) for band in band_delta]).T
        bank = np.vstack([np.interp(target_x, source_x, band) for band in bands]).T
        base = np.interp(target_x, np.linspace(0, bands.shape[1] - 1, len(rms)), rms)
        flux = np.interp(target_x, np.linspace(0, bands.shape[1] - 1, len(flux)), flux)

        fast = gaussian_filter1d(bank, sigma=max(0.7, fps * 0.045), axis=0)
        slow = gaussian_filter1d(bank, sigma=max(1.0, fps * 0.42), axis=0)
        contrast = np.clip(fast - slow * 0.58, 0.0, 1.0)
        band_delta = gaussian_filter1d(band_delta, sigma=max(0.7, fps * 0.035), axis=0)
        bank = gaussian_filter1d(fast, sigma=0.72, axis=1)
        contrast = gaussian_filter1d(contrast, sigma=0.55, axis=1)

        x = np.linspace(0, 1, bars)
        low_focus = np.exp(-np.square((x - 0.22) * 3.4))
        mid_focus = np.exp(-np.square((x - 0.58) * 2.5))
        high_texture = np.exp(-np.square((x - 0.82) * 3.8))
        profile = 0.66 + 0.36 * low_focus + 0.22 * mid_focus + 0.12 * high_texture
        motion = (
            bank * 0.62
            + contrast * 0.42
            + band_delta * 0.58
            + flux[:, None] * (0.10 + 0.20 * low_focus[None, :])
        )
        bank = motion * profile[None, :]
        bank = 0.045 + bank * (0.42 + 0.88 * base[:, None])
        return np.clip(bank, 0.025, 1.0).astype(np.float32)
    except Exception:
        base = 0.22 + 0.08 * np.sin(np.linspace(0, duration * 1.7, frame_count))

    x = np.linspace(0, 1, bars)
    bank = []
    for frame, value in enumerate(base):
        phase = frame / max(1, fps)
        waves = 0.5 + 0.5 * np.sin((x * 20.0) + phase * 0.85)
        center = np.exp(-np.square((x - 0.52) * 2.25))
        low = np.exp(-np.square((x - 0.22) * 5.2))
        row = value * (0.24 + 0.34 * waves + 0.42 * center + 0.2 * low)
        bank.append(np.clip(row, 0.025, 1.0))
    return np.asarray(bank, dtype=np.float32)


def font(size, bold=False):
    candidates = [
        "C:/Windows/Fonts/segoeuib.ttf" if bold else "C:/Windows/Fonts/segoeui.ttf",
        "C:/Windows/Fonts/arialbd.ttf" if bold else "C:/Windows/Fonts/arial.ttf",
    ]
    for candidate in candidates:
        if Path(candidate).exists():
            return ImageFont.truetype(candidate, size)
    return ImageFont.load_default()


def hex_color(value, alpha=255):
    value = str(value or "#ffe7a6").lstrip("#")
    if len(value) == 3:
        value = "".join(ch * 2 for ch in value)
    return tuple(int(value[i : i + 2], 16) for i in (0, 2, 4)) + (alpha,)


def fmt_time(seconds):
    seconds = max(0, int(seconds))
    h = seconds // 3600
    m = (seconds % 3600) // 60
    s = seconds % 60
    return f"{h:02d}:{m:02d}:{s:02d}"


def draw_glow_line(base, xy, fill, width, radius):
    glow = Image.new("RGBA", base.size, (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.line(xy, fill=fill, width=width, joint="curve")
    glow = glow.filter(ImageFilter.GaussianBlur(radius))
    base.alpha_composite(glow)
    ImageDraw.Draw(base).line(xy, fill=fill, width=width, joint="curve")


def panel(draw, box, outline, fill):
    draw.rounded_rectangle(box, radius=18, fill=fill, outline=outline, width=1)


DEFAULT_LAYOUT = {
    "logo": {"x": 3.4, "y": 4.2, "w": 34.0, "h": 8.5},
    "labels": {"x": 78.0, "y": 4.2, "w": 18.6, "h": 8.4},
    "progress": {"x": 3.4, "y": 71.9, "w": 93.2, "h": 9.5},
    "visualizer": {"x": 3.4, "y": 82.2, "w": 93.2, "h": 12.6},
    "tags": {"x": 3.4, "y": 94.7, "w": 93.2, "h": 4.2},
}


def layout_box(settings, key, width, height):
    layout = settings.get("layout", {}) if isinstance(settings.get("layout", {}), dict) else {}
    item = {**DEFAULT_LAYOUT[key], **layout.get(key, {})}
    x = int(width * float(item.get("x", 0)) / 100)
    y = int(height * float(item.get("y", 0)) / 100)
    w = int(width * float(item.get("w", 10)) / 100)
    h = int(height * float(item.get("h", 10)) / 100)
    return (x, y, x + max(1, w), y + max(1, h))


def text_size(draw, text, text_font):
    box = draw.textbbox((0, 0), text, font=text_font)
    return box[2] - box[0], box[3] - box[1]


def slug(value, fallback="audio", max_len=80):
    allowed = []
    for char in str(value or ""):
        if char.isalnum():
            allowed.append(char.lower())
        elif char in {" ", "-", "_", "+", "."}:
            allowed.append("-")
    cleaned = "".join(allowed).strip("-")
    while "--" in cleaned:
        cleaned = cleaned.replace("--", "-")
    return (cleaned or fallback)[:max_len].strip("-")


def export_label(kind):
    labels = {
        "combined": "full-overlay",
        "progress-visualizer": "progress-plus-visualizer",
        "progress": "progress-only",
        "visualizer": "visualizer-only",
        "ui": "ui-only",
        "png-sequence": "full-overlay",
    }
    return labels.get(kind, slug(kind, "overlay"))


def draw_playhead(draw, px, cy, dot, fill, style):
    if style == "none":
        return
    if style == "pill":
        draw.rounded_rectangle((px - dot * 2, cy - dot, px + dot * 2, cy + dot), radius=dot, fill=fill)
    elif style == "diamond":
        draw.polygon([(px, cy - dot * 1.35), (px + dot * 1.35, cy), (px, cy + dot * 1.35), (px - dot * 1.35, cy)], fill=fill)
    elif style == "line":
        draw.rounded_rectangle((px - max(2, dot // 4), cy - dot * 1.8, px + max(2, dot // 4), cy + dot * 1.8), radius=max(2, dot // 4), fill=fill)
    else:
        draw.ellipse((px - dot, cy - dot, px + dot, cy + dot), fill=fill)


def render_frame(settings, kind, frame_index, fps, duration, envelope_row):
    width = int(settings.get("width", 1920))
    height = int(settings.get("height", 1080))
    primary = hex_color(settings.get("primary"), 230)
    secondary = hex_color(settings.get("secondary"), 185)
    panel_fill = hex_color(settings.get("panel"), 150)
    outline = hex_color(settings.get("primary"), 72)
    image = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    t = min(duration, frame_index / fps)
    progress = 0 if duration <= 0 else min(1.0, t / duration)

    include_progress = kind in {"combined", "progress", "progress-visualizer"}
    include_visualizer = kind in {"combined", "visualizer", "progress-visualizer"}
    include_ui = kind in {"combined", "ui"}
    sensitivity = float(settings.get("sensitivity", 0.62))
    dynamics = float(settings.get("dynamics", 0.72))
    floor = float(settings.get("floor", 0.08))
    smoothing = float(settings.get("smoothing", 0.64))
    show_panel_labels = settings.get("showPanelLabels", True)

    if include_ui:
        if settings.get("showLogo", True):
            lx1, ly1, lx2, ly2 = layout_box(settings, "logo", width, height)
            badge = max(34, min(ly2 - ly1, lx2 - lx1) - 6)
            by = ly1 + max(0, (ly2 - ly1 - badge) // 2)
            draw.ellipse((lx1, by, lx1 + badge, by + badge), outline=outline, width=2, fill=hex_color(settings.get("panel"), 115))
            ls_font = font(max(14, int(badge * 0.34)), True)
            tw, th = text_size(draw, "LS", ls_font)
            draw.text((lx1 + (badge - tw) / 2, by + (badge - th) / 2 - 1), "LS", font=ls_font, fill=primary)
            title_size = max(16, int((ly2 - ly1) * 0.38))
            sub_size = max(12, int((ly2 - ly1) * 0.22))
            draw.text((lx1 + badge + 18, ly1 + 2), settings.get("headline", "THE LOFI SET"), font=font(title_size, True), fill=(248, 239, 213, 240))
            draw.text((lx1 + badge + 18, ly1 + title_size + 12), settings.get("subline", "Relax. Sleep. Recharge."), font=font(sub_size), fill=primary)

        wx1, wy1, wx2, wy2 = layout_box(settings, "labels", width, height)
        panel(draw, (wx1, wy1, wx2, wy2), outline, panel_fill)
        label_size = max(12, int((wy2 - wy1) * 0.25))
        draw.text((wx1 + 22, wy1 + (wy2 - wy1) * 0.32), "Rain", font=font(label_size, True), fill=primary)
        draw.text((wx1 + max(70, int((wx2 - wx1) * 0.28)), wy1 + (wy2 - wy1) * 0.24), "PURE RAIN SOUNDS\nNO MUSIC", font=font(label_size, True), fill=(248, 239, 213, 240), spacing=4)

    if include_progress:
        progress_box = layout_box(settings, "progress", width, height)
        px1, py1, px2, py2 = progress_box
        panel(draw, progress_box, outline, panel_fill)
        label_font = font(max(12, int((py2 - py1) * 0.26)), True)
        if show_panel_labels:
            draw.text((px1 + 34, py1 + (py2 - py1) * 0.33), "VISUAL PROGRESS", font=label_font, fill=primary)

        label_w = max(170, int((px2 - px1) * 0.16)) if show_panel_labels else 28
        percent_w = max(86, int((px2 - px1) * 0.08))
        x1, x2 = px1 + label_w + 24, px2 - percent_w - 34
        cy = py1 + int((py2 - py1) * 0.45)
        thickness = int(settings.get("progressThickness", 10))
        draw.line((x1, cy, x2, cy), fill=(248, 239, 213, 55), width=thickness)
        px = int(x1 + (x2 - x1) * progress)
        draw_glow_line(image, (x1, cy, px, cy), primary, thickness, int(settings.get("progressGlow", 34)) // 2)
        dot = max(8, int((py2 - py1) * 0.18))
        draw_playhead(draw, px, cy, dot, primary, settings.get("progressDotStyle", "circle"))

        if settings.get("showTimer", True):
            timer_font = font(max(10, int((py2 - py1) * 0.18)))
            draw.text((x1, py1 + int((py2 - py1) * 0.68)), fmt_time(t), font=timer_font, fill=primary)
            draw.text((x2 - 92, py1 + int((py2 - py1) * 0.68)), fmt_time(duration), font=timer_font, fill=primary)
        if settings.get("showPercent", True):
            draw.text((px2 - percent_w, py1 + int((py2 - py1) * 0.28)), f"{round(progress * 100)}%", font=font(max(16, int((py2 - py1) * 0.38)), True), fill=primary)

    if include_visualizer:
        box = layout_box(settings, "visualizer", width, height)
        vx1, vy1, vx2, vy2 = box
        panel(draw, box, outline, panel_fill)
        if show_panel_labels:
            draw.text((vx1 + 34, vy1 + int((vy2 - vy1) * 0.38)), "AUDIO VISUALIZATION", font=font(max(12, int((vy2 - vy1) * 0.2)), True), fill=primary)

        label_w = max(210, int((vx2 - vx1) * 0.18)) if show_panel_labels else 28
        left, right = vx1 + label_w + 28, vx2 - 34
        bottom = vy2 - int((vy2 - vy1) * 0.18)
        max_h = max(10, int((vy2 - vy1) * 0.68))
        count = len(envelope_row)
        gap = max(3, int(settings.get("barGap", 9)))
        bar_w = max(3, min(int(settings.get("barWidth", 8)), (right - left) // max(1, count) - gap))
        total_w = count * bar_w + (count - 1) * gap
        x = left + max(0, (right - left - total_w) // 2)
        for value in envelope_row:
            shaped = math.pow(max(0.0, float(value)), max(0.28, smoothing))
            reactive = floor + shaped * (0.74 + sensitivity) + max(0.0, float(value) - 0.12) * dynamics * 0.34
            h = max(4, int(max_h * min(1.0, reactive)))
            bar = (x, bottom - h, x + bar_w, bottom)
            draw.rounded_rectangle(bar, radius=max(2, bar_w // 2), fill=secondary)
            x += bar_w + gap

    if include_ui and settings.get("showTags", True):
        tx1, ty1, tx2, ty2 = layout_box(settings, "tags", width, height)
        panel(draw, (tx1, ty1, tx2, ty2), outline, hex_color(settings.get("panel"), 128))
        tags = [
            settings.get("tagLeft", "COZY RAIN AMBIENCE"),
            settings.get("tagCenter", "DEEP SLEEP  •  INSOMNIA RELIEF"),
            settings.get("tagRight", "RELAXATION  •  STRESS RELIEF"),
        ]
        tag_font = font(max(10, int((ty2 - ty1) * 0.34)), True)
        xs = [tx1 + int((tx2 - tx1) * 0.08), tx1 + int((tx2 - tx1) * 0.43), tx1 + int((tx2 - tx1) * 0.73)]
        for text, x in zip(tags, xs):
            draw.text((x, ty1 + int((ty2 - ty1) * 0.28)), text, font=tag_font, fill=primary)

    return image


def analyze(payload):
    audio_path = Path(payload.get("audioPath", ""))
    if not audio_path.exists():
        fail("Audio file does not exist.")
    fps = int(payload.get("fps", 30))
    bars = int(payload.get("bars", 96))
    duration = get_duration(audio_path)
    envelope = load_envelope(audio_path, duration, fps=10, bars=bars)
    preview_rows = envelope[:: max(1, len(envelope) // 900)]
    respond(
        {
            "duration": duration,
            "fps": fps,
            "bars": bars,
            "preview": preview_rows.round(4).tolist(),
        }
    )


def export(payload):
    settings = payload.get("settings", {})
    kind = payload.get("kind", "combined")
    export_id = payload.get("exportId")
    audio_path = Path(payload.get("audioPath", ""))
    if not audio_path.exists():
        fail("Audio file does not exist.")
    fps = int(settings.get("fps", 30))
    duration = get_duration(audio_path)
    bars = int(settings.get("bars", 96))
    width = int(settings.get("width", 1920))
    height = int(settings.get("height", 1080))
    export_dir = Path(payload.get("exportDir") or ROOT / "exports")
    export_dir.mkdir(parents=True, exist_ok=True)

    audio_name = slug(audio_path.stem, "audio")
    safe_kind = export_label(kind)
    frame_count = max(1, int(math.ceil(duration * fps)))
    started = time.time()
    progress(export_id, 0, frame_count, started, stage="analyzing")
    envelope = load_envelope(audio_path, duration, fps=fps, bars=bars)
    progress(export_id, 0, frame_count, started, stage="rendering")

    if kind == "png-sequence":
        seq_dir = export_dir / f"lofi-set-{audio_name}-{safe_kind}-png-sequence"
        seq_dir.mkdir(parents=True, exist_ok=True)
        for i in range(frame_count):
            frame = render_frame(settings, "combined", i, fps, duration, envelope[min(i, len(envelope) - 1)])
            frame.save(seq_dir / f"frame_{i:06d}.png")
            if i == 0 or (i + 1) % max(1, fps * 5) == 0 or i + 1 == frame_count:
                progress(export_id, i + 1, frame_count, started, path=str(seq_dir))
        respond({"path": str(seq_dir), "format": "PNG sequence", "frames": frame_count})
        return

    if kind == "visualizer":
        ext = "webm"
        cmd = [
            "ffmpeg",
            "-y",
            "-f",
            "rawvideo",
            "-pix_fmt",
            "rgba",
            "-s",
            f"{width}x{height}",
            "-r",
            str(fps),
            "-i",
            "-",
            "-an",
            "-c:v",
            "libvpx-vp9",
            "-pix_fmt",
            "yuva420p",
            "-b:v",
            "0",
            "-crf",
            "24",
        ]
    else:
        ext = "mov"
        cmd = [
            "ffmpeg",
            "-y",
            "-f",
            "rawvideo",
            "-pix_fmt",
            "rgba",
            "-s",
            f"{width}x{height}",
            "-r",
            str(fps),
            "-i",
            "-",
            "-an",
            "-c:v",
            "prores_ks",
            "-profile:v",
            "4444",
            "-pix_fmt",
            "yuva444p10le",
        ]

    format_label = "prores4444-alpha" if ext == "mov" else "webm-vp9-alpha"
    out_path = export_dir / f"lofi-set-{audio_name}-{safe_kind}-{format_label}.{ext}"
    proc = subprocess.Popen(cmd + [str(out_path)], stdin=subprocess.PIPE, stderr=subprocess.PIPE)
    try:
        for i in range(frame_count):
            frame = render_frame(settings, kind, i, fps, duration, envelope[min(i, len(envelope) - 1)])
            proc.stdin.write(frame.tobytes())
            if i == 0 or (i + 1) % max(1, fps * 5) == 0 or i + 1 == frame_count:
                progress(export_id, i + 1, frame_count, started, path=str(out_path))
        proc.stdin.close()
        stderr = proc.stderr.read().decode("utf-8", errors="ignore")
        code = proc.wait()
    except BrokenPipeError:
        stderr = proc.stderr.read().decode("utf-8", errors="ignore")
        code = proc.wait()
    if code != 0:
        fail("ffmpeg export failed. Confirm ffmpeg is installed and available on PATH.\n" + stderr)
    respond({"path": str(out_path), "format": "ProRes 4444 MOV" if ext == "mov" else "WebM VP9 alpha", "frames": frame_count})


def main():
    if len(sys.argv) < 3:
        fail("Expected command and JSON payload.")
    command = sys.argv[1]
    payload = json.loads(sys.argv[2])
    if command == "analyze":
        analyze(payload)
    elif command == "export":
        export(payload)
    else:
        fail(f"Unknown command: {command}")


if __name__ == "__main__":
    main()
