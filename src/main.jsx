import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const defaultStyle = {
  width: 1920,
  height: 1080,
  fps: 30,
  progressPosition: "bottom",
  progressThickness: 10,
  progressGlow: 34,
  visualizerMode: "bars",
  bars: 96,
  barWidth: 8,
  barGap: 9,
  sensitivity: 0.62,
  smoothing: 0.64,
  dynamics: 0.72,
  floor: 0.08,
  opacity: 0.84,
  primary: "#ffe7a6",
  secondary: "#b7d49c",
  panel: "#07110d",
  showLogo: true,
  showTimer: true,
  showPercent: true,
  showTags: true,
  showPanelLabels: true,
  progressDotStyle: "circle",
  headline: "THE LOFI SET",
  subline: "Relax. Sleep. Recharge.",
  tagLeft: "COZY RAIN AMBIENCE",
  tagCenter: "DEEP SLEEP - INSOMNIA RELIEF",
  tagRight: "RELAXATION - STRESS RELIEF",
  layout: {
    logo: { x: 3.4, y: 4.2, w: 34, h: 8.5 },
    labels: { x: 78, y: 4.2, w: 18.6, h: 8.4 },
    progress: { x: 3.4, y: 71.9, w: 93.2, h: 9.5 },
    visualizer: { x: 3.4, y: 82.2, w: 93.2, h: 12.6 },
    tags: { x: 3.4, y: 94.7, w: 93.2, h: 4.2 }
  }
};

const layoutItems = [
  ["progress", "Progress"],
  ["visualizer", "Visualizer"],
  ["logo", "Logo"],
  ["labels", "Labels"],
  ["tags", "Tag Strip"]
];

const fpsOptions = [15, 24, 30, 60];
const dotStyleOptions = ["circle", "pill", "diamond", "line", "none"];

const variationPresets = [
  {
    id: "sleep-rain-minimal",
    name: "Sleep Rain Minimal",
    description: "Sparse bars, low glow, quiet labels, and a clean lower-third layout.",
    values: {
      bars: 72,
      sensitivity: 0.48,
      dynamics: 0.42,
      smoothing: 0.86,
      floor: 0.06,
      opacity: 0.72,
      progressThickness: 7,
      progressGlow: 20,
      headline: "THE LOFI SET",
      subline: "Pure Rain for Deep Rest",
      tagLeft: "PURE RAIN SOUNDS",
      tagCenter: "DEEP SLEEP - LOW DISTRACTION",
      tagRight: "CALM NIGHT AMBIENCE",
      layout: {
        progress: { x: 5.5, y: 73.6, w: 89, h: 8.2 },
        visualizer: { x: 5.5, y: 84.0, w: 89, h: 10.5 },
        logo: { x: 4.4, y: 4.8, w: 30, h: 7.5 },
        labels: { x: 76.5, y: 5.0, w: 19.5, h: 7.4 },
        tags: { x: 5.5, y: 95.2, w: 89, h: 3.7 }
      }
    }
  },
  {
    id: "lofi-study-active",
    name: "Lofi Study Active",
    description: "Denser bars and stronger transient response for tracks with beat movement.",
    values: {
      bars: 128,
      sensitivity: 0.86,
      dynamics: 1.18,
      smoothing: 0.52,
      floor: 0.09,
      opacity: 0.86,
      progressThickness: 9,
      progressGlow: 34,
      headline: "THE LOFI SET",
      subline: "Focus. Rain. Flow.",
      tagLeft: "LOFI STUDY RAIN",
      tagCenter: "FOCUS SESSION - SOFT BEATS",
      tagRight: "RAIN AMBIENCE",
      layout: {
        progress: { x: 3.4, y: 70.6, w: 93.2, h: 9.2 },
        visualizer: { x: 3.4, y: 81.2, w: 93.2, h: 13.4 },
        logo: { x: 3.2, y: 4.0, w: 34, h: 8.5 },
        labels: { x: 76.6, y: 4.0, w: 20, h: 8.2 },
        tags: { x: 3.4, y: 94.8, w: 93.2, h: 4.2 }
      }
    }
  },
  {
    id: "pure-rain-wide",
    name: "Pure Rain Wide",
    description: "Wide calm waveform-style movement for rain ambience and insomnia relief videos.",
    values: {
      visualizerMode: "waveform",
      bars: 104,
      sensitivity: 0.68,
      dynamics: 0.82,
      smoothing: 0.72,
      floor: 0.11,
      opacity: 0.8,
      progressThickness: 6,
      progressGlow: 28,
      headline: "THE LOFI SET",
      subline: "Relax. Sleep. Recharge.",
      tagLeft: "COZY RAIN AMBIENCE",
      tagCenter: "NO MUSIC - PURE RAIN",
      tagRight: "INSOMNIA RELIEF",
      layout: {
        progress: { x: 7, y: 76.2, w: 86, h: 7.5 },
        visualizer: { x: 7, y: 85.2, w: 86, h: 9.8 },
        logo: { x: 4, y: 5.0, w: 32, h: 8 },
        labels: { x: 77, y: 5.1, w: 18.5, h: 7.5 },
        tags: { x: 7, y: 95.4, w: 86, h: 3.5 }
      }
    }
  },
  {
    id: "cinematic-gold",
    name: "Cinematic Gold",
    description: "More premium glow, larger progress presence, and reordered tags for distinct videos.",
    values: {
      bars: 90,
      sensitivity: 0.74,
      dynamics: 0.92,
      smoothing: 0.6,
      floor: 0.08,
      opacity: 0.9,
      progressThickness: 12,
      progressGlow: 52,
      headline: "THE LOFI SET",
      subline: "Rain Ambience for Stress Relief",
      tagLeft: "RELAXATION - STRESS RELIEF",
      tagCenter: "WARM RAIN AMBIENCE",
      tagRight: "DEEP REST",
      layout: {
        progress: { x: 4.2, y: 69.4, w: 91.6, h: 10.8 },
        visualizer: { x: 4.2, y: 82.0, w: 91.6, h: 12.6 },
        logo: { x: 4.2, y: 4.6, w: 35, h: 8.8 },
        labels: { x: 75.4, y: 4.6, w: 20.4, h: 8.6 },
        tags: { x: 4.2, y: 95.0, w: 91.6, h: 4.0 }
      }
    }
  }
];

