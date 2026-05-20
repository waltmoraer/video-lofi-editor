const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("lofiStudio", {
  pickAudio: () => ipcRenderer.invoke("audio:pick"),
  pickFolder: () => ipcRenderer.invoke("folder:pick"),
  onExportProgress: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on("overlay:export-progress", listener);
    return () => ipcRenderer.removeListener("overlay:export-progress", listener);
  },
  analyzeAudio: (payload) => ipcRenderer.invoke("audio:analyze", payload),
  exportOverlay: (payload) => ipcRenderer.invoke("overlay:export", payload),
  cancelExport: (exportId) => ipcRenderer.invoke("overlay:cancel-export", exportId)
});
