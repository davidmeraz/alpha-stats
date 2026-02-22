import { useState, useEffect } from 'react'
import './App.css'

const POINT_VALUE_PER_CONTRACT = 5;
const TICK_SIZE = 0.25;

interface Trade {
  id: string;
  isLong: boolean;
  contracts: number;
  entryPrice: number;
  exitPrice: number;
  points: number;
  ticks: number;
  resultUSD: number;
  isWin: boolean;
  date: string;
}

function App() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [isLong, setIsLong] = useState<boolean>(true);
  const [contracts, setContracts] = useState<string>('1');
  const [entryPrice, setEntryPrice] = useState<string>('');
  const [exitPrice, setExitPrice] = useState<string>('');
  const [tradeDate, setTradeDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);

  const [winRate, setWinRate] = useState(0);
  const [avgWinUSD, setAvgWinUSD] = useState(0);
  const [avgLossUSD, setAvgLossUSD] = useState(0);
  const [avgRR, setAvgRR] = useState(0);
  const [totalUSD, setTotalUSD] = useState(0);
  const [expectancyUSD, setExpectancyUSD] = useState(0);

  // Persistence: Load from JSON file via IPC
  useEffect(() => {
    const loadData = async () => {
      if (window.ipcRenderer) {
        const savedTrades = await window.ipcRenderer.invoke('load-trades');
        if (savedTrades) {
          setTrades(savedTrades);
        }
      }
      setIsLoaded(true);
    };
    loadData();
  }, []);

  // Persistence: Save to JSON file via IPC on change + Calculate stats
  useEffect(() => {
    const saveData = async () => {
      if (isLoaded && window.ipcRenderer) {
        await window.ipcRenderer.invoke('save-trades', trades);
      }
    };
    saveData();
    calculateStats();
  }, [trades, isLoaded]);

  const addTrade = () => {
    const entry = parseFloat(entryPrice);
    const exit = parseFloat(exitPrice);
    const qty = parseInt(contracts);
    if (isNaN(entry) || isNaN(exit) || isNaN(qty) || qty <= 0) return;

    const pointsResult = isLong ? (exit - entry) : (entry - exit);
    const usdResult = pointsResult * POINT_VALUE_PER_CONTRACT * qty;

    const newTrade: Trade = {
      id: Date.now().toString(),
      isLong,
      contracts: qty,
      entryPrice: entry,
      exitPrice: exit,
      points: pointsResult,
      ticks: pointsResult / TICK_SIZE,
      resultUSD: usdResult,
      isWin: pointsResult > 0,
      date: tradeDate
    };

    const updatedTrades = [newTrade, ...trades].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    setTrades(updatedTrades);

    setEntryPrice('');
    setExitPrice('');
  };

  const calculateStats = () => {
    if (trades.length === 0) {
      setWinRate(0); setAvgWinUSD(0); setAvgLossUSD(0); setAvgRR(0); setTotalUSD(0); setExpectancyUSD(0);
      return;
    }
    const wins = trades.filter(t => t.isWin);
    const losses = trades.filter(t => !t.isWin);

    const wRate = (wins.length / trades.length) * 100;
    const avgW = wins.length > 0 ? wins.reduce((a, t) => a + t.resultUSD, 0) / wins.length : 0;
    const avgL = losses.length > 0 ? Math.abs(losses.reduce((a, t) => a + t.resultUSD, 0) / losses.length) : 0;
    const rr = avgL !== 0 ? avgW / avgL : 0;

    setWinRate(wRate);
    setAvgWinUSD(avgW);
    setAvgLossUSD(avgL);
    setAvgRR(rr);
    setTotalUSD(trades.reduce((a, t) => a + t.resultUSD, 0));

    const probWin = wins.length / trades.length;
    const probLoss = 1 - probWin;
    setExpectancyUSD((probWin * avgW) - (probLoss * avgL));
  };

  const deleteTrade = async (id: string) => {
    if (window.confirm('¿Estás seguro de eliminar esta operación?')) {
      const updatedTrades = trades.filter(tr => tr.id !== id);
      setTrades(updatedTrades);
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

  const formatDateLabel = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year.slice(2)}`;
  };

  return (
    <div className="app-container">
      <div className="main-layout">

        {/* Left Panel */}
        <div className="card left-panel">
          <div className="header">
            <h1>MES ALPHA CORE</h1>
            <p>Direct Market Analytics (JSON Save)</p>
          </div>

          <div className="input-group">
            <label>Tipo</label>
            <div className="outcome-selector">
              <button className={`outcome-btn ${isLong ? 'active' : ''}`} style={isLong ? { color: '#38bdf8', borderColor: '#38bdf8' } : {}} onClick={() => setIsLong(true)}>LONG</button>
              <button className={`outcome-btn ${!isLong ? 'active' : ''}`} style={!isLong ? { color: '#f472b6', borderColor: '#f472b6' } : {}} onClick={() => setIsLong(false)}>SHORT</button>
            </div>
          </div>

          <div className="input-row">
            <div className="input-group">
              <label>Fecha</label>
              <input type="date" value={tradeDate} onChange={(e) => setTradeDate(e.target.value)} />
            </div>
            <div className="input-group">
              <label>Contratos</label>
              <input type="number" value={contracts} onChange={(e) => setContracts(e.target.value)} />
            </div>
          </div>

          <div className="input-row">
            <div className="input-group">
              <label>Entrada</label>
              <input type="number" step="0.25" placeholder="0.00" value={entryPrice} onChange={(e) => setEntryPrice(e.target.value)} />
            </div>
            <div className="input-group">
              <label>Salida</label>
              <input type="number" step="0.25" placeholder="0.00" value={exitPrice} onChange={(e) => setExitPrice(e.target.value)} />
            </div>
          </div>

          <div className="preview-box">
            <span style={{ fontSize: '0.6rem', color: '#64748b' }}>PREVISIÓN USD</span>
            <div style={{ fontSize: '1.25rem', fontWeight: '800', color: previewPts() >= 0 ? '#10b981' : '#ef4444' }}>
              {formatUSD(previewPts() * 5 * getContractsQty())}
            </div>
            <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>
              {previewPts() > 0 ? '+' : ''}{previewPts().toFixed(2)} pts | {(previewPts() / TICK_SIZE).toFixed(0)} ticks
            </div>
          </div>

          <button className="btn-primary" onClick={addTrade} disabled={!entryPrice || !exitPrice}>Registrar Operación</button>

          <div className="balance-card">
            <div style={{ fontSize: '0.65rem', color: '#94a3b8' }}>BALANCE EN ARCHIVO</div>
            <div style={{ fontSize: '1.1rem', fontWeight: '850', color: '#fbbf24' }}>{formatUSD(totalUSD)}</div>
            <div style={{ fontSize: '0.6rem', color: '#64748b', marginTop: '2px' }}>Local trades.json</div>
          </div>
        </div>

        {/* Right Panel */}
        <div className="card right-panel">
          <div className="stats-grid">
            <div className="stat-box">
              <div className="stat-label">Win Rate</div>
              <div className="stat-value" style={{ color: '#fbbf24' }}>{winRate.toFixed(1)}%</div>
            </div>
            <div className="stat-box">
              <div className="stat-label">Avg Win</div>
              <div className="stat-value" style={{ color: '#10b981' }}>{formatUSD(avgWinUSD)}</div>
            </div>
            <div className="stat-box">
              <div className="stat-label">Avg Loss</div>
              <div className="stat-value" style={{ color: '#ef4444' }}>{formatUSD(avgLossUSD)}</div>
            </div>
            <div className="stat-box">
              <div className="stat-label">Prom. R:R</div>
              <div className="stat-value" style={{ color: '#8b5cf6' }}>1:{avgRR.toFixed(2)}</div>
            </div>
            <div className="stat-box">
              <div className="stat-label">Total Trades</div>
              <div className="stat-value" style={{ color: '#38bdf8' }}>{trades.length}</div>
            </div>
          </div>

          <div className={`expectancy-hero ${expectancyUSD >= 0 ? 'positive' : 'negative'}`}>
            <div className="stat-label">Esperanza Matemática por Trade</div>
            <div style={{ fontSize: '1.75rem', fontWeight: '900' }}>{expectancyUSD >= 0 ? '+' : ''}{formatUSD(expectancyUSD)}</div>
            <div style={{ fontSize: '0.7rem', opacity: 0.7 }}>Análisis extraído de archivo local</div>
          </div>

          <div className="trades-container">
            <h3>Bitácora Micro E-mini S&P 500</h3>
            <div className="trades-list">
              {trades.map(t => (
                <div key={t.id} className="trade-row">
                  <span className="trade-date-col">{formatDateLabel(t.date)}</span>
                  <span className="trade-type" style={{ color: t.isLong ? '#38bdf8' : '#f472b6' }}>
                    {t.isLong ? 'LONG' : 'SHORT'} x{t.contracts}
                  </span>
                  <span className="trade-prices">{t.entryPrice.toFixed(2)} → {t.exitPrice.toFixed(2)}</span>
                  <span className="trade-pts" style={{ color: t.isWin ? '#34d399' : '#f87171' }}>
                    {t.points > 0 ? '+' : ''}{t.points.toFixed(2)} pts
                  </span>
                  <span className="trade-usd">{formatUSD(t.resultUSD)}</span>
                  <button className="delete-btn" onClick={() => deleteTrade(t.id)}>✕</button>
                </div>
              ))}
              {trades.length === 0 && (
                <div style={{ textAlign: 'center', color: '#475569', marginTop: '2rem', fontSize: '0.8rem' }}>No hay trades en el archivo JSON.</div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}

export default App
