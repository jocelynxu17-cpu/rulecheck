import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminApi } from "@/lib/admin/assert-admin-api";
import { insertInternalOpsAuditLog } from "@/lib/admin/internal-ops-audit";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type PostBody = {
  note?: unknown;
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

  if (typeof body.note !== "string") {
    return NextResponse.json({ error: "note 須為字串。" }, { status: 400 });
  }
  const note = body.note.trim();
  if (note.length < 4) {
    return NextResponse.json({ error: "請至少輸入 4 個字元的註記。" }, { status: 400 });
  }
  if (note.length > 2000) {
    return NextResponse.json({ error: "註記過長。" }, { status: 400 });
  }

  try {
    const admin = createAdminClient();
    const { data: exists, error: findErr } = await admin.from("users").select("id").eq("id", userId).maybeSingle();
    if (findErr) {
      return NextResponse.json({ error: findErr.message }, { status: 500 });
    }
    if (!exists) {
      return NextResponse.json({ error: "找不到使用者。" }, { status: 404 });
    }

    await insertInternalOpsAuditLog(admin, {
      actorUserId: auth.user.id,
      actorEmail: auth.user.email ?? null,
      actionType: "user_manual_override",
      targetType: "user",
      targetId: userId,
      beforeJson: {},
      afterJson: { recorded: true },
      note,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "manual_override_failed";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
