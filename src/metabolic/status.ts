/**
 * status.ts — Metabolic Status Check
 *
 * Implements the `get_metabolic_status` MCP tool.
 * Aggregates OKB balance + V3/V4 fee positions into a single health report.
 *
 * SDK: @okxweb3/onchainos-sdk → getBalance()
 *      @uniswap/v3-sdk        → NonfungiblePositionManager positions scan
 *      @uniswap/v4-sdk        → PositionManager positions scan
 */

import { ethers } from 'ethers';
import { z } from 'zod';
import { getOnchainOSClient, getOKBBalance, getProvider, ADDRESSES } from '../wallet/agent.js';
import { scanV3Positions, type V3PositionInfo } from '../protocols/v3.js';
import { scanV4Positions, type V4PositionInfo } from '../protocols/v4.js';
import { getOKBPriceUSD, getTokenPriceUSD } from './guard.js';

const MIN_GAS_THRESHOLD = parseFloat(process.env.MIN_GAS_THRESHOLD ?? '0.05');

// ─── Output Types ────────────────────────────────────────────────────────────

export interface EnrichedV3Position extends V3PositionInfo {
  fees0USD: number;
  fees1USD: number;
  totalFeesUSD: number;
}

export interface EnrichedV4Position extends V4PositionInfo {
  fees0USD: number;
  fees1USD: number;
  totalFeesUSD: number;
}

export interface MetabolicStatus {
  timestamp: string;
  agentAddress: string;

  // Gas vitals
  okbBalance: string;
  okbBalanceUSD: number;
  okbPriceUSD: number;
  gasHealthPercent: number;
  isRefuelNeeded: boolean;

  // Yield reserves
  v3Positions: EnrichedV3Position[];
  v4Positions: EnrichedV4Position[];
  totalHarvestableFeeUSD: number;

  // Diagnosis
  recommendation: string;
  explorerUrl: string;
}

// ─── ERC-20 Helpers ──────────────────────────────────────────────────────────
const ERC20_ABI = [
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
] as const;

async function getTokenDecimals(address: string): Promise<number> {
  try {
    const provider = getProvider();
    const token = new ethers.Contract(address, ERC20_ABI, provider);
    return Number(await token.decimals());
  } catch {
    return 18;
  }
}

// ─── Main Status Function ────────────────────────────────────────────────────

/**
 * Collects a full metabolic health report for the agent wallet.
 *
 * Steps:
 * 1. Fetch OKB balance via ethers provider (native balance on X Layer)
 * 2. Fetch OKB/USD price via OKX OnchainOS dex.getQuote()
 * 3. Scan V3 positions via @uniswap/v3-sdk NonfungiblePositionManager
 * 4. Scan V4 positions via @uniswap/v4-sdk PositionManager
 * 5. Price each unclaimed fee amount via OKX OnchainOS getQuote()
 * 6. Compute gasHealthPercent and recommendation
 */
export async function getMetabolicStatus(agentAddress: string): Promise<MetabolicStatus> {
  const timestamp = new Date().toISOString();
  const explorerUrl = `https://www.oklink.com/xlayer/address/${agentAddress}`;

  // ── Step 1: OKB Balance via ethers + OnchainOS ────────────────────────────
  // @okxweb3/onchainos-sdk provides getBalance with multi-asset support;
  // for native OKB we use ethers.provider.getBalance directly.
  const [okbBalanceStr, okbPriceUSD] = await Promise.all([
    getOKBBalance(agentAddress),
    getOKBPriceUSD(),
  ]);

  const okbBalance = parseFloat(okbBalanceStr);
  const okbBalanceUSD = okbBalance * okbPriceUSD;

  // Health score: 0–100%, capped at threshold×4 for "full health"
  const FULL_HEALTH_OKB = MIN_GAS_THRESHOLD * 4;
  const gasHealthPercent = Math.min(100, Math.round((okbBalance / FULL_HEALTH_OKB) * 100));
  const isRefuelNeeded = okbBalance < MIN_GAS_THRESHOLD;

  // ── Step 2: Scan V3 Positions ─────────────────────────────────────────────
  const [rawV3, rawV4] = await Promise.all([
    scanV3Positions(agentAddress),
    scanV4Positions(agentAddress),
  ]);

  // Enrich V3 positions with USD fee values
  const enrichedV3 = await Promise.all(
    rawV3.map(async (pos): Promise<EnrichedV3Position> => {
      const [dec0, dec1] = await Promise.all([
        getTokenDecimals(pos.token0),
        getTokenDecimals(pos.token1),
      ]);
      const [fees0USD, fees1USD] = await Promise.all([
        getTokenPriceUSD(pos.token0, pos.tokensOwed0, dec0),
        getTokenPriceUSD(pos.token1, pos.tokensOwed1, dec1),
      ]);
      return {
        ...pos,
        fees0USD,
        fees1USD,
        totalFeesUSD: fees0USD + fees1USD,
      };
    }),
  );

  // Enrich V4 positions with USD fee values
  const enrichedV4 = await Promise.all(
    rawV4.map(async (pos): Promise<EnrichedV4Position> => {
      const [dec0, dec1] = await Promise.all([
        getTokenDecimals(pos.poolKey.currency0),
        getTokenDecimals(pos.poolKey.currency1),
      ]);
      const [fees0USD, fees1USD] = await Promise.all([
        getTokenPriceUSD(pos.poolKey.currency0, pos.tokensOwed0, dec0),
        getTokenPriceUSD(pos.poolKey.currency1, pos.tokensOwed1, dec1),
      ]);
      return {
        ...pos,
        fees0USD,
        fees1USD,
        totalFeesUSD: fees0USD + fees1USD,
      };
    }),
  );

  const totalHarvestableFeeUSD =
    enrichedV3.reduce((s, p) => s + p.totalFeesUSD, 0) +
    enrichedV4.reduce((s, p) => s + p.totalFeesUSD, 0);

  // ── Step 3: Generate Recommendation ──────────────────────────────────────
  let recommendation: string;
  if (!isRefuelNeeded) {
    recommendation = `Gas healthy at ${gasHealthPercent}% (${okbBalance.toFixed(4)} OKB). No refuel needed.`;
  } else if (totalHarvestableFeeUSD === 0) {
    recommendation =
      `Gas critical (${gasHealthPercent}%). No harvestable yield found. ` +
      `Manual top-up required or wait for LP fees to accrue.`;
  } else {
    const bestV3 = enrichedV3.sort((a, b) => b.totalFeesUSD - a.totalFeesUSD)[0];
    const bestV4 = enrichedV4.sort((a, b) => b.totalFeesUSD - a.totalFeesUSD)[0];
    const bestPos = (bestV3?.totalFeesUSD ?? 0) >= (bestV4?.totalFeesUSD ?? 0) ? bestV3 : bestV4;
    const protocol = bestV3 === bestPos ? 'V3' : 'V4';
    recommendation =
      `GAS CRITICAL (${gasHealthPercent}%). Initiate metabolic harvest. ` +
      `Best position: Uniswap ${protocol} #${bestPos?.tokenId} ` +
      `($${bestPos?.totalFeesUSD.toFixed(2)} harvestable). ` +
      `Total available yield: $${totalHarvestableFeeUSD.toFixed(2)}.`;
  }

  return {
    timestamp,
    agentAddress,
    okbBalance: okbBalanceStr,
    okbBalanceUSD,
    okbPriceUSD,
    gasHealthPercent,
    isRefuelNeeded,
    v3Positions: enrichedV3,
    v4Positions: enrichedV4,
    totalHarvestableFeeUSD,
    recommendation,
    explorerUrl,
  };
}
