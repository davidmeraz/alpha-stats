import { useRef, useEffect } from 'react'

interface Trade {
    id: string;
    resultUSD: number;
    isWin: boolean;
    date: string;
}

interface ChartsProps {
    trades: Trade[];
}

function Charts({ trades }: ChartsProps) {
    const donutRef = useRef<HTMLCanvasElement>(null);
    const barRef = useRef<HTMLCanvasElement>(null);

    // Win/Loss Donut
    useEffect(() => {
        const canvas = donutRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);

        const W = rect.width;
        const H = rect.height;
        ctx.clearRect(0, 0, W, H);

        if (trades.length === 0) {
            ctx.fillStyle = '#475569';
            ctx.font = '11px Inter, system-ui, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('No data', W / 2, H / 2);
            return;
        }

        const wins = trades.filter(t => t.isWin).length;
        const losses = trades.length - wins;
        const cx = W / 2;
        const cy = H / 2;
        const radius = Math.min(W, H) / 2 - 12;
        const lineWidth = 10;

        const winAngle = (wins / trades.length) * Math.PI * 2;

        // Loss arc (background)
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.6)';
        ctx.lineWidth = lineWidth;
        ctx.stroke();

        // Win arc
        ctx.beginPath();
        ctx.arc(cx, cy, radius, -Math.PI / 2, -Math.PI / 2 + winAngle);
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = lineWidth;
        ctx.lineCap = 'round';
        ctx.stroke();
        ctx.lineCap = 'butt';

        // Center text
        ctx.fillStyle = '#f1f5f9';
        ctx.font = '600 14px Inter, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${((wins / trades.length) * 100).toFixed(0)}%`, cx, cy - 6);
        ctx.fillStyle = '#94a3b8';
        ctx.font = '10px Inter, system-ui, sans-serif';
        ctx.fillText(`${wins}W / ${losses}L`, cx, cy + 10);

    }, [trades]);

    // Daily P&L Bar Chart
    useEffect(() => {
        const canvas = barRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);

        const W = rect.width;
        const H = rect.height;
        ctx.clearRect(0, 0, W, H);

        if (trades.length === 0) {
            ctx.fillStyle = '#475569';
            ctx.font = '11px Inter, system-ui, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('No data', W / 2, H / 2);
            return;
        }

        // Aggregate by date
        const dailyMap = new Map<string, number>();
        for (const t of trades) {
            dailyMap.set(t.date, (dailyMap.get(t.date) || 0) + t.resultUSD);
        }
        const sorted = [...dailyMap.entries()].sort((a, b) => a[0].localeCompare(b[0]));
        // Show last 15 days max
        const data = sorted.slice(-15);

        const PAD_LEFT = 45;
        const PAD_RIGHT = 8;
        const PAD_TOP = 8;
        const PAD_BOTTOM = 18;
        const chartW = W - PAD_LEFT - PAD_RIGHT;
        const chartH = H - PAD_TOP - PAD_BOTTOM;

        const values = data.map(d => d[1]);
        const maxAbs = Math.max(...values.map(Math.abs), 1);

        const barWidth = Math.max(4, (chartW / data.length) - 3);
        const zeroY = PAD_TOP + chartH / 2;

        // Zero line
        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(PAD_LEFT, zeroY);
        ctx.lineTo(W - PAD_RIGHT, zeroY);
        ctx.stroke();

        // Y labels
        ctx.fillStyle = '#64748b';
        ctx.font = '9px Inter, system-ui, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(`+$${maxAbs.toFixed(0)}`, PAD_LEFT - 5, PAD_TOP + 8);
        ctx.fillText(`-$${maxAbs.toFixed(0)}`, PAD_LEFT - 5, PAD_TOP + chartH - 2);
        ctx.fillText('$0', PAD_LEFT - 5, zeroY + 3);

        // Bars
        for (let i = 0; i < data.length; i++) {
            const val = data[i][1];
            const x = PAD_LEFT + (i / data.length) * chartW + (chartW / data.length - barWidth) / 2;
            const barH = (Math.abs(val) / maxAbs) * (chartH / 2);
            const y = val >= 0 ? zeroY - barH : zeroY;

            const grad = ctx.createLinearGradient(x, y, x, y + barH);
            if (val >= 0) {
                grad.addColorStop(0, 'rgba(16, 185, 129, 0.9)');
                grad.addColorStop(1, 'rgba(16, 185, 129, 0.3)');
            } else {
                grad.addColorStop(0, 'rgba(239, 68, 68, 0.3)');
                grad.addColorStop(1, 'rgba(239, 68, 68, 0.9)');
            }

            ctx.fillStyle = grad;
            ctx.beginPath();
            const r = 2;
            // Rounded top corners
            if (val >= 0) {
                ctx.moveTo(x, y + barH);
                ctx.lineTo(x, y + r);
                ctx.quadraticCurveTo(x, y, x + r, y);
                ctx.lineTo(x + barWidth - r, y);
                ctx.quadraticCurveTo(x + barWidth, y, x + barWidth, y + r);
                ctx.lineTo(x + barWidth, y + barH);
            } else {
                ctx.moveTo(x, y);
                ctx.lineTo(x, y + barH - r);
                ctx.quadraticCurveTo(x, y + barH, x + r, y + barH);
                ctx.lineTo(x + barWidth - r, y + barH);
                ctx.quadraticCurveTo(x + barWidth, y + barH, x + barWidth, y + barH - r);
                ctx.lineTo(x + barWidth, y);
            }
            ctx.closePath();
            ctx.fill();

            // Date label (only show every other for small sets)
            if (data.length <= 8 || i % 2 === 0) {
                ctx.fillStyle = '#475569';
                ctx.font = '8px Inter, system-ui, sans-serif';
                ctx.textAlign = 'center';
                const lbl = data[i][0].slice(5); // MM-DD
                ctx.fillText(lbl, x + barWidth / 2, H - 3);
            }
        }

    }, [trades]);

    return (
        <div className="charts-row">
            <div className="mini-chart-box">
                <span className="mini-chart-title">Win / Loss</span>
                <canvas ref={donutRef} style={{ width: '100%', height: '100px', display: 'block' }} />
            </div>
            <div className="mini-chart-box" style={{ flex: 2 }}>
                <span className="mini-chart-title">Daily P&L</span>
                <canvas ref={barRef} style={{ width: '100%', height: '100px', display: 'block' }} />
            </div>
        </div>
    );
}

export default Charts;
