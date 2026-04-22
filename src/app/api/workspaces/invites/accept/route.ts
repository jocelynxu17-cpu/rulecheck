import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "請先登入。" }, { status: 401 });

  let token: string;
  try {
    const b = (await request.json()) as { token?: string };
    if (typeof b.token !== "string" || !b.token.trim()) throw new Error();
    token = b.token.trim();
  } catch {
    return NextResponse.json({ error: "需要 token。" }, { status: 400 });
  }

  const { data: rpcData, error } = await supabase.rpc("accept_workspace_invite", {
    p_token: token,
  });

  if (error) {
    console.error("accept_workspace_invite:", error.message);
    return NextResponse.json({ error: "無法接受邀請。" }, { status: 500 });
  }

  const row = rpcData as { ok?: boolean; error?: string; workspace_id?: string };
  if (!row?.ok) {
    const map: Record<string, string> = {
      not_found: "邀請不存在。",
      expired: "邀請已過期。",
      revoked: "邀請已撤銷。",
      email_mismatch: "請以受邀 Email 登入相同帳號。",
      already_accepted: "邀請已使用。",
    };
    return NextResponse.json(
      { error: map[row.error ?? ""] ?? row.error ?? "無法加入。" },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true, workspaceId: row.workspace_id });
}
