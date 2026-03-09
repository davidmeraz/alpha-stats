import { Trade, Stats } from '../types';
import { EMPTY_STATS } from '../constants';
import { floor1 } from './formatters';

export const calculateStats = (trades: Trade[]): Stats => {
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
