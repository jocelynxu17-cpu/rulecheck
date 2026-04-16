import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseCookieToSet } from "@/lib/supabase/cookie-types";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: SupabaseCookieToSet[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // 在某些 Server Component 環境中可能無法直接寫 cookie，忽略即可
          }
        },
      },
    }
  );
}