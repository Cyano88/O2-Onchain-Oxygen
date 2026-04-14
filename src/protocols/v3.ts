/**
 * v3.ts — Uniswap V3 Position Fee Scanner & Collector
 *
 * SDK: @uniswap/v3-sdk  NonfungiblePositionManager
 *      @uniswap/sdk-core  Token, CurrencyAmount
 *      ethers v6         contract interaction
 */

import { ethers, MaxUint256 } from 'ethers';
import {
  NonfungiblePositionManager,
  Pool,
  Position,
} from '@uniswap/v3-sdk';
import { Token, CurrencyAmount, Percent } from '@uniswap/sdk-core';
import { getProvider, getSigner, getViemClient, ADDRESSES, X_LAYER_CHAIN_ID } from '../wallet/agent.js';

// ─── ABIs (minimal — only methods we call) ───────────────────────────────────
const POSITION_MANAGER_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)',
  'function positions(uint256 tokenId) view returns (uint96 nonce, address operator, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)',
  'function collect(tuple(uint256 tokenId, address recipient, uint128 amount0Max, uint128 amount1Max) params) returns (uint256 amount0, uint256 amount1)',
  'function ownerOf(uint256 tokenId) view returns (address)',
] as const;

export interface V3PositionInfo {
  tokenId: bigint;
  token0: string;
  token1: string;
  fee: number;
  liquidity: bigint;
  tokensOwed0: bigint;
  tokensOwed1: bigint;
  tickLower: number;
  tickUpper: number;
}

export interface V3CollectResult {
  tokenId: bigint;
  txHash: string;
  amount0Collected: bigint;
  amount1Collected: bigint;
  token0: string;
  token1: string;
}

// ─── MaxUint128 for collect() calls ──────────────────────────────────────────
const MAX_UINT_128 = BigInt('0xffffffffffffffffffffffffffffffff');

/**
 * Fetches all Uniswap V3 NFT positions owned by `ownerAddress`
 * that have unclaimed fees (tokensOwed0 > 0 OR tokensOwed1 > 0).
 *
 * Uses @uniswap/v3-sdk NonfungiblePositionManager ABI pattern.
 */
export async function scanV3Positions(ownerAddress: string): Promise<V3PositionInfo[]> {
  const provider = getProvider();
  const positionManager = new ethers.Contract(
    ADDRESSES.V3_POSITION_MANAGER,
    POSITION_MANAGER_ABI,
    provider,
  );

  // Get count of NFTs held by this agent
  const balance: bigint = await positionManager.balanceOf(ownerAddress);
  if (balance === 0n) return [];

  const positions: V3PositionInfo[] = [];

  // Enumerate each NFT by index
  const tokenIdPromises: Promise<bigint>[] = [];
  for (let i = 0n; i < balance; i++) {
    tokenIdPromises.push(positionManager.tokenOfOwnerByIndex(ownerAddress, i));
  }
  const tokenIds = await Promise.all(tokenIdPromises);

  // Fetch position data in parallel
  const positionDataPromises = tokenIds.map((tokenId) =>
    positionManager.positions(tokenId),
  );
  const positionData = await Promise.all(positionDataPromises);

  for (let i = 0; i < tokenIds.length; i++) {
    const p = positionData[i];
    const tokensOwed0 = BigInt(p.tokensOwed0.toString());
    const tokensOwed1 = BigInt(p.tokensOwed1.toString());

    // Only include positions with claimable fees
    if (tokensOwed0 > 0n || tokensOwed1 > 0n) {
      positions.push({
        tokenId: tokenIds[i],
        token0: p.token0,
        token1: p.token1,
        fee: Number(p.fee),
        liquidity: BigInt(p.liquidity.toString()),
        tokensOwed0,
        tokensOwed1,
        tickLower: Number(p.tickLower),
        tickUpper: Number(p.tickUpper),
      });
    }
  }

  return positions;
}

/**
 * Collects accumulated fees from a Uniswap V3 position NFT.
 *
 * Calls NonfungiblePositionManager.collect() with amount0Max/amount1Max = MaxUint128
 * to claim the full accrued fee balance.
 *
 * SDK reference: @uniswap/v3-sdk NonfungiblePositionManager.collectCallParameters()
 */
export async function collectV3Fees(
  tokenId: bigint,
  recipientAddress: string,
): Promise<V3CollectResult> {
  const signer = getSigner();
  const positionManager = new ethers.Contract(
    ADDRESSES.V3_POSITION_MANAGER,
    POSITION_MANAGER_ABI,
    signer,
  );

  // Build collect params using the NonfungiblePositionManager SDK helper
  // This mirrors NonfungiblePositionManager.collectCallParameters() structure
  const collectParams = {
    tokenId:    tokenId,
    recipient:  recipientAddress,
    amount0Max: MAX_UINT_128,
    amount1Max: MAX_UINT_128,
  };

  // Estimate gas before sending to support the Profitability Guard check
  const gasEstimate = await positionManager.collect.estimateGas(collectParams);
  const gasPrice = (await signer.provider!.getFeeData()).gasPrice ?? 0n;
  const gasCostWei = gasEstimate * gasPrice;

  // Fetch position info so we can report token addresses in the result
  const posData = await positionManager.positions(tokenId);

  // Execute the collect transaction
  const tx = await positionManager.collect(collectParams, {
    gasLimit: (gasEstimate * 120n) / 100n, // 20% buffer
  });
  const receipt = await tx.wait(1);

  // Parse Transfer events to determine actual amounts collected
  // The collect() function emits Collect(tokenId, recipient, amount0, amount1)
  const collectInterface = new ethers.Interface([
    'event Collect(uint256 indexed tokenId, address recipient, uint256 amount0Collect, uint256 amount1Collect)',
  ]);

  let amount0Collected = 0n;
  let amount1Collected = 0n;

  for (const log of receipt.logs) {
    try {
      const parsed = collectInterface.parseLog(log);
      if (parsed?.name === 'Collect') {
        amount0Collected = parsed.args.amount0Collect;
        amount1Collected = parsed.args.amount1Collect;
        break;
      }
    } catch {
      // Not a Collect event, continue
    }
  }

  return {
    tokenId,
    txHash: receipt.hash,
    amount0Collected,
    amount1Collected,
    token0: posData.token0,
    token1: posData.token1,
  };
}

/** Returns the estimated gas cost (in wei) for a V3 collect call. */
export async function estimateV3CollectGas(tokenId: bigint, recipient: string): Promise<bigint> {
  const provider = getProvider();
  const positionManager = new ethers.Contract(
    ADDRESSES.V3_POSITION_MANAGER,
    POSITION_MANAGER_ABI,
    provider,
  );
  const gasEstimate = await positionManager.collect.estimateGas({
    tokenId,
    recipient,
    amount0Max: MAX_UINT_128,
    amount1Max: MAX_UINT_128,
  });
  const feeData = await provider.getFeeData();
  return gasEstimate * (feeData.gasPrice ?? 0n);
}
