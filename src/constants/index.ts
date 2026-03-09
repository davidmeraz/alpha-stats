import { Stats } from '../types';

export const POINT_VALUE_PER_CONTRACT = 5;
export const TICK_SIZE = 0.25;

export const EMPTY_STATS: Stats = {
    winRate: 0, avgWinUSD: 0, avgLossUSD: 0, avgRR: 0,
    totalUSD: 0, expectancyUSD: 0, profitFactor: 0,
    maxDrawdown: 0, bestTrade: 0, worstTrade: 0,
    bestDayGains: 0, totalTrades: 0,
};
