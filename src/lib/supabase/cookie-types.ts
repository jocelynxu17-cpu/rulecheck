/**
 * Rows passed to `@supabase/ssr` cookie adapter `setAll`.
 * Options are a compatible subset for Next.js 15 `cookies().set` and `ResponseCookies.set`.
 */
export type SupabaseCookieToSet = {
  name: string;
  value: string;
  options?: {
    domain?: string;
    expires?: Date | number;
    httpOnly?: boolean;
    maxAge?: number;
    path?: string;
    priority?: "low" | "medium" | "high";
    sameSite?: boolean | "lax" | "strict" | "none";
    secure?: boolean;
    partitioned?: boolean;
  };
};
