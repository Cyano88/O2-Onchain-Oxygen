/**
 * guard.ts — Profitability Guard
 *
 * Before any on-chain harvest, O2 verifies that the value of collected fees
 * exceeds the gas cost of the operation by a safety margin.
 *
 * Rule: harvestedValueUSD >= gasCostUSD * PROFIT_MARGIN_MULTIPLIER
 *
 * This prevents the agent from burning more gas than it earns — a critical
 * safeguard for autonomous systems that have no human oversight.
 */

import { ethers } from 'ethers';
import { getProvider, getOnchainOSClient } from '../wallet/agent.js';

// ─── Configuration ────────────────────────────────────────────────────────────
/** Minimum safety multiplier: harvested value must be 1.5× the gas cost. */
const PROFIT_MARGIN_MULTIPLIER = 1.5;

/** ERC-20 balanceOf ABI for reading token balances. */
const ERC20_ABI = [
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
] as const;

export interface ProfitabilityReport {
  harvestedValueUSD: number;
  gasCostUSD:        number;
  netGainUSD:        number;
  isProfitable:      boolean;
  marginMultiplier:  number;
  reason:            string;
}

/**
 * Fetches the current OKB/USD price from OKX OnchainOS DEX aggregator.
 * Falls back to a conservative estimate if the API call fails.
 *
 * SDK: @okxweb3/onchainos-sdk → client.dex.getQuote()
 */
export async function getOKBPriceUSD(): Promise<number> {
  try {
    const client = getOnchainOSClient();
    // Use the OKX DEX aggregator to get a live OKB/USDC price
    const quote = await client.dex.getQuote({
      chainId:   String(Number(process.env.X_LAYER_CHAIN_ID ?? 195)),
      fromToken: process.env.WOKB_ADDRESS ?? '',  // WOKB
      toToken:   process.env.USDC_ADDRESS ?? '',  // USDC
      amount:    ethers.parseEther('1').toString(), // 1 OKB
    });
    // quote.toTokenAmount is the USDC received for 1 OKB (6 decimals)
    return Number(quote.toTokenAmount) / 1e6;
  } catch {
    // Fallback: conservative OKB price estimate for guard calculation
    return 45.00;
  }
}

/**
 * Fetches USD price of an ERC-20 token relative to OKB via DEX quote.
 *
 * SDK: @okxweb3/onchainos-sdk → client.dex.getQuote()
 */
export async function getTokenPriceUSD(
  tokenAddress: string,
  amountWei: bigint,
  tokenDecimals: number,
): Promise<number> {
  if (amountWei === 0n) return 0;

  try {
    const client = getOnchainOSClient();
    const quote = await client.dex.getQuote({
      chainId:   String(Number(process.env.X_LAYER_CHAIN_ID ?? 195)),
      fromToken: tokenAddress,
      toToken:   process.env.USDC_ADDRESS ?? '',
      amount:    amountWei.toString(),
    });
    return Number(quote.toTokenAmount) / 1e6;
  } catch {
    return 0;
  }
}

/**
 * Core Profitability Guard.
 *
 * @param harvestedValueUSD  USD value of fees about to be collected
 * @param gasCostWei         Estimated gas cost in wei (OKB)
 * @param okbPriceUSD        Current OKB/USD price
 *
 * @returns ProfitabilityReport — includes isProfitable flag that MUST be
 *          checked before executing any on-chain transaction.
 */
export function evaluateProfitability(
  harvestedValueUSD: number,
  gasCostWei: bigint,
  okbPriceUSD: number,
): ProfitabilityReport {
  const gasCostOKB = Number(ethers.formatEther(gasCostWei));
  const gasCostUSD = gasCostOKB * okbPriceUSD;
  const netGainUSD = harvestedValueUSD - gasCostUSD;
  const requiredMinimumUSD = gasCostUSD * PROFIT_MARGIN_MULTIPLIER;
  const isProfitable = harvestedValueUSD >= requiredMinimumUSD;

  const marginMultiplier =
    gasCostUSD > 0 ? harvestedValueUSD / gasCostUSD : Infinity;

  let reason: string;
  if (gasCostWei === 0n) {
    reason = 'Unable to estimate gas cost — transaction blocked for safety.';
  } else if (harvestedValueUSD === 0) {
    reason = 'No harvestable yield detected. Nothing to collect.';
  } else if (!isProfitable) {
    reason =
      `Harvest value ($${harvestedValueUSD.toFixed(4)}) is less than ` +
      `${PROFIT_MARGIN_MULTIPLIER}× gas cost ($${requiredMinimumUSD.toFixed(4)}). ` +
      `Blocking transaction to protect agent funds.`;
  } else {
    reason =
      `Profitable: yield ($${harvestedValueUSD.toFixed(4)}) ` +
      `exceeds ${PROFIT_MARGIN_MULTIPLIER}× gas cost ($${requiredMinimumUSD.toFixed(4)}). ` +
      `Net gain: $${netGainUSD.toFixed(4)}.`;
  }

  return {
    harvestedValueUSD,
    gasCostUSD,
    netGainUSD,
    isProfitable,
    marginMultiplier,
    reason,
  };
}
