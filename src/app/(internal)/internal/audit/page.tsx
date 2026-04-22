import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchInternalOpsAuditLogsFiltered, INTERNAL_OPS_AUDIT_ACTIONS } from "@/lib/admin/internal-ops-audit";
import { internalOpsAuditActionLabelZh } from "@/lib/admin/internal-audit-labels";
import { InternalAuditLogList } from "@/components/admin/InternalAuditLogList";
import { Button } from "@/components/ui/button";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function firstString(v: string | string[] | undefined): string {
  if (typeof v === "string") return v;
  if (Array.isArray(v) && v[0]) return v[0];
  return "";
}

export default async function InternalAuditPage({ searchParams }: PageProps) {
  const sp = (await searchParams) ?? {};
  const actionType = firstString(sp.action_type).trim();
  const actorEmail = firstString(sp.actor_email).trim();
  const targetId = firstString(sp.target_id).trim();

  let rows: Awaited<ReturnType<typeof fetchInternalOpsAuditLogsFiltered>>["rows"] = [];
  let loadError: string | null = null;

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    loadError = "未設定 SUPABASE_SERVICE_ROLE_KEY。";
  } else {
    const admin = createAdminClient();
    const out = await fetchInternalOpsAuditLogsFiltered(
      admin,
      { actionType: actionType || null, actorEmail: actorEmail || null, targetId: targetId || null },
      120
    );
    rows = out.rows;
    loadError = out.error;
  }

  const hasFilters = Boolean(actionType || actorEmail || targetId);

  return (
    <div className="space-y-8 pb-8">
      <div className="space-y-2">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-ink-secondary">內部營運</p>
        <h1 className="text-2xl font-medium tracking-tight text-ink sm:text-[1.625rem]">稽核紀錄</h1>
        <p className="max-w-2xl text-sm text-ink-secondary">
          依動作類型、操作者信箱、目標／工作區 ID 篩選；帳務 notify 等事件可比對 JSON 內嵌之 workspace。
        </p>
      </div>

      <form
        action="/internal/audit"
        method="get"
        className="flex flex-col gap-4 rounded-xl border border-surface-border bg-white/80 p-4 sm:flex-row sm:flex-wrap sm:items-end"
      >
        <div className="min-w-[10rem] flex-1 space-y-1">
          <label htmlFor="action_type" className="text-xs font-medium text-ink-secondary">
            動作類型
          </label>
          <select
            id="action_type"
            name="action_type"
            defaultValue={actionType}
            className="h-10 w-full rounded-lg border border-surface-border bg-white px-3 text-sm text-ink"
          >
            <option value="">全部</option>
            {INTERNAL_OPS_AUDIT_ACTIONS.map((a) => (
              <option key={a} value={a}>
                {internalOpsAuditActionLabelZh(a)}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-[12rem] flex-1 space-y-1">
          <label htmlFor="actor_email" className="text-xs font-medium text-ink-secondary">
            操作者信箱（部分符合）
          </label>
          <input
            id="actor_email"
            name="actor_email"
            type="search"
            defaultValue={actorEmail}
            placeholder="name@example.com"
            className="h-10 w-full rounded-lg border border-surface-border bg-white px-3 text-sm text-ink"
            autoComplete="off"
          />
        </div>
        <div className="min-w-[12rem] flex-[1.2] space-y-1">
          <label htmlFor="target_id" className="text-xs font-medium text-ink-secondary">
            目標 ID／工作區 UUID
          </label>
          <input
            id="target_id"
            name="target_id"
            type="search"
            defaultValue={targetId}
            placeholder="UUID 或子字串"
            className="h-10 w-full rounded-lg border border-surface-border bg-white px-3 font-mono text-sm text-ink"
            autoComplete="off"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" className="rounded-lg">
            套用篩選
          </Button>
          <Link
            href="/internal/audit"
            className="inline-flex h-10 items-center justify-center rounded-lg border border-surface-border bg-white px-4 text-sm font-medium text-ink shadow-none hover:bg-zinc-50"
          >
            清除
          </Link>
        </div>
      </form>

      {hasFilters ? (
        <p className="text-xs text-ink-secondary">
          目前條件：{actionType ? `動作=${internalOpsAuditActionLabelZh(actionType)}` : "動作=全部"}
          {actorEmail ? ` · 信箱含「${actorEmail}」` : ""}
          {targetId ? ` · 目標／JSON 含「${targetId}」` : ""}
          {UUID_RE.test(targetId) ? "（UUID：比對 target_id 與巢狀 JSON）" : ""}
        </p>
      ) : null}

      {loadError ? (
        <p className="rounded-lg border border-amber-200/80 bg-amber-50/60 px-4 py-3 text-sm text-amber-950">{loadError}</p>
      ) : (
        <InternalAuditLogList rows={rows} compact={false} />
      )}

      <p className="text-xs text-ink-secondary">
        非 UUID 之目標關鍵字會寬鬆比對 `target_id` 與整段 JSON 文字；大量資料時建議優先使用 UUID 或動作類型縮小範圍。
      </p>
    </div>
  );
}
