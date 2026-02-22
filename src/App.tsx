import { useState, useEffect, useRef, useCallback } from 'react'
import EquityCurve from './EquityCurve'
import './App.css'

const POINT_VALUE_PER_CONTRACT = 5;
const TICK_SIZE = 0.25;

const SETUP_TAGS = ['Breakout', 'Pullback', 'Range', 'Reversal', 'Scalp', 'Trend', 'Other'] as const;
type SetupTag = typeof SETUP_TAGS[number];

interface Trade {
  id: string;
  isLong: boolean;
  contracts: number;
  entryPrice: number;
  exitPrice: number;
  points: number;
  ticks: number;
  grossUSD: number;
  commission: number;
  resultUSD: number;
  isWin: boolean;
  date: string;
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
  currentStreak: number; // positive = win streak, negative = loss streak
  totalTrades: number;
}

const EMPTY_STATS: Stats = {
  winRate: 0, avgWinUSD: 0, avgLossUSD: 0, avgRR: 0,
  totalUSD: 0, expectancyUSD: 0, profitFactor: 0,
  maxDrawdown: 0, bestTrade: 0, worstTrade: 0,
  currentStreak: 0, totalTrades: 0,
};

function App() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [isLong, setIsLong] = useState<boolean>(true);
  const [contracts, setContracts] = useState<string>('1');
  const [entryPrice, setEntryPrice] = useState<string>('');
  const [exitPrice, setExitPrice] = useState<string>('');
  const [tradeDate, setTradeDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [tradeNote, setTradeNote] = useState<string>('');
  const [tradeSetup, setTradeSetup] = useState<SetupTag>('Breakout');
  const [isLoaded, setIsLoaded] = useState<boolean>(false);
  const [commissionPerContract, setCommissionPerContract] = useState<number>(0.62);
  const [showSettings, setShowSettings] = useState(false);
  const [commissionInput, setCommissionInput] = useState<string>('0.62');

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
    date: string; note: string; setup: SetupTag;
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
      points: pointsResult,
      ticks: pointsResult / TICK_SIZE,
      grossUSD,
      commission: totalCommission,
      resultUSD: netUSD,
      isWin: netUSD > 0,
      date: tradeDate,
      note: tradeNote.trim() || undefined,
      setup: tradeSetup,
    };

    const updatedTrades = [newTrade, ...trades].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    setTrades(updatedTrades);
    setEntryPrice('');
    setExitPrice('');
    setTradeNote('');
  }, [entryPrice, exitPrice, contracts, isLong, tradeDate, tradeNote, tradeSetup, commissionPerContract, trades]);

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

    // Current streak
    const sortedDesc = [...trades].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    let streak = 0;
    if (sortedDesc.length > 0) {
      const firstIsWin = sortedDesc[0].isWin;
      for (const t of sortedDesc) {
        if (t.isWin === firstIsWin) streak++;
        else break;
      }
      if (!firstIsWin) streak = -streak;
    }

    const probWin = wins.length / trades.length;
    const probLoss = 1 - probWin;

    return {
      winRate: (wins.length / trades.length) * 100,
      avgWinUSD: avgW,
      avgLossUSD: avgL,
      avgRR: avgL !== 0 ? avgW / avgL : 0,
      totalUSD: trades.reduce((a, t) => a + t.resultUSD, 0),
      expectancyUSD: (probWin * avgW) - (probLoss * avgL),
      profitFactor: profitFactor === Infinity ? 999 : profitFactor,
      maxDrawdown: maxDD,
      bestTrade,
      worstTrade,
      currentStreak: streak,
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
      points: pointsResult,
      ticks: pointsResult / TICK_SIZE,
      grossUSD,
      commission: totalCommission,
      resultUSD: netUSD,
      isWin: netUSD > 0,
      date: editForm.date,
      note: editForm.note.trim() || undefined,
      setup: editForm.setup,
    } : t).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    cancelEdit();
  };

  const exportCSV = () => {
    const headers = ['Date', 'Type', 'Contracts', 'Entry', 'Exit', 'Points', 'Ticks', 'Gross USD', 'Commission', 'Net USD', 'Setup', 'Note'];
    const rows = trades.map(t => [
      t.date,
      t.isLong ? 'LONG' : 'SHORT',
      t.contracts,
      t.entryPrice.toFixed(2),
      t.exitPrice.toFixed(2),
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

  return (
    <div className="app-container" onKeyDown={handleKeyDown}>
      <div className="main-layout">

        {/* Left Panel */}
        <div className="card left-panel">
          <div className="header">
            <h1>MES ALPHA CORE</h1>
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

          <div className="input-row">
            <div className="input-group">
              <label>Entry</label>
              <input type="number" step="0.25" placeholder="0.00" value={entryPrice} onChange={(e) => setEntryPrice(e.target.value)} />
            </div>
            <div className="input-group">
              <label>Exit</label>
              <input type="number" step="0.25" placeholder="0.00" value={exitPrice} onChange={(e) => setExitPrice(e.target.value)} />
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

          <button className="btn-primary" onClick={addTrade} disabled={!entryPrice || !exitPrice}>
            Log Trade
            <span style={{ fontSize: '0.65rem', opacity: 0.7, marginLeft: '6px' }}>ENTER ↵</span>
          </button>

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

          <div className="balance-card">
            <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>NET BALANCE</div>
            <div style={{ fontSize: '1.3rem', fontWeight: '850', color: stats.totalUSD >= 0 ? '#10b981' : '#ef4444' }}>{formatUSD(stats.totalUSD)}</div>
            <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>After commissions</div>
          </div>

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

        {/* Right Panel */}
        <div className="card right-panel">
          {/* Stats Row 1 */}
          <div className="stats-grid">
            <div className="stat-box">
              <div className="stat-label">Win Rate</div>
              <div className="stat-value" style={{ color: '#38bdf8' }}>{stats.winRate.toFixed(1)}%</div>
            </div>
            <div className="stat-box">
              <div className="stat-label">Avg Win</div>
              <div className="stat-value" style={{ color: '#10b981' }}>{formatUSD(stats.avgWinUSD)}</div>
            </div>
            <div className="stat-box">
              <div className="stat-label">Avg Loss</div>
              <div className="stat-value" style={{ color: '#ef4444' }}>{formatUSD(stats.avgLossUSD)}</div>
            </div>
            <div className="stat-box">
              <div className="stat-label">R:R</div>
              <div className="stat-value" style={{ color: '#8b5cf6' }}>1:{stats.avgRR.toFixed(2)}</div>
            </div>
            <div className="stat-box">
              <div className="stat-label">Trades</div>
              <div className="stat-value" style={{ color: '#38bdf8' }}>{stats.totalTrades}</div>
            </div>
          </div>

          {/* Stats Row 2: Advanced */}
          <div className="stats-grid stats-grid-secondary">
            <div className="stat-box">
              <div className="stat-label">Profit Factor</div>
              <div className="stat-value" style={{ color: stats.profitFactor >= 1.5 ? '#10b981' : stats.profitFactor >= 1 ? '#38bdf8' : '#ef4444' }}>
                {stats.profitFactor >= 999 ? '∞' : stats.profitFactor.toFixed(2)}
              </div>
            </div>
            <div className="stat-box">
              <div className="stat-label">Max Drawdown</div>
              <div className="stat-value" style={{ color: '#ef4444' }}>{formatUSD(stats.maxDrawdown)}</div>
            </div>
            <div className="stat-box">
              <div className="stat-label">Best Trade</div>
              <div className="stat-value" style={{ color: '#10b981' }}>{formatUSD(stats.bestTrade)}</div>
            </div>
            <div className="stat-box">
              <div className="stat-label">Worst Trade</div>
              <div className="stat-value" style={{ color: '#ef4444' }}>{formatUSD(stats.worstTrade)}</div>
            </div>
            <div className="stat-box">
              <div className="stat-label">Streak</div>
              <div className="stat-value" style={{ color: stats.currentStreak >= 0 ? '#10b981' : '#ef4444' }}>
                {stats.currentStreak > 0 ? `${stats.currentStreak}W 🔥` : stats.currentStreak < 0 ? `${Math.abs(stats.currentStreak)}L` : '—'}
              </div>
            </div>
          </div>

          <div className={`expectancy-hero ${stats.expectancyUSD >= 0 ? 'positive' : 'negative'}`}>
            <div className="stat-label">Mathematical Expectancy per Trade</div>
            <div style={{ fontSize: '2rem', fontWeight: '900' }}>{stats.expectancyUSD >= 0 ? '+' : ''}{formatUSD(stats.expectancyUSD)}</div>
            <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>Net after commissions</div>
          </div>

          {/* Equity Curve */}
          <EquityCurve trades={trades} />

          <div className="trades-container">
            <div className="trades-header">
              <h3>Micro E-mini S&P 500 Trade Log</h3>
              {trades.length > 0 && (
                <button className="btn-export" onClick={exportCSV} title="Export CSV">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                  CSV
                </button>
              )}
            </div>
            <div className="trades-list">
              {trades.map(t => (
                <div key={t.id} className={`trade-row ${expandedNote === t.id ? 'expanded' : ''}`}>
                  <div className="trade-row-main">
                    <span className="trade-date-col">{formatDateLabel(t.date)}</span>
                    <span className="trade-type" style={{ color: t.isLong ? '#38bdf8' : '#f472b6' }}>
                      {t.isLong ? 'LONG' : 'SHORT'} x{t.contracts}
                    </span>
                    <span className="trade-prices">{t.entryPrice.toFixed(2)} → {t.exitPrice.toFixed(2)}</span>
                    {t.setup && <span className="trade-setup-badge">{t.setup}</span>}
                    <span className="trade-pts" style={{ color: t.isWin ? '#34d399' : '#f87171' }}>
                      {t.points > 0 ? '+' : ''}{t.points.toFixed(2)} pts
                    </span>
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
              {trades.length === 0 && (
                <div style={{ textAlign: 'center', color: '#475569', marginTop: '2rem', fontSize: '0.8rem' }}>No trades logged yet.</div>
              )}
            </div>
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
  )
}

export default App
