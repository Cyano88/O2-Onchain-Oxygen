import React from 'react';
import type { V3Position, V4Position } from '../types';

interface YieldTableProps {
  v3Positions: V3Position[];
  v4Positions: V4Position[];
  totalHarvestableFeeUSD: number;
  onHarvest: (tokenId: string, protocol: 'v3' | 'v4') => void;
  isHarvesting: boolean;
  harvestingId: string | null;
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
  onHarvest: () => void;
  isHarvesting: boolean;
}

function PositionRow({ tokenId, protocol, currency0, currency1, fee, totalFeesUSD, onHarvest, isHarvesting }: RowProps) {
  const valueColor =
    totalFeesUSD > 10 ? 'text-[#00ff88]' :
    totalFeesUSD > 2  ? 'text-[#f59e0b]' :
                        'text-slate-400';

  return (
    <tr className="border-t border-surface-border hover:bg-white/[0.02] transition-colors">
      <td className="py-3 px-4 font-mono text-sm text-slate-300">
        <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold mr-2 ${
          protocol === 'V4' ? 'bg-purple-900/60 text-purple-300' : 'bg-sky-900/60 text-sky-300'
        }`}>
          {protocol}
        </span>
        #{tokenId}
      </td>
      <td className="py-3 px-4 font-mono text-sm text-slate-400">
        {shortAddress(currency0)} / {shortAddress(currency1)}
      </td>
      <td className="py-3 px-4 font-mono text-sm text-slate-500">
        {feeText(fee)}
      </td>
      <td className={`py-3 px-4 font-mono text-sm font-semibold ${valueColor}`}>
        ${totalFeesUSD.toFixed(4)}
      </td>
      <td className="py-3 px-4">
        <button
          onClick={onHarvest}
          disabled={isHarvesting}
          className={`px-3 py-1 rounded text-xs font-mono font-semibold transition-all
            ${isHarvesting
              ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
              : 'bg-[#00ff88]/10 border border-[#00ff88]/30 text-[#00ff88] hover:bg-[#00ff88]/20 hover:border-[#00ff88]/60'
            }`}
        >
          {isHarvesting ? (
            <span className="flex items-center gap-1">
              <span className="animate-spin">⟳</span> Harvesting…
            </span>
          ) : '⚡ Harvest'}
        </button>
      </td>
    </tr>
  );
}

export function YieldTable({
  v3Positions, v4Positions, totalHarvestableFeeUSD,
  onHarvest, isHarvesting, harvestingId,
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
            <p className="font-mono text-xs text-slate-500">Uniswap V3 + V4 Harvestable Fees</p>
          </div>
        </div>
        <div className="text-right">
          <div className="font-mono text-lg font-bold text-[#00ff88]">
            ${totalHarvestableFeeUSD.toFixed(2)}
          </div>
          <div className="font-mono text-xs text-slate-500">Total Available</div>
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
                <th className="py-2 px-4 text-left">Action</th>
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
                  onHarvest={() => onHarvest(pos.tokenId, 'v3')}
                  isHarvesting={isHarvesting && harvestingId === pos.tokenId}
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
                  onHarvest={() => onHarvest(pos.tokenId, 'v4')}
                  isHarvesting={isHarvesting && harvestingId === pos.tokenId}
                />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="py-12 text-center font-mono text-slate-600">
          <div className="text-3xl mb-2">🌱</div>
          <div className="text-sm">No harvestable positions detected.</div>
          <div className="text-xs mt-1 text-slate-700">Provide liquidity on Uniswap V3/V4 to enable metabolic cycles.</div>
        </div>
      )}
    </div>
  );
}
