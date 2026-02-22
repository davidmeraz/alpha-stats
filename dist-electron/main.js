import { app, BrowserWindow, ipcMain, screen } from "electron";
import fs from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
createRequire(import.meta.url);
const __dirname$1 = path.dirname(fileURLToPath(import.meta.url));
process.env.APP_ROOT = path.join(__dirname$1, "..");
const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, "public") : RENDERER_DIST;
let win;
function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  win = new BrowserWindow({
    width: Math.floor(width * 0.8),
    height: Math.floor(height * 0.86),
    resizable: false,
    maximizable: false,
    movable: false,
    center: true,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: "#020617",
    icon: path.join(process.env.VITE_PUBLIC, "electron-vite.svg"),
    webPreferences: {
      preload: path.join(__dirname$1, "preload.mjs"),
      nodeIntegration: true,
      contextIsolation: false
    }
  });
  win.once("ready-to-show", () => {
    win == null ? void 0 : win.show();
  });
  win.webContents.on("did-finish-load", () => {
    win == null ? void 0 : win.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  });
  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(RENDERER_DIST, "index.html"));
  }
}
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
    win = null;
  }
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
const DATA_PATH = path.join(app.getPath("userData"), "trades.json");
ipcMain.handle("save-trades", async (_, trades) => {
  try {
    await fs.promises.writeFile(DATA_PATH, JSON.stringify(trades, null, 2), "utf-8");
    return { success: true };
  } catch (error) {
    console.error("Failed to save trades:", error);
    return { success: false, error };
  }
});
ipcMain.handle("load-trades", async () => {
  try {
    if (fs.existsSync(DATA_PATH)) {
      const data = await fs.promises.readFile(DATA_PATH, "utf-8");
      return JSON.parse(data);
    }
    return [];
  } catch (error) {
    console.error("Failed to load trades:", error);
    return [];
  }
});
app.whenReady().then(createWindow);
export {
  MAIN_DIST,
  RENDERER_DIST,
  VITE_DEV_SERVER_URL
};
