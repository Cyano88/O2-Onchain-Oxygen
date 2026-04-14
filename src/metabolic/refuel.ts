/**
 * refuel.ts — Metabolic Refuel Cycle
 *
 * Implements `execute_refuel_cycle` MCP tool.
 *
 * Pipeline:
 *   1. Profitability Guard check
 *   2. Collect LP fees (V3 or V4)
 *   3. Swap collected tokens → OKB via OKX OnchainOS DEX
 *   4. Return verified transaction hashes + updated balance
 *
 * SDK: @uniswap/v3-sdk  → collectV3Fees()
 *      @uniswap/v4-sdk  → collectV4Fees() via V4Planner + Actions
 *      @okxweb3/onchainos-sdk → dex.swap() for post-harvest OKB acquisition
 *      ethers v6        → signing & broadcast
 */

import { ethers } from 'ethers';
import { getOnchainOSClient, getSigner, getOKBBalance, explorerTxUrl, ADDRESSES, X_LAYER_CHAIN_ID } from '../wallet/agent.js';
import { collectV3Fees, estimateV3CollectGas, scanV3Positions } from '../protocols/v3.js';
import { collectV4Fees, estimateV4CollectGas, scanV4Positions, type V4PoolKey } from '../protocols/v4.js';
import { evaluateProfitability, getOKBPriceUSD, getTokenPriceUSD } from './guard.js';

// ─── Types ───────────────────────────────────────────────────────────────────

export type Protocol = 'v3' | 'v4';

