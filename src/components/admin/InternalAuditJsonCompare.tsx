"use client";

import { useMemo, useState } from "react";

function formatJson(obj: Record<string, unknown>): string {
  try {
    return JSON.stringify(obj, null, 2);
  } catch {
    return String(obj);
  }
}

type Tab = "before" | "after";

export function InternalAuditJsonCompare({
  beforeJson,
  afterJson,
  compact,
}: {
  beforeJson: Record<string, unknown>;
  afterJson: Record<string, unknown>;
  /** 總覽卡片用較矮區塊 */
  compact?: boolean;
}) {
  const [tab, setTab] = useState<Tab>("after");
  const beforeStr = useMemo(() => formatJson(beforeJson), [beforeJson]);
  const afterStr = useMemo(() => formatJson(afterJson), [afterJson]);
  const maxH = compact ? "max-h-[220px]" : "max-h-[min(70vh,520px)]";

  return (
    <div className="mt-2 space-y-2">
      <div className="flex flex-wrap gap-1 rounded-lg border border-surface-border/80 bg-canvas/50 p-1">
        <button
          type="button"
          onClick={() => setTab("before")}
          className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition ${
            tab === "before" ? "bg-white text-ink shadow-sm ring-1 ring-surface-border" : "text-ink-secondary hover:text-ink"
          }`}
        >
          變更前
        </button>
        <button
          type="button"
          onClick={() => setTab("after")}
          className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition ${
            tab === "after" ? "bg-white text-ink shadow-sm ring-1 ring-surface-border" : "text-ink-secondary hover:text-ink"
          }`}
        >
          變更後
        </button>
      </div>
      <pre
        className={`overflow-auto rounded-xl border border-surface-border bg-zinc-950 p-3 font-mono text-[11px] leading-relaxed text-zinc-100 ${maxH}`}
        tabIndex={0}
      >
        {tab === "before" ? beforeStr : afterStr}
      </pre>
    </div>
  );
}
