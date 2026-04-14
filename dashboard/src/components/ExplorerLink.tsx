import React from 'react';

interface ExplorerLinkProps {
  txHash: string | null;
  label?: string;
  variant?: 'button' | 'badge';
}

export function ExplorerLink({ txHash, label, variant = 'button' }: ExplorerLinkProps) {
  if (!txHash) {
    return (
      <div className="flex items-center gap-2 font-mono text-xs text-slate-600">
        <span className="w-2 h-2 rounded-full bg-slate-700" />
        No transaction recorded yet
      </div>
    );
  }

  const url = `https://www.oklink.com/xlayer/tx/${txHash}`;
  const displayHash = `${txHash.slice(0, 14)}…${txHash.slice(-8)}`;

  if (variant === 'badge') {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 font-mono text-xs text-[#38bdf8] hover:text-[#7dd3fc] transition-colors"
      >
        <span className="w-2 h-2 rounded-full bg-[#38bdf8] animate-pulse" />
        {displayHash}
        <span className="text-slate-600">↗</span>
      </a>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-center gap-3 px-4 py-3 rounded-xl
        bg-[#38bdf8]/5 border border-[#38bdf8]/20
        hover:bg-[#38bdf8]/10 hover:border-[#38bdf8]/50
        transition-all duration-200"
    >
      {/* OKLink logo placeholder */}
      <div className="w-8 h-8 rounded-lg bg-[#38bdf8]/10 border border-[#38bdf8]/20
        flex items-center justify-center text-sm font-bold text-[#38bdf8] font-mono">
        OK
      </div>

      <div className="flex-1 min-w-0">
        <div className="font-mono text-xs text-slate-400 uppercase tracking-widest mb-0.5">
          {label ?? 'Latest Refuel Transaction'}
        </div>
        <div className="font-mono text-sm text-[#38bdf8] truncate">
          {displayHash}
        </div>
      </div>

      <div className="text-[#38bdf8] opacity-60 group-hover:opacity-100 transition-opacity text-lg">
        ↗
      </div>
    </a>
  );
}

// ─── Live Transaction Verification Panel ─────────────────────────────────────

interface VerificationPanelProps {
  harvestTxHash: string | null;
  swapTxHash: string | null;
  okbReceived: string | null;
  newBalance: string | null;
}

export function VerificationPanel({
  harvestTxHash, swapTxHash, okbReceived, newBalance,
}: VerificationPanelProps) {
  return (
    <div className="bg-surface-card border border-surface-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-surface-border">
        <span className="text-xl">🔍</span>
        <div>
          <h2 className="font-mono text-sm font-semibold text-slate-200 uppercase tracking-widest">
            Live Transaction Verification
          </h2>
          <p className="font-mono text-xs text-slate-500">All events are permanently recorded on X Layer</p>
        </div>
      </div>

      <div className="p-5 space-y-4">
        {/* Harvest TX */}
        <div>
          <div className="font-mono text-xs text-slate-500 uppercase tracking-widest mb-2">
            Step 1 — Fee Collection (Uniswap)
          </div>
          <ExplorerLink txHash={harvestTxHash} label="collect() on Position Manager" />
        </div>

        {/* Swap TX */}
        <div>
          <div className="font-mono text-xs text-slate-500 uppercase tracking-widest mb-2">
            Step 2 — OKB Swap (OKX DEX)
          </div>
          <ExplorerLink txHash={swapTxHash} label="dex.swap() → OKB via OnchainOS" />
        </div>

        {/* Result summary */}
        {okbReceived && newBalance && (
          <div className="mt-4 pt-4 border-t border-surface-border grid grid-cols-2 gap-4">
            <div className="text-center">
              <div className="font-mono text-xs text-slate-500 uppercase tracking-widest mb-1">OKB Acquired</div>
              <div className="font-mono text-xl font-bold text-[#00ff88]">+{parseFloat(okbReceived).toFixed(4)}</div>
            </div>
            <div className="text-center">
              <div className="font-mono text-xs text-slate-500 uppercase tracking-widest mb-1">New Balance</div>
              <div className="font-mono text-xl font-bold text-[#38bdf8]">{parseFloat(newBalance).toFixed(4)}</div>
            </div>
          </div>
        )}

        {/* Verification note */}
        <div className="text-xs font-mono text-slate-600 bg-black/20 rounded-lg p-3">
          Verify autonomy: navigate to either link above and confirm the wallet address
          received OKB without any human-initiated transaction.
        </div>
      </div>
    </div>
  );
}
