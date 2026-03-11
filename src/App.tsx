import { useState, useEffect, useRef, useCallback } from 'react'
import EquityCurve from './components/EquityCurve'
import WinLossDonut from './components/WinLossDonut'
import DrawdownChart from './components/DrawdownChart'
import './App.css'

import { Trade, Stats, SetupTag, SETUP_TAGS } from './types';
import { POINT_VALUE_PER_CONTRACT, TICK_SIZE, EMPTY_STATS } from './constants';
import { floor1Str, floor2Str, formatUSD, formatDayFull, formatDateLabel } from './utils/formatters';
import { calculateStats } from './utils/calculations';
import { TitleBar } from './components/TitleBar';


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
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

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

    // Listen for real-time trades from NinjaTrader bridge
    const handleNtTrade = (_event: any, trade: any) => {
      setTrades(prev => {
        // Prevent duplicates by checking if this trade ID already exists
        if (prev.some((t: any) => t.id === trade.id)) return prev;
        return [...prev, trade];
      });
    };

    window.ipcRenderer?.on('nt-trade-received', handleNtTrade);

    // Cleanup: remove listener on unmount (prevents React Strict Mode duplicates)
    return () => {
      window.ipcRenderer?.off('nt-trade-received', handleNtTrade);
    };
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


  const selectedDayTrades = selectedDay ? (tradesByDay[selectedDay] || []) : [];
  const selectedDayStats = selectedDay ? calculateStats(selectedDayTrades) : EMPTY_STATS;
  const selectedDaySorted = [...selectedDayTrades].sort((a, b) => {
    const ta = a.createdAt || parseInt(a.id) || 0;
    const tb = b.createdAt || parseInt(b.id) || 0;
    return sortOrder === 'oldest' ? ta - tb : tb - ta;
  });

  return (
    <>
      <TitleBar />
      <div className="app-container" onKeyDown={handleKeyDown}>
        <div className="main-layout">

          {/* Left Panel */}
          <div className="card left-panel">

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
                <input type="number" step="0.25" placeholder="—" value={stopLossPrice} onChange={(e) => setStopLossPrice(e.target.value)} />
              </div>
              <div className="input-group">
                <label>TP</label>
                <input type="number" step="0.25" placeholder="—" value={takeProfitPrice} onChange={(e) => setTakeProfitPrice(e.target.value)} />
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
              <div className="preview-details">
                <span className="preview-pill">
                  <span className="preview-pill-label">PTS</span>
                  <span className="preview-pill-value" style={{ color: previewPts() >= 0 ? '#34d399' : '#f87171' }}>{previewPts() > 0 ? '+' : ''}{previewPts().toFixed(2)}</span>
                </span>
                <span className="preview-pill">
                  <span className="preview-pill-label">TICKS</span>
                  <span className="preview-pill-value" style={{ color: previewPts() >= 0 ? '#34d399' : '#f87171' }}>{(previewPts() / TICK_SIZE).toFixed(0)}</span>
                </span>
                <span className="preview-pill">
                  <span className="preview-pill-label">COM</span>
                  <span className="preview-pill-value">{formatUSD(commissionPerContract * getContractsQty())}</span>
                </span>
              </div>
              <div className="preview-net">
                <span className="preview-net-label">NET USD</span>
                <span className="preview-net-amount" style={{ color: previewNet() >= 0 ? '#10b981' : '#f43f5e' }}>
                  {previewNet() > 0 ? '+' : ''}{formatUSD(previewNet())}
                </span>
              </div>
              <button className="btn-primary" onClick={addTrade} disabled={!entryPrice || !exitPrice} title="Log Trade (ENTER ↵)">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                Log Trade
              </button>
            </div>

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

                {/* Stats Row 2 */}
                <div className="stats-grid stats-grid-secondary" style={{ marginTop: '0.4rem' }}>
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
              </>);
            })()}

            <div className="main-content-split">
              <div className="left-charts-column">
                <WinLossDonut trades={(selectedDay && !showAllTrades) ? selectedDayTrades : trades} />
                <div className="mini-chart-box" style={{ minHeight: '180px' }}>
                  <span className="mini-chart-title">Equity Curve</span>
                  <EquityCurve trades={(selectedDay && !showAllTrades) ? selectedDayTrades : trades} inline />
                </div>
                <div className="mini-chart-box" style={{ minHeight: '180px' }}>
                  <span className="mini-chart-title">Drawdown</span>
                  <DrawdownChart trades={(selectedDay && !showAllTrades) ? selectedDaySorted : sortedTrades} />
                </div>
              </div>

              <div className="trades-container" style={{ marginTop: 0 }}>
                <div className="trades-header">
                  <h3>
                    {(selectedDay || showAllTrades) ? (
                      <button className="btn-back-day" onClick={() => { setSelectedDay(null); setShowAllTrades(false); setEditingId(null); setExpandedNote(null); }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
                      </button>
                    ) : null}
                    {showAllTrades ? 'All Trades' : selectedDay ? formatDayFull(selectedDay) : ''}
                  </h3>
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    {(selectedDay || showAllTrades) && (
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
                    )}
                    {!selectedDay && !showAllTrades && trades.length > 0 && (
                      <button className="btn-export btn-all-trades" onClick={() => { setShowAllTrades(true); setEditingId(null); setExpandedNote(null); }} title="View all trades">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></svg>
                        All
                      </button>
                    )}
                  </div>
                </div>

                {/* === CALENDAR MONTH VIEW === */}
                {!selectedDay && !showAllTrades && (
                  <div className="calendar-view">
                    <div className="calendar-nav">
                      <button className="cal-nav-btn" onClick={() => setCalendarMonth(prev => {
                        const d = new Date(prev.year, prev.month - 1, 1);
                        return { year: d.getFullYear(), month: d.getMonth() };
                      })}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
                      </button>
                      <span className="cal-month-label">
                        {new Date(calendarMonth.year, calendarMonth.month).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                      </span>
                      <button className="cal-nav-btn" onClick={() => setCalendarMonth(prev => {
                        const d = new Date(prev.year, prev.month + 1, 1);
                        return { year: d.getFullYear(), month: d.getMonth() };
                      })}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
                      </button>
                    </div>
                    <div className="calendar-weekdays">
                      {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
                        <span key={d} className="cal-weekday">{d}</span>
                      ))}
                    </div>
                    <div className="calendar-grid">
                      {(() => {
                        const { year, month } = calendarMonth;
                        const firstDay = new Date(year, month, 1);
                        const lastDay = new Date(year, month + 1, 0);
                        const daysInMonth = lastDay.getDate();
                        // Monday = 0 ... Sunday = 6
                        let startDow = firstDay.getDay() - 1;
                        if (startDow < 0) startDow = 6;

                        const cells: React.ReactNode[] = [];

                        // Empty leading cells
                        for (let i = 0; i < startDow; i++) {
                          cells.push(<div key={`empty-${i}`} className="cal-cell cal-cell-empty" />);
                        }

                        // Monthly P&L totals for intensity
                        const monthPnLs = Array.from({ length: daysInMonth }, (_, i) => {
                          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`;
                          const dt = tradesByDay[dateStr];
                          return dt ? dt.reduce((s, t) => s + t.resultUSD, 0) : 0;
                        });
                        const maxAbsPnL = Math.max(...monthPnLs.map(Math.abs), 1);

                        for (let d = 1; d <= daysInMonth; d++) {
                          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                          const dayTrades = tradesByDay[dateStr];
                          const hasTrades = dayTrades && dayTrades.length > 0;
                          const isToday = dateStr === new Date().toISOString().split('T')[0];

                          if (!hasTrades) {
                            cells.push(
                              <div key={dateStr} className={`cal-cell ${isToday ? 'cal-cell-today' : ''}`}>
                                <span className="cal-day-num">{d}</span>
                              </div>
                            );
                          } else {
                            const dayPnL = dayTrades.reduce((s, t) => s + t.resultUSD, 0);
                            const dayWins = dayTrades.filter(t => t.isWin).length;
                            const dayWR = (dayWins / dayTrades.length) * 100;
                            const isProfit = dayPnL >= 0;
                            const intensity = Math.min(Math.abs(dayPnL) / maxAbsPnL, 1);
                            const bg = isProfit
                              ? `rgba(16, 185, 129, ${0.08 + intensity * 0.22})`
                              : `rgba(239, 68, 68, ${0.08 + intensity * 0.22})`;
                            const border = isProfit
                              ? `rgba(16, 185, 129, ${0.15 + intensity * 0.25})`
                              : `rgba(239, 68, 68, ${0.15 + intensity * 0.25})`;

                            cells.push(
                              <div
                                key={dateStr}
                                className={`cal-cell cal-cell-active ${isToday ? 'cal-cell-today' : ''} ${isProfit ? 'cal-cell-profit' : 'cal-cell-loss'}`}
                                style={{ background: bg, borderColor: border }}
                                onClick={() => { setSelectedDay(dateStr); setShowAllTrades(false); setEditingId(null); setExpandedNote(null); }}
                              >
                                <div className="cal-cell-top">
                                  <span className="cal-day-num">{d}</span>
                                  <span className="cal-trade-count">{dayTrades.length}t</span>
                                </div>
                                <div className="cal-cell-pnl" style={{ color: isProfit ? '#34d399' : '#f87171' }}>
                                  {isProfit ? '+' : ''}{formatUSD(dayPnL)}
                                </div>
                                <div className="cal-cell-wr">
                                  <div className="cal-wr-bar">
                                    <div className="cal-wr-fill" style={{
                                      width: `${dayWR}%`,
                                      background: isProfit ? 'linear-gradient(90deg, #10b981, #34d399)' : 'linear-gradient(90deg, #ef4444, #f87171)'
                                    }} />
                                  </div>
                                  <span className="cal-wr-label">{dayWR.toFixed(0)}%</span>
                                </div>
                              </div>
                            );
                          }
                        }

                        // Trailing empties to complete the last row
                        const totalCells = cells.length;
                        const trailing = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
                        for (let i = 0; i < trailing; i++) {
                          cells.push(<div key={`trail-${i}`} className="cal-cell cal-cell-empty" />);
                        }

                        return cells;
                      })()}
                    </div>
                    {trades.length === 0 && (
                      <div style={{ textAlign: 'center', color: 'rgba(255, 255, 255, 0.8)', marginTop: '1.5rem', fontSize: '0.8rem' }}>
                        No trades logged yet. Start logging to see your calendar.
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
              {/* End main-content-split */}
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
