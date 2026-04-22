import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export type EnsureWorkspaceResult =
  | { ok: true; created: boolean; workspaceId?: string }
  | { ok: false; error: string };

function parseRpcPayload(data: unknown): EnsureWorkspaceResult {
  if (!data || typeof data !== "object") {
    return { ok: false, error: "invalid_response" };
  }
  const row = data as { ok?: boolean; created?: boolean; error?: string; workspace_id?: string };
  if (row.ok === false) {
    return { ok: false, error: typeof row.error === "string" ? row.error : "ensure_failed" };
  }
  return {
    ok: true,
    created: row.created === true,
    workspaceId: typeof row.workspace_id === "string" ? row.workspace_id : undefined,
  };
}

/** Idempotent: creates default workspace + owner membership when missing. */
export async function ensureUserWorkspace(supabase: SupabaseClient): Promise<EnsureWorkspaceResult> {
  const { data, error } = await supabase.rpc("ensure_user_workspace");
  if (error) {
    return { ok: false, error: error.message };
  }
  return parseRpcPayload(data);
}

/** Dedupe ensure calls within a single RSC render tree. */
export const ensureWorkspaceForRequest = cache(async (): Promise<EnsureWorkspaceResult> => {
  const supabase = await createClient();
  return ensureUserWorkspace(supabase);
});
