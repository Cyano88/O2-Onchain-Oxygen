import React from 'react';
import type { GasHealth } from '../types';

interface GasGaugeProps {
  healthPercent: number;
  okbBalance: string;
  okbBalanceUSD: number;
  isRefuelNeeded: boolean;
}

function getHealthColor(pct: number): { stroke: string; glow: string; label: GasHealth } {
  if (pct >= 50) return { stroke: '#00ff88', glow: 'rgba(0,255,136,0.5)', label: 'healthy' };
  if (pct >= 25) return { stroke: '#f59e0b', glow: 'rgba(245,158,11,0.5)', label: 'warning' };
  return { stroke: '#ef4444', glow: 'rgba(239,68,68,0.5)', label: 'critical' };
}

export function GasGauge({ healthPercent, okbBalance, okbBalanceUSD, isRefuelNeeded }: GasGaugeProps) {
  const { stroke, glow, label } = getHealthColor(healthPercent);

  // SVG arc parameters
  const R = 72;
  const cx = 90;
  const cy = 90;
  const circumference = 2 * Math.PI * R;
  // Use 270° of the circle (from 135° to 405°)
  const arcLength = circumference * 0.75;
  const offset = arcLength - (healthPercent / 100) * arcLength;

  const labelColors: Record<GasHealth, string> = {
    healthy:  'text-[#00ff88]',
    warning:  'text-[#f59e0b]',
    critical: 'text-[#ef4444]',
  };

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Gauge */}
      <div className="relative" style={{ filter: `drop-shadow(0 0 12px ${glow})` }}>
        <svg width="180" height="180" viewBox="0 0 180 180">
          {/* Background track */}
          <circle
            cx={cx} cy={cy} r={R}
            fill="none"
            stroke="#1a2540"
            strokeWidth="12"
            strokeDasharray={`${arcLength} ${circumference}`}
            strokeLinecap="round"
            transform={`rotate(135 ${cx} ${cy})`}
          />
          {/* Active fill */}
          <circle
            cx={cx} cy={cy} r={R}
            fill="none"
            stroke={stroke}
            strokeWidth="12"
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

        {/* Heartbeat icon — pulses when critical */}
        {isRefuelNeeded && (
          <div className="absolute top-2 right-2 text-[#ef4444] animate-heartbeat text-xl">
            ♥
          </div>
        )}
      </div>

      {/* Balance readout */}
      <div className="text-center space-y-1">
        <div className={`font-mono text-2xl font-bold ${labelColors[label]}`}>
          {parseFloat(okbBalance).toFixed(4)} OKB
        </div>
        <div className="font-mono text-sm text-slate-400">
          ≈ ${okbBalanceUSD.toFixed(2)} USD
        </div>
        <div className={`font-mono text-xs uppercase tracking-widest font-semibold ${labelColors[label]}`}>
          {label === 'healthy' && '● NOMINAL'}
          {label === 'warning' && '⚠ LOW'}
          {label === 'critical' && '⚡ CRITICAL — REFUEL NEEDED'}
        </div>
      </div>
    </div>
  );
}