const exportKinds = [
  ["combined", "Full Overlay", "Exports progress, visualizer, and branding/UI labels together as one transparent overlay."],
  ["progress-visualizer", "Progress + Visualizer", "Exports only the progress bar and audio visualization together, without logo, labels, or tag strip."],
  ["progress", "Progress", "Exports only the animated progress bar with timer and percentage."],
  ["visualizer", "Visualizer", "Exports only the audio-reactive visualization bars."],
  ["ui", "UI Only", "Exports only static branding, labels, and tag elements."],
  ["png-sequence", "PNG Seq", "Exports the full overlay as transparent PNG frames instead of video."]
];

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return "00:00:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return [h, m, s].map((part) => String(part).padStart(2, "0")).join(":");
}

function formatEta(seconds) {
  if (!Number.isFinite(seconds)) return "--:--";
  if (seconds <= 0) return "00:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function makeDemoBars(count, t, sensitivity) {
  return Array.from({ length: count }, (_, index) => {
    const x = index / Math.max(1, count - 1);
    const slow = Math.sin(x * 18 + t * 1.4) * 0.5 + 0.5;
    const swell = Math.sin(x * 43 - t * 2.2) * 0.5 + 0.5;
    const center = Math.exp(-Math.pow((x - 0.5) * 2.3, 2));
    return Math.min(1, 0.05 + sensitivity * (0.28 * slow + 0.36 * swell + 0.34 * center));
  });
}

function resampleRow(row, count) {
  if (!row?.length) return [];
  if (row.length === count) return row;
  return Array.from({ length: count }, (_, index) => {
    const source = (index / Math.max(1, count - 1)) * (row.length - 1);
    const left = Math.floor(source);
    const right = Math.min(row.length - 1, left + 1);
    const mix = source - left;
    return row[left] * (1 - mix) + row[right] * mix;
  });
}

