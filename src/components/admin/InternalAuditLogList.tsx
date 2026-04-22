import type { InternalOpsAuditRow } from "@/lib/admin/internal-ops-audit";
import { InternalAuditLogRow } from "@/components/admin/InternalAuditLogRow";

export function InternalAuditLogList({
  rows,
  compact,
}: {
  rows: InternalOpsAuditRow[];
  compact?: boolean;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-ink-secondary">尚無稽核紀錄（或條件下無符合列／資料表尚未 migration）。</p>;
  }

  return (
    <ul className="divide-y divide-surface-border/80 rounded-xl border border-surface-border bg-white">
      {rows.map((row) => (
        <InternalAuditLogRow key={row.id} row={row} compact={compact} />
      ))}
    </ul>
  );
}
