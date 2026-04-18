import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { randomBytes } from "crypto";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  const { workspaceId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "請先登入。" }, { status: 401 });

  let body: { email?: string; role?: "admin" | "member" };
  try {
    body = (await request.json()) as { email?: string; role?: "admin" | "member" };
  } catch {
    return NextResponse.json({ error: "無效的 JSON。" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const role = body.role === "admin" ? "admin" : "member";

  if (!email.includes("@")) {
    return NextResponse.json({ error: "請輸入有效 Email。" }, { status: 400 });
  }

  const { data: mem } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!mem || (mem.role !== "owner" && mem.role !== "admin")) {
    return NextResponse.json({ error: "需要管理員權限。" }, { status: 403 });
  }

  const token = randomBytes(24).toString("hex");
  const expires = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14);

  const { data: inv, error } = await supabase
    .from("workspace_invites")
    .insert({
      workspace_id: workspaceId,
      email,
      role,
      token,
      invited_by: user.id,
      expires_at: expires.toISOString(),
    })
    .select("id, token, expires_at")
    .maybeSingle();

  if (error) {
    console.error("invite:", error.message);
    return NextResponse.json({ error: "建立邀請失敗。" }, { status: 500 });
  }

  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const inviteUrl = `${site}/team/join?token=${token}`;

  return NextResponse.json({
    invite: inv,
    inviteUrl,
    message: "將連結傳給對方；對方需以相同 Email 登入後開啟連結加入。",
  });
}
