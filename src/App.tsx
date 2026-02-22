import { useState, useEffect, useRef, useCallback } from 'react'
import EquityCurve from './EquityCurve'
import Charts from './Charts'
import DrawdownChart from './DrawdownChart'
import './App.css'

const POINT_VALUE_PER_CONTRACT = 5;
const TICK_SIZE = 0.25;

const floor1Str = (val: number) => (Math.floor(val * 10) / 10).toFixed(1);
const floor1 = (val: number) => Math.floor(val * 10) / 10;
const floor2Str = (val: number) => (Math.floor(val * 100) / 100).toFixed(2);

const SETUP_TAGS = ['Breakout', 'Pullback', 'Range', 'Reversal', 'Scalp', 'Trend', 'Other'] as const;
type SetupTag = typeof SETUP_TAGS[number];

interface Trade {
  id: string;
  isLong: boolean;
  contracts: number;
  entryPrice: number;
  exitPrice: number;
  stopLoss?: number;
  takeProfit?: number;
  points: number;
  ticks: number;
  riskPoints?: number;
  rewardPoints?: number;
  grossUSD: number;
  commission: number;
  resultUSD: number;
  isWin: boolean;
  date: string;
  createdAt?: number;
  screenshotFile?: string;
  note?: string;
  setup?: SetupTag;
}

interface Stats {
  winRate: number;
  avgWinUSD: number;
  avgLossUSD: number;
  avgRR: number;
  totalUSD: number;
  expectancyUSD: number;
  profitFactor: number;
  maxDrawdown: number;
  bestTrade: number;
  worstTrade: number;
  bestDayGains: number;
  totalTrades: number;
}

const EMPTY_STATS: Stats = {
  winRate: 0, avgWinUSD: 0, avgLossUSD: 0, avgRR: 0,
  totalUSD: 0, expectancyUSD: 0, profitFactor: 0,
  maxDrawdown: 0, bestTrade: 0, worstTrade: 0,
  bestDayGains: 0, totalTrades: 0,
};

function TitleBar() {
  const handleMinimize = () => {
    if (window.ipcRenderer) window.ipcRenderer.send('window-minimize');
  };
  const handleMaximize = () => {
    if (window.ipcRenderer) window.ipcRenderer.send('window-maximize');
  };
  const handleClose = () => {
    if (window.ipcRenderer) window.ipcRenderer.send('window-close');
  };

  return (
    <div className="title-bar">
      <div className="title-bar-title">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" /></svg>
        ALPHA STATS
      </div>
      <div className="window-controls">
        <button className="window-ctrl-btn" onClick={handleMinimize} tabIndex={-1}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="4" y1="12" x2="20" y2="12" /></svg>
        </button>
        <button className="window-ctrl-btn" onClick={handleMaximize} tabIndex={-1}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /></svg>
        </button>
        <button className="window-ctrl-btn window-ctrl-close" onClick={handleClose} tabIndex={-1}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
        </button>
      </div>
    </div>
  );
}

