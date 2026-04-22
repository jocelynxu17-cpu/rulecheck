import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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

  if (!mem) return NextResponse.json({ error: "無權限。" }, { status: 403 });

  const { data: members, error } = await supabase
    .from("workspace_members")
    .select("user_id, role, created_at")
    .eq("workspace_id", workspaceId);

  if (error) return NextResponse.json({ error: "無法載入成員。" }, { status: 500 });

  const ids = (members ?? []).map((m) => m.user_id);
  let emails: Record<string, string> = {};
  try {
    const admin = createAdminClient();
    const { data: users } = await admin.from("users").select("id, email").in("id", ids);
    emails = Object.fromEntries((users ?? []).map((u) => [u.id, u.email ?? ""]));
  } catch {
    /* service role missing locally */
  }

  const yymm = new Date().toISOString().slice(0, 7);
  const [y, mo] = yymm.split("-").map(Number);
  const periodStart = new Date(Date.UTC(y, mo - 1, 1)).toISOString();

  const { data: usageRows } = await supabase
    .from("usage_events")
    .select("user_id, units_charged, created_at")
    .eq("workspace_id", workspaceId)
    .gte("created_at", periodStart);

  const agg: Record<string, { units: number; lastAt: string | null }> = {};
  for (const row of usageRows ?? []) {
    const uid = row.user_id as string;
    if (!agg[uid]) agg[uid] = { units: 0, lastAt: null };
    agg[uid].units += row.units_charged ?? 0;
    const ca = row.created_at as string;
    if (!agg[uid].lastAt || ca > agg[uid].lastAt!) agg[uid].lastAt = ca;
  }

  return NextResponse.json({
    members: (members ?? []).map((m) => {
      const a = agg[m.user_id];
      return {
        userId: m.user_id,
        role: m.role,
        email: emails[m.user_id] ?? "—",
        createdAt: m.created_at,
        joinedAt: m.created_at,
        status: "active",
        monthlyUsedUnits: a?.units ?? 0,
        lastActivityAt: a?.lastAt ?? null,
      };
    }),
  });
}
