import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GasGauge } from './components/GasGauge';
import { YieldTable } from './components/YieldTable';
import { HeartbeatLog } from './components/HeartbeatLog';
import { VerificationPanel } from './components/ExplorerLink';
import type { MetabolicStatus, RefuelResult, LogEntry } from './types';

// ─── Mock data for demo mode (no live backend required) ───────────────────────
function getMockStatus(tick: number): MetabolicStatus {
  const pct = Math.max(5, 20 - tick * 2);
  const okbBalance = (pct / 100 * 0.2).toFixed(6);
  return {
    timestamp: new Date().toISOString(),
    agentAddress: '0xDe3d98c01C4B4EFe09F25A1EeC34dE64aCe7B48E',
    okbBalance,
    okbBalanceUSD: parseFloat(okbBalance) * 45,
    okbPriceUSD: 45,
    gasHealthPercent: pct,
    isRefuelNeeded: pct < 25,
    v3Positions: pct < 15 ? [
      {
        tokenId: '882',
        token0: '0x5A77f1443D16ee5761d310e38b62f77f726bC71c',
        token1: '0x74b7F16337b8972027F6196A17a631aC6dE26d22',
        fee: 3000,
        tokensOwed0: '8200000000000000',
        tokensOwed1: '5100000',
        fees0USD: 9.18,
        fees1USD: 5.10,
        totalFeesUSD: 14.28,
      },
    ] : [],
    v4Positions: pct < 15 ? [
      {
        tokenId: '1204',
        poolKey: {
          currency0: '0x0000000000000000000000000000000000000000',
          currency1: '0x74b7F16337b8972027F6196A17a631aC6dE26d22',
          fee: 500,
          tickSpacing: 10,
          hooks: '0x0000000000000000000000000000000000000000',
        },
        tokensOwed0: '3100000000000000',
        tokensOwed1: '2400000',
        fees0USD: 3.47,
        fees1USD: 2.40,
        totalFeesUSD: 5.87,
      },
    ] : [],
    totalHarvestableFeeUSD: pct < 15 ? 20.15 : 0,
    recommendation: pct < 25
      ? `GAS CRITICAL (${pct}%). Initiate metabolic harvest. Best position: Uniswap V3 #882 ($14.28 harvestable).`
      : `Gas healthy at ${pct}% (${okbBalance} OKB). No refuel needed.`,
    explorerUrl: 'https://www.oklink.com/xlayer/address/0xDe3d98c01C4B4EFe09F25A1EeC34dE64aCe7B48E',
  };
}

const DEMO_TX_HASH = '0x7f3a9b2e1c4d8f6a0e5b3c9d2a7f1e4b8c3d6a9e2f5b8c1d4e7a0f3b6c9d2e5';