function App() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [isLong, setIsLong] = useState<boolean>(true);
  const [contracts, setContracts] = useState<string>('1');
  const [entryPrice, setEntryPrice] = useState<string>('');
  const [exitPrice, setExitPrice] = useState<string>('');
  const [stopLossPrice, setStopLossPrice] = useState<string>('');
  const [takeProfitPrice, setTakeProfitPrice] = useState<string>('');
  const [tradeDate, setTradeDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [tradeNote, setTradeNote] = useState<string>('');
  const [tradeSetup, setTradeSetup] = useState<SetupTag>('Breakout');
  const [isLoaded, setIsLoaded] = useState<boolean>(false);
  const [commissionPerContract, setCommissionPerContract] = useState<number>(0.62);
  const [showSettings, setShowSettings] = useState(false);
  const [commissionInput, setCommissionInput] = useState<string>('0.62');
  const [sortOrder, setSortOrder] = useState<'oldest' | 'newest'>('oldest');

  // Day detail view
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [showAllTrades, setShowAllTrades] = useState(false);
  const [showAdvancedStats, setShowAdvancedStats] = useState(false);

  // Stats
  const [stats, setStats] = useState<Stats>(EMPTY_STATS);

  // Lightbox
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const lightboxRef = useRef<HTMLDivElement>(null);

  // Expanded note view
  const [expandedNote, setExpandedNote] = useState<string | null>(null);

  // Edit trade
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{
    isLong: boolean; contracts: string; entryPrice: string; exitPrice: string;
    stopLoss: string; takeProfit: string; date: string; note: string; setup: SetupTag;
  } | null>(null);

  // Load data on mount
  useEffect(() => {
    const loadData = async () => {
      if (window.ipcRenderer) {
        const savedTrades = await window.ipcRenderer.invoke('load-trades');
        if (savedTrades) setTrades(savedTrades);

        const savedSettings = await window.ipcRenderer.invoke('load-settings');
        if (savedSettings) {
          setCommissionPerContract(savedSettings.commissionPerContract ?? 0.62);
          setCommissionInput(String(savedSettings.commissionPerContract ?? 0.62));
        }
      }
      setIsLoaded(true);
    };
    loadData();
  }, []);

  // Save trades + recalculate stats
  useEffect(() => {
    const saveData = async () => {
      if (isLoaded && window.ipcRenderer) {
        await window.ipcRenderer.invoke('save-trades', trades);
      }
    };
    saveData();
    setStats(calculateStats(trades));
  }, [trades, isLoaded]);

  const saveSettings = async (commission: number) => {
    setCommissionPerContract(commission);
    if (window.ipcRenderer) {
      await window.ipcRenderer.invoke('save-settings', { commissionPerContract: commission });
    }
  };

  const handleCommissionSave = () => {
    const val = parseFloat(commissionInput);
    if (!isNaN(val) && val >= 0) {
      saveSettings(val);
      setShowSettings(false);
    }
  };

  const addTrade = useCallback(() => {
    const entry = parseFloat(entryPrice);
    const exit = parseFloat(exitPrice);
    const qty = parseInt(contracts);
    if (isNaN(entry) || isNaN(exit) || isNaN(qty) || qty <= 0) return;

    const sl = parseFloat(stopLossPrice);
    const hasSL = !isNaN(sl) && sl > 0;
    const riskPoints = hasSL ? Math.abs(entry - sl) : undefined;

    const tp = parseFloat(takeProfitPrice);
    const hasTP = !isNaN(tp) && tp > 0;
    const rewardPoints = hasTP ? Math.abs(tp - entry) : undefined;

    const pointsResult = isLong ? (exit - entry) : (entry - exit);
    const grossUSD = pointsResult * POINT_VALUE_PER_CONTRACT * qty;
    const totalCommission = commissionPerContract * qty;
    const netUSD = grossUSD - totalCommission;

    const newTrade: Trade = {
      id: Date.now().toString(),
      isLong,
      contracts: qty,
      entryPrice: entry,
      exitPrice: exit,
      stopLoss: hasSL ? sl : undefined,
      takeProfit: hasTP ? tp : undefined,
      points: pointsResult,
      ticks: pointsResult / TICK_SIZE,
      riskPoints,
      rewardPoints,
      grossUSD,
      commission: totalCommission,
      resultUSD: netUSD,
      isWin: netUSD > 0,
      date: tradeDate,
      createdAt: Date.now(),
      note: tradeNote.trim() || undefined,
      setup: tradeSetup,
    };

    const updatedTrades = [...trades, newTrade];
    setTrades(updatedTrades);
    setEntryPrice('');
    setExitPrice('');
    setStopLossPrice('');
    setTakeProfitPrice('');
    setTradeNote('');
  }, [entryPrice, exitPrice, stopLossPrice, takeProfitPrice, contracts, isLong, tradeDate, tradeNote, tradeSetup, commissionPerContract, trades]);

  // Enter key handler
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && entryPrice && exitPrice) {
      e.preventDefault();
      addTrade();
    }
  }, [addTrade, entryPrice, exitPrice]);

  const calculateStats = (trades: Trade[]): Stats => {
    if (trades.length === 0) return EMPTY_STATS;

    const wins = trades.filter(t => t.isWin);
    const losses = trades.filter(t => !t.isWin);

    const avgW = wins.length > 0 ? wins.reduce((a, t) => a + t.resultUSD, 0) / wins.length : 0;
    const avgL = losses.length > 0 ? Math.abs(losses.reduce((a, t) => a + t.resultUSD, 0) / losses.length) : 0;
    const totalWins = wins.reduce((a, t) => a + t.resultUSD, 0);
    const totalLosses = Math.abs(losses.reduce((a, t) => a + t.resultUSD, 0));

    // Profit Factor
    const profitFactor = totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? Infinity : 0;

    // Max Drawdown (from equity peak)
    const sorted = [...trades].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    let peak = 0, maxDD = 0, cumulative = 0;
    for (const t of sorted) {
      cumulative += t.resultUSD;
      if (cumulative > peak) peak = cumulative;
      const dd = peak - cumulative;
      if (dd > maxDD) maxDD = dd;
    }

    // Best / Worst trade
    const results = trades.map(t => t.resultUSD);
    const bestTrade = Math.max(...results);
    const worstTrade = Math.min(...results);

    // Best day gains: sum of all winning trades per day, take the max
    const dayMap: Record<string, number> = {};
    for (const t of trades) {
      if (t.isWin) {
        dayMap[t.date] = (dayMap[t.date] || 0) + t.resultUSD;
      }
    }
    const bestDayGains = Object.values(dayMap).length > 0 ? Math.max(...Object.values(dayMap)) : 0;

    const probWin = wins.length / trades.length;
    const probLoss = 1 - probWin;

    // R:R using planned risk/reward if available, otherwise fallback
    const tradesWithSL = trades.filter(t => t.riskPoints && t.riskPoints > 0);
    let totalRR = 0;
    let rrCount = 0;
    let avgRR = 0;

    if (tradesWithSL.length > 0) {
      for (const t of trades) {
        if (t.riskPoints && t.riskPoints > 0) {
          let rr = 0;
          if (t.rewardPoints && t.rewardPoints > 0) {
            rr = t.rewardPoints / t.riskPoints;
          } else {
            rr = Math.abs(t.points) / t.riskPoints;
          }
          totalRR += floor1(rr);
          rrCount++;
        }
      }
      avgRR = rrCount > 0 ? (totalRR / rrCount) : 0;
    } else {
      avgRR = avgL !== 0 ? avgW / avgL : 0;
    }

    return {
      winRate: (wins.length / trades.length) * 100,
      avgWinUSD: avgW,
      avgLossUSD: avgL,
      avgRR,
      totalUSD: trades.reduce((a, t) => a + t.resultUSD, 0),
      expectancyUSD: (probWin * avgW) - (probLoss * avgL),
      profitFactor: profitFactor === Infinity ? 999 : profitFactor,
      maxDrawdown: maxDD,
      bestTrade,
      worstTrade,
      bestDayGains,
      totalTrades: trades.length,
    };
  };

  const deleteTrade = (id: string) => {
    if (window.confirm('Are you sure you want to delete this trade?')) {
      const trade = trades.find(t => t.id === id);
      if (trade?.screenshotFile && window.ipcRenderer) {
        window.ipcRenderer.invoke('delete-screenshot', trade.screenshotFile);
      }
      setTrades(trades.filter(tr => tr.id !== id));
    }
  };

  const attachScreenshot = async (tradeId: string) => {
    if (!window.ipcRenderer) return;
    const result = await window.ipcRenderer.invoke('attach-screenshot', tradeId);
    if (result.success && result.filename) {
      setTrades(prev => prev.map(t =>
        t.id === tradeId ? { ...t, screenshotFile: result.filename } : t
      ));
    }
  };

  const viewScreenshot = async (filename: string) => {
    if (!window.ipcRenderer) return;
    const dataUrl = await window.ipcRenderer.invoke('load-screenshot', filename);
    if (dataUrl) setLightboxSrc(dataUrl);
  };

  const startEdit = (t: Trade) => {
    if (editingId === t.id) {
      cancelEdit();
      return;
    }
    setEditingId(t.id);
    setEditForm({
      isLong: t.isLong,
      contracts: String(t.contracts),
      entryPrice: String(t.entryPrice),
      exitPrice: String(t.exitPrice),
      stopLoss: t.stopLoss ? String(t.stopLoss) : '',
      takeProfit: t.takeProfit ? String(t.takeProfit) : '',
      date: t.date,
      note: t.note || '',
      setup: (t.setup as SetupTag) || 'Breakout',
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm(null);
  };

  const saveEdit = () => {
    if (!editingId || !editForm) return;
    const entry = parseFloat(editForm.entryPrice);
    const exit = parseFloat(editForm.exitPrice);
    const qty = parseInt(editForm.contracts);
    if (isNaN(entry) || isNaN(exit) || isNaN(qty) || qty <= 0) return;

    const sl = parseFloat(editForm.stopLoss);
    const hasSL = !isNaN(sl) && sl > 0;
    const riskPoints = hasSL ? Math.abs(entry - sl) : undefined;

    const tp = parseFloat(editForm.takeProfit);
    const hasTP = !isNaN(tp) && tp > 0;
    const rewardPoints = hasTP ? Math.abs(tp - entry) : undefined;

    const pointsResult = editForm.isLong ? (exit - entry) : (entry - exit);
    const grossUSD = pointsResult * POINT_VALUE_PER_CONTRACT * qty;
    const totalCommission = commissionPerContract * qty;
    const netUSD = grossUSD - totalCommission;

    setTrades(prev => prev.map(t => t.id === editingId ? {
      ...t,
      isLong: editForm.isLong,
      contracts: qty,
      entryPrice: entry,
      exitPrice: exit,
      stopLoss: hasSL ? sl : undefined,
      takeProfit: hasTP ? tp : undefined,
      points: pointsResult,
      ticks: pointsResult / TICK_SIZE,
      riskPoints,
      rewardPoints,
      grossUSD,
      commission: totalCommission,
      resultUSD: netUSD,
      isWin: netUSD > 0,
      date: editForm.date,
      note: editForm.note.trim() || undefined,
      setup: editForm.setup,
    } : t));
    cancelEdit();
  };

  const exportCSV = () => {
    const headers = ['Date', 'Type', 'Contracts', 'Entry', 'Exit', 'Stop Loss', 'Take Profit', 'Risk Pts', 'Reward Pts', 'Points', 'Ticks', 'Gross USD', 'Commission', 'Net USD', 'Setup', 'Note'];
    const rows = trades.map(t => [
      t.date,
      t.isLong ? 'LONG' : 'SHORT',
      t.contracts,
      t.entryPrice.toFixed(2),
      t.exitPrice.toFixed(2),
      t.stopLoss?.toFixed(2) ?? '',
      t.takeProfit?.toFixed(2) ?? '',
      t.riskPoints?.toFixed(2) ?? '',
      t.rewardPoints?.toFixed(2) ?? '',
      t.points.toFixed(2),
      t.ticks.toFixed(0),
      t.grossUSD.toFixed(2),
      t.commission.toFixed(2),
      t.resultUSD.toFixed(2),
      t.setup || '',
      `"${(t.note || '').replace(/"/g, '""')}"`,
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `MES_trades_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportDB = async () => {
    if (!window.ipcRenderer) return;
    await window.ipcRenderer.invoke('export-db');
  };

  const importDB = async () => {
    if (!window.ipcRenderer) return;
    const result = await window.ipcRenderer.invoke('import-db');
    if (result.success) {
      if (result.trades) setTrades(result.trades);
      if (result.settings) {
        setCommissionPerContract(result.settings.commissionPerContract ?? 0.62);
        setCommissionInput(String(result.settings.commissionPerContract ?? 0.62));
      }
    }
  };

  const getContractsQty = () => {
    const qty = parseInt(contracts);
    return isNaN(qty) ? 0 : qty;
  };

  const formatUSD = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

  const previewPts = () => {
    const e = parseFloat(entryPrice), ex = parseFloat(exitPrice);
    return (isNaN(e) || isNaN(ex)) ? 0 : (isLong ? (ex - e) : (e - ex));
  };

  const previewNet = () => {
    const pts = previewPts();
    const qty = getContractsQty();
    const gross = pts * POINT_VALUE_PER_CONTRACT * qty;
    return gross - (commissionPerContract * qty);
  };

  const formatDateLabel = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year.slice(2)}`;
  };

  const formatDayFull = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    const d = new Date(dateStr + 'T12:00:00');
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  };

  const sortedTrades = [...trades].sort((a, b) => {
    const ta = a.createdAt || parseInt(a.id) || new Date(a.date).getTime();
    const tb = b.createdAt || parseInt(b.id) || new Date(b.date).getTime();
    return sortOrder === 'oldest' ? ta - tb : tb - ta;
  });

  // Group trades by day
  const tradesByDay = trades.reduce<Record<string, Trade[]>>((acc, t) => {
    if (!acc[t.date]) acc[t.date] = [];
    acc[t.date].push(t);
    return acc;
  }, {});

  const sortedDays = Object.keys(tradesByDay).sort((a, b) => {
    return sortOrder === 'oldest'
      ? new Date(a).getTime() - new Date(b).getTime()
      : new Date(b).getTime() - new Date(a).getTime();
  });

  const selectedDayTrades = selectedDay ? (tradesByDay[selectedDay] || []) : [];
  const selectedDayStats = selectedDay ? calculateStats(selectedDayTrades) : EMPTY_STATS;
  const selectedDaySorted = [...selectedDayTrades].sort((a, b) => {
    const ta = a.createdAt || parseInt(a.id) || 0;
    const tb = b.createdAt || parseInt(b.id) || 0;
    return ta - tb;
  });

  return (
    <>
      <TitleBar />
      <div className="app-container" onKeyDown={handleKeyDown}>
        <div className="main-layout">

          {/* Left Panel */}
          <div className="card left-panel">
            <div className="header">
              <h1>ALPHA CORE</h1>
              <p>Trading Journal · MES Futures</p>
            </div>

            <div className="input-group">
              <label>Type</label>
              <div className="outcome-selector">
                <button className={`outcome-btn ${isLong ? 'active' : ''}`} style={isLong ? { color: '#38bdf8', borderColor: '#38bdf8' } : {}} onClick={() => setIsLong(true)}>LONG</button>
                <button className={`outcome-btn ${!isLong ? 'active' : ''}`} style={!isLong ? { color: '#f472b6', borderColor: '#f472b6' } : {}} onClick={() => setIsLong(false)}>SHORT</button>
              </div>
            </div>

            <div className="input-row">
              <div className="input-group">
                <label>Date</label>
                <input type="date" value={tradeDate} onChange={(e) => setTradeDate(e.target.value)} />
              </div>
              <div className="input-group">
                <label>Contracts</label>
                <input type="number" value={contracts} onChange={(e) => setContracts(e.target.value)} />
              </div>
            </div>

            <div className="input-row input-row-4">
              <div className="input-group">
                <label>Entry</label>
                <input type="number" step="0.25" placeholder="0.00" value={entryPrice} onChange={(e) => setEntryPrice(e.target.value)} />
              </div>
              <div className="input-group">
                <label>Exit</label>
                <input type="number" step="0.25" placeholder="0.00" value={exitPrice} onChange={(e) => setExitPrice(e.target.value)} />
              </div>
              <div className="input-group">
                <label>SL</label>
                <input type="number" step="0.25" placeholder="—" value={stopLossPrice} onChange={(e) => setStopLossPrice(e.target.value)} className="sl-input" />
              </div>
              <div className="input-group">
                <label>TP</label>
                <input type="number" step="0.25" placeholder="—" value={takeProfitPrice} onChange={(e) => setTakeProfitPrice(e.target.value)} className="tp-input" />
              </div>
            </div>

            {/* Setup Tag Selector */}
            <div className="input-group">
              <label>Setup</label>
              <div className="setup-tags">
                {SETUP_TAGS.map(tag => (
                  <button
                    key={tag}
                    className={`setup-tag ${tradeSetup === tag ? 'active' : ''}`}
                    onClick={() => setTradeSetup(tag)}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            {/* Trade Note */}
            <div className="input-group">
              <label>Note</label>
              <textarea
                className="trade-note-input"
                placeholder="Entry reason, emotions, observations..."
                value={tradeNote}
                onChange={(e) => setTradeNote(e.target.value)}
                rows={2}
              />
            </div>

            <div className="preview-box">
              <span style={{ fontSize: '0.72rem', color: '#64748b' }}>NET USD PREVIEW</span>
              <div style={{ fontSize: '1.4rem', fontWeight: '800', color: previewNet() >= 0 ? '#10b981' : '#ef4444' }}>
                {formatUSD(previewNet())}
              </div>
              <div style={{ fontSize: '0.85rem', opacity: 0.8 }}>
                {previewPts() > 0 ? '+' : ''}{previewPts().toFixed(2)} pts | {(previewPts() / TICK_SIZE).toFixed(0)} ticks
              </div>
              <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>
                Commission: {formatUSD(commissionPerContract * getContractsQty())}
              </div>
            </div>

            <button className="btn-primary" onClick={addTrade} disabled={!entryPrice || !exitPrice} title="Log Trade (ENTER ↵)">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
              <span style={{ fontSize: '1rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Log Trade</span>
            </button>

            <div className="left-panel-bottom">
              {/* Commission config toggle */}
              <button className="btn-settings" onClick={() => setShowSettings(!showSettings)}>
                ⚙ Commission: {formatUSD(commissionPerContract)}/contract
              </button>

              {showSettings && (
                <div className="settings-dropdown">
                  <label>Commission per contract (USD)</label>
                  <div className="settings-row">
                    <input
                      type="number"
                      step="0.01"
                      value={commissionInput}
                      onChange={(e) => setCommissionInput(e.target.value)}
                    />
                    <button className="btn-save-settings" onClick={handleCommissionSave}>Save</button>
                  </div>
                </div>
              )}

              <div className="db-actions">
                <button className="btn-db" onClick={exportDB} title="Export backup">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
                  Export
                </button>
                <button className="btn-db" onClick={importDB} title="Import backup">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                  Import
                </button>
              </div>
            </div>
          </div>

          {/* Right Panel */}
          <div className="card right-panel">
            {/* Stats switch: show day stats when a day is selected */}
            {(() => {
              const displayStats = (selectedDay && !showAllTrades) ? selectedDayStats : stats; return (<>
                {/* Top Hero Row */}
                <div className="hero-row">
                  <div className={`expectancy-hero ${displayStats.expectancyUSD >= 0 ? 'positive' : 'negative'}`}>
                    <div className="stat-label">{selectedDay ? 'Day Expectancy' : 'Mathematical Expectancy per Trade'}</div>
                    <div style={{ fontSize: '2rem', fontWeight: '900' }}>{displayStats.expectancyUSD >= 0 ? '+' : ''}{formatUSD(displayStats.expectancyUSD)}</div>
                    <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>{selectedDay ? formatDayFull(selectedDay) : 'Net after commissions'}</div>
                  </div>
                  <div className="balance-hero">
                    <div className="stat-label">{selectedDay ? 'Day P&L' : 'Net Balance'}</div>
                    <div style={{ fontSize: '2rem', fontWeight: '900', color: displayStats.totalUSD >= 0 ? '#10b981' : '#ef4444' }}>{formatUSD(displayStats.totalUSD)}</div>
                    <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>{selectedDay ? `${displayStats.totalTrades} trade${displayStats.totalTrades !== 1 ? 's' : ''}` : 'After commissions'}</div>
                  </div>
                </div>

                {/* Stats Row 1 */}
                <div className="stats-grid">
                  <div className="stat-box" style={{ '--theme-color': '#38bdf8' } as React.CSSProperties}>
                    <div className="stat-label"><div className="stat-pulse-dot"></div> Win Rate</div>
                    <div className="stat-value" style={{ color: '#38bdf8' }}>{displayStats.winRate.toFixed(1)}%</div>
                  </div>
                  <div className="stat-box" style={{ '--theme-color': '#10b981' } as React.CSSProperties}>
                    <div className="stat-label"><div className="stat-pulse-dot"></div> Avg Win</div>
                    <div className="stat-value" style={{ color: '#10b981' }}>{formatUSD(displayStats.avgWinUSD)}</div>
                  </div>
                  <div className="stat-box" style={{ '--theme-color': '#ef4444' } as React.CSSProperties}>
                    <div className="stat-label"><div className="stat-pulse-dot"></div> Avg Loss</div>
                    <div className="stat-value" style={{ color: '#ef4444' }}>{formatUSD(displayStats.avgLossUSD)}</div>
                  </div>
                  <div className="stat-box" style={{ '--theme-color': '#a855f7' } as React.CSSProperties}>
                    <div className="stat-label"><div className="stat-pulse-dot"></div> R:R</div>
                    <div className="stat-value" style={{ color: '#a855f7' }}>1:{floor2Str(displayStats.avgRR)}</div>
                  </div>
                  <div className="stat-box" style={{ '--theme-color': '#6366f1' } as React.CSSProperties}>
                    <div className="stat-label"><div className="stat-pulse-dot"></div> Trades</div>
                    <div className="stat-value" style={{ color: '#6366f1' }}>{displayStats.totalTrades}</div>
                  </div>
                </div>

                {/* Toggle button for advanced stats */}
                <button className="btn-toggle-stats" onClick={() => setShowAdvancedStats(!showAdvancedStats)}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`toggle-chevron ${showAdvancedStats ? 'open' : ''}`}>
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                  {showAdvancedStats ? 'Hide' : 'More'} Stats
                </button>

                {/* Stats Row 2: Advanced (collapsible) */}
                <div className={`stats-collapsible ${showAdvancedStats ? 'expanded' : ''}`}>
                  <div className="stats-grid stats-grid-secondary">
                    <div className="stat-box" style={{ '--theme-color': '#f59e0b' } as React.CSSProperties}>
                      <div className="stat-label"><div className="stat-pulse-dot"></div> Profit Factor</div>
                      <div className="stat-value" style={{ color: '#f59e0b' }}>
                        {displayStats.profitFactor >= 999 ? '∞' : displayStats.profitFactor.toFixed(2)}
                      </div>
                    </div>
                    <div className="stat-box" style={{ '--theme-color': '#f43f5e' } as React.CSSProperties}>
                      <div className="stat-label"><div className="stat-pulse-dot"></div> Max Drawdown</div>
                      <div className="stat-value" style={{ color: '#f43f5e' }}>{formatUSD(displayStats.maxDrawdown)}</div>
                    </div>
                    <div className="stat-box" style={{ '--theme-color': '#2dd4bf' } as React.CSSProperties}>
                      <div className="stat-label"><div className="stat-pulse-dot"></div> Best Trade</div>
                      <div className="stat-value" style={{ color: '#2dd4bf' }}>{formatUSD(displayStats.bestTrade)}</div>
                    </div>
                    <div className="stat-box" style={{ '--theme-color': '#ef4444' } as React.CSSProperties}>
                      <div className="stat-label"><div className="stat-pulse-dot"></div> Worst Trade</div>
                      <div className="stat-value" style={{ color: '#ef4444' }}>{formatUSD(displayStats.worstTrade)}</div>
                    </div>
                    <div className="stat-box" style={{ '--theme-color': '#10b981' } as React.CSSProperties}>
                      <div className="stat-label"><div className="stat-pulse-dot"></div> Best Day</div>
                      <div className="stat-value" style={{ color: '#10b981' }}>
                        {displayStats.bestDayGains > 0 ? formatUSD(displayStats.bestDayGains) : '—'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Charts Row */}
                <div className="charts-row">
                  <Charts trades={(selectedDay && !showAllTrades) ? selectedDayTrades : trades} />
                  <div className="mini-chart-box" style={{ flex: 2 }}>
                    <span className="mini-chart-title">Equity Curve</span>
                    <EquityCurve trades={(selectedDay && !showAllTrades) ? selectedDayTrades : trades} inline />
                  </div>
                  <div className="mini-chart-box" style={{ flex: 2 }}>
                    <span className="mini-chart-title">Drawdown</span>
                    <DrawdownChart trades={(selectedDay && !showAllTrades) ? selectedDaySorted : sortedTrades} />
                  </div>
                </div>
              </>);
            })()}

            <div className="trades-container">
              <div className="trades-header">
                <h3>
                  {(selectedDay || showAllTrades) ? (
                    <button className="btn-back-day" onClick={() => { setSelectedDay(null); setShowAllTrades(false); setEditingId(null); setExpandedNote(null); }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
                    </button>
                  ) : null}
                  {showAllTrades ? 'All Trades' : selectedDay ? formatDayFull(selectedDay) : 'Micro E-mini S&P 500 Trade Log'}
                </h3>
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  <button
                    className="btn-export"
                    onClick={() => setSortOrder(prev => prev === 'newest' ? 'oldest' : 'newest')}
                    title="Toggle sort order"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      {sortOrder === 'newest' ? (
                        <><line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" /></>
                      ) : (
                        <><line x1="12" y1="5" x2="12" y2="19" /><polyline points="19 12 12 19 5 12" /></>
                      )}
                    </svg>
                    {sortOrder === 'newest' ? 'Newest' : 'Oldest'} First
                  </button>
                  {!selectedDay && !showAllTrades && trades.length > 0 && (
                    <button className="btn-export btn-all-trades" onClick={() => { setShowAllTrades(true); setEditingId(null); setExpandedNote(null); }} title="View all trades">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></svg>
                      All
                    </button>
                  )}
                  {trades.length > 0 && (
                    <button className="btn-export" onClick={exportCSV} title="Export CSV">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                      CSV
                    </button>
                  )}
                </div>
              </div>

              {/* === DAY CARDS GRID VIEW === */}
              {!selectedDay && !showAllTrades && (
                <div className="day-cards-grid">
                  {sortedDays.map(day => {
                    const dayTrades = tradesByDay[day];
                    const dayPnL = dayTrades.reduce((sum, t) => sum + t.resultUSD, 0);
                    const dayWins = dayTrades.filter(t => t.isWin).length;
                    const dayWinRate = (dayWins / dayTrades.length) * 100;
                    const isProfit = dayPnL >= 0;
                    const dayPoints = dayTrades.reduce((sum, t) => sum + t.points, 0);

                    return (
                      <div
                        key={day}
                        className={`day-card ${isProfit ? 'day-card-profit' : 'day-card-loss'}`}
                        onClick={() => { setSelectedDay(day); setShowAllTrades(false); setEditingId(null); setExpandedNote(null); }}
                      >
                        <div className="day-card-header">
                          <span className="day-card-date">{formatDateLabel(day)}</span>
                          <span className={`day-card-badge ${isProfit ? 'badge-profit' : 'badge-loss'}`}>
                            {isProfit ? '▲' : '▼'}
                          </span>
                        </div>
                        <div className="day-card-pnl" style={{ color: isProfit ? '#10b981' : '#ef4444' }}>
                          {isProfit ? '+' : ''}{formatUSD(dayPnL)}
                        </div>
                        <div className="day-card-meta">
                          <span>{dayTrades.length} trade{dayTrades.length !== 1 ? 's' : ''}</span>
                          <span className="day-card-separator">·</span>
                          <span style={{ color: dayWinRate >= 50 ? '#34d399' : '#f87171' }}>{dayWinRate.toFixed(0)}% WR</span>
                        </div>
                        <div className="day-card-pts">
                          {dayPoints > 0 ? '+' : ''}{dayPoints.toFixed(2)} pts
                        </div>
                        <div className="day-card-bar">
                          <div
                            className="day-card-bar-fill"
                            style={{
                              width: `${dayWinRate}%`,
                              background: isProfit
                                ? 'linear-gradient(90deg, #10b981, #34d399)'
                                : 'linear-gradient(90deg, #ef4444, #f87171)',
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                  {trades.length === 0 && (
                    <div style={{ textAlign: 'center', color: '#475569', marginTop: '2rem', fontSize: '0.8rem', gridColumn: '1 / -1' }}>
                      No trades logged yet.
                    </div>
                  )}
                </div>
              )}

              {/* === ALL TRADES VIEW === */}
              {showAllTrades && !selectedDay && (
                <div className="day-detail-view">
                  <div className="trades-list">
                    {sortedTrades.map(t => (
                      <div key={t.id} className={`trade-row ${expandedNote === t.id ? 'expanded' : ''}`}>
                        <div className="trade-row-main">
                          <span className="trade-date-col">{formatDateLabel(t.date)}</span>
                          <span className="trade-type" style={{ color: t.isLong ? '#38bdf8' : '#f472b6' }}>
                            {t.isLong ? 'LONG' : 'SHORT'} x{t.contracts}
                          </span>
                          <span className="trade-prices">{t.entryPrice.toFixed(2)} → {t.exitPrice.toFixed(2)}</span>
                          {t.setup && <span className="trade-setup-badge">{t.setup}</span>}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end' }}>
                            {t.riskPoints && t.rewardPoints ? (
                              <span className="trade-rr-badge" title={`Planned R:R (TP/SL) | Actual R:R 1:${floor1Str(Math.abs(t.points) / t.riskPoints)}`}>
                                Plan 1:{floor1Str(t.rewardPoints / t.riskPoints)}
                              </span>
                            ) : t.riskPoints ? (
                              <span className="trade-rr-badge" title="Risk:Reward">1:{floor1Str(Math.abs(t.points) / t.riskPoints)}</span>
                            ) : null}
                            <span className="trade-pts" style={{ color: t.isWin ? '#34d399' : '#f87171' }}>
                              {t.points > 0 ? '+' : ''}{t.points.toFixed(2)} pts
                            </span>
                          </div>
                          <span className="trade-usd">{formatUSD(t.resultUSD)}</span>
                          <span className="trade-actions">
                            {(t.note) && (
                              <button className="screenshot-btn" onClick={() => setExpandedNote(expandedNote === t.id ? null : t.id)} title="View note">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>
                              </button>
                            )}
                            {t.screenshotFile ? (
                              <>
                                <button className="screenshot-btn has-img" onClick={() => viewScreenshot(t.screenshotFile!)} title="View screenshot">
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                                </button>
                                <button className="screenshot-btn" onClick={() => attachScreenshot(t.id)} title="Change image">
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" /></svg>
                                </button>
                              </>
                            ) : (
                              <button className="screenshot-btn" onClick={() => attachScreenshot(t.id)} title="Attach image">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" /></svg>
                              </button>
                            )}
                            <button className="edit-btn" onClick={() => startEdit(t)} title="Edit trade">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="5" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="19" cy="12" r="1.5" /></svg>
                            </button>
                            <button className="delete-btn" onClick={() => deleteTrade(t.id)}>✕</button>
                          </span>
                        </div>
                        {expandedNote === t.id && t.note && (
                          <div className="trade-note-expanded">{t.note}</div>
                        )}
                        {editingId === t.id && editForm && (
                          <div className="trade-edit-form">
                            <div className="edit-row">
                              <div className="edit-field">
                                <label>Type</label>
                                <div className="outcome-selector">
                                  <button className={`outcome-btn ${editForm.isLong ? 'active' : ''}`} style={editForm.isLong ? { color: '#38bdf8', borderColor: '#38bdf8' } : {}} onClick={() => setEditForm({ ...editForm, isLong: true })}>LONG</button>
                                  <button className={`outcome-btn ${!editForm.isLong ? 'active' : ''}`} style={!editForm.isLong ? { color: '#f472b6', borderColor: '#f472b6' } : {}} onClick={() => setEditForm({ ...editForm, isLong: false })}>SHORT</button>
                                </div>
                              </div>
                              <div className="edit-field">
                                <label>Date</label>
                                <input type="date" value={editForm.date} onChange={e => setEditForm({ ...editForm, date: e.target.value })} />
                              </div>
                              <div className="edit-field">
                                <label>Contracts</label>
                                <input type="number" value={editForm.contracts} onChange={e => setEditForm({ ...editForm, contracts: e.target.value })} />
                              </div>
                            </div>
                            <div className="edit-row">
                              <div className="edit-field">
                                <label>Entry</label>
                                <input type="number" step="0.25" value={editForm.entryPrice} onChange={e => setEditForm({ ...editForm, entryPrice: e.target.value })} />
                              </div>
                              <div className="edit-field">
                                <label>Exit</label>
                                <input type="number" step="0.25" value={editForm.exitPrice} onChange={e => setEditForm({ ...editForm, exitPrice: e.target.value })} />
                              </div>
                              <div className="edit-field">
                                <label>SL</label>
                                <input type="number" step="0.25" value={editForm.stopLoss} onChange={e => setEditForm({ ...editForm, stopLoss: e.target.value })} placeholder="—" />
                              </div>
                              <div className="edit-field">
                                <label>TP</label>
                                <input type="number" step="0.25" value={editForm.takeProfit} onChange={e => setEditForm({ ...editForm, takeProfit: e.target.value })} placeholder="—" />
                              </div>
                            </div>
                            <div className="edit-row">
                              <div className="edit-field">
                                <label>Setup</label>
                                <select value={editForm.setup} onChange={e => setEditForm({ ...editForm, setup: e.target.value as SetupTag })}>
                                  {SETUP_TAGS.map(tag => <option key={tag} value={tag}>{tag}</option>)}
                                </select>
                              </div>
                            </div>
                            <div className="edit-row">
                              <div className="edit-field" style={{ flex: 1 }}>
                                <label>Note</label>
                                <input type="text" value={editForm.note} onChange={e => setEditForm({ ...editForm, note: e.target.value })} placeholder="Entry reason, observations..." />
                              </div>
                            </div>
                            <div className="edit-actions">
                              <button className="btn-edit-save" onClick={saveEdit}>Save Changes</button>
                              <button className="btn-edit-cancel" onClick={cancelEdit}>Cancel</button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* === DAY DETAIL VIEW === */}
              {selectedDay && (
                <div className="day-detail-view">
                  {/* Trades list for the day */}
                  <div className="trades-list">
                    {selectedDaySorted.map((t, idx) => (
                      <div key={t.id} className={`trade-row ${expandedNote === t.id ? 'expanded' : ''}`}>
                        <div className="trade-row-main">
                          <span className="trade-index">#{idx + 1}</span>
                          <span className="trade-type" style={{ color: t.isLong ? '#38bdf8' : '#f472b6' }}>
                            {t.isLong ? 'LONG' : 'SHORT'} x{t.contracts}
                          </span>
                          <span className="trade-prices">{t.entryPrice.toFixed(2)} → {t.exitPrice.toFixed(2)}</span>
                          {t.setup && <span className="trade-setup-badge">{t.setup}</span>}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end' }}>
                            {t.riskPoints && t.rewardPoints ? (
                              <span className="trade-rr-badge" title={`Planned R:R (TP/SL) | Actual R:R 1:${floor1Str(Math.abs(t.points) / t.riskPoints)}`}>
                                Plan 1:{floor1Str(t.rewardPoints / t.riskPoints)}
                              </span>
                            ) : t.riskPoints ? (
                              <span className="trade-rr-badge" title="Risk:Reward">1:{floor1Str(Math.abs(t.points) / t.riskPoints)}</span>
                            ) : null}
                            <span className="trade-pts" style={{ color: t.isWin ? '#34d399' : '#f87171' }}>
                              {t.points > 0 ? '+' : ''}{t.points.toFixed(2)} pts
                            </span>
                          </div>
                          <span className="trade-usd">{formatUSD(t.resultUSD)}</span>
                          <span className="trade-actions">
                            {(t.note) && (
                              <button className="screenshot-btn" onClick={() => setExpandedNote(expandedNote === t.id ? null : t.id)} title="View note">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>
                              </button>
                            )}
                            {t.screenshotFile ? (
                              <>
                                <button className="screenshot-btn has-img" onClick={() => viewScreenshot(t.screenshotFile!)} title="View screenshot">
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                                </button>
                                <button className="screenshot-btn" onClick={() => attachScreenshot(t.id)} title="Change image">
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" /></svg>
                                </button>
                              </>
                            ) : (
                              <button className="screenshot-btn" onClick={() => attachScreenshot(t.id)} title="Attach image">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" /></svg>
                              </button>
                            )}
                            <button className="edit-btn" onClick={() => startEdit(t)} title="Edit trade">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="5" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="19" cy="12" r="1.5" /></svg>
                            </button>
                            <button className="delete-btn" onClick={() => deleteTrade(t.id)}>✕</button>
                          </span>
                        </div>
                        {expandedNote === t.id && t.note && (
                          <div className="trade-note-expanded">{t.note}</div>
                        )}
                        {editingId === t.id && editForm && (
                          <div className="trade-edit-form">
                            <div className="edit-row">
                              <div className="edit-field">
                                <label>Type</label>
                                <div className="outcome-selector">
                                  <button className={`outcome-btn ${editForm.isLong ? 'active' : ''}`} style={editForm.isLong ? { color: '#38bdf8', borderColor: '#38bdf8' } : {}} onClick={() => setEditForm({ ...editForm, isLong: true })}>LONG</button>
                                  <button className={`outcome-btn ${!editForm.isLong ? 'active' : ''}`} style={!editForm.isLong ? { color: '#f472b6', borderColor: '#f472b6' } : {}} onClick={() => setEditForm({ ...editForm, isLong: false })}>SHORT</button>
                                </div>
                              </div>
                              <div className="edit-field">
                                <label>Date</label>
                                <input type="date" value={editForm.date} onChange={e => setEditForm({ ...editForm, date: e.target.value })} />
                              </div>
                              <div className="edit-field">
                                <label>Contracts</label>
                                <input type="number" value={editForm.contracts} onChange={e => setEditForm({ ...editForm, contracts: e.target.value })} />
                              </div>
                            </div>
                            <div className="edit-row">
                              <div className="edit-field">
                                <label>Entry</label>
                                <input type="number" step="0.25" value={editForm.entryPrice} onChange={e => setEditForm({ ...editForm, entryPrice: e.target.value })} />
                              </div>
                              <div className="edit-field">
                                <label>Exit</label>
                                <input type="number" step="0.25" value={editForm.exitPrice} onChange={e => setEditForm({ ...editForm, exitPrice: e.target.value })} />
                              </div>
                              <div className="edit-field">
                                <label>SL</label>
                                <input type="number" step="0.25" value={editForm.stopLoss} onChange={e => setEditForm({ ...editForm, stopLoss: e.target.value })} placeholder="—" />
                              </div>
                              <div className="edit-field">
                                <label>TP</label>
                                <input type="number" step="0.25" value={editForm.takeProfit} onChange={e => setEditForm({ ...editForm, takeProfit: e.target.value })} placeholder="—" />
                              </div>
                            </div>
                            <div className="edit-row">
                              <div className="edit-field">
                                <label>Setup</label>
                                <select value={editForm.setup} onChange={e => setEditForm({ ...editForm, setup: e.target.value as SetupTag })}>
                                  {SETUP_TAGS.map(tag => <option key={tag} value={tag}>{tag}</option>)}
                                </select>
                              </div>
                            </div>
                            <div className="edit-row">
                              <div className="edit-field" style={{ flex: 1 }}>
                                <label>Note</label>
                                <input type="text" value={editForm.note} onChange={e => setEditForm({ ...editForm, note: e.target.value })} placeholder="Entry reason, observations..." />
                              </div>
                            </div>
                            <div className="edit-actions">
                              <button className="btn-edit-save" onClick={saveEdit}>Save Changes</button>
                              <button className="btn-edit-cancel" onClick={cancelEdit}>Cancel</button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Lightbox Modal */}
        {lightboxSrc && (
          <div className="lightbox-overlay" ref={lightboxRef} onClick={(e) => { if (e.target === lightboxRef.current) setLightboxSrc(null); }}>
            <div className="lightbox-content">
              <button className="lightbox-close" onClick={() => setLightboxSrc(null)}>✕</button>
              <img src={lightboxSrc} alt="Trade Screenshot" />
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default App;
