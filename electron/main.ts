import { app, BrowserWindow, screen, ipcMain, dialog } from 'electron'
import http from 'node:http'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

process.env.APP_ROOT = path.join(__dirname, '..')

export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let win: BrowserWindow | null

function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize

  win = new BrowserWindow({
    width: Math.floor(width * 0.80),
    height: Math.floor(height * 0.90),
    resizable: true,
    maximizable: true,
    movable: true,
    frame: false,
    center: true,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#050d1a',
    icon: path.join(process.env.VITE_PUBLIC, 'electron-vite.svg'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  win.once('ready-to-show', () => {
    win?.show()
  })

  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

// --- Window Controls IPC ---
ipcMain.on('window-minimize', () => {
  win?.minimize()
})
ipcMain.on('window-maximize', () => {
  if (win?.isMaximized()) {
    win?.restore()
  } else {
    win?.maximize()
  }
})
ipcMain.on('window-close', () => {
  win?.close()
})

// --- Data paths ---
const DATA_PATH = path.join(app.getPath('userData'), 'trades.json')
const SETTINGS_PATH = path.join(app.getPath('userData'), 'settings.json')
const SCREENSHOTS_DIR = path.join(app.getPath('userData'), 'screenshots')

// Ensure screenshots directory exists
if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true })
}

// --- Trades IPC ---
ipcMain.handle('save-trades', async (_, trades) => {
  try {
    await fs.promises.writeFile(DATA_PATH, JSON.stringify(trades, null, 2), 'utf-8')
    return { success: true }
  } catch (error) {
    console.error('Failed to save trades:', error)
    return { success: false, error }
  }
})

ipcMain.handle('load-trades', async () => {
  try {
    if (fs.existsSync(DATA_PATH)) {
      const data = await fs.promises.readFile(DATA_PATH, 'utf-8')
      if (!data || data.trim() === '') return []
      return JSON.parse(data)
    }
    return []
  } catch (error) {
    console.error('Failed to load trades:', error)
    return []
  }
})

// --- Settings IPC ---
ipcMain.handle('save-settings', async (_, settings) => {
  try {
    await fs.promises.writeFile(SETTINGS_PATH, JSON.stringify(settings, null, 2), 'utf-8')
    return { success: true }
  } catch (error) {
    console.error('Failed to save settings:', error)
    return { success: false, error }
  }
})

ipcMain.handle('load-settings', async () => {
  try {
    if (fs.existsSync(SETTINGS_PATH)) {
      const data = await fs.promises.readFile(SETTINGS_PATH, 'utf-8')
      return JSON.parse(data)
    }
    return { commissionPerContract: 0.62 }
  } catch (error) {
    console.error('Failed to load settings:', error)
    return { commissionPerContract: 0.62 }
  }
})

// --- Screenshot IPC ---
ipcMain.handle('attach-screenshot', async (_, tradeId: string) => {
  try {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'] }],
    })

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, canceled: true }
    }

    const sourcePath = result.filePaths[0]
    const ext = path.extname(sourcePath)
    const destFilename = `${tradeId}${ext}`
    const destPath = path.join(SCREENSHOTS_DIR, destFilename)

    await fs.promises.copyFile(sourcePath, destPath)

    return { success: true, filename: destFilename }
  } catch (error) {
    console.error('Failed to attach screenshot:', error)
    return { success: false, error }
  }
})

