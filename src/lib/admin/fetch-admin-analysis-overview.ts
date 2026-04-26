import type { SupabaseClient } from "@supabase/supabase-js";

export function buildEmptyAdminAnalysisOverview(): AdminAnalysisOverview {
  const weekSince = sevenDaysAgoUtc().toISOString();
  const todaySince = startOfTodayUtc().toISOString();
  return {
    ok: false,
    error: null,
    weekSinceIso: weekSince,
    todaySinceIso: todaySince,
    todayCount: 0,
    weekCount: 0,
    byInputWeek: { text: 0, image: 0, pdf: 0, unknown: 0 },
    pipelineSampleSize: 0,
    openaiCountSample: 0,
    mockCountSample: 0,
    activeWorkspacesWeekApprox: 0,
    newUsersWeek: 0,
    paidWorkspacesCount: 0,
  };
}

export type AdminAnalysisOverview = {
  ok: boolean;
  error: string | null;
  /** ISO bounds used (UTC) */
  weekSinceIso: string;
  todaySinceIso: string;
  todayCount: number;
  weekCount: number;
  byInputWeek: { text: number; image: number; pdf: number; unknown: number };
  /** From sample of rows in the week window (max 1200); ratios extrapolated if sample capped */
  pipelineSampleSize: number;
  openaiCountSample: number;
  mockCountSample: number;
  /** Distinct workspace_id in recent rows (cap 4000) */
  activeWorkspacesWeekApprox: number;
  newUsersWeek: number;
  paidWorkspacesCount: number;
};

function startOfTodayUtc(): Date {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
}

function sevenDaysAgoUtc(): Date {
  return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
}

export async function fetchAdminAnalysisOverview(admin: SupabaseClient): Promise<AdminAnalysisOverview> {
  const base = buildEmptyAdminAnalysisOverview();
  const todaySince = base.todaySinceIso;
  const weekSince = base.weekSinceIso;

  try {
    const [
      todayRes,
      weekRes,
      textRes,
      imageRes,
      pdfRes,
      unknownRes,
      newUsersRes,
      paidWsRes,
      sampleRes,
      wsActiveRes,
    ] = await Promise.all([
      admin.from("analysis_logs").select("*", { count: "exact", head: true }).gte("created_at", todaySince),
      admin.from("analysis_logs").select("*", { count: "exact", head: true }).gte("created_at", weekSince),
      admin
        .from("analysis_logs")
        .select("*", { count: "exact", head: true })
        .gte("created_at", weekSince)
        .eq("input_type", "text"),
      admin
        .from("analysis_logs")
        .select("*", { count: "exact", head: true })
        .gte("created_at", weekSince)
        .eq("input_type", "image"),
      admin
        .from("analysis_logs")
        .select("*", { count: "exact", head: true })
        .gte("created_at", weekSince)
        .eq("input_type", "pdf"),
      admin
        .from("analysis_logs")
        .select("*", { count: "exact", head: true })
        .gte("created_at", weekSince)
        .is("input_type", null),
      admin.from("users").select("*", { count: "exact", head: true }).gte("created_at", weekSince),
      admin
        .from("workspaces")
        .select("*", { count: "exact", head: true })
        .eq("plan", "pro")
        .in("subscription_status", ["active", "trialing"]),
      admin
        .from("analysis_logs")
        .select("result, workspace_id")
        .gte("created_at", weekSince)
        .order("created_at", { ascending: false })
        .limit(1200),
      admin
        .from("analysis_logs")
        .select("workspace_id")
        .gte("created_at", weekSince)
        .not("workspace_id", "is", null)
        .limit(4000),
    ]);

    const err =
      todayRes.error?.message ??
      weekRes.error?.message ??
      textRes.error?.message ??
      imageRes.error?.message ??
      pdfRes.error?.message ??
      unknownRes.error?.message ??
      newUsersRes.error?.message ??
      paidWsRes.error?.message ??
      sampleRes.error?.message ??
      wsActiveRes.error?.message;

    if (err) {
      return { ...base, error: err };
    }

    let openai = 0;
    let mock = 0;
    const sample = (sampleRes.data ?? []) as Array<{ result: unknown; workspace_id: string | null }>;
    for (const row of sample) {
      const r = row.result as { meta?: { source?: string } } | null;
      const src = r?.meta?.source;
      if (src === "openai") openai += 1;
      else if (src === "mock") mock += 1;
    }

    const wsRows = (wsActiveRes.data ?? []) as { workspace_id: string | null }[];
    const activeSet = new Set<string>();
    for (const w of wsRows) {
      if (w.workspace_id) activeSet.add(w.workspace_id);
    }

    return {
      ok: true,
      error: null,
      weekSinceIso: weekSince,
      todaySinceIso: todaySince,
      todayCount: todayRes.count ?? 0,
      weekCount: weekRes.count ?? 0,
      byInputWeek: {
        text: textRes.count ?? 0,
        image: imageRes.count ?? 0,
        pdf: pdfRes.count ?? 0,
        unknown: unknownRes.count ?? 0,
      },
      pipelineSampleSize: sample.length,
      openaiCountSample: openai,
      mockCountSample: mock,
      activeWorkspacesWeekApprox: activeSet.size,
      newUsersWeek: newUsersRes.count ?? 0,
      paidWorkspacesCount: paidWsRes.count ?? 0,
    };
  } catch (e) {
    return {
      ...base,
      error: e instanceof Error ? e.message : "無法載入分析營運摘要",
    };
  }
}

