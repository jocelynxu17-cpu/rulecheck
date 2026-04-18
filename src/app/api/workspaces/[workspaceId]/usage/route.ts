import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
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

  if (!mem) return NextResponse.json({ error: "無權限。" }, { status: 403 });

  const { data: events, error } = await supabase
    .from("usage_events")
    .select("id, user_id, input_type, units_charged, metadata, created_at")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) return NextResponse.json({ error: "無法載入用量。" }, { status: 500 });

  const ids = [...new Set((events ?? []).map((e) => e.user_id))];
  let emails: Record<string, string> = {};
  try {
    const admin = createAdminClient();
    const { data: users } = await admin.from("users").select("id, email").in("id", ids);
    emails = Object.fromEntries((users ?? []).map((u) => [u.id, u.email ?? ""]));
  } catch {
    /* local */
  }

  return NextResponse.json({
    events: (events ?? []).map((e) => ({
      id: e.id,
      userId: e.user_id,
      email: emails[e.user_id] ?? "—",
      inputType: e.input_type,
      unitsCharged: e.units_charged,
      createdAt: e.created_at,
      metadata: e.metadata,
    })),
  });
}
