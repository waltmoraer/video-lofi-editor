const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const path = require("node:path");
const { spawn } = require("node:child_process");

const rootDir = path.resolve(__dirname, "..");
const isDev = Boolean(process.env.VITE_DEV_SERVER_URL);
const activeExports = new Map();

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 980,
    minWidth: 1180,
    minHeight: 760,
    backgroundColor: "#08100d",
    title: "The Lofi SET Overlay Studio",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (isDev) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(rootDir, "dist", "index.html"));
  }
}

function runPython(command, payload, event) {
  return new Promise((resolve, reject) => {
    const script = path.join(rootDir, "backend", "overlay_tool.py");
    const child = spawn("python", [script, command, JSON.stringify(payload ?? {})], {
      cwd: rootDir,
      windowsHide: true
    });
    const exportId = command === "export" ? payload?.exportId : null;
    if (exportId) {
      activeExports.set(exportId, child);
      child.isCanceled = false;
    }

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
      const lines = stdout.split(/\r?\n/);
      stdout = lines.pop() || "";
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const message = JSON.parse(line);
          if (message.type === "progress") {
            event?.sender.send("overlay:export-progress", message);
          } else {
            child.lastMessage = message;
          }
        } catch {
          stderr += `\nInvalid Python output: ${line}`;
        }
      }
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (exportId) activeExports.delete(exportId);
      if (child.isCanceled) {
        reject(new Error("Export canceled."));
        return;
      }
      if (code !== 0) {
        reject(new Error(stderr || `Python exited with code ${code}`));
        return;
      }
      if (stdout.trim()) {
        try {
          child.lastMessage = JSON.parse(stdout);
        } catch (error) {
          reject(new Error(`Invalid Python response: ${stdout || error.message}`));
          return;
        }
      }
      resolve(child.lastMessage ?? {});
    });
  });
}

ipcMain.handle("audio:pick", async () => {
  const result = await dialog.showOpenDialog({
    title: "Import audio",
    properties: ["openFile"],
    filters: [
      { name: "Audio", extensions: ["wav", "mp3", "m4a", "aac", "flac", "ogg"] },
      { name: "All Files", extensions: ["*"] }
    ]
  });
  if (result.canceled || !result.filePaths[0]) return null;
  return result.filePaths[0];
});

ipcMain.handle("folder:pick", async () => {
  const result = await dialog.showOpenDialog({
    title: "Choose export folder",
    properties: ["openDirectory", "createDirectory"]
  });
  if (result.canceled || !result.filePaths[0]) return null;
  return result.filePaths[0];
});

ipcMain.handle("audio:analyze", (_event, payload) => runPython("analyze", payload));
ipcMain.handle("overlay:export", (event, payload) => runPython("export", payload, event));
ipcMain.handle("overlay:cancel-export", (_event, exportId) => {
  const child = activeExports.get(exportId);
  if (!child) return { canceled: false };
  child.isCanceled = true;
  child.kill("SIGTERM");
  activeExports.delete(exportId);
  return { canceled: true };
});

app.whenReady().then(createWindow);
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
