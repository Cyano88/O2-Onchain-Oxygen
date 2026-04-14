/**
 * agent.ts — Agentic Wallet Bootstrap
 *
 * Initialises the agent's identity on X Layer using OKX OnchainOS SDK
 * and ethers v6 for transaction signing.
 *
 * SDK: @okxweb3/onchainos-sdk  (identity, balance, DEX)
 *      ethers v6               (signing, broadcast)
 *      viem                    (multicall reads)
 */

import { ethers } from 'ethers';
import { createPublicClient, http, type PublicClient } from 'viem';
import { OnchainOSClient } from '@okxweb3/onchainos-sdk';
import 'dotenv/config';

// ─── X Layer Network Constants ──────────────────────────────────────────────
export const X_LAYER_CHAIN_ID = Number(process.env.X_LAYER_CHAIN_ID ?? 195);
export const X_LAYER_RPC = process.env.X_LAYER_RPC ?? 'https://testrpc.xlayer.tech';
export const OKLINK_BASE = 'https://www.oklink.com/xlayer';

export const X_LAYER_VIEM_CHAIN = {
  id: X_LAYER_CHAIN_ID,
  name: X_LAYER_CHAIN_ID === 196 ? 'X Layer' : 'X Layer Testnet',
  nativeCurrency: { name: 'OKB', symbol: 'OKB', decimals: 18 },
  rpcUrls: {
    default: { http: [X_LAYER_RPC] },
    public:  { http: [X_LAYER_RPC] },
  },
  blockExplorers: {
    default: { name: 'OKLink', url: OKLINK_BASE },
  },
} as const;

// ─── Contract Addresses ──────────────────────────────────────────────────────
export const ADDRESSES = {
  V3_POSITION_MANAGER: process.env.V3_POSITION_MANAGER as `0x${string}`,
  V4_POSITION_MANAGER: process.env.V4_POSITION_MANAGER as `0x${string}`,
  UNISWAP_V3_FACTORY:  process.env.UNISWAP_V3_FACTORY  as `0x${string}`,
  V4_POOL_MANAGER:     process.env.UNISWAP_V4_POOL_MANAGER as `0x${string}`,
  WOKB:                process.env.WOKB_ADDRESS as `0x${string}`,
  WETH:                process.env.WETH_ADDRESS as `0x${string}`,
  USDC:                process.env.USDC_ADDRESS as `0x${string}`,
};

// ─── Ethers Provider & Signer ────────────────────────────────────────────────
let _provider: ethers.JsonRpcProvider | null = null;
let _signer: ethers.Wallet | null = null;

export function getProvider(): ethers.JsonRpcProvider {
  if (!_provider) {
    _provider = new ethers.JsonRpcProvider(X_LAYER_RPC, {
      chainId: X_LAYER_CHAIN_ID,
      name: X_LAYER_VIEM_CHAIN.name,
    });
  }
  return _provider;
}

export function getSigner(): ethers.Wallet {
  if (!_signer) {
    const pk = process.env.AGENT_PRIVATE_KEY;
    if (!pk) throw new Error('AGENT_PRIVATE_KEY is not set in environment');
    _signer = new ethers.Wallet(pk, getProvider());
  }
  return _signer;
}

// ─── Viem Public Client (for multicall / reads) ──────────────────────────────
let _viemClient: PublicClient | null = null;

export function getViemClient(): PublicClient {
  if (!_viemClient) {
    _viemClient = createPublicClient({
      chain: X_LAYER_VIEM_CHAIN as any,
      transport: http(X_LAYER_RPC),
    });
  }
  return _viemClient as PublicClient;
}

// ─── OKX OnchainOS Client ────────────────────────────────────────────────────
let _onchainOS: OnchainOSClient | null = null;

/**
 * Initialises the OKX OnchainOS SDK client.
 * The OnchainOSClient provides:
 *  - getBalance()  — native + ERC-20 balances on X Layer
 *  - dex.getQuote() — real-time swap quotes via OKX DEX aggregator
 *  - dex.swap()    — execute a swap transaction
 */
export function getOnchainOSClient(): OnchainOSClient {
  if (!_onchainOS) {
    _onchainOS = new OnchainOSClient({
      apiKey:      process.env.OKX_API_KEY      ?? '',
      apiSecret:   process.env.OKX_API_SECRET   ?? '',
      passphrase:  process.env.OKX_PASSPHRASE   ?? '',
      privateKey:  process.env.AGENT_PRIVATE_KEY ?? '',
      chainId:     X_LAYER_CHAIN_ID,
      rpcUrl:      X_LAYER_RPC,
    });
  }
  return _onchainOS;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Returns the native OKB balance of an address in ETH-unit string. */
export async function getOKBBalance(address: string): Promise<string> {
  const provider = getProvider();
  const raw = await provider.getBalance(address);
  return ethers.formatEther(raw);
}

/** Formats a transaction hash into a full OKLink explorer URL. */
export function explorerTxUrl(txHash: string): string {
  return `${OKLINK_BASE}/tx/${txHash}`;
}

/** Formats an address into a full OKLink explorer URL. */
export function explorerAddressUrl(address: string): string {
  return `${OKLINK_BASE}/address/${address}`;
}