ipcMain.handle('load-screenshot', async (_, filename: string) => {
  try {
    const filePath = path.join(SCREENSHOTS_DIR, filename)
    if (!fs.existsSync(filePath)) return null

    const data = await fs.promises.readFile(filePath)
    const ext = path.extname(filename).toLowerCase().replace('.', '')
    const mime = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`
    return `data:${mime};base64,${data.toString('base64')}`
  } catch (error) {
    console.error('Failed to load screenshot:', error)
    return null
  }
})

ipcMain.handle('delete-screenshot', async (_, filename: string) => {
  try {
    const filePath = path.join(SCREENSHOTS_DIR, filename)
    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath)
    }
    return { success: true }
  } catch (error) {
    console.error('Failed to delete screenshot:', error)
    return { success: false, error }
  }
})
// --- Database Import/Export IPC ---
ipcMain.handle('export-db', async () => {
  try {
    const result = await dialog.showSaveDialog({
      title: 'Export Trade Database',
      defaultPath: `alpha-stats-backup_${new Date().toISOString().split('T')[0]}.json`,
      filters: [{ name: 'JSON Database', extensions: ['json'] }],
    })

    if (result.canceled || !result.filePath) {
      return { success: false, canceled: true }
    }

    // Read current trades + settings and bundle them
    let trades: any[] = []
    let settings: any = {}

    if (fs.existsSync(DATA_PATH)) {
      const data = await fs.promises.readFile(DATA_PATH, 'utf-8')
      trades = JSON.parse(data)
    }
    if (fs.existsSync(SETTINGS_PATH)) {
      const data = await fs.promises.readFile(SETTINGS_PATH, 'utf-8')
      settings = JSON.parse(data)
    }

    const bundle = { version: 1, exportedAt: new Date().toISOString(), trades, settings }
    await fs.promises.writeFile(result.filePath, JSON.stringify(bundle, null, 2), 'utf-8')

    return { success: true, path: result.filePath }
  } catch (error) {
    console.error('Failed to export database:', error)
    return { success: false, error }
  }
})

ipcMain.handle('import-db', async () => {
  try {
    const result = await dialog.showOpenDialog({
      title: 'Import Trade Database',
      properties: ['openFile'],
      filters: [{ name: 'JSON Database', extensions: ['json'] }],
    })

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, canceled: true }
    }

    const data = await fs.promises.readFile(result.filePaths[0], 'utf-8')
    const parsed = JSON.parse(data)

    // Support both bundled format and raw trades array
    if (parsed.version && parsed.trades) {
      // Bundled format — restore trades + settings
      await fs.promises.writeFile(DATA_PATH, JSON.stringify(parsed.trades, null, 2), 'utf-8')
      if (parsed.settings) {
        await fs.promises.writeFile(SETTINGS_PATH, JSON.stringify(parsed.settings, null, 2), 'utf-8')
      }
      return { success: true, trades: parsed.trades, settings: parsed.settings || null }
    } else if (Array.isArray(parsed)) {
      // Raw trades array
      await fs.promises.writeFile(DATA_PATH, JSON.stringify(parsed, null, 2), 'utf-8')
      return { success: true, trades: parsed, settings: null }
    }

    return { success: false, error: 'Invalid file format' }
  } catch (error) {
    console.error('Failed to import database:', error)
    return { success: false, error }
  }
})

app.whenReady().then(createWindow)

// ═══════════════════════════════════════════════════════════════════════
//  NINJATRADER BRIDGE — HTTP Server on localhost:52525
//  Receives individual executions from AlphaCore NinjaTrader Add-on
//  and pairs entry + exit into a single complete trade.
// ═══════════════════════════════════════════════════════════════════════

const NT_PORT = 52525
const POINT_VALUE = 5  // MES Micro E-mini S&P 500
const TICK = 0.25

interface PendingEntry {
  instrument: string
  side: string
  quantity: number
  price: number
  date: string
  commission: number
  stopLoss: number
  takeProfit: number
}

const pendingEntries: PendingEntry[] = []

function startNinjaTraderBridge() {
  const server = http.createServer((req: any, res: any) => {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

    if (req.method === 'OPTIONS') {
      res.writeHead(204)
      res.end()
      return
    }

    if (req.method === 'POST' && req.url === '/api/trade') {
      let body = ''
      req.on('data', (chunk: Buffer) => { body += chunk.toString() })
      req.on('end', () => {
        try {
          const exec = JSON.parse(body)
          processExecution(exec)
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ success: true }))
        } catch (err) {
          console.error('[NT Bridge] Parse error:', err)
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ success: false, error: 'Invalid JSON' }))
        }
      })
    } else {
      res.writeHead(404)
      res.end('Not found')
    }
  })

  server.listen(NT_PORT, '127.0.0.1', () => {
    console.log(`[NT Bridge] Listening on http://127.0.0.1:${NT_PORT}/api/trade`)
  })

  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`[NT Bridge] Port ${NT_PORT} already in use. Bridge disabled.`)
    } else {
      console.error('[NT Bridge] Server error:', err)
    }
  })
}