export type AdminAnalysisLogRow = {
  id: string;
  created_at: string;
  workspace_id: string | null;
  user_id: string;
  input_type: string | null;
  units_charged: number | null;
  pdf_page_count: number | null;
  user_email: string | null;
  workspace_name: string | null;
  findingsCount: number;
  source: string | null;
  inputKind: string | null;
};

export async function fetchAdminRecentAnalysisLogs(
  admin: SupabaseClient,
  limit: number
): Promise<{ rows: AdminAnalysisLogRow[]; error: string | null }> {
  try {
    const { data, error } = await admin
      .from("analysis_logs")
      .select("id, created_at, workspace_id, user_id, input_type, units_charged, pdf_page_count, result")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) return { rows: [], error: error.message };

    const raw = (data ?? []) as Array<{
      id: string;
      created_at: string;
      workspace_id: string | null;
      user_id: string;
      input_type: string | null;
      units_charged: number | null;
      pdf_page_count: number | null;
      result: unknown;
    }>;

    const userIds = [...new Set(raw.map((r) => r.user_id))];
    const wsIds = [...new Set(raw.map((r) => r.workspace_id).filter(Boolean))] as string[];

    let emailByUserId: Record<string, string> = {};
    if (userIds.length) {
      const { data: users } = await admin.from("users").select("id, email").in("id", userIds);
      for (const u of users ?? []) {
        if (u.id && u.email) emailByUserId[u.id] = u.email;
      }
    }

    let nameByWsId: Record<string, string> = {};
    if (wsIds.length) {
      const { data: wss } = await admin.from("workspaces").select("id, name").in("id", wsIds);
      for (const w of wss ?? []) {
        if (w.id && w.name) nameByWsId[w.id] = w.name;
      }
    }

    const rows: AdminAnalysisLogRow[] = raw.map((row) => {
      const res = row.result as {
        findings?: unknown[];
        meta?: { source?: string; inputKind?: string };
      } | null;
      const findings = Array.isArray(res?.findings) ? res!.findings!.length : 0;
      return {
        id: row.id,
        created_at: row.created_at,
        workspace_id: row.workspace_id,
        user_id: row.user_id,
        input_type: row.input_type,
        units_charged: row.units_charged,
        pdf_page_count: row.pdf_page_count,
        user_email: emailByUserId[row.user_id] ?? null,
        workspace_name: row.workspace_id ? nameByWsId[row.workspace_id] ?? null : null,
        findingsCount: findings,
        source: res?.meta?.source ?? null,
        inputKind: res?.meta?.inputKind ?? row.input_type,
      };
    });

    return { rows, error: null };
  } catch (e) {
    return { rows: [], error: e instanceof Error ? e.message : String(e) };
  }
}
