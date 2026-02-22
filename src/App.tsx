import { useState, useEffect } from 'react'
import './App.css'

interface Trade {
  id: string;
  result: number;
  tp: number;
  sl: number;
  rr: number;
  date: string;
}

function App() {
  const [trades, setTrades] = useState<Trade[]>([]);

  // Form Inputs
  const [inputResult, setInputResult] = useState<string>('');
  const [inputTP, setInputTP] = useState<string>('');
  const [inputSL, setInputSL] = useState<string>('');

  // Stats
  const [winRate, setWinRate] = useState(0);
  const [avgWin, setAvgWin] = useState(0);
  const [avgLoss, setAvgLoss] = useState(0);
  const [avgRR, setAvgRR] = useState(0);
  const [expectancy, setExpectancy] = useState(0);

  useEffect(() => {
    calculateStats();
  }, [trades]);

  const addTrade = () => {
    const res = parseFloat(inputResult);
    const tp = parseFloat(inputTP);
    const sl = parseFloat(inputSL);

    if (isNaN(res)) return;

    // Calculate RR for this specific trade if TP/SL provided, otherwise 0
    // Concept RR = TP / SL (absolute values)
    const rrValue = (tp && sl && sl !== 0) ? Math.abs(tp / sl) : 0;

    const newTrade: Trade = {
      id: Date.now().toString(),
      result: res,
      tp: tp || 0,
      sl: sl || 0,
      rr: rrValue,
      date: new Date().toLocaleString()
    };

    setTrades([newTrade, ...trades]);

    // Reset form
    setInputResult('');
    setInputTP('');
    setInputSL('');
  };

  const deleteTrade = (id: string) => {
    setTrades(trades.filter(t => t.id !== id));
  };

  const calculateStats = () => {
    if (trades.length === 0) {
      setWinRate(0); setAvgWin(0); setAvgLoss(0); setExpectancy(0); setAvgRR(0);
      return;
    }

    const wins = trades.filter(t => t.result > 0);
    const losses = trades.filter(t => t.result < 0);

    const wRate = (wins.length / trades.length) * 100;
    const aWin = wins.length > 0 ? wins.reduce((acc, t) => acc + t.result, 0) / wins.length : 0;
    const aLoss = losses.length > 0 ? Math.abs(losses.reduce((acc, t) => acc + t.result, 0) / losses.length) : 0;

    // Average RR of all trades that had RR defined
    const tradesWithRR = trades.filter(t => t.rr > 0);
    const aRR = tradesWithRR.length > 0 ? tradesWithRR.reduce((acc, t) => acc + t.rr, 0) / tradesWithRR.length : 0;

    setWinRate(wRate);
    setAvgWin(aWin);
    setAvgLoss(aLoss);
    setAvgRR(aRR);

    // Esperanza = (PW * AW) - (PL * AL)
    const probWin = wRate / 100;
    const probLoss = 1 - probWin;
    const exp = (probWin * aWin) - (probLoss * aLoss);
    setExpectancy(exp);
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
  };

  return (
    <div className="app-container">
      <div className="main-layout">

        {/* Lado Izquierdo: Entrada de Datos */}
        <div className="card left-panel">
          <div className="header">
            <h1>Alpha Stats</h1>
            <p>Configuración de Operación</p>
          </div>

          <div className="input-group">
            <label>Resultado Final ($)</label>
            <div className="input-wrapper">
              <span className="input-prefix">$</span>
              <input
                type="number"
                step="0.01"
                placeholder="Ganancia (+) o Pérdida (-)"
                value={inputResult}
                onChange={(e) => setInputResult(e.target.value)}
              />
            </div>
          </div>

          <div className="input-row">
            <div className="input-group">
              <label>Take Profit ($)</label>
              <div className="input-wrapper">
                <span className="input-prefix">$</span>
                <input
                  type="number"
                  step="0.01"
                  placeholder="Objetivo"
                  value={inputTP}
                  onChange={(e) => setInputTP(e.target.value)}
                />
              </div>
            </div>
            <div className="input-group">
              <label>Stop Loss ($)</label>
              <div className="input-wrapper">
                <span className="input-prefix">$</span>
                <input
                  type="number"
                  step="0.01"
                  placeholder="Riesgo"
                  value={inputSL}
                  onChange={(e) => setInputSL(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div style={{
            background: 'rgba(56, 189, 248, 0.05)',
            padding: '1rem',
            borderRadius: '12px',
            fontSize: '0.8rem',
            color: '#38bdf8',
            border: '1px dashed rgba(56, 189, 248, 0.2)'
          }}>
            <strong>Riesgo:Beneficio Teórico:</strong> 1 : {(inputTP && inputSL) ? (Math.abs(parseFloat(inputTP) / parseFloat(inputSL)) || 0).toFixed(2) : '0.00'}
          </div>

          <button className="btn-primary" onClick={addTrade}>
            Registrar Trade
          </button>

          <div style={{ marginTop: 'auto', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#94a3b8' }}>
              <span>Total en Historial:</span>
              <span>{trades.length}</span>
            </div>
          </div>
        </div>

        {/* Lado Derecho: Estadísticas y Lista */}
        <div className="card right-panel">
          <div className="stats-panel">
            <div className="stat-box">
              <div className="stat-label">Win Rate</div>
              <div className="stat-value" style={{ color: '#38bdf8' }}>{winRate.toFixed(1)}%</div>
            </div>
            <div className="stat-box">
              <div className="stat-label">Avg Win</div>
              <div className="stat-value" style={{ color: '#10b981' }}>{formatCurrency(avgWin)}</div>
            </div>
            <div className="stat-box">
              <div className="stat-label">Avg Loss</div>
              <div className="stat-value" style={{ color: '#ef4444' }}>{formatCurrency(avgLoss)}</div>
            </div>
            <div className="stat-box">
              <div className="stat-label">Avg R:B</div>
              <div className="stat-value" style={{ color: '#8b5cf6' }}>1:{avgRR.toFixed(2)}</div>
            </div>

            <div className={`expectancy-display ${expectancy >= 0 ? 'positive' : 'negative'}`}>
              <div className="stat-label" style={{ color: 'inherit', opacity: 0.8 }}>Esperanza Matemática Global</div>
              <div className="stat-value" style={{ fontSize: '2.5rem' }}>
                {expectancy > 0 ? '+' : ''}{formatCurrency(expectancy)}
              </div>
              <div style={{ fontSize: '0.8rem', marginTop: '0.5rem', fontWeight: 500 }}>
                {expectancy > 0
                  ? 'SISTEMA RENTABLE: Tu ventaja estadística está confirmada.'
                  : expectancy < 0
                    ? 'RIESGO DETECTADO: El sistema no es sostenible con estos parámetros.'
                    : 'Registra tus operaciones con TP/SL para analizar tu desempeño.'}
              </div>
            </div>
          </div>

          <div className="header" style={{ marginTop: '1rem', marginBottom: '0.5rem' }}>
            <h3>Historial Detallado</h3>
          </div>

          <div className="trades-list-container">
            {trades.map(trade => (
              <div key={trade.id} className={`trade-item ${trade.result >= 0 ? 'win' : 'loss'}`}>
                <div className="trade-main">
                  <span className="trade-amount">
                    {trade.result > 0 ? '+' : ''}{formatCurrency(trade.result)}
                  </span>
                  <span className="trade-date">{trade.date}</span>
                </div>
                <div className="trade-rr-info">
                  <span>TP: ${trade.tp} | SL: ${trade.sl}</span>
                  <span style={{ color: '#e2e8f0', fontWeight: 'bold' }}>R:B 1:{trade.rr.toFixed(2)}</span>
                </div>
                <button className="delete-btn" onClick={() => deleteTrade(trade.id)}>
                  ✕
                </button>
              </div>
            ))}
            {trades.length === 0 && (
              <div style={{ textAlign: 'center', color: '#475569', marginTop: '3rem' }}>
                Esperando datos de NinjaTrader...
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}

export default App
