export type GasHealth = 'healthy' | 'warning' | 'critical';

export interface V3Position {
  tokenId: string;
  token0: string;
  token1: string;
  fee: number;
  tokensOwed0: string;
  tokensOwed1: string;
  fees0USD: number;
  fees1USD: number;
  totalFeesUSD: number;
}

export interface V4Position {
  tokenId: string;
  poolKey: {
    currency0: string;
    currency1: string;
    fee: number;
    tickSpacing: number;
    hooks: string;
  };
  tokensOwed0: string;
  tokensOwed1: string;
  fees0USD: number;
  fees1USD: number;
  totalFeesUSD: number;
}

export interface MetabolicStatus {
  timestamp: string;
  agentAddress: string;
  okbBalance: string;
  okbBalanceUSD: number;
  okbPriceUSD: number;
  gasHealthPercent: number;
  isRefuelNeeded: boolean;
  v3Positions: V3Position[];
  v4Positions: V4Position[];
  totalHarvestableFeeUSD: number;
  recommendation: string;
  explorerUrl: string;
}

export interface RefuelResult {
  success: boolean;
  harvestTxHash: string;
  swapTxHash: string;
  explorerUrl: string;
  okbReceived: string;
  newBalance: string;
  profitabilityReport: {
    harvestedValueUSD: number;
    gasCostUSD: number;
    netGainUSD: number;
    isProfitable: boolean;
  };
  error?: string;
}

export interface LogEntry {
  id: number;
  timestamp: string;
  level: 'info' | 'warn' | 'success' | 'error';
  message: string;
  txHash?: string;
}
