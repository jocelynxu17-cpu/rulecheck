import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { randomBytes } from "crypto";
import { canAssignInviteRole } from "@/lib/workspace/member-permissions";

function inviteStatus(
  row: { accepted_at: string | null; revoked_at: string | null | undefined; expires_at: string }
): { key: string; label: string; tone: "blue" | "amber" | "emerald" | "neutral" } {
  if (row.accepted_at) return { key: "joined", label: "已加入", tone: "emerald" };
  if (row.revoked_at) return { key: "revoked", label: "已撤銷", tone: "neutral" };
  if (new Date(row.expires_at) < new Date()) return { key: "expired", label: "已過期", tone: "amber" };
  return { key: "pending", label: "待加入", tone: "blue" };
}

export async function GET(_request: Request, { params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "請先登入。" }, { status: 401 });

  const { data: mem } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!mem) {
    return NextResponse.json({ error: "無權限。" }, { status: 403 });
  }

  const { data: rows, error } = await supabase
    .from("workspace_invites")
    .select("id, email, role, token, created_at, expires_at, accepted_at, revoked_at, invited_by")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("invites list:", error.message);
    return NextResponse.json({ error: "無法載入邀請。" }, { status: 500 });
  }

  const inviterIds = [...new Set((rows ?? []).map((r) => r.invited_by).filter(Boolean))] as string[];
  let inviterEmails: Record<string, string> = {};
  if (inviterIds.length) {
    try {
      const admin = createAdminClient();
      const { data: users } = await admin.from("users").select("id, email").in("id", inviterIds);
      inviterEmails = Object.fromEntries((users ?? []).map((u) => [u.id, u.email ?? "—"]));
    } catch {
      /* optional */
    }
  }

  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const invites = (rows ?? []).map((r) => {
    const st = inviteStatus({
      accepted_at: r.accepted_at,
      revoked_at: r.revoked_at ?? null,
      expires_at: r.expires_at,
    });
    const actionable = !r.accepted_at && !r.revoked_at;
    return {
      id: r.id,
      email: r.email,
      role: r.role,
      createdAt: r.created_at,
      expiresAt: r.expires_at,
      acceptedAt: r.accepted_at,
      revokedAt: r.revoked_at ?? null,
      invitedByUserId: r.invited_by,
      invitedByEmail: inviterEmails[r.invited_by] ?? "—",
      status: st.key,
      statusLabel: st.label,
      statusTone: st.tone,
      inviteUrl: actionable ? `${site}/team/join?token=${r.token}` : null,
    };
  });

  const pending = invites.filter((i) => i.status === "pending" || i.status === "expired");
  const history = invites.filter((i) => i.status === "joined" || i.status === "revoked");

  return NextResponse.json({ invites, pending, history });
}

export async function POST(request: Request, { params }: { params: Promise<{ workspaceId: string }> }) {
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

  if (!canAssignInviteRole(mem.role, role)) {
    return NextResponse.json({ error: "管理員僅能邀請一般成員。" }, { status: 403 });
  }

  const insertPayload: Record<string, unknown> = {
    workspace_id: workspaceId,
    email,
    role,
    token: randomBytes(24).toString("hex"),
    invited_by: user.id,
    expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString(),
  };

  const { data: inv, error } = await supabase
    .from("workspace_invites")
    .insert(insertPayload)
    .select("id, token, expires_at")
    .maybeSingle();

  if (error) {
    console.error("invite:", error.message);
    return NextResponse.json({ error: "建立邀請失敗。" }, { status: 500 });
  }

  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const token = inv?.token as string;
  const inviteUrl = `${site}/team/join?token=${token}`;

  return NextResponse.json({
    invite: inv,
    inviteUrl,
    message: "將連結傳給對方；對方需以相同 Email 登入後開啟連結加入。",
  });
}
