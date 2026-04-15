import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SettingsProfileForm } from "@/components/settings/SettingsProfileForm";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const displayName =
    typeof user?.user_metadata?.display_name === "string"
      ? (user?.user_metadata?.display_name as string)
      : "";

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-ink">設定</h1>
        <p className="mt-2 text-sm text-ink-secondary">管理個人檔案與登入資訊（顯示名稱儲存在 Auth metadata）。</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>個人檔案</CardTitle>
          <CardDescription>更新你在 RuleCheck 顯示的名稱。</CardDescription>
        </CardHeader>
        <CardContent>
          <SettingsProfileForm email={user?.email ?? ""} initialDisplayName={displayName} />
        </CardContent>
      </Card>
    </div>
  );
}
