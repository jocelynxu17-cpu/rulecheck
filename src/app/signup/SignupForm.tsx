"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function SignupForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    const supabase = createClient();
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const { data, error: signError } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${origin}/auth/callback` },
    });
    setLoading(false);
    if (signError) {
      setError(signError.message);
      return;
    }
    if (data.session) {
      router.push("/auth/post-login");
      router.refresh();
      return;
    }
    setInfo("若專案已啟用信箱驗證，請至信箱完成驗證後再登入。");
    router.refresh();
  }

  return (
    <Card className="border-surface-border">
      <CardHeader>
        <CardTitle className="text-2xl">建立帳號</CardTitle>
        <CardDescription>
          已有帳號？{" "}
          <Link href="/login" className="font-medium text-ink underline-offset-4 hover:underline">
            登入
          </Link>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-ink">
              電子郵件
            </label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-2"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-ink">
              密碼（至少 6 字元）
            </label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-2"
            />
          </div>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          {info ? <p className="text-sm text-emerald-700">{info}</p> : null}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "建立中…" : "建立帳號"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
