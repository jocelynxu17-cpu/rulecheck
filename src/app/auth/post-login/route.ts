import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { canAccessInternalOps } from "@/lib/admin/internal-ops-access";

/**
 * 登入後分流：具內部營運權限 → /internal；其餘 → /analyze。
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = url.origin;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const login = new URL("/login", origin);
    login.searchParams.set("next", "/auth/post-login");
    return NextResponse.redirect(login);
  }

  const target = canAccessInternalOps(user.email) ? "/internal" : "/analyze";
  return NextResponse.redirect(new URL(target, origin));
}