// ─── Log helpers ──────────────────────────────────────────────────────────────
let logCounter = 0;
function makeLog(level: LogEntry['level'], message: string, txHash?: string): LogEntry {
  return {
    id: ++logCounter,
    timestamp: new Date().toISOString(),
    level,
    message,
    txHash,
  };
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [status, setStatus] = useState<MetabolicStatus>(getMockStatus(0));
  const [logs, setLogs] = useState<LogEntry[]>([
    makeLog('info', 'O2 Metabolic Agent initialised on X Layer Testnet (Chain 195)'),
    makeLog('info', `Agent wallet: 0xDe3d…B48E | Threshold: 0.05 OKB`),
  ]);
  const [isHarvesting, setIsHarvesting] = useState(false);
  const [harvestingId, setHarvestingId] = useState<string | null>(null);
  const [refuelResult, setRefuelResult] = useState<RefuelResult | null>(null);
  const [tick, setTick] = useState(0);
  const tickRef = useRef(0);

  const addLog = useCallback((level: LogEntry['level'], message: string, txHash?: string) => {
    setLogs((prev) => [...prev.slice(-99), makeLog(level, message, txHash)]);
  }, []);

  // ── Simulate gas drain every 4 seconds ─────────────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      tickRef.current += 1;
      setTick(tickRef.current);
      const nextStatus = getMockStatus(tickRef.current);
      setStatus(nextStatus);

      if (tickRef.current % 3 === 0) {
        addLog('info', `Polling metabolic status… OKB: ${nextStatus.okbBalance} (${nextStatus.gasHealthPercent}% vitality)`);
      }

      if (nextStatus.gasHealthPercent <= 20 && nextStatus.gasHealthPercent > 18) {
        addLog('warn', `Gas vitality at ${nextStatus.gasHealthPercent}%. Scanning LP positions for yield…`);
      }

      if (nextStatus.gasHealthPercent <= 10 && !isHarvesting) {
        addLog('error', `CRITICAL: Gas at ${nextStatus.gasHealthPercent}%. Autonomous refuel trigger activated.`);
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [addLog, isHarvesting]);

  // ── Trigger a manual harvest ────────────────────────────────────────────────
  const handleHarvest = useCallback(async (tokenId: string, protocol: 'v3' | 'v4') => {
    setIsHarvesting(true);
    setHarvestingId(tokenId);

    addLog('info', `Profitability Guard: evaluating position #${tokenId} (Uniswap ${protocol.toUpperCase()})…`);
    await delay(1200);

    addLog('success', `Guard passed. Harvest value $14.28 > 1.5× gas cost ($0.42). Executing…`);
    await delay(800);

    addLog('info', `Broadcasting collect() → NonfungiblePositionManager (V3 #${tokenId})…`);
    await delay(1500);

    addLog('success', `Fee collection confirmed.`, DEMO_TX_HASH.replace('7f', 'a1'));
    await delay(600);

    addLog('info', `OKX OnchainOS DEX: routing USDC/WETH → OKB… (slippage: 0.5%)`);
    await delay(1800);

    addLog('success', `Swap confirmed. +0.2847 OKB acquired. Wallet refuelled.`, DEMO_TX_HASH);

    const mockResult: RefuelResult = {
      success: true,
      harvestTxHash: DEMO_TX_HASH.replace('7f', 'a1'),
      swapTxHash:    DEMO_TX_HASH,
      explorerUrl:   `https://www.oklink.com/xlayer/tx/${DEMO_TX_HASH}`,
      okbReceived:   '0.284700',
      newBalance:    '0.301200',
      profitabilityReport: {
        harvestedValueUSD: 14.28,
        gasCostUSD: 0.42,
        netGainUSD: 13.86,
        isProfitable: true,
      },
    };

    setRefuelResult(mockResult);
    setStatus((prev) => ({
      ...prev,
      okbBalance: '0.301200',
      okbBalanceUSD: 13.55,
      gasHealthPercent: 60,
      isRefuelNeeded: false,
      v3Positions: [],
      v4Positions: [],
      totalHarvestableFeeUSD: 0,
      recommendation: 'Refuel complete. Gas healthy at 60% (0.3012 OKB). No refuel needed.',
    }));
    tickRef.current = 0;

    setIsHarvesting(false);
    setHarvestingId(null);
  }, [addLog]);

  const healthStatus =
    status.gasHealthPercent >= 50 ? 'NOMINAL' :
    status.gasHealthPercent >= 25 ? 'DEGRADED' :
                                    'CRITICAL';

  const healthBorderColor =
    status.gasHealthPercent >= 50 ? 'border-[#00ff88]/20' :
    status.gasHealthPercent >= 25 ? 'border-[#f59e0b]/30' :
                                    'border-[#ef4444]/40';

  return (
    <div className="min-h-screen bg-surface font-mono text-slate-200" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
      {/* Top bar */}
      <header className="border-b border-surface-border px-6 py-3 flex items-center justify-between bg-surface-card/50">
        <div className="flex items-center gap-3">
          <div className="text-2xl">🫁</div>
          <div>
            <span className="text-white font-bold text-lg tracking-tight">O2</span>
            <span className="text-slate-500 text-sm ml-2">Metabolic Agent Command Center</span>
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full animate-pulse ${
              healthStatus === 'NOMINAL' ? 'bg-[#00ff88]' :
              healthStatus === 'DEGRADED' ? 'bg-[#f59e0b]' : 'bg-[#ef4444]'
            }`} />
            X Layer Testnet
          </span>
          <span className="text-slate-600">|</span>
          <span>Chain 195</span>
          <span className="text-slate-600">|</span>
          <span className={
            healthStatus === 'NOMINAL' ? 'text-[#00ff88]' :
            healthStatus === 'DEGRADED' ? 'text-[#f59e0b]' : 'text-[#ef4444]'
          }>
            AGENT {healthStatus}
          </span>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* Alert banner */}
        {status.isRefuelNeeded && (
          <div className="border border-[#ef4444]/40 bg-[#ef4444]/5 rounded-xl px-5 py-3 flex items-center gap-3 animate-pulse_slow">
            <span className="text-xl">⚡</span>
            <span className="text-sm text-[#ef4444] font-semibold">{status.recommendation}</span>
          </div>
        )}

        {/* Top row: Gas gauge + Verification panel */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Gas Gauge */}
          <div className={`bg-surface-card border ${healthBorderColor} rounded-xl p-6 flex flex-col items-center justify-center gap-4`}>
            <div className="font-mono text-xs text-slate-500 uppercase tracking-widest w-full text-center border-b border-surface-border pb-3 mb-1">
              Agent Gas Vitality
            </div>
            <GasGauge
              healthPercent={status.gasHealthPercent}
              okbBalance={status.okbBalance}
              okbBalanceUSD={status.okbBalanceUSD}
              isRefuelNeeded={status.isRefuelNeeded}
            />
            <div className="w-full text-center font-mono text-xs text-slate-600 border-t border-surface-border pt-3">
              OKB/USD: ${status.okbPriceUSD.toFixed(2)} · Threshold: {process.env.REACT_APP_MIN_GAS ?? '0.05'} OKB
            </div>
          </div>

          {/* Verification panel */}
          <div className="lg:col-span-2">
            <VerificationPanel
              harvestTxHash={refuelResult?.harvestTxHash ?? null}
              swapTxHash={refuelResult?.swapTxHash ?? null}
              okbReceived={refuelResult?.okbReceived ?? null}
              newBalance={refuelResult?.newBalance ?? null}
            />
          </div>
        </div>

        {/* Yield table */}
        <YieldTable
          v3Positions={status.v3Positions}
          v4Positions={status.v4Positions}
          totalHarvestableFeeUSD={status.totalHarvestableFeeUSD}
          onHarvest={handleHarvest}
          isHarvesting={isHarvesting}
          harvestingId={harvestingId}
        />

        {/* Heartbeat log */}
        <HeartbeatLog entries={logs} />

        {/* Footer */}
        <footer className="text-center font-mono text-xs text-slate-700 py-4 border-t border-surface-border">
          O2 Metabolic Agent · Built for OKX X Layer "Build X" Hackathon ·&nbsp;
          <a href="https://www.oklink.com/xlayer" target="_blank" rel="noopener noreferrer"
            className="text-slate-600 hover:text-slate-400 transition-colors">
            OKLink Explorer ↗
          </a>
        </footer>
      </main>
    </div>
  );
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
