import { app, BrowserWindow, ipcMain, dialog, screen } from "electron";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
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
    resizable: true,
    maximizable: true,
    movable: true,
    frame: false,
    center: true,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: "#020617",
    icon: path.join(process.env.VITE_PUBLIC, "electron-vite.svg"),
    webPreferences: {
      preload: path.join(__dirname$1, "preload.mjs"),
      nodeIntegration: false,
      contextIsolation: true
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
ipcMain.on("window-minimize", () => {
  win == null ? void 0 : win.minimize();
});
ipcMain.on("window-maximize", () => {
  if (win == null ? void 0 : win.isMaximized()) {
    win == null ? void 0 : win.restore();
  } else {
    win == null ? void 0 : win.maximize();
  }
});
ipcMain.on("window-close", () => {
  win == null ? void 0 : win.close();
});
const DATA_PATH = path.join(app.getPath("userData"), "trades.json");
const SETTINGS_PATH = path.join(app.getPath("userData"), "settings.json");
const SCREENSHOTS_DIR = path.join(app.getPath("userData"), "screenshots");
if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}
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
ipcMain.handle("save-settings", async (_, settings) => {
  try {
    await fs.promises.writeFile(SETTINGS_PATH, JSON.stringify(settings, null, 2), "utf-8");
    return { success: true };
  } catch (error) {
    console.error("Failed to save settings:", error);
    return { success: false, error };
  }
});
ipcMain.handle("load-settings", async () => {
  try {
    if (fs.existsSync(SETTINGS_PATH)) {
      const data = await fs.promises.readFile(SETTINGS_PATH, "utf-8");
      return JSON.parse(data);
    }
    return { commissionPerContract: 0.62 };
  } catch (error) {
    console.error("Failed to load settings:", error);
    return { commissionPerContract: 0.62 };
  }
});
ipcMain.handle("attach-screenshot", async (_, tradeId) => {
  try {
    const result = await dialog.showOpenDialog({
      properties: ["openFile"],
      filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "gif", "webp", "bmp"] }]
    });
    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, canceled: true };
    }
    const sourcePath = result.filePaths[0];
    const ext = path.extname(sourcePath);
    const destFilename = `${tradeId}${ext}`;
    const destPath = path.join(SCREENSHOTS_DIR, destFilename);
    await fs.promises.copyFile(sourcePath, destPath);
    return { success: true, filename: destFilename };
  } catch (error) {
    console.error("Failed to attach screenshot:", error);
    return { success: false, error };
  }
});
ipcMain.handle("load-screenshot", async (_, filename) => {
  try {
    const filePath = path.join(SCREENSHOTS_DIR, filename);
    if (!fs.existsSync(filePath)) return null;
    const data = await fs.promises.readFile(filePath);
    const ext = path.extname(filename).toLowerCase().replace(".", "");
    const mime = ext === "jpg" ? "image/jpeg" : `image/${ext}`;
    return `data:${mime};base64,${data.toString("base64")}`;
  } catch (error) {
    console.error("Failed to load screenshot:", error);
    return null;
  }
});
ipcMain.handle("delete-screenshot", async (_, filename) => {
  try {
    const filePath = path.join(SCREENSHOTS_DIR, filename);
    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
    }
    return { success: true };
  } catch (error) {
    console.error("Failed to delete screenshot:", error);
    return { success: false, error };
  }
});
ipcMain.handle("export-db", async () => {
  try {
    const result = await dialog.showSaveDialog({
      title: "Export Trade Database",
      defaultPath: `alpha-stats-backup_${(/* @__PURE__ */ new Date()).toISOString().split("T")[0]}.json`,
      filters: [{ name: "JSON Database", extensions: ["json"] }]
    });
    if (result.canceled || !result.filePath) {
      return { success: false, canceled: true };
    }
    let trades = [];
    let settings = {};
    if (fs.existsSync(DATA_PATH)) {
      const data = await fs.promises.readFile(DATA_PATH, "utf-8");
      trades = JSON.parse(data);
    }
    if (fs.existsSync(SETTINGS_PATH)) {
      const data = await fs.promises.readFile(SETTINGS_PATH, "utf-8");
      settings = JSON.parse(data);
    }
    const bundle = { version: 1, exportedAt: (/* @__PURE__ */ new Date()).toISOString(), trades, settings };
    await fs.promises.writeFile(result.filePath, JSON.stringify(bundle, null, 2), "utf-8");
    return { success: true, path: result.filePath };
  } catch (error) {
    console.error("Failed to export database:", error);
    return { success: false, error };
  }
});
ipcMain.handle("import-db", async () => {
  try {
    const result = await dialog.showOpenDialog({
      title: "Import Trade Database",
      properties: ["openFile"],
      filters: [{ name: "JSON Database", extensions: ["json"] }]
    });
    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, canceled: true };
    }
    const data = await fs.promises.readFile(result.filePaths[0], "utf-8");
    const parsed = JSON.parse(data);
    if (parsed.version && parsed.trades) {
      await fs.promises.writeFile(DATA_PATH, JSON.stringify(parsed.trades, null, 2), "utf-8");
      if (parsed.settings) {
        await fs.promises.writeFile(SETTINGS_PATH, JSON.stringify(parsed.settings, null, 2), "utf-8");
      }
      return { success: true, trades: parsed.trades, settings: parsed.settings || null };
    } else if (Array.isArray(parsed)) {
      await fs.promises.writeFile(DATA_PATH, JSON.stringify(parsed, null, 2), "utf-8");
      return { success: true, trades: parsed, settings: null };
    }
    return { success: false, error: "Invalid file format" };
  } catch (error) {
    console.error("Failed to import database:", error);
    return { success: false, error };
  }
});
app.whenReady().then(createWindow);
export {
  MAIN_DIST,
  RENDERER_DIST,
  VITE_DEV_SERVER_URL
};
