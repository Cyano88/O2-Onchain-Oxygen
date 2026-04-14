/**
 * v4.ts — Uniswap V4 Position Fee Scanner & Collector
 *
 * SDK: @uniswap/v4-sdk  V4Planner, Actions, PositionManager
 *      @uniswap/sdk-core  Currency, Token
 *      ethers v6          contract interaction + signing
 *
 * V4 Architecture Note:
 *   Unlike V3's per-pair contracts, V4 uses a singleton PoolManager.
 *   Positions are managed by the PositionManager contract, which holds
 *   the NFT and routes actions to the PoolManager via `modifyLiquidities`.
 *   Fee collection is done via the `COLLECT_FEES` action in V4Planner.
 */

import { ethers } from 'ethers';
import {
  V4Planner,
  Actions,
  PositionManager,
  Pool,
  Position,
} from '@uniswap/v4-sdk';
import { Token, CurrencyAmount, Percent } from '@uniswap/sdk-core';
import { getProvider, getSigner, ADDRESSES, X_LAYER_CHAIN_ID } from '../wallet/agent.js';

// ─── ABIs (V4 PositionManager) ───────────────────────────────────────────────
const V4_POSITION_MANAGER_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)',
  'function getPositionInfo(uint256 tokenId) view returns (address poolManager, bytes32 positionKey, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)',
  'function getPoolAndPositionInfo(uint256 tokenId) view returns (tuple(address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) poolKey, int24 tickLower, int24 tickUpper, uint128 liquidity, uint128 tokensOwed0, uint128 tokensOwed1)',
  'function modifyLiquidities(bytes calldata unlockData, uint256 deadline) payable returns (bytes[] memory)',
  'function ownerOf(uint256 tokenId) view returns (address)',
] as const;

export interface V4PoolKey {
  currency0: string;
  currency1: string;
  fee: number;
  tickSpacing: number;
  hooks: string;
}

export interface V4PositionInfo {
  tokenId: bigint;
  poolKey: V4PoolKey;
  tickLower: number;
  tickUpper: number;
  liquidity: bigint;
  tokensOwed0: bigint;
  tokensOwed1: bigint;
}

export interface V4CollectResult {
  tokenId: bigint;
  txHash: string;
  amount0Collected: bigint;
  amount1Collected: bigint;
  currency0: string;
  currency1: string;
}

const MAX_UINT_128 = BigInt('0xffffffffffffffffffffffffffffffff');
const COLLECT_DEADLINE_BUFFER = 20 * 60; // 20 minutes in seconds

/**
 * Scans all Uniswap V4 NFT positions held by `ownerAddress`
 * and returns those with unclaimed fee balances.
 *
 * Uses @uniswap/v4-sdk PositionManager ABI to enumerate positions.
 */
export async function scanV4Positions(ownerAddress: string): Promise<V4PositionInfo[]> {
  const provider = getProvider();
  const positionManager = new ethers.Contract(
    ADDRESSES.V4_POSITION_MANAGER,
    V4_POSITION_MANAGER_ABI,
    provider,
  );

  const balance: bigint = await positionManager.balanceOf(ownerAddress);
  if (balance === 0n) return [];

  const tokenIdPromises: Promise<bigint>[] = [];
  for (let i = 0n; i < balance; i++) {
    tokenIdPromises.push(positionManager.tokenOfOwnerByIndex(ownerAddress, i));
  }
  const tokenIds = await Promise.all(tokenIdPromises);

  // Fetch full pool + position info in parallel
  const infoPromises = tokenIds.map((id) =>
    positionManager.getPoolAndPositionInfo(id),
  );
  const infos = await Promise.all(infoPromises);

  const positions: V4PositionInfo[] = [];
  for (let i = 0; i < tokenIds.length; i++) {
    const info = infos[i];
    const tokensOwed0 = BigInt(info.tokensOwed0.toString());
    const tokensOwed1 = BigInt(info.tokensOwed1.toString());

    if (tokensOwed0 > 0n || tokensOwed1 > 0n) {
      positions.push({
        tokenId: tokenIds[i],
        poolKey: {
          currency0: info.poolKey.currency0,
          currency1: info.poolKey.currency1,
          fee:        Number(info.poolKey.fee),
          tickSpacing: Number(info.poolKey.tickSpacing),
          hooks:      info.poolKey.hooks,
        },
        tickLower:   Number(info.tickLower),
        tickUpper:   Number(info.tickUpper),
        liquidity:   BigInt(info.liquidity.toString()),
        tokensOwed0,
        tokensOwed1,
      });
    }
  }

  return positions;
}

