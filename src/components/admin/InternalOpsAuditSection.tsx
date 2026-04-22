import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { InternalOpsAuditRow } from "@/lib/admin/internal-ops-audit";
import { InternalAuditLogList } from "@/components/admin/InternalAuditLogList";

export function InternalOpsAuditSection({
  rows,
  title = "近期內部營運稽核",
  description = "含工作區修復、營運 PATCH、帳務 Notify 等（寫入 internal_ops_audit_log）。",
  moreHref = "/internal/audit",
  moreLabel = "進階篩選",
  compact = true,
}: {
  rows: InternalOpsAuditRow[];
  title?: string;
  description?: string;
  moreHref?: string | null;
  moreLabel?: string;
  compact?: boolean;
}) {
  return (
    <Card className="border-surface-border">
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">{title}</CardTitle>
          {moreHref ? (
            <Link
              href={moreHref}
              className="text-xs font-medium text-ink-secondary underline-offset-4 hover:text-ink hover:underline"
            >
              {moreLabel}
            </Link>
          ) : null}
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <InternalAuditLogList rows={rows} compact={compact} />
      </CardContent>
    </Card>
  );
}
