import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * 成員數大於 1 的工作區數（多帳號共用審查額度）。
 * 以分頁掃描 workspace_members，避免依賴 DB 自訂函式。
 */
export async function countWorkspacesWithMultipleMembers(admin: SupabaseClient): Promise<number> {
  const memberCountByWorkspace = new Map<string, number>();
  const pageSize = 2000;
  let from = 0;

  for (;;) {
    const { data, error } = await admin
      .from("workspace_members")
      .select("workspace_id")
      .range(from, from + pageSize - 1);

    if (error) {
      throw new Error(error.message);
    }

    if (!data?.length) {
      break;
    }

    for (const row of data) {
      const wid = row.workspace_id as string;
      memberCountByWorkspace.set(wid, (memberCountByWorkspace.get(wid) ?? 0) + 1);
    }

    if (data.length < pageSize) {
      break;
    }
    from += pageSize;
  }

  let shared = 0;
  for (const n of memberCountByWorkspace.values()) {
    if (n > 1) shared += 1;
  }
  return shared;
}
