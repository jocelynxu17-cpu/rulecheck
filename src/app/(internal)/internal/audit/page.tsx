import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchInternalOpsAuditLogsFiltered, INTERNAL_OPS_AUDIT_ACTIONS } from "@/lib/admin/internal-ops-audit";
import { internalOpsAuditActionLabelZh } from "@/lib/admin/internal-audit-labels";
import { InternalAuditLogList } from "@/components/admin/InternalAuditLogList";
import { Button } from "@/components/ui/button";
import {
  INTERNAL_AUDIT_PAGE_DEFAULT,
  INTERNAL_AUDIT_PAGE_MAX,
  clampPage,
  clampPageSize,
} from "@/lib/admin/internal-scale-conventions";
import { flattenInternalSearchParams, hrefWithPage } from "@/lib/admin/internal-pagination-url";
import { InternalOpsListGuideCard } from "@/components/admin/InternalOpsListGuideCard";

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

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  const n = parseInt(String(raw ?? ""), 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export default async function InternalAuditPage({ searchParams }: PageProps) {
  const sp = (await searchParams) ?? {};
  const flat = flattenInternalSearchParams(sp);
  const actionType = firstString(sp.action_type).trim();
  const actorEmail = firstString(sp.actor_email).trim();
  const targetId = firstString(sp.target_id).trim();

  const page = clampPage(parsePositiveInt(flat.page, 1));
  const pageSize = clampPageSize(
    parsePositiveInt(flat.page_size, INTERNAL_AUDIT_PAGE_DEFAULT),
    INTERNAL_AUDIT_PAGE_DEFAULT,
    INTERNAL_AUDIT_PAGE_MAX
  );
  const offset = (page - 1) * pageSize;

  let rows: Awaited<ReturnType<typeof fetchInternalOpsAuditLogsFiltered>>["rows"] = [];
  let loadError: string | null = null;
  let hasNextPage = false;

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    loadError = "未設定 SUPABASE_SERVICE_ROLE_KEY。";
  } else {
    const admin = createAdminClient();
    const out = await fetchInternalOpsAuditLogsFiltered(
      admin,
      { actionType: actionType || null, actorEmail: actorEmail || null, targetId: targetId || null },
      pageSize,
      { offset }
    );
    rows = out.rows;
    loadError = out.error;
    hasNextPage = out.hasNextPage;
  }

  const hasFilters = Boolean(actionType || actorEmail || targetId);

  const prevHref =
    page > 1 ? hrefWithPage("/internal/audit", flat, { page: String(page - 1) }) : null;
  const nextHref = hasNextPage ? hrefWithPage("/internal/audit", flat, { page: String(page + 1) }) : null;

  return (
    <div className="space-y-8 pb-8">
      <div className="space-y-2">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-ink-secondary">內部營運</p>
        <h1 className="text-2xl font-medium tracking-tight text-ink sm:text-[1.625rem]">稽核</h1>
        <p className="max-w-2xl text-sm text-ink-secondary">
          內部操作軌跡：操作者、動作、目標與 before／after。可依動作類型、信箱、目標 ID 篩選。
        </p>
      </div>

      <InternalOpsListGuideCard
        summary="全系統內部操作軌跡；含目標關鍵字時為 JSON 後篩選，僅在最近視窗內可靠分頁。"
        bullets={[
          "無目標關鍵字時為資料庫分頁；填入目標／UUID 時為固定視窗內比對（見下方說明）。",
          "縮小時間或動作類型可降低負載；長期建議索引／彙總（第二階段）。",
        ]}
      />

      <form
        action="/internal/audit"
        method="get"
        className="flex flex-col gap-4 rounded-xl border border-surface-border bg-white/80 p-4 sm:flex-row sm:flex-wrap sm:items-end"
      >
        <input type="hidden" name="page_size" value={String(pageSize)} />
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
        <>
          <InternalAuditLogList rows={rows} compact={false} />
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-ink-secondary">
            <span className="text-xs">
              第 {page} 頁 · 每頁 {pageSize} 筆
              {hasNextPage ? " · 尚有下一頁" : ""}
              {targetId ? " · 目標篩選時僅在目前拉取視窗內分頁" : ""}
            </span>
            <div className="flex gap-2">
              {prevHref ? (
                <Link
                  href={prevHref}
                  className="inline-flex h-9 items-center rounded-lg border border-surface-border bg-white px-3 text-sm font-medium text-ink hover:bg-canvas"
                >
                  上一頁
                </Link>
              ) : (
                <span className="inline-flex h-9 cursor-not-allowed items-center rounded-lg border border-transparent px-3 text-sm text-ink-secondary/50">
                  上一頁
                </span>
              )}
              {nextHref ? (
                <Link
                  href={nextHref}
                  className="inline-flex h-9 items-center rounded-lg border border-surface-border bg-white px-3 text-sm font-medium text-ink hover:bg-canvas"
                >
                  下一頁
                </Link>
              ) : (
                <span className="inline-flex h-9 cursor-not-allowed items-center rounded-lg border border-transparent px-3 text-sm text-ink-secondary/50">
                  下一頁
                </span>
              )}
            </div>
          </div>
        </>
      )}

      <p className="text-xs text-ink-secondary">
        非 UUID 之目標關鍵字會寬鬆比對 `target_id` 與整段 JSON 文字；大量資料時建議優先使用 UUID 或動作類型縮小範圍。
      </p>
    </div>
  );
}