function processExecution(exec: any) {
  const action = (exec.orderAction || '').toLowerCase()
  const qty = parseInt(exec.quantity) || 1
  const price = parseFloat(exec.price) || 0
  const commission = parseFloat(exec.commission) || 0
  const instrument = exec.instrument || 'MES'
  const date = exec.date || new Date().toISOString().split('T')[0]
  const stopLoss = parseFloat(exec.stopLoss) || 0
  const takeProfit = parseFloat(exec.takeProfit) || 0

  // Position-based matching: if no pending entry for this instrument, it's an entry.
  // If there IS a pending entry, this execution is the exit.
  const idx = pendingEntries.findIndex(e => e.instrument === instrument && e.quantity === qty)

  if (idx >= 0) {
    // EXIT: we already have a pending entry — close the trade
    const entry = pendingEntries.splice(idx, 1)[0]
    buildTrade(entry, price, commission, date)
  } else {
    // ENTRY: no pending entry for this instrument — store it
    // Determine side: Buy = Long, Sell/SellShort = Short
    const side = (action === 'sell' || action === 'sellshort') ? 'Short' : 'Long'
    pendingEntries.push({ instrument, side, quantity: qty, price, date, commission, stopLoss, takeProfit })
    console.log(`[NT Bridge] 📥 Entry stored: ${side} ${qty}x ${instrument} @ ${price}${stopLoss ? ' SL:' + stopLoss : ''}${takeProfit ? ' TP:' + takeProfit : ''}`)
  }
}

async function buildTrade(entry: PendingEntry, exitPrice: number, exitCommission: number, date: string) {
  const isLong = entry.side === 'Long'
  const points = isLong ? (exitPrice - entry.price) : (entry.price - exitPrice)
  const ticks = points / TICK
  const grossUSD = points * POINT_VALUE * entry.quantity
  const totalCommission = entry.commission + exitCommission
  const resultUSD = grossUSD - totalCommission

  const trade: any = {
    id: crypto.randomUUID(),
    isLong,
    contracts: entry.quantity,
    entryPrice: entry.price,
    exitPrice,
    points: parseFloat(points.toFixed(2)),
    ticks: parseFloat(ticks.toFixed(2)),
    grossUSD: parseFloat(grossUSD.toFixed(2)),
    commission: parseFloat(totalCommission.toFixed(2)),
    resultUSD: parseFloat(resultUSD.toFixed(2)),
    isWin: resultUSD > 0,
    date,
    createdAt: Date.now(),
    note: 'Auto-imported from NinjaTrader',
    setup: 'Other' as const
  }

  // Add SL/TP if available
  if (entry.stopLoss > 0) trade.stopLoss = entry.stopLoss
  if (entry.takeProfit > 0) trade.takeProfit = entry.takeProfit

  // Save to file
  try {
    let trades: any[] = []
    if (fs.existsSync(DATA_PATH)) {
      const data = await fs.promises.readFile(DATA_PATH, 'utf-8')
      trades = JSON.parse(data)
    }
    trades.push(trade)
    await fs.promises.writeFile(DATA_PATH, JSON.stringify(trades, null, 2), 'utf-8')

    // Notify the UI in real-time
    if (win && !win.isDestroyed()) {
      win.webContents.send('nt-trade-received', trade)
    }

    console.log(`[NT Bridge] ✓ Trade saved: ${isLong ? 'LONG' : 'SHORT'} ${entry.quantity}x | ${points > 0 ? '+' : ''}${points.toFixed(2)} pts | $${resultUSD.toFixed(2)}`)
  } catch (err) {
    console.error('[NT Bridge] Failed to save trade:', err)
  }
}

// Start the bridge when the app is ready
app.whenReady().then(() => {
  startNinjaTraderBridge()
})
