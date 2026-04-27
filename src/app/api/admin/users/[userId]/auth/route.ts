import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminApi } from "@/lib/admin/assert-admin-api";
import { insertInternalOpsAuditLog } from "@/lib/admin/internal-ops-audit";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type PostBody = {
  action?: unknown;
};

export async function POST(request: Request, ctx: { params: Promise<{ userId: string }> }) {
  const auth = await requireAdminApi();
  if (auth instanceof NextResponse) {
    return auth;
  }

  const { userId } = await ctx.params;
  if (!UUID_RE.test(userId)) {
    return NextResponse.json({ error: "使用者 ID 格式不正確。" }, { status: 400 });
  }

  let body: PostBody;
  try {
    body = (await request.json()) as PostBody;
  } catch {
    return NextResponse.json({ error: "無效的 JSON。" }, { status: 400 });
  }

  const action = typeof body.action === "string" ? body.action.trim() : "";

  const allowed = new Set([
    "send_password_recovery",
    "force_password_recovery",
    "disable_account",
    "enable_account",
  ]);
  if (!allowed.has(action)) {
    return NextResponse.json({ error: "不支援的 action。" }, { status: 400 });
  }

  try {
    const admin = createAdminClient();
    const actorId = auth.user.id;
    const actorEmail = auth.user.email ?? null;

    const { data: gu, error: guErr } = await admin.auth.admin.getUserById(userId);
    if (guErr) {
      return NextResponse.json({ error: guErr.message }, { status: 400 });
    }
    if (!gu?.user) {
      return NextResponse.json({ error: "找不到 Auth 使用者。" }, { status: 404 });
    }

    if (action === "send_password_recovery" || action === "force_password_recovery") {
      let email = (gu.user.email ?? "").trim();
      if (!email) {
        const { data: urow } = await admin.from("users").select("email").eq("id", userId).maybeSingle();
        email = typeof urow?.email === "string" ? urow.email.trim() : "";
      }
      if (!email) {
        return NextResponse.json({ error: "找不到使用者 Email，無法觸發重設流程。" }, { status: 400 });
      }

      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
      const { error: glErr } = await admin.auth.admin.generateLink({
        type: "recovery",
        email,
        options: { redirectTo: `${siteUrl}/auth/callback` },
      });
      if (glErr) {
        return NextResponse.json({ ok: false, error: glErr.message }, { status: 400 });
      }

      await insertInternalOpsAuditLog(admin, {
        actorUserId: actorId,
        actorEmail,
        actionType: action === "force_password_recovery" ? "user_password_recovery_force" : "user_password_recovery_request",
        targetType: "user",
        targetId: userId,
        beforeJson: {},
        afterJson: {
          recovery_flow_triggered: true,
        },
        note: action === "force_password_recovery" ? "forced_second_flow" : null,
      });

      return NextResponse.json({
        ok: true,
        message:
          "已觸發密碼重設流程（伺服器端產生 recovery 連結；不會回傳給瀏覽器）。若使用者未收到信，請確認 Supabase Auth 的 SMTP／寄信設定。",
      });
    }

    const ban = action === "disable_account";
    const { error: banErr } = await admin.auth.admin.updateUserById(userId, {
      ban_duration: ban ? "876000h" : "none",
    });
    if (banErr) {
      return NextResponse.json({ ok: false, error: banErr.message }, { status: 400 });
    }

    await insertInternalOpsAuditLog(admin, {
      actorUserId: actorId,
      actorEmail,
      actionType: "user_ban_update",
      targetType: "user",
      targetId: userId,
      beforeJson: {},
      afterJson: { banned: ban },
      note: ban ? "disabled_via_admin" : "enabled_via_admin",
    });

    return NextResponse.json({ ok: true, banned: ban });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "auth_action_failed";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
