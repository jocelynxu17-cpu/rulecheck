import type { SupabaseClient } from "@supabase/supabase-js";

export async function resolveWorkspaceForUser(
  supabase: SupabaseClient,
  userId: string,
  providedWorkspaceId: string | null | undefined
): Promise<
  | { ok: true; workspaceId: string }
  | { ok: false; error: string }
> {
  if (providedWorkspaceId) {
    const { data, error } = await supabase
      .from("workspace_members")
      .select("workspace_id")
      .eq("workspace_id", providedWorkspaceId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error || !data) {
      return { ok: false, error: "找不到工作區或無權限。" };
    }
    return { ok: true, workspaceId: data.workspace_id };
  }

  const { data: rows, error } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", userId)
    .limit(1);

  if (error || !rows?.length) {
    return { ok: false, error: "尚未建立工作區，請重新登入或聯絡管理員。" };
  }
  return { ok: true, workspaceId: rows[0].workspace_id };
}