export interface RefuelInput {
  agentAddress: string;
  targetPositionId: string;
  protocol: Protocol;
  slippageTolerance?: number; // percent, default 0.5
  deadline?: number;          // unix timestamp
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

// ─── ERC20 ABI (for approval) ────────────────────────────────────────────────
const ERC20_ABI = [
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function balanceOf(address account) view returns (uint256)',
] as const;

// ─── Main Refuel Function ─────────────────────────────────────────────────────

/**
 * Executes the full O2 metabolic cycle:
 *
 * Phase 1 — Profitability Guard:
 *   Estimate gas cost for the collect call. Compare against fee value
 *   using OKX OnchainOS price data. Block if not profitable.
 *
 * Phase 2 — Harvest:
 *   Call collect() on the target V3/V4 position to claim accrued fees.
 *
 * Phase 3 — Refuel:
 *   Use OKX OnchainOS dex.swap() to convert harvested tokens into OKB.
 *   This is the "Circular Economy" close: yield → OKB → agent gas.
 */
export async function executeRefuelCycle(input: RefuelInput): Promise<RefuelResult> {
  const {
    agentAddress,
    targetPositionId,
    protocol,
    slippageTolerance = 0.5,
    deadline = Math.floor(Date.now() / 1000) + 20 * 60,
  } = input;

  const signer = getSigner();
  const tokenId = BigInt(targetPositionId);

  // ── Phase 1: Profitability Guard ──────────────────────────────────────────
  const [okbPriceUSD, gasCostWei] = await Promise.all([
    getOKBPriceUSD(),
    protocol === 'v3'
      ? estimateV3CollectGas(tokenId, agentAddress)
      : estimateV4CollectGas(tokenId, agentAddress),
  ]);

  // Fetch the position's owed fee amounts and price them in USD
  let harvestedValueUSD = 0;
  let token0Address = '';
  let token1Address = '';
  let amount0Owed = 0n;
  let amount1Owed = 0n;
  let v4PoolKey: V4PoolKey | undefined;

  if (protocol === 'v3') {
    const positions = await scanV3Positions(agentAddress);
    const target = positions.find((p) => p.tokenId === tokenId);
    if (!target) {
      return {
        success: false, harvestTxHash: '', swapTxHash: '',
        explorerUrl: '', okbReceived: '0', newBalance: await getOKBBalance(agentAddress),
        profitabilityReport: { harvestedValueUSD: 0, gasCostUSD: 0, netGainUSD: 0, isProfitable: false },
        error: `V3 position #${targetPositionId} not found or has no fees.`,
      };
    }
    token0Address = target.token0;
    token1Address = target.token1;
    amount0Owed = target.tokensOwed0;
    amount1Owed = target.tokensOwed1;
    const [usd0, usd1] = await Promise.all([
      getTokenPriceUSD(token0Address, amount0Owed, 18),
      getTokenPriceUSD(token1Address, amount1Owed, 18),
    ]);
    harvestedValueUSD = usd0 + usd1;
  } else {
    const positions = await scanV4Positions(agentAddress);
    const target = positions.find((p) => p.tokenId === tokenId);
    if (!target) {
      return {
        success: false, harvestTxHash: '', swapTxHash: '',
        explorerUrl: '', okbReceived: '0', newBalance: await getOKBBalance(agentAddress),
        profitabilityReport: { harvestedValueUSD: 0, gasCostUSD: 0, netGainUSD: 0, isProfitable: false },
        error: `V4 position #${targetPositionId} not found or has no fees.`,
      };
    }
    token0Address = target.poolKey.currency0;
    token1Address = target.poolKey.currency1;
    amount0Owed = target.tokensOwed0;
    amount1Owed = target.tokensOwed1;
    v4PoolKey = target.poolKey;
    const [usd0, usd1] = await Promise.all([
      getTokenPriceUSD(token0Address, amount0Owed, 18),
      getTokenPriceUSD(token1Address, amount1Owed, 18),
    ]);
    harvestedValueUSD = usd0 + usd1;
  }

  const profitReport = evaluateProfitability(harvestedValueUSD, gasCostWei, okbPriceUSD);

  if (!profitReport.isProfitable) {
    return {
      success: false,
      harvestTxHash: '', swapTxHash: '',
      explorerUrl: '', okbReceived: '0',
      newBalance: await getOKBBalance(agentAddress),
      profitabilityReport: {
        harvestedValueUSD: profitReport.harvestedValueUSD,
        gasCostUSD: profitReport.gasCostUSD,
        netGainUSD: profitReport.netGainUSD,
        isProfitable: false,
      },
      error: `Profitability Guard blocked: ${profitReport.reason}`,
    };
  }

  // ── Phase 2: Harvest LP Fees ──────────────────────────────────────────────
  let harvestTxHash: string;
  let collected0: bigint;
  let collected1: bigint;

  if (protocol === 'v3') {
    const result = await collectV3Fees(tokenId, agentAddress);
    harvestTxHash = result.txHash;
    collected0 = result.amount0Collected;
    collected1 = result.amount1Collected;
  } else {
    const result = await collectV4Fees(tokenId, agentAddress, v4PoolKey!);
    harvestTxHash = result.txHash;
    collected0 = result.amount0Collected;
    collected1 = result.amount1Collected;
  }

  // ── Phase 3: Swap Harvested Tokens → OKB via OKX OnchainOS DEX ──────────
  // The OKX OnchainOS SDK's dex.swap() routes through the OKX DEX aggregator,
  // finding the optimal path to convert harvested yield into OKB gas.
  const client = getOnchainOSClient();
  const slippageBps = String(Math.round(slippageTolerance * 100));

  let swapTxHash = '';
  let totalOKBReceived = 0n;

  // Swap token0 if we received any
  if (collected0 > 0n && token0Address !== ADDRESSES.WOKB) {
    // Approve position manager spend for token0
    const token0Contract = new ethers.Contract(token0Address, ERC20_ABI, signer);
    const approveTx = await token0Contract.approve(
      await client.dex.getRouterAddress(String(X_LAYER_CHAIN_ID)),
      collected0,
    );
    await approveTx.wait(1);

    // Execute swap: token0 → WOKB (OKB)
    const swap0 = await client.dex.swap({
      chainId:          String(X_LAYER_CHAIN_ID),
      fromToken:        token0Address,
      toToken:          ADDRESSES.WOKB,
      amount:           collected0.toString(),
      slippage:         slippageBps,
      userWalletAddress: agentAddress,
      deadline:         String(deadline),
    });
    swapTxHash = swap0.txHash;
    totalOKBReceived += BigInt(swap0.toTokenAmount ?? '0');
  }

  // Swap token1 if we received any (and it's a different token)
  if (collected1 > 0n && token1Address !== ADDRESSES.WOKB && token1Address !== token0Address) {
    const token1Contract = new ethers.Contract(token1Address, ERC20_ABI, signer);
    const approveTx = await token1Contract.approve(
      await client.dex.getRouterAddress(String(X_LAYER_CHAIN_ID)),
      collected1,
    );
    await approveTx.wait(1);

    const swap1 = await client.dex.swap({
      chainId:          String(X_LAYER_CHAIN_ID),
      fromToken:        token1Address,
      toToken:          ADDRESSES.WOKB,
      amount:           collected1.toString(),
      slippage:         slippageBps,
      userWalletAddress: agentAddress,
      deadline:         String(deadline),
    });
    if (!swapTxHash) swapTxHash = swap1.txHash;
    totalOKBReceived += BigInt(swap1.toTokenAmount ?? '0');
  }

  // ── Result ────────────────────────────────────────────────────────────────
  const newBalance = await getOKBBalance(agentAddress);
  const finalExplorerUrl = explorerTxUrl(swapTxHash || harvestTxHash);

  return {
    success: true,
    harvestTxHash,
    swapTxHash,
    explorerUrl: finalExplorerUrl,
    okbReceived: ethers.formatEther(totalOKBReceived),
    newBalance,
    profitabilityReport: {
      harvestedValueUSD: profitReport.harvestedValueUSD,
      gasCostUSD: profitReport.gasCostUSD,
      netGainUSD: profitReport.netGainUSD,
      isProfitable: true,
    },
  };
}
