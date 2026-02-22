import { useRef, useEffect } from 'react'

interface Trade {
    id: string;
    resultUSD: number;
    date: string;
}

interface EquityCurveProps {
    trades: Trade[];
}

function EquityCurve({ trades }: EquityCurveProps) {
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
        const PAD_LEFT = 55;
        const PAD_RIGHT = 15;
        const PAD_TOP = 20;
        const PAD_BOTTOM = 10;
        const CHART_W = W - PAD_LEFT - PAD_RIGHT;
        const CHART_H = H - PAD_TOP - PAD_BOTTOM;

        ctx.clearRect(0, 0, W, H);

        if (trades.length === 0) {
            ctx.fillStyle = '#475569';
            ctx.font = '12px Inter, system-ui, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('Sin datos para la curva de equidad', W / 2, H / 2);
            return;
        }

        // Sort trades oldest → newest for cumulative calc
        const sorted = [...trades].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        // Build cumulative equity points
        const equityPoints: number[] = [0];
        let cumulative = 0;
        for (const t of sorted) {
            cumulative += t.resultUSD;
            equityPoints.push(cumulative);
        }

        const minVal = Math.min(...equityPoints);
        const maxVal = Math.max(...equityPoints);
        const range = maxVal - minVal || 1;

        const getX = (i: number) => PAD_LEFT + (i / (equityPoints.length - 1)) * CHART_W;
        const getY = (val: number) => PAD_TOP + CHART_H - ((val - minVal) / range) * CHART_H;

        // Draw horizontal gridlines
        const gridLines = 5;
        ctx.strokeStyle = 'rgba(255,255,255,0.04)';
        ctx.lineWidth = 1;
        ctx.font = '10px Inter, system-ui, sans-serif';
        ctx.fillStyle = '#475569';
        ctx.textAlign = 'right';
        for (let i = 0; i <= gridLines; i++) {
            const val = minVal + (range * i) / gridLines;
            const y = getY(val);
            ctx.beginPath();
            ctx.moveTo(PAD_LEFT, y);
            ctx.lineTo(W - PAD_RIGHT, y);
            ctx.stroke();
            ctx.fillText(`$${val.toFixed(0)}`, PAD_LEFT - 6, y + 3);
        }

        // Zero line
        if (minVal < 0 && maxVal > 0) {
            const zeroY = getY(0);
            ctx.strokeStyle = 'rgba(255,255,255,0.12)';
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(PAD_LEFT, zeroY);
            ctx.lineTo(W - PAD_RIGHT, zeroY);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        // Draw line
        const finalValue = equityPoints[equityPoints.length - 1];
        const lineColor = finalValue >= 0 ? '#10b981' : '#ef4444';
        const gradientTop = finalValue >= 0 ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)';
        const gradientBot = finalValue >= 0 ? 'rgba(16,185,129,0.0)' : 'rgba(239,68,68,0.0)';

        ctx.beginPath();
        ctx.moveTo(getX(0), getY(equityPoints[0]));
        for (let i = 1; i < equityPoints.length; i++) {
            const x = getX(i);
            const y = getY(equityPoints[i]);
            // Smooth curve via quadratic
            const prevX = getX(i - 1);
            const prevY = getY(equityPoints[i - 1]);
            const cpx = (prevX + x) / 2;
            ctx.quadraticCurveTo(prevX + (cpx - prevX) * 0.5, prevY, cpx, (prevY + y) / 2);
            ctx.quadraticCurveTo(cpx + (x - cpx) * 0.5, y, x, y);
        }
        ctx.strokeStyle = lineColor;
        ctx.lineWidth = 2;
        ctx.stroke();

        // Gradient fill
        const gradient = ctx.createLinearGradient(0, PAD_TOP, 0, PAD_TOP + CHART_H);
        gradient.addColorStop(0, gradientTop);
        gradient.addColorStop(1, gradientBot);

        ctx.lineTo(getX(equityPoints.length - 1), PAD_TOP + CHART_H);
        ctx.lineTo(getX(0), PAD_TOP + CHART_H);
        ctx.closePath();
        ctx.fillStyle = gradient;
        ctx.fill();

        // Draw dots at each point
        for (let i = 0; i < equityPoints.length; i++) {
            ctx.beginPath();
            ctx.arc(getX(i), getY(equityPoints[i]), 3, 0, Math.PI * 2);
            ctx.fillStyle = lineColor;
            ctx.fill();
            ctx.strokeStyle = '#0f172a';
            ctx.lineWidth = 1.5;
            ctx.stroke();
        }

    }, [trades]);

    return (
        <div className="equity-curve-container">
            <div className="equity-curve-header">
                <span className="equity-curve-title">EQUITY CURVE</span>
            </div>
            <canvas
                ref={canvasRef}
                style={{ width: '100%', height: '140px', display: 'block' }}
            />
        </div>
    );
}

export default EquityCurve;
