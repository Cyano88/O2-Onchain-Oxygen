import React, { useEffect, useRef } from 'react';
import type { LogEntry } from '../types';

interface HeartbeatLogProps {
  entries: LogEntry[];
}

const LEVEL_STYLES: Record<LogEntry['level'], { prefix: string; color: string }> = {
  info:    { prefix: '◆ INFO   ', color: 'text-slate-400' },
  warn:    { prefix: '⚠ WARN   ', color: 'text-[#f59e0b]' },
  success: { prefix: '✔ OK     ', color: 'text-[#00ff88]' },
  error:   { prefix: '✖ ERR    ', color: 'text-[#ef4444]' },
};

function LogLine({ entry }: { entry: LogEntry }) {
  const style = LEVEL_STYLES[entry.level];
  const time = new Date(entry.timestamp).toLocaleTimeString('en-US', {
    hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit',
  });

  return (
    <div className={`font-mono text-xs ${style.color} animate-scroll_up leading-relaxed`}>
      <span className="text-slate-600 select-none">{time} </span>
      <span className="text-slate-600 select-none">{style.prefix}</span>
      <span>{entry.message}</span>
      {entry.txHash && (
        <a
          href={`https://www.oklink.com/xlayer/tx/${entry.txHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-2 text-[#38bdf8] underline hover:text-[#7dd3fc]"
        >
          [{entry.txHash.slice(0, 10)}…]
        </a>
      )}
    </div>
  );
}

export function HeartbeatLog({ entries }: HeartbeatLogProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to latest entry
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [entries.length]);

  return (
    <div className="bg-surface-card border border-surface-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-surface-border">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#ef4444] animate-pulse_slow" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#f59e0b]" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#00ff88]" />
        </div>
        <h2 className="font-mono text-sm font-semibold text-slate-200 uppercase tracking-widest">
          Autonomous Heartbeat
        </h2>
        <div className="ml-auto font-mono text-xs text-slate-600">
          AGENT COGNITION STREAM
        </div>
      </div>

      {/* Log scroll area */}
      <div className="h-64 overflow-y-auto p-4 space-y-1 bg-black/30">
        {entries.length === 0 ? (
          <div className="font-mono text-xs text-slate-700 text-center pt-8">
            Awaiting agent activity…
          </div>
        ) : (
          entries.map((entry) => <LogLine key={entry.id} entry={entry} />)
        )}
        <div ref={bottomRef} />
      </div>

      {/* Blinking cursor */}
      <div className="px-4 pb-3 pt-1 font-mono text-xs text-[#00ff88]">
        <span className="opacity-60">agent@xlayer:~$ </span>
        <span className="animate-pulse">█</span>
      </div>
    </div>
  );
}