function toAudioUrl(filePath) {
  if (!filePath) return "";
  const normalized = filePath.replace(/\\/g, "/");
  const prefixed = normalized.startsWith("/") ? normalized : `/${normalized}`;
  return `file://${encodeURI(prefixed).replace(/#/g, "%23")}`;
}

function previewBars(analysis, time, duration, settings) {
  if (!analysis?.preview?.length) {
    return makeDemoBars(settings.bars, time, settings.sensitivity);
  }
  const index = Math.min(
    analysis.preview.length - 1,
    Math.max(0, Math.round((time / Math.max(1, duration)) * (analysis.preview.length - 1)))
  );
  const row = resampleRow(analysis.preview[index], settings.bars);
  const prev = resampleRow(analysis.preview[Math.max(0, index - 1)], settings.bars);
  return row.map((value, band) => {
    const transient = Math.max(0, value - (prev[band] ?? value));
    const shaped = Math.pow(Math.max(0, value), Math.max(0.28, settings.smoothing));
    const motion = shaped * (0.72 + settings.sensitivity) + transient * (0.8 + settings.dynamics);
    return Math.min(1, settings.floor + motion);
  });
}

function App() {
  const [settings, setSettings] = useState(defaultStyle);
  const [selectedLayout, setSelectedLayout] = useState("progress");
  const [variationSeed, setVariationSeed] = useState("Rainy Study Loop");
  const [audioPath, setAudioPath] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
  const [exportDir, setExportDir] = useState("");
  const [analysis, setAnalysis] = useState(null);
  const [status, setStatus] = useState("Import audio to preview and export measured overlay motion.");
  const [previewTime, setPreviewTime] = useState(0);
  const [mediaDuration, setMediaDuration] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(0.72);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(null);
  const [activeExportId, setActiveExportId] = useState("");
  const audioRef = useRef(null);

  const duration = analysis?.duration || mediaDuration || 0;
  const percent = duration > 0 ? Math.min(100, Math.round((previewTime / duration) * 100)) : 0;
  const bars = useMemo(
    () => previewBars(analysis, previewTime, duration || 180, settings),
    [analysis, previewTime, duration, settings]
  );

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  useEffect(() => {
    if (!window.lofiStudio?.onExportProgress) return undefined;
    return window.lofiStudio.onExportProgress((message) => {
      setExportProgress((current) => {
        if (current?.exportId && message.exportId && current.exportId !== message.exportId) return current;
        return message;
      });
    });
  }, []);

  const update = (key, value) => setSettings((current) => ({ ...current, [key]: value }));
  const updateLayout = (key, field, value) => {
    setSettings((current) => ({
      ...current,
      layout: {
        ...current.layout,
        [key]: {
          ...current.layout[key],
          [field]: value
        }
      }
    }));
  };

  const applyVariation = (preset) => {
    setSettings((current) => ({
      ...current,
      ...preset.values,
      layout: {
        ...current.layout,
        ...(preset.values.layout || {})
      }
    }));
    setStatus(`Applied variation: ${preset.name}`);
  };

  const applySeedVariation = () => {
    const hash = Array.from(variationSeed || "lofi-set").reduce((value, char) => {
      return (value * 31 + char.charCodeAt(0)) >>> 0;
    }, 2166136261);
    const pick = (min, max, salt = 0) => min + (((hash >> salt) & 255) / 255) * (max - min);
    const tagOrders = [
      [settings.tagLeft, settings.tagCenter, settings.tagRight],
      [settings.tagCenter, settings.tagRight, settings.tagLeft],
      [settings.tagRight, settings.tagLeft, settings.tagCenter]
    ];
    const tags = tagOrders[hash % tagOrders.length];
    setSettings((current) => ({
      ...current,
      bars: Math.round(pick(72, 144, 0)),
      sensitivity: Number(pick(0.48, 0.98, 8).toFixed(2)),
      dynamics: Number(pick(0.45, 1.28, 16).toFixed(2)),
      smoothing: Number(pick(0.48, 0.88, 4).toFixed(2)),
      floor: Number(pick(0.05, 0.14, 12).toFixed(2)),
      opacity: Number(pick(0.72, 0.9, 20).toFixed(2)),
      progressThickness: Math.round(pick(6, 13, 2)),
      progressGlow: Math.round(pick(22, 56, 10)),
      tagLeft: tags[0],
      tagCenter: tags[1],
      tagRight: tags[2],
      layout: {
        ...current.layout,
        progress: {
          ...current.layout.progress,
          y: Number(pick(69.5, 76.5, 6).toFixed(1)),
          h: Number(pick(7.6, 10.8, 14).toFixed(1))
        },
        visualizer: {
          ...current.layout.visualizer,
          y: Number(pick(81.0, 85.2, 18).toFixed(1)),
          h: Number(pick(10.4, 14.8, 22).toFixed(1))
        }
      }
    }));
    setStatus(`Applied seeded variation from "${variationSeed}".`);
  };

  async function importAudio() {
    if (!window.lofiStudio) {
      setStatus("Run in Electron to use native audio import.");
      return;
    }
    const filePath = await window.lofiStudio.pickAudio();
    if (!filePath) return;

    try {
      const nextAudioUrl = toAudioUrl(filePath);
      setAudioPath(filePath);
      setAudioUrl(nextAudioUrl);
      setPreviewTime(0);
      setMediaDuration(0);
      setPlaying(false);
      setAnalysis(null);
      setStatus("Loading audio and analyzing frequency bands...");

      const result = await window.lofiStudio.analyzeAudio({
        audioPath: filePath,
        bars: settings.bars,
        fps: settings.fps
      });
      setAnalysis(result);
      setStatus(`Ready: ${formatTime(result.duration)} analyzed at ${result.fps} fps.`);
    } catch (error) {
      setStatus(`Import failed: ${error.message}`);
    }
  }

  async function chooseFolder() {
    if (!window.lofiStudio) return;
    const folder = await window.lofiStudio.pickFolder();
    if (folder) setExportDir(folder);
  }

  async function togglePlayback() {
    const audio = audioRef.current;
    if (!audio) {
      setStatus("Import audio before playback.");
      return;
    }
    if (audio.paused) {
      await audio.play();
      setPlaying(true);
    } else {
      audio.pause();
      setPlaying(false);
    }
  }

  function seek(value) {
    const next = Number(value);
    setPreviewTime(next);
    if (audioRef.current && Number.isFinite(next)) {
      audioRef.current.currentTime = next;
    }
  }

  async function exportAsset(kind) {
    if (!window.lofiStudio) {
      setStatus("Run in Electron to export transparent video assets.");
      return;
    }
    if (!audioPath) {
      setStatus("Import audio before export so timing matches the track.");
      return;
    }
    const exportId = `${Date.now()}-${kind}`;
    setActiveExportId(exportId);
    setExporting(true);
    setExportProgress({
      exportId,
      stage: "starting",
      frame: 0,
      totalFrames: 0,
      percent: 0,
      eta: 0
    });
    setStatus(`Starting ${kind} overlay export...`);
    try {
      const result = await window.lofiStudio.exportOverlay({
        exportId,
        kind,
        audioPath,
        exportDir,
        settings
      });
      setExportProgress((current) => ({
        ...(current || {}),
        exportId,
        stage: "complete",
        percent: 100,
        eta: 0,
        path: result.path
      }));
      setStatus(`Success: exported ${result.format} to ${result.path}`);
    } catch (error) {
      setExportProgress((current) => ({
        ...(current || {}),
        exportId,
        stage: "failed"
      }));
      setStatus(error.message);
    } finally {
      setExporting(false);
      setActiveExportId("");
    }
  }

  async function cancelExport() {
    if (!activeExportId || !window.lofiStudio?.cancelExport) return;
    await window.lofiStudio.cancelExport(activeExportId);
    setExporting(false);
    setExportProgress((current) => ({
      ...(current || {}),
      exportId: activeExportId,
      stage: "canceled",
      eta: 0
    }));
    setStatus("Export canceled.");
    setActiveExportId("");
  }

  return (
    <main className="app">
      <aside className="sidebar">
        <div className="brand-mark">
          <div className="moon">LS</div>
          <div>
            <h1>The Lofi SET</h1>
            <p>Overlay Studio</p>
          </div>
        </div>

        <section className="panel">
          <h2>Source</h2>
          <button className="primary" onClick={importAudio}>Import Audio</button>
          <div className="file-line">{audioPath || "No audio selected"}</div>
          <button className="secondary" onClick={chooseFolder}>Export Folder</button>
          <div className="file-line">{exportDir || "Default: exports folder"}</div>
        </section>

        <section className="panel">
          <h2>Export</h2>
          <div className="fps-grid">
            {fpsOptions.map((fps) => (
              <button
                key={fps}
                className={settings.fps === fps ? "active" : ""}
                onClick={() => update("fps", fps)}
                title={`${fps} frames per second export`}
              >
                {fps} fps
              </button>
            ))}
          </div>
          <div className="export-hint">
            {settings.fps === 15 && "Fastest export. Good for subtle sleep overlays."}
            {settings.fps === 24 && "Cinematic motion with smaller files than 30 fps."}
            {settings.fps === 30 && "Recommended default for YouTube and most editors."}
            {settings.fps === 60 && "Smoothest motion. Exports take much longer."}
          </div>
        </section>

        <section className="panel">
          <h2>Progress</h2>
          <Segmented value={settings.progressPosition} options={["bottom", "top"]} onChange={(value) => update("progressPosition", value)} />
          <Segmented value={settings.progressDotStyle} options={dotStyleOptions} onChange={(value) => update("progressDotStyle", value)} />
          <Slider label="Thickness" min="4" max="22" value={settings.progressThickness} onChange={(v) => update("progressThickness", v)} />
          <Slider label="Glow" min="0" max="70" value={settings.progressGlow} onChange={(v) => update("progressGlow", v)} />
          <Toggle label="Timer" checked={settings.showTimer} onChange={(v) => update("showTimer", v)} />
          <Toggle label="Percentage" checked={settings.showPercent} onChange={(v) => update("showPercent", v)} />
          <Toggle label="Section Labels" checked={settings.showPanelLabels} onChange={(v) => update("showPanelLabels", v)} />
        </section>

        <section className="panel">
          <h2>Visualizer</h2>
          <Segmented value={settings.visualizerMode} options={["bars", "waveform"]} onChange={(value) => update("visualizerMode", value)} />
          <Slider label="Bars" min="32" max="180" value={settings.bars} onChange={(v) => update("bars", v)} />
          <Slider label="Intensity" min="0.18" max="1.4" step="0.01" value={settings.sensitivity} onChange={(v) => update("sensitivity", v)} />
          <Slider label="Dynamics" min="0" max="1.6" step="0.01" value={settings.dynamics} onChange={(v) => update("dynamics", v)} />
          <Slider label="Smoothing" min="0.35" max="1.2" step="0.01" value={settings.smoothing} onChange={(v) => update("smoothing", v)} />
          <Slider label="Floor" min="0.02" max="0.22" step="0.01" value={settings.floor} onChange={(v) => update("floor", v)} />
          <Slider label="Opacity" min="0.25" max="1" step="0.01" value={settings.opacity} onChange={(v) => update("opacity", v)} />
        </section>

        <section className="panel">
          <h2>Branding</h2>
          <Toggle label="Logo" checked={settings.showLogo} onChange={(v) => update("showLogo", v)} />
          <Toggle label="Tags" checked={settings.showTags} onChange={(v) => update("showTags", v)} />
          <TextInput label="Headline" value={settings.headline} onChange={(v) => update("headline", v)} />
          <TextInput label="Subline" value={settings.subline} onChange={(v) => update("subline", v)} />
        </section>

        <section className="panel">
          <h2>Layout</h2>
          <Segmented value={selectedLayout} options={layoutItems.map(([key]) => key)} onChange={setSelectedLayout} />
          <div className="layout-name">{layoutItems.find(([key]) => key === selectedLayout)?.[1]}</div>
          <LayoutEditor item={settings.layout[selectedLayout]} onChange={(field, value) => updateLayout(selectedLayout, field, value)} />
        </section>

        <section className="panel">
          <h2>Variations</h2>
          <TextInput label="Seed" value={variationSeed} onChange={setVariationSeed} />
          <button className="secondary" onClick={applySeedVariation}>Generate From Seed</button>
          <div className="variation-list">
            {variationPresets.map((preset) => (
              <button key={preset.id} className="variation-card" title={preset.description} onClick={() => applyVariation(preset)}>
                <strong>{preset.name}</strong>
                <span>{preset.description}</span>
              </button>
            ))}
          </div>
        </section>
      </aside>

      <section className="stage-column">
        <header className="transport">
          <div className="status-block">
            <strong>{duration ? formatTime(duration) : "No audio loaded"}</strong>
            <span>{status}</span>
          </div>
          <button className="play-button" onClick={togglePlayback}>{playing ? "Pause" : "Play"}</button>
          <div className="seek-group">
            <span>{formatTime(previewTime)}</span>
            <input
              aria-label="Seek audio"
              type="range"
              min="0"
              max={Math.max(1, duration)}
              step="0.05"
              value={Math.min(previewTime, Math.max(1, duration))}
              onChange={(event) => seek(event.target.value)}
            />
            <span>{formatTime(duration)}</span>
          </div>
          <label className="volume">
            <span>Volume</span>
            <input type="range" min="0" max="1" step="0.01" value={volume} onChange={(event) => setVolume(Number(event.target.value))} />
          </label>
          <audio
            ref={audioRef}
            src={audioUrl}
            onTimeUpdate={(event) => setPreviewTime(event.currentTarget.currentTime)}
            onLoadedMetadata={(event) => {
              setPreviewTime(event.currentTarget.currentTime);
              setMediaDuration(event.currentTarget.duration || 0);
              if (!analysis) {
                setStatus(`Audio loaded: ${formatTime(event.currentTarget.duration)}. Analysis is still pending.`);
              }
            }}
            onCanPlay={() => {
              if (!analysis) setStatus("Audio can play. Analysis is still pending.");
            }}
            onError={(event) => {
              const code = event.currentTarget.error?.code;
              setStatus(`Audio playback could not load this file${code ? ` (media error ${code})` : ""}.`);
            }}
            onPause={() => setPlaying(false)}
            onPlay={() => setPlaying(true)}
            onEnded={() => setPlaying(false)}
          />
        </header>

        <div className="preview-shell">
          <div className="video-preview">
            <div className="preview-image" />
            <Overlay settings={settings} bars={bars} time={previewTime} duration={duration || 1} percent={percent} />
          </div>
        </div>

        <div className="export-row">
          {exportKinds.map(([kind, label, tooltip]) => (
            <button
              key={kind}
              className="export-button tooltip"
              disabled={exporting}
              onClick={() => exportAsset(kind)}
              title={tooltip}
              data-tooltip={tooltip}
            >
              {label}
            </button>
          ))}
        </div>
        {exportProgress && (
          <div className={`export-progress ${exportProgress.stage === "complete" ? "complete" : ""} ${exportProgress.stage === "failed" ? "failed" : ""} ${exportProgress.stage === "canceled" ? "canceled" : ""}`}>
            <div>
              <strong>
                {exportProgress.stage === "complete"
                  ? "Export complete"
                  : exportProgress.stage === "canceled"
                    ? "Export canceled"
                  : exportProgress.stage === "failed"
                    ? "Export failed"
                    : `Exporting ${Math.round(exportProgress.percent || 0)}%`}
              </strong>
              <span>
                {exportProgress.stage === "complete"
                  ? exportProgress.path
                  : exportProgress.stage === "canceled"
                    ? "The running export was stopped."
                  : `${exportProgress.stage || "rendering"} - ${exportProgress.frame || 0}/${exportProgress.totalFrames || 0} frames - ETA ${formatEta(exportProgress.eta)}`}
              </span>
            </div>
            <div className="export-meter">
              <span style={{ width: `${Math.min(100, exportProgress.percent || 0)}%` }} />
            </div>
            {exporting && (
              <button className="cancel-export" onClick={cancelExport}>
                Cancel Export
              </button>
            )}
          </div>
        )}
      </section>
    </main>
  );
}

