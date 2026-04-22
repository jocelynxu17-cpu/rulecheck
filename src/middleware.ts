import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { SupabaseCookieToSet } from "@/lib/supabase/cookie-types";
import { canAccessInternalOps } from "@/lib/admin/internal-ops-access";

const protectedPrefixes = [
  "/history",
  "/billing",
  "/settings",
  "/members",
  "/api-settings",
  "/internal",
  "/team/join",
];

function isProtectedPath(pathname: string) {
  if (protectedPrefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return true;
  }
  if (pathname === "/team/members" || pathname.startsWith("/team/members/")) return true;
  return false;
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const { pathname } = request.nextUrl;

  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    const suffix = pathname === "/admin" ? "" : pathname.slice("/admin".length);
    return NextResponse.redirect(new URL(`/internal${suffix}`, request.url));
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    if (isProtectedPath(pathname)) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return response;
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: SupabaseCookieToSet[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (isProtectedPath(pathname) && !user) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", pathname);
    const redirect = NextResponse.redirect(login);
    response.cookies.getAll().forEach((c) => {
      redirect.cookies.set(c.name, c.value);
    });
    return redirect;
  }

  if (user && (pathname === "/internal" || pathname.startsWith("/internal/"))) {
    if (!canAccessInternalOps(user.email)) {
      const deny = NextResponse.redirect(new URL("/analyze", request.url));
      response.cookies.getAll().forEach((c) => deny.cookies.set(c.name, c.value));
      return deny;
    }
  }

  if ((pathname === "/login" || pathname === "/signup") && user) {
    const postLogin = NextResponse.redirect(new URL("/auth/post-login", request.url));
    response.cookies.getAll().forEach((c) => {
      postLogin.cookies.set(c.name, c.value);
    });
    return postLogin;
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