/**
 * Collects fees from a Uniswap V4 position using the V4Planner.
 *
 * Flow:
 *   1. Build a V4Planner with the COLLECT_FEES action
 *   2. Encode via planner.finalize()
 *   3. Call positionManager.modifyLiquidities(encodedData, deadline)
 *
 * SDK reference:
 *   @uniswap/v4-sdk → V4Planner, Actions.COLLECT_FEES
 */
export async function collectV4Fees(
  tokenId: bigint,
  recipientAddress: string,
  poolKey: V4PoolKey,
): Promise<V4CollectResult> {
  const signer = getSigner();
  const positionManagerContract = new ethers.Contract(
    ADDRESSES.V4_POSITION_MANAGER,
    V4_POSITION_MANAGER_ABI,
    signer,
  );

  // ─── Build the V4 action plan ─────────────────────────────────────────────
  // V4Planner encodes a sequence of PoolManager actions into a single calldata blob.
  // COLLECT_FEES withdraws accumulated fees for the specified position NFT.
  const planner = new V4Planner();

  planner.addAction(Actions.COLLECT_FEES, [
    tokenId,           // position NFT id
    recipientAddress,  // fee recipient
    MAX_UINT_128,      // amount0Max — collect everything
    MAX_UINT_128,      // amount1Max — collect everything
  ]);

  const { calldata } = planner.finalize();

  const deadline = BigInt(Math.floor(Date.now() / 1000) + COLLECT_DEADLINE_BUFFER);

  // Estimate gas
  const gasEstimate = await positionManagerContract.modifyLiquidities.estimateGas(
    calldata,
    deadline,
  );

  // Execute
  const tx = await positionManagerContract.modifyLiquidities(
    calldata,
    deadline,
    { gasLimit: (gasEstimate * 120n) / 100n },
  );
  const receipt = await tx.wait(1);

  // Parse CollectFees event
  const eventInterface = new ethers.Interface([
    'event CollectFees(uint256 indexed tokenId, address indexed recipient, address currency0, address currency1, uint256 amount0, uint256 amount1)',
  ]);

  let amount0Collected = 0n;
  let amount1Collected = 0n;

  for (const log of receipt.logs) {
    try {
      const parsed = eventInterface.parseLog(log);
      if (parsed?.name === 'CollectFees') {
        amount0Collected = parsed.args.amount0;
        amount1Collected = parsed.args.amount1;
        break;
      }
    } catch {
      // Not a CollectFees event
    }
  }

  return {
    tokenId,
    txHash: receipt.hash,
    amount0Collected,
    amount1Collected,
    currency0: poolKey.currency0,
    currency1: poolKey.currency1,
  };
}

/** Returns estimated gas cost in wei for a V4 collect operation. */
export async function estimateV4CollectGas(
  tokenId: bigint,
  recipient: string,
): Promise<bigint> {
  const provider = getProvider();
  const positionManagerContract = new ethers.Contract(
    ADDRESSES.V4_POSITION_MANAGER,
    V4_POSITION_MANAGER_ABI,
    provider,
  );

  const planner = new V4Planner();
  planner.addAction(Actions.COLLECT_FEES, [
    tokenId,
    recipient,
    MAX_UINT_128,
    MAX_UINT_128,
  ]);
  const { calldata } = planner.finalize();

  const deadline = BigInt(Math.floor(Date.now() / 1000) + COLLECT_DEADLINE_BUFFER);
  const gasEstimate = await positionManagerContract.modifyLiquidities.estimateGas(
    calldata,
    deadline,
  );
  const feeData = await provider.getFeeData();
  return gasEstimate * (feeData.gasPrice ?? 0n);
}
