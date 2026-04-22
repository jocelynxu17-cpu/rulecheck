import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { canAccessInternalOps } from "@/lib/admin/internal-ops-access";
import type { User } from "@supabase/supabase-js";

export type AdminApiAuthOk = { user: User };

/**
 * 用於 `/api/admin/*`：與內部營運後台相同門檻（SUPERADMIN_EMAILS，未設時過渡為 ADMIN_EMAILS）。
 */
export async function requireAdminApi(): Promise<AdminApiAuthOk | NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "請先登入。" }, { status: 401 });
  }

  if (!canAccessInternalOps(user.email)) {
    return NextResponse.json({ error: "需要內部營運權限。" }, { status: 403 });
  }

  return { user };
}
