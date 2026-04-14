# O2 Demo Script — 2 Minutes

**Title:** "O2: Building Self-Sustaining Intelligence on X Layer"  
**Format:** Live terminal + browser dashboard  
**Setup:** MCP server running, dashboard open at `localhost:5173`, terminal visible

---

## ACT I — THE CRISIS (0:00–0:45)

**[0:00]** *(Open the dashboard. The gas gauge is animated, showing 12% vitality — glowing red.)*

> "This is an autonomous AI agent. It's been trading, voting, executing transactions on X Layer all day. But look at this gauge."

*(Point to the GasGauge showing 12% with blinking red CRITICAL status.)*

> "Gas is at 12%. The agent has 0.031 OKB left. At the current burn rate, it will be dead in roughly **four more transactions**. In a traditional setup, this means paging a human developer at 3 AM to top it up manually."

*(Scroll the heartbeat log — it's showing: `GAS CRITICAL (12%). Autonomous refuel trigger activated.`)*

> "But nobody called us. Nobody is going to call us. Because this agent has something different."

**[0:25]** *(Switch to terminal. Run:)*
```bash
node dist/server.js &
# MCP server starts
```

> "It has a metabolism. Let me show you."

---

## ACT II — THE SOLUTION (0:45–1:30)

**[0:45]** *(In the terminal, make a direct MCP call to `get_metabolic_status`:)*

```bash
echo '{"method":"tools/call","params":{"name":"get_metabolic_status","arguments":{"agentAddress":"0xDe3d98c01C4B4EFe09F25A1EeC34dE64aCe7B48E"}}}' | node dist/server.js
```

*(Output appears — show it clearly:)*
```json
{
  "gasHealthPercent": 12,
  "isRefuelNeeded": true,
  "v3Positions": [{ "tokenId": "882", "totalFeesUSD": 14.28 }],
  "v4Positions": [{ "tokenId": "1204", "totalFeesUSD": 5.87 }],
  "totalHarvestableFeeUSD": 20.15,
  "recommendation": "GAS CRITICAL (12%). Best position: Uniswap V3 #882 ($14.28 harvestable)."
}
```

> "The agent scanned its own liquidity positions. It has **$20 in harvestable fees** sitting in Uniswap V3 and V4 — more than enough to refuel."

**[1:05]** *(Trigger the refuel from the dashboard — click "Harvest" on position #882. The log starts scrolling:)*

```
◆ INFO    Profitability Guard: evaluating position #882 (Uniswap V3)…
✔ OK      Guard passed. Harvest value $14.28 > 1.5× gas cost ($0.42). Executing…
◆ INFO    Broadcasting collect() → NonfungiblePositionManager…
✔ OK      Fee collection confirmed. [0xa1f3b8…]
◆ INFO    OKX OnchainOS DEX: routing WETH/USDC → OKB… (slippage: 0.5%)
✔ OK      Swap confirmed. +0.2847 OKB acquired. Wallet refuelled.
```

> "Three SDK calls. One autonomous decision loop. The agent just fed itself."

*(The GasGauge animates from 12% to 60%, switching from red to green.)*

---

## ACT III — THE VERIFICATION (1:30–2:00)

**[1:30]** *(In the dashboard, the "Live Transaction Verification" panel now shows two hashes. Click "View on Explorer" for the swap transaction.)*

> "Here's what makes this powerful for judges and users alike: **every metabolic event is permanently on-chain**."

*(Browser opens to OKLink with the swap transaction.)*

> "You can see: this is the agent's wallet address. This transaction was not triggered by any human. The `From` field is the agent itself. OKB balance increased. And the Uniswap position NFT is now empty of fees."

**[1:48]** *(Return to the dashboard. The gauge is green, the log is quiet.)*

> "The Profitability Guard ensured this was worth doing — $14 harvested, $0.42 in gas, $13.58 net gain. The agent is not just alive; it **profited from staying alive**."

**[1:55]** *(Closing.)*

> "O2 is not a gas top-up script. It's a metabolic architecture. An agent that earns its own oxygen. Built on X Layer, powered by OKX OnchainOS and Uniswap V3/V4."

> **"O2: Building self-sustaining intelligence on X Layer."**

---

## Technical Callouts for Q&A

**"How is this different from a bot that just keeps a wallet funded?"**
> A bot requires a separate funded wallet and human oversight. O2 sources its own fuel from yield the agent itself generated. It's fully circular — no external capital injection required after initial LP deployment.

**"What stops it from draining itself in fees?"**
> The Profitability Guard in `src/metabolic/guard.ts`. It enforces `yield > gasCost × 1.5` before signing any transaction. If a harvest isn't worth it, O2 waits.

**"Why X Layer specifically?"**
> OKB is both the native gas token AND the most liquid base asset on X Layer's DEX. The circular economy is only possible because the thing you spend (OKB gas) is also the thing you earn (OKB from WOKB swaps). On most chains, you spend ETH but earn arbitrary tokens — you'd always need an external step. On X Layer, the loop closes perfectly.

**"Does this work with other protocols?"**
> The MCP tool interface is protocol-agnostic. V3 and V4 are the reference implementations. Adding Aerodrome, Curve, or any yield source requires implementing the `scanPositions` + `collectFees` interface in `src/protocols/`.
