import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminApi } from "@/lib/admin/assert-admin-api";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request: Request) {
  const auth = await requireAdminApi();
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id")?.trim() ?? "";
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "事件 ID 格式不正確。" }, { status: 400 });
  }

  try {
    const admin = createAdminClient();
    const { data, error } = await admin.from("payment_events").select("*").eq("id", id).maybeSingle();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: "找不到事件。" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, row: data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "lookup_failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
