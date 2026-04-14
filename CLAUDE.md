# O2 — Metabolic Agent Skill

## Skill Identity

**Name:** O2 (Onchain Oxygen)  
**Version:** 1.0.0  
**Category:** Agent Infrastructure / DeFi Automation  
**Network:** X Layer (OKB L2, Chain IDs: 196 mainnet / 195 testnet)  
**Standard:** MCP (Model Context Protocol) Skill

---

## Capability Declaration

O2 is a self-contained MCP Skill that grants any AI agent **Autonomous Metabolism** — the ability to self-fund its own gas operations by harvesting yield from Uniswap V3/V4 liquidity positions and converting that yield into OKB gas tokens without human intervention.

---

## Available Tools

### `get_metabolic_status`

**Purpose:** Assess the agent's current "vital signs" — OKB gas level plus all Uniswap V3/V4 LP positions with harvestable fees.

**Inputs:**
```typescript
{
  agentAddress: string   // The agent's wallet address on X Layer
}
```

**Outputs:**
```typescript
{
  okbBalance: string         // Native OKB balance in ETH units
  okbBalanceUSD: number      // USD equivalent
  gasHealthPercent: number   // 0–100 vitality score
  isRefuelNeeded: boolean    // true when below MIN_GAS_THRESHOLD
  v3Positions: V3Position[]  // Uniswap V3 NFTs with fees > 0
  v4Positions: V4Position[]  // Uniswap V4 NFTs with fees > 0
  totalHarvestableFeeUSD: number
  recommendation: string
}
```

**SDK Usage:**
- `@okxweb3/onchainos-sdk` → `OnchainOSClient.getBalance()` for OKB balance
- `viem` → `createPublicClient` for multicall position reads
- `@uniswap/v3-sdk` → `NonfungiblePositionManager.positions()` ABI
- `@uniswap/v4-sdk` → `PositionManager` position queries

---

### `execute_refuel_cycle`

**Purpose:** Execute a full metabolic harvest: collect LP fees from a target position, swap proceeds to OKB, return the verified transaction hash.

**Inputs:**
```typescript
{
  agentAddress: string
  targetPositionId: string    // NFT tokenId to harvest
  protocol: "v3" | "v4"
  slippageTolerance?: number  // default: 0.5 (%)
  deadline?: number           // UNIX timestamp, default: now + 20 min
}
```

**Outputs:**
```typescript
{
  success: boolean
  harvestTxHash: string      // fee collection transaction
  swapTxHash: string         // OKB swap transaction
  explorerUrl: string        // OKLink deep link for verification
  okbReceived: string        // OKB acquired from swap
  newBalance: string         // Updated OKB balance post-refuel
  profitabilityReport: {
    harvestedValueUSD: number
    gasCostUSD: number
    netGainUSD: number
    isProfitable: boolean
  }
}
```

**SDK Usage:**
- `@uniswap/v3-sdk` → `NonfungiblePositionManager.collectCallParameters()` → collect tx
- `@uniswap/v4-sdk` → `V4Planner`, `Actions.COLLECT_FEES` → modifyLiquidities
- `@okxweb3/onchainos-sdk` → `dex.swap()` for post-harvest OKB acquisition
- `ethers` → `Wallet.sendTransaction()` for broadcast

---

## Autonomy Contract

O2 operates under a **Profitability Guard**: it will NEVER execute a refuel cycle if:

```
harvestedValueUSD < gasCostUSD * 1.5
```

This 50% margin ensures every metabolic event creates net value. The guard is enforced in `src/metabolic/guard.ts` before any on-chain transaction is signed.

---

## Integration with x402 Standard

O2 is designed to complement the x402 agentic payment standard. While x402 handles micropayment authorization between agents, O2 handles the underlying energy (gas) that makes those payments possible. Together they form a complete Agent Economic Stack:

```
x402  →  "I authorize this payment"
O2    →  "I have the gas to execute it"
```

---

## Security Model

- Agent private key is held exclusively in the `.env` / secure secrets store
- O2 never exposes the private key through any MCP tool output
- All transactions are broadcast directly to X Layer; no intermediary custody
- The Profitability Guard prevents drain attacks via artificially cheap gas estimates

---

## On-Chain Verification

Every refuel event is permanently recorded on X Layer. Verification steps:
1. Capture `harvestTxHash` and `swapTxHash` from `execute_refuel_cycle` output
2. Navigate to `https://www.oklink.com/xlayer/tx/{txHash}`
3. Confirm `collect()` call on V3 Position Manager or V4 Position Manager
4. Confirm OKB balance increase in the agent wallet

---

## Skill Taxonomy

```
Skills Category:   Agent Infrastructure
Sub-category:      Gas Management / Yield Automation
Protocols Used:    Uniswap V3, Uniswap V4, OKX DEX
Networks:          X Layer (primary), EVM-compatible
Trigger Type:      Threshold-based (gas level) + Manual
Execution Mode:    Fully Autonomous
Human-in-Loop:     Optional (configurable via MIN_GAS_THRESHOLD)
```
