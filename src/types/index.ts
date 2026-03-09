export const SETUP_TAGS = ['Breakout', 'Pullback', 'Range', 'Reversal', 'Scalp', 'Trend', 'Other'] as const;
export type SetupTag = typeof SETUP_TAGS[number];

export interface Trade {
    id: string;
    isLong: boolean;
    contracts: number;
    entryPrice: number;
    exitPrice: number;
    stopLoss?: number;
    takeProfit?: number;
    points: number;
    ticks: number;
    riskPoints?: number;
    rewardPoints?: number;
    grossUSD: number;
    commission: number;
    resultUSD: number;
    isWin: boolean;
    date: string;
    createdAt?: number;
    screenshotFile?: string;
    note?: string;
    setup?: SetupTag;
}

export interface Stats {
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
    bestDayGains: number;
    totalTrades: number;
}