function Overlay({ settings, bars, time, duration, percent }) {
  const boxStyle = (key) => {
    const item = settings.layout?.[key] || defaultStyle.layout[key];
    return {
      left: `${item.x}%`,
      top: `${item.y}%`,
      width: `${item.w}%`,
      height: `${item.h}%`
    };
  };
  const progressStyle = {
    "--progress": `${(time / duration) * 100}%`,
    "--primary": settings.primary,
    "--secondary": settings.secondary,
    "--panel": settings.panel,
    "--bar-thickness": `${settings.progressThickness}px`,
    "--glow": `${settings.progressGlow}px`,
    opacity: settings.opacity
  };

  return (
    <div className={`overlay ${settings.progressPosition}`} style={progressStyle}>
      <div className="top-brand" style={boxStyle("logo")}>
        {settings.showLogo && <div className="logo-badge">LS</div>}
        <div>
          <div className="brand-title">{settings.headline}</div>
          <div className="brand-subtitle">{settings.subline}</div>
        </div>
      </div>

      <div className="weather-pill" style={boxStyle("labels")}>
        <span className="cloud">Rain</span>
        <span>PURE RAIN SOUNDS<br />NO MUSIC</span>
      </div>

      <div className={`progress-panel ${settings.showPanelLabels ? "" : "labels-hidden"}`} style={boxStyle("progress")}>
        {settings.showPanelLabels && <div className="panel-label">VISUAL PROGRESS</div>}
        <div className="track">
          <div className="fill" />
          {settings.progressDotStyle !== "none" && <div className={`dot ${settings.progressDotStyle}`} />}
        </div>
        {settings.showPercent && <div className="percent">{percent}%</div>}
        {settings.showTimer && (
          <div className="times">
            <span>{formatTime(time)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        )}
      </div>

      <div className={`visualizer-panel ${settings.showPanelLabels ? "" : "labels-hidden"}`} style={boxStyle("visualizer")}>
        {settings.showPanelLabels && <div className="panel-label">AUDIO VISUALIZATION</div>}
        <div className={`visualizer ${settings.visualizerMode}`}>
          {bars.map((value, index) => <span key={index} style={{ "--h": `${value * 100}%` }} />)}
        </div>
      </div>

      {settings.showTags && (
        <div className="tag-strip" style={boxStyle("tags")}>
          <span>{settings.tagLeft}</span>
          <span>{settings.tagCenter}</span>
          <span>{settings.tagRight}</span>
        </div>
      )}
    </div>
  );
}

function Segmented({ value, options, onChange }) {
  return (
    <div className="segmented">
      {options.map((option) => (
        <button key={option} className={value === option ? "active" : ""} onClick={() => onChange(option)}>
          {option}
        </button>
      ))}
    </div>
  );
}

function Slider({ label, value, onChange, ...props }) {
  return (
    <label className="control">
      <span>{label}<b>{value}</b></span>
      <input type="range" value={value} onChange={(event) => onChange(Number(event.target.value))} {...props} />
    </label>
  );
}

function Toggle({ label, checked, onChange }) {
  return (
    <label className="toggle">
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}

function LayoutEditor({ item, onChange }) {
  return (
    <div className="layout-editor">
      <Slider label="X" min="0" max="100" step="0.1" value={item.x} onChange={(v) => onChange("x", v)} />
      <Slider label="Y" min="0" max="100" step="0.1" value={item.y} onChange={(v) => onChange("y", v)} />
      <Slider label="Width" min="5" max="100" step="0.1" value={item.w} onChange={(v) => onChange("w", v)} />
      <Slider label="Height" min="3" max="35" step="0.1" value={item.h} onChange={(v) => onChange("h", v)} />
    </div>
  );
}

function TextInput({ label, value, onChange }) {
  return (
    <label className="text-input">
      <span>{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

createRoot(document.getElementById("root")).render(<App />);
