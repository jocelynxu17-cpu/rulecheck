"use client";

import { useOptionalWorkspace } from "@/components/workspace/WorkspaceContext";

export function WorkspaceSwitcher() {
  const ws = useOptionalWorkspace();
  if (!ws || ws.loading || ws.workspaces.length === 0) return null;

  return (
    <label className="flex min-w-0 max-w-[200px] items-center gap-2 sm:max-w-xs">
      <span className="hidden shrink-0 text-[11px] font-medium uppercase tracking-wide text-ink-secondary sm:inline">
        工作區
      </span>
      <select
        value={ws.selectedId ?? ""}
        onChange={(e) => ws.setSelectedId(e.target.value)}
        className="h-9 min-w-0 flex-1 truncate rounded-lg border border-surface-border bg-white px-2.5 text-xs font-medium text-ink shadow-none outline-none transition focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400/25"
      >
        {ws.workspaces.map((w) => (
          <option key={w.id} value={w.id}>
            {w.name}
          </option>
        ))}
      </select>
    </label>
  );
}
