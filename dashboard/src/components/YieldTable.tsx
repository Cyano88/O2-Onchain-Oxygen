/**
 * YieldTable.tsx — Read-only LP Yield Position View
 *
 * No manual harvest buttons. The agent harvests autonomously.
 * Shows which position is currently being auto-harvested.
 */

import React from 'react';
import type { V3Position, V4Position } from '../types';

interface YieldTableProps {
  v3Positions: V3Position[];
  v4Positions: V4Position[];
  totalHarvestableFeeUSD: number;
  autoHarvestingId: string | null;  // position currently being auto-harvested
  isSelfMaintaining: boolean;
}

function shortAddress(addr: string): string {
  if (!addr || addr === '0x0000000000000000000000000000000000000000') return 'ETH';
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function feeText(fee: number): string {
  return `${(fee / 10000).toFixed(2)}%`;
}

interface RowProps {
  tokenId: string;
  protocol: 'V3' | 'V4';
  currency0: string;
  currency1: string;
  fee: number;
  totalFeesUSD: number;
  isAutoHarvesting: boolean;
  isSelfMaintaining: boolean;
}

function PositionRow({
  tokenId, protocol, currency0, currency1, fee,
  totalFeesUSD, isAutoHarvesting, isSelfMaintaining,
}: RowProps) {
  const valueColor =
    totalFeesUSD > 10 ? 'text-[#00ff88]' :
    totalFeesUSD > 2  ? 'text-[#f59e0b]' : 'text-slate-400';

  return (
    <tr className={`border-t border-surface-border transition-colors ${
      isAutoHarvesting ? 'bg-[#00ff88]/5' : 'hover:bg-white/[0.02]'
    }`}>
      {/* Position ID + protocol badge */}
      <td className="py-3 px-4 font-mono text-sm text-slate-300">
        <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold mr-2 ${
          protocol === 'V4' ? 'bg-purple-900/60 text-purple-300' : 'bg-sky-900/60 text-sky-300'
        }`}>
          {protocol}
        </span>
        #{tokenId}
      </td>

      {/* Pair */}
      <td className="py-3 px-4 font-mono text-sm text-slate-400">
        {shortAddress(currency0)} / {shortAddress(currency1)}
      </td>

      {/* Fee tier */}
      <td className="py-3 px-4 font-mono text-sm text-slate-500">
        {feeText(fee)}
      </td>

      {/* Claimable USD */}
      <td className={`py-3 px-4 font-mono text-sm font-semibold ${valueColor}`}>
        ${totalFeesUSD.toFixed(4)}
      </td>

      {/* Status — replaces manual button */}
      <td className="py-3 px-4">
        {isAutoHarvesting ? (
          <span className="flex items-center gap-1.5 font-mono text-xs text-[#00ff88]">
            <span className="animate-spin">⟳</span> Auto-harvesting…
          </span>
        ) : isSelfMaintaining ? (
          <span className="flex items-center gap-1.5 font-mono text-xs text-slate-500">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00ff88]/50 animate-pulse" />
            Queued (auto)
          </span>
        ) : (
          <span className="font-mono text-xs text-slate-700">Idle</span>
        )}
      </td>
    </tr>
  );
}

export function YieldTable({
  v3Positions, v4Positions, totalHarvestableFeeUSD,
  autoHarvestingId, isSelfMaintaining,
}: YieldTableProps) {
  const hasPositions = v3Positions.length > 0 || v4Positions.length > 0;

  return (
    <div className="bg-surface-card border border-surface-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-surface-border">
        <div className="flex items-center gap-3">
          <span className="text-xl">🌾</span>
          <div>
            <h2 className="font-mono text-sm font-semibold text-slate-200 uppercase tracking-widest">
              Yield Stomach
            </h2>
            <p className="font-mono text-xs text-slate-500">
              Uniswap V3 + V4 · Chain 1952 · Auto-harvested by agent
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {/* Self-maintaining indicator */}
          {isSelfMaintaining && (
            <span className="font-mono text-xs px-2 py-0.5 rounded-full border border-[#00ff88]/30 text-[#00ff88] bg-[#00ff88]/5">
              ● AUTO
            </span>
          )}
          <div className="text-right">
            <div className="font-mono text-lg font-bold text-[#00ff88]">
              ${totalHarvestableFeeUSD.toFixed(2)}
            </div>
            <div className="font-mono text-xs text-slate-500">Available</div>
          </div>
        </div>
      </div>

      {/* Table */}
      {hasPositions ? (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-xs font-mono text-slate-500 uppercase tracking-widest">
                <th className="py-2 px-4 text-left">Position</th>
                <th className="py-2 px-4 text-left">Pair</th>
                <th className="py-2 px-4 text-left">Tier</th>
                <th className="py-2 px-4 text-left">Claimable</th>
                <th className="py-2 px-4 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {v3Positions.map((pos) => (
                <PositionRow
                  key={`v3-${pos.tokenId}`}
                  tokenId={pos.tokenId}
                  protocol="V3"
                  currency0={pos.token0}
                  currency1={pos.token1}
                  fee={pos.fee}
                  totalFeesUSD={pos.totalFeesUSD}
                  isAutoHarvesting={autoHarvestingId === pos.tokenId}
                  isSelfMaintaining={isSelfMaintaining}
                />
              ))}
              {v4Positions.map((pos) => (
                <PositionRow
                  key={`v4-${pos.tokenId}`}
                  tokenId={pos.tokenId}
                  protocol="V4"
                  currency0={pos.poolKey.currency0}
                  currency1={pos.poolKey.currency1}
                  fee={pos.poolKey.fee}
                  totalFeesUSD={pos.totalFeesUSD}
                  isAutoHarvesting={autoHarvestingId === pos.tokenId}
                  isSelfMaintaining={isSelfMaintaining}
                />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="py-12 text-center font-mono text-slate-600">
          <div className="text-3xl mb-2">🌱</div>
          <div className="text-sm">No harvestable positions — gas is healthy.</div>
          <div className="text-xs mt-1 text-slate-700">
            Yield will appear when gas drops below {0.05} OKB.
          </div>
        </div>
      )}
    </div>
  );
}
