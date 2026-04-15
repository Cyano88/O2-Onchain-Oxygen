import React, { useState } from 'react';
import type { GasHealth } from '../types';

interface GasGaugeProps {
  healthPercent: number;
  okbBalance: string;
  okbBalanceUSD: number;
  isRefuelNeeded: boolean;
  agentAddress: string;
}

function getHealthColor(pct: number): { stroke: string; glow: string; label: GasHealth } {
  if (pct >= 50) return { stroke: '#00ff88', glow: 'rgba(0,255,136,0.5)', label: 'healthy' };
  if (pct >= 25) return { stroke: '#f59e0b', glow: 'rgba(245,158,11,0.5)', label: 'warning' };
  return { stroke: '#ef4444', glow: 'rgba(239,68,68,0.5)', label: 'critical' };
}

export function GasGauge({
  healthPercent, okbBalance, okbBalanceUSD, isRefuelNeeded, agentAddress,
}: GasGaugeProps) {
  const { stroke, glow, label } = getHealthColor(healthPercent);
  const [copied, setCopied] = useState(false);

  const R = 72;
  const cx = 90;
  const cy = 90;
  const circumference = 2 * Math.PI * R;
  const arcLength = circumference * 0.75;
  const offset = arcLength - (healthPercent / 100) * arcLength;

  const labelColors: Record<GasHealth, string> = {
    healthy:  'text-[#00ff88]',
    warning:  'text-[#f59e0b]',
    critical: 'text-[#ef4444]',
  };

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(agentAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard not available in some iframe contexts
    }
  }

  const shortAddr = `${agentAddress.slice(0, 6)}…${agentAddress.slice(-4)}`;

  return (
    <div className="flex flex-col items-center gap-3 w-full">
      {/* Arc Gauge */}
      <div className="relative" style={{ filter: `drop-shadow(0 0 12px ${glow})` }}>
        <svg width="180" height="180" viewBox="0 0 180 180">
          {/* Background track */}
          <circle
            cx={cx} cy={cy} r={R}
            fill="none" stroke="#1a2540" strokeWidth="12"
            strokeDasharray={`${arcLength} ${circumference}`}
            strokeLinecap="round"
            transform={`rotate(135 ${cx} ${cy})`}
          />
          {/* Active fill */}
          <circle
            cx={cx} cy={cy} r={R}
            fill="none" stroke={stroke} strokeWidth="12"
            strokeDasharray={`${arcLength} ${circumference}`}
            strokeDashoffset={offset}
            strokeLinecap="round"
            transform={`rotate(135 ${cx} ${cy})`}
            style={{ transition: 'stroke-dashoffset 1s ease, stroke 0.5s ease' }}
          />
          {/* Center text */}
          <text x={cx} y={cy - 8} textAnchor="middle" fill={stroke}
            fontSize="28" fontWeight="700" fontFamily="JetBrains Mono">
            {healthPercent}%
          </text>
          <text x={cx} y={cy + 16} textAnchor="middle" fill="#64748b"
            fontSize="11" fontFamily="JetBrains Mono">
            GAS VITALITY
          </text>
        </svg>
        {isRefuelNeeded && (
          <div className="absolute top-2 right-2 text-[#ef4444] animate-heartbeat text-xl">♥</div>
        )}
      </div>

      {/* Balance readout */}
      <div className="text-center space-y-1">
        <div className={`font-mono text-2xl font-bold ${labelColors[label]}`}>
          {parseFloat(okbBalance).toFixed(4)} OKB
        </div>
        <div className="font-mono text-sm text-slate-400">≈ ${okbBalanceUSD.toFixed(2)} USD</div>
        <div className={`font-mono text-xs uppercase tracking-widest font-semibold ${labelColors[label]}`}>
          {label === 'healthy' && '● NOMINAL'}
          {label === 'warning'  && '⚠ LOW'}
          {label === 'critical' && '⚡ CRITICAL — AUTO-REFUEL PENDING'}
        </div>
      </div>

      {/* ── Wallet Address Display ────────────────────────────────────────── */}
      {/* Prominently shows the agent wallet address so users know where to
          send faucet OKB to trigger the autonomous_bootstrap event.       */}
      <div className="w-full mt-1">
        <div className="font-mono text-xs text-slate-500 uppercase tracking-widest mb-1.5 text-center">
          Agent Wallet — Send Faucet OKB Here
        </div>
        <button
          onClick={handleCopy}
          title="Click to copy full address"
          className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg
            border transition-all duration-200 group
            ${copied
              ? 'border-[#00ff88]/60 bg-[#00ff88]/10'
              : 'border-surface-border bg-black/20 hover:border-[#38bdf8]/40 hover:bg-[#38bdf8]/5'
            }`}
        >
          {/* Full address — truncated display, full value in clipboard */}
          <span className="font-mono text-xs text-slate-300 truncate flex-1 text-left">
            {agentAddress}
          </span>
          {/* Copy icon */}
          <span className={`shrink-0 text-sm transition-colors ${copied ? 'text-[#00ff88]' : 'text-slate-600 group-hover:text-[#38bdf8]'}`}>
            {copied ? '✔' : '⧉'}
          </span>
        </button>
        {copied && (
          <p className="font-mono text-xs text-[#00ff88] text-center mt-1 animate-scroll_up">
            Address copied!
          </p>
        )}
        <p className="font-mono text-[10px] text-slate-700 text-center mt-1">
          Send ≥ 0.5 OKB to trigger autonomous_bootstrap
        </p>
      </div>
    </div>
  );
}
