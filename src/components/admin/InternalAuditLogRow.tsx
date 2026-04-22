import Link from "next/link";
import type { InternalOpsAuditRow } from "@/lib/admin/internal-ops-audit";
import { collectWorkspaceLinkIds } from "@/lib/admin/internal-audit-workspace-links";
import { internalOpsAuditActionLabelZh } from "@/lib/admin/internal-audit-labels";
import { InternalAuditJsonCompare } from "@/components/admin/InternalAuditJsonCompare";

function formatDateTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat("zh-TW", {
      dateStyle: "short",
      timeStyle: "medium",
      timeZone: "Asia/Taipei",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function buildAuditFilterHref(workspaceId: string): string {
  const p = new URLSearchParams();
  p.set("target_id", workspaceId);
  return `/internal/audit?${p.toString()}`;
}

export function InternalAuditLogRow({
  row,
  compact,
}: {
  row: InternalOpsAuditRow;
  compact?: boolean;
}) {
  const workspaceIds = collectWorkspaceLinkIds(row);

  return (
    <li className="space-y-2 px-3 py-3 text-xs">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-ink-secondary">
        <span className="font-mono text-[10px] text-ink-secondary/90">{row.id.slice(0, 8)}…</span>
        <span className="text-[11px]">{formatDateTime(row.created_at)}</span>
        <span className="font-medium text-ink">{internalOpsAuditActionLabelZh(row.action_type)}</span>
        <span className="text-surface-border">·</span>
        <span className="break-all">{row.actor_email ?? row.actor_user_id ?? "—"}</span>
        <span className="text-surface-border">·</span>
        <span>
          {row.target_type}
          {row.target_id ? (
            <>
              {" "}
              <code className="rounded bg-canvas px-1 font-mono text-[10px] break-all">{row.target_id}</code>
            </>
          ) : null}
        </span>
      </div>

      {workspaceIds.length > 0 ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
          <span className="text-ink-secondary">工作區：</span>
          {workspaceIds.map((wid) => (
            <span key={wid} className="inline-flex flex-wrap items-center gap-2">
              <code className="rounded bg-canvas px-1 font-mono text-[10px] text-ink-secondary">{wid.slice(0, 8)}…</code>
              <Link
                href={`/internal/workspaces/${encodeURIComponent(wid)}`}
                className="font-medium text-ink underline-offset-4 hover:underline"
              >
                開啟詳情
              </Link>
              <Link
                href={buildAuditFilterHref(wid)}
                className="text-ink-secondary underline-offset-4 hover:text-ink hover:underline"
              >
                同目標稽核
              </Link>
            </span>
          ))}
        </div>
      ) : null}

      {row.note ? <p className="text-ink-secondary">備註：{row.note}</p> : null}

      <details className="group">
        <summary className="cursor-pointer select-none text-[11px] font-medium text-ink-secondary hover:text-ink">
          檢視變更前／後 JSON
        </summary>
        <InternalAuditJsonCompare beforeJson={row.before_json} afterJson={row.after_json} compact={compact} />
      </details>
    </li>
  );
}
