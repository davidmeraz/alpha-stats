import { useRef, useEffect } from 'react'
import { Trade } from '../types'

interface WinLossDonutProps {
    trades: Trade[];
}

function WinLossDonut({ trades }: WinLossDonutProps) {
    const donutRef = useRef<HTMLCanvasElement>(null);

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
            ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
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

    return (
        <div className="mini-chart-box">
            <span className="mini-chart-title">Win / Loss</span>
            <canvas ref={donutRef} style={{ width: '100%', height: '100px', display: 'block' }} />
        </div>
    );
}

export default WinLossDonut;
