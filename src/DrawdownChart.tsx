import { useRef, useEffect } from 'react'

interface Trade {
    id: string;
    resultUSD: number;
    date: string;
}

interface DrawdownChartProps {
    trades: Trade[];
}

function DrawdownChart({ trades }: DrawdownChartProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
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

        const values = trades.map(t => t.resultUSD);

        const maxGain = Math.max(...values, 0);
        const maxLoss = Math.min(...values, 0);
        const totalRange = (maxGain + Math.abs(maxLoss)) || 1;

        const PAD_LEFT = 6;
        const PAD_RIGHT = 6;
        const PAD_TOP = 14;
        const PAD_BOTTOM = 14;
        const chartW = W - PAD_LEFT - PAD_RIGHT;
        const chartH = H - PAD_TOP - PAD_BOTTOM;

        const zeroY = PAD_TOP + (maxGain / totalRange) * chartH;
        const barWidth = Math.max(3, (chartW / values.length) - 2);

        // Zero line
        ctx.strokeStyle = 'rgba(255,255,255,0.15)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(PAD_LEFT, zeroY);
        ctx.lineTo(W - PAD_RIGHT, zeroY);
        ctx.stroke();
        ctx.setLineDash([]);

        // Draw bars per trade
        for (let i = 0; i < values.length; i++) {
            const val = values[i];
            const x = PAD_LEFT + (i / values.length) * chartW + (chartW / values.length - barWidth) / 2;

            if (val >= 0) {
                const barH = (val / totalRange) * chartH;
                const y = zeroY - barH;
                const grad = ctx.createLinearGradient(x, y, x, zeroY);
                grad.addColorStop(0, 'rgba(16, 185, 129, 0.85)');
                grad.addColorStop(1, 'rgba(16, 185, 129, 0.2)');
                ctx.fillStyle = grad;
                roundedBar(ctx, x, y, barWidth, barH, 2, true);
            } else {
                const barH = (Math.abs(val) / totalRange) * chartH;
                const y = zeroY;
                const grad = ctx.createLinearGradient(x, y, x, y + barH);
                grad.addColorStop(0, 'rgba(239, 68, 68, 0.2)');
                grad.addColorStop(1, 'rgba(239, 68, 68, 0.85)');
                ctx.fillStyle = grad;
                roundedBar(ctx, x, y, barWidth, barH, 2, false);
            }
        }

        // Labels
        ctx.font = '600 9px Inter, system-ui, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillStyle = '#10b981';
        ctx.fillText(`Best +$${maxGain.toFixed(0)}`, PAD_LEFT, PAD_TOP - 3);

        ctx.fillStyle = '#ef4444';
        ctx.textAlign = 'right';
        ctx.fillText(`Worst -$${Math.abs(maxLoss).toFixed(0)}`, W - PAD_RIGHT, H - 2);

    }, [trades]);

    return (
        <canvas
            ref={canvasRef}
            style={{ width: '100%', height: '100px', display: 'block' }}
        />
    );
}

function roundedBar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, top: boolean) {
    r = Math.min(r, h / 2, w / 2);
    ctx.beginPath();
    if (top) {
        ctx.moveTo(x, y + h);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h);
    } else {
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + h - r);
        ctx.quadraticCurveTo(x, y + h, x + r, y + h);
        ctx.lineTo(x + w - r, y + h);
        ctx.quadraticCurveTo(x + w, y + h, x + w, y + h - r);
        ctx.lineTo(x + w, y);
    }
    ctx.closePath();
    ctx.fill();
}

export default DrawdownChart;
