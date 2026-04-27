import { createAdminClient } from "@/lib/supabase/admin";
import {
  collectAnalysisOpsHintsFromResult,
  mergeHintLabels,
} from "@/lib/admin/workspace-analysis-ops-hints";
import {
  INTERNAL_ACTIVITY_BATCH_CAP,
  INTERNAL_LIST_PAGE_DEFAULT,
  INTERNAL_LIST_PAGE_MAX,
  clampPage,
  clampPageSize,
} from "@/lib/admin/internal-scale-conventions";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function escapeIlikePattern(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

export type InternalWorkspaceListRow = {
  id: string;
  name: string;
  created_at: string;
  created_by: string | null;
  owner_email: string | null;
  member_count: number;
  plan: string | null;
  subscription_status: string | null;
  billing_provider: string | null;
  cancel_at_period_end: boolean | null;
  current_period_end: string | null;
  monthly_quota_units: number;
  units_used_month: number;
  usage_month: string;
  /** max(最近扣點, 最近分析) — 來自批次掃描，可能略漏極舊資料 */
  last_activity_at: string | null;
  /** 來自該工作區最新一筆 analysis_logs.result 的簡短提示 */
  ops_hint_summary: string | null;
};

export type InternalWorkspacesListResult = {
  workspaces: InternalWorkspaceListRow[];
  error: string | null;
  yymm: string;
  pagination: {
    page: number;
    pageSize: number;
    hasNextPage: boolean;
  };
};

/**
 * 工作區營運列表：搜尋、批次成員數／擁有者、最近活動與簡要提示（避免 N+1）。
 */
export async function fetchInternalWorkspacesList(
  searchQuery?: string | null,
  opts?: { page?: number; pageSize?: number }
): Promise<InternalWorkspacesListResult> {
  const yymm = new Date().toISOString().slice(0, 7);
  const pageSize = clampPageSize(opts?.pageSize, INTERNAL_LIST_PAGE_DEFAULT, INTERNAL_LIST_PAGE_MAX);
  const page = clampPage(opts?.page);
  const offset = (page - 1) * pageSize;
  const empty: InternalWorkspacesListResult = {
    workspaces: [],
    error: null,
    yymm,
    pagination: { page, pageSize, hasNextPage: false },
  };

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { ...empty, error: "未設定 SUPABASE_SERVICE_ROLE_KEY，無法載入列表。" };
  }

  const q = searchQuery?.trim() ?? "";

  try {
    const admin = createAdminClient();
    let wq = admin
      .from("workspaces")
      .select(
        "id, name, plan, subscription_status, billing_provider, cancel_at_period_end, current_period_end, monthly_quota_units, units_used_month, usage_month, created_at, created_by"
      )
      .order("created_at", { ascending: false });

    if (q) {
      const esc = escapeIlikePattern(q);
      if (UUID_RE.test(q)) {
        wq = wq.or(`id.eq.${q},name.ilike.%${esc}%`);
      } else {
        wq = wq.ilike("name", `%${esc}%`);
      }
    }

    const fetchEnd = offset + pageSize;
    const { data: rawWs, error: wsErr } = await wq.range(offset, fetchEnd);
    if (wsErr) {
      return { ...empty, error: wsErr.message };
    }

    const batch = (rawWs ?? []) as Array<{
      id: string;
      name: string;
      plan: string | null;
      subscription_status: string | null;
      billing_provider: string | null;
      cancel_at_period_end: boolean | null;
      current_period_end: string | null;
      monthly_quota_units: number;
      units_used_month: number;
      usage_month: string;
      created_at: string;
      created_by: string | null;
    }>;

    const hasNextPage = batch.length > pageSize;
    const rows = batch.slice(0, pageSize);

    const wsIds = rows.map((w) => w.id);
    const ownerIds = [...new Set(rows.map((w) => w.created_by).filter(Boolean))] as string[];
    let ownerEmailById: Record<string, string> = {};
    if (ownerIds.length > 0) {
      const { data: owners } = await admin.from("users").select("id, email").in("id", ownerIds);
      for (const o of owners ?? []) {
        if (o.id && o.email) ownerEmailById[o.id as string] = o.email as string;
      }
    }

    const memberCountByWs = new Map<string, number>();
    const lastUsageByWs = new Map<string, string>();
    const lastAnalysisByWs = new Map<string, string>();
    const hintByWs = new Map<string, string | null>();

    if (wsIds.length > 0) {
      const [{ data: memRows }, { data: usageEv }, { data: anaRows }] = await Promise.all([
        admin.from("workspace_members").select("workspace_id").in("workspace_id", wsIds),
        admin
          .from("usage_events")
          .select("workspace_id, created_at")
          .in("workspace_id", wsIds)
          .order("created_at", { ascending: false })
          .limit(INTERNAL_ACTIVITY_BATCH_CAP),
        admin
          .from("analysis_logs")
          .select("workspace_id, created_at, result, input_text, input_type")
          .in("workspace_id", wsIds)
          .order("created_at", { ascending: false })
          .limit(INTERNAL_ACTIVITY_BATCH_CAP),
      ]);

      for (const m of memRows ?? []) {
        const wid = (m as { workspace_id: string }).workspace_id;
        memberCountByWs.set(wid, (memberCountByWs.get(wid) ?? 0) + 1);
      }

      for (const ev of usageEv ?? []) {
        const e = ev as { workspace_id: string; created_at: string };
        if (!lastUsageByWs.has(e.workspace_id)) {
          lastUsageByWs.set(e.workspace_id, e.created_at);
        }
      }

      for (const ar of anaRows ?? []) {
        const a = ar as {
          workspace_id: string;
          created_at: string;
          result: unknown;
          input_text: string | null;
          input_type: string | null;
        };
        const wid = a.workspace_id;
        if (!lastAnalysisByWs.has(wid)) {
          lastAnalysisByWs.set(wid, a.created_at);
          const hints = collectAnalysisOpsHintsFromResult(a.result, a.input_text ?? "", a.input_type);
          hintByWs.set(wid, hints.length ? mergeHintLabels(hints) : null);
        }
      }
    }

    const workspaces: InternalWorkspaceListRow[] = rows.map((w) => {
      const uAt = lastUsageByWs.get(w.id);
      const aAt = lastAnalysisByWs.get(w.id);
      let last: string | null = null;
      if (uAt && aAt) {
        last = new Date(uAt) > new Date(aAt) ? uAt : aAt;
      } else {
        last = uAt ?? aAt ?? null;
      }

      return {
        id: w.id,
        name: w.name,
        created_at: w.created_at,
        created_by: w.created_by,
        owner_email: w.created_by ? ownerEmailById[w.created_by] ?? null : null,
        member_count: memberCountByWs.get(w.id) ?? 0,
        plan: w.plan,
        subscription_status: w.subscription_status,
        billing_provider: w.billing_provider,
        cancel_at_period_end: w.cancel_at_period_end,
        current_period_end: w.current_period_end,
        monthly_quota_units: w.monthly_quota_units,
        units_used_month: w.units_used_month,
        usage_month: w.usage_month,
        last_activity_at: last,
        ops_hint_summary: hintByWs.get(w.id) ?? null,
      };
    });

    return { workspaces, error: null, yymm, pagination: { page, pageSize, hasNextPage } };
  } catch (e) {
    return {
      ...empty,
      error: e instanceof Error ? e.message : "無法建立管理連線",
    };
  }
}
