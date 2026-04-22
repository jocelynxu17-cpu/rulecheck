import type { SupabaseClient } from "@supabase/supabase-js";

export type AdminWorkspaceRepairResult = {
  ok: true;
  usersProvisioned: number;
  ownersLinked: number;
};

/**
 * 與 migration 邏輯對齊的 idempotent 修復：
 * 1) 無任何 workspace_members 的使用者 → 建立預設工作區與 owner
 * 2) 工作區缺少 created_by 之 owner 成員列 → 補上
 */
export async function runGlobalWorkspaceRepair(admin: SupabaseClient): Promise<AdminWorkspaceRepairResult> {
  const yymm = new Date().toISOString().slice(0, 7);

  const usersWithMembership = new Set<string>();
  let from = 0;
  const pageSize = 2000;
  for (;;) {
    const { data, error } = await admin.from("workspace_members").select("user_id").range(from, from + pageSize - 1);
    if (error) {
      throw new Error(error.message);
    }
    if (!data?.length) break;
    for (const row of data) {
      usersWithMembership.add(row.user_id as string);
    }
    if (data.length < pageSize) break;
    from += pageSize;
  }

  let usersProvisioned = 0;
  from = 0;
  for (;;) {
    const { data: users, error } = await admin
      .from("users")
      .select(
        "id, plan, subscription_status, billing_provider, cancel_at_period_end, current_period_end, monthly_analysis_quota, usage_month"
      )
      .range(from, from + 499);

    if (error) {
      throw new Error(error.message);
    }
    if (!users?.length) break;

    for (const u of users) {
      if (usersWithMembership.has(u.id)) continue;

      const usageMonth = (u.usage_month && String(u.usage_month).trim()) || yymm;
      const quota = Math.max((u.monthly_analysis_quota ?? 30) * 50, 1500);

      const { data: wsRow, error: wsErr } = await admin
        .from("workspaces")
        .insert({
          name: "我的團隊",
          created_by: u.id,
          monthly_quota_units: quota,
          usage_month: usageMonth,
          plan: u.plan ?? "free",
          subscription_status: u.subscription_status,
          billing_provider: u.billing_provider,
          cancel_at_period_end: u.cancel_at_period_end ?? false,
          current_period_end: u.current_period_end,
        })
        .select("id")
        .maybeSingle();

      if (wsErr || !wsRow?.id) {
        throw new Error(wsErr?.message ?? "建立工作區失敗");
      }

      const { error: memErr } = await admin.from("workspace_members").insert({
        workspace_id: wsRow.id,
        user_id: u.id,
        role: "owner",
      });

      if (memErr) {
        throw new Error(memErr.message);
      }

      usersWithMembership.add(u.id);
      usersProvisioned += 1;
    }

    if (users.length < 500) {
      break;
    }
    from += 500;
  }

  let ownersLinked = 0;
  from = 0;
  for (;;) {
    const { data: workspaces, error } = await admin
      .from("workspaces")
      .select("id, created_by")
      .range(from, from + 499);

    if (error) {
      throw new Error(error.message);
    }
    if (!workspaces?.length) break;

    for (const w of workspaces) {
      const { data: existing } = await admin
        .from("workspace_members")
        .select("user_id")
        .eq("workspace_id", w.id)
        .eq("user_id", w.created_by)
        .maybeSingle();

      if (existing) continue;

      const { error: insErr } = await admin.from("workspace_members").insert({
        workspace_id: w.id,
        user_id: w.created_by,
        role: "owner",
      });

      if (insErr) {
        throw new Error(insErr.message);
      }
      ownersLinked += 1;
    }

    if (workspaces.length < 500) {
      break;
    }
    from += 500;
  }

  return { ok: true, usersProvisioned, ownersLinked };
}

export type SingleWorkspaceRepairResult = {
  ok: true;
  ownersLinked: number;
  message: string;
};

/**
 * 僅針對指定工作區：若存在 `created_by` 且尚無對應 owner 成員列，則補上一筆（與全站修復第 2 步對齊）。
 */
export async function runSingleWorkspaceRepair(
  admin: SupabaseClient,
  workspaceId: string
): Promise<SingleWorkspaceRepairResult> {
  const { data: ws, error } = await admin
    .from("workspaces")
    .select("id, created_by")
    .eq("id", workspaceId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  if (!ws) {
    throw new Error("workspace_not_found");
  }

  const createdBy = ws.created_by as string | null;
  if (!createdBy) {
    return {
      ok: true,
      ownersLinked: 0,
      message: "此工作區無 created_by，已跳過擁有者補列。",
    };
  }

  const { data: existing } = await admin
    .from("workspace_members")
    .select("user_id")
    .eq("workspace_id", workspaceId)
    .eq("user_id", createdBy)
    .maybeSingle();

  if (existing) {
    return {
      ok: true,
      ownersLinked: 0,
      message: "擁有者成員列已存在，無需變更。",
    };
  }

  const { error: insErr } = await admin.from("workspace_members").insert({
    workspace_id: workspaceId,
    user_id: createdBy,
    role: "owner",
  });

  if (insErr) {
    throw new Error(insErr.message);
  }

  return {
    ok: true,
    ownersLinked: 1,
    message: "已補上擁有者（owner）成員列。",
  };
}