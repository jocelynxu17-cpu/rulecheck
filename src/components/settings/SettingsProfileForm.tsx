"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function SettingsProfileForm({
  email,
  initialDisplayName,
}: {
  email: string;
  initialDisplayName: string;
}) {
  const [name, setName] = useState(initialDisplayName);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({
      data: { display_name: name.trim() },
    });
    setLoading(false);
    if (error) {
      setMsg(error.message);
      return;
    }
    setMsg("已儲存。");
  }

  return (
    <form onSubmit={(e) => void save(e)} className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-ink" htmlFor="email">
          電子郵件
        </label>
        <Input id="email" value={email} disabled className="mt-2 bg-surface" />
        <p className="mt-1 text-xs text-ink-secondary">信箱由 Supabase Auth 管理，請透過登入流程變更。</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-ink" htmlFor="dn">
          顯示名稱
        </label>
        <Input
          id="dn"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="例如：法遵小組"
          className="mt-2"
        />
      </div>
      {msg ? <p className="text-sm text-brand-strong">{msg}</p> : null}
      <Button type="submit" disabled={loading}>
        {loading ? "儲存中…" : "儲存變更"}
      </Button>
    </form>
  );
}
