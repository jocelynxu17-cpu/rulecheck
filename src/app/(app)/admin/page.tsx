import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const admins =
    process.env.ADMIN_EMAILS?.split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean) ?? [];
  const allowed = admins.length === 0 || (user?.email && admins.includes(user.email.toLowerCase()));

  if (!allowed) {
    return (
      <div className="mx-auto max-w-lg py-10">
        <Card>
          <CardHeader>
            <CardTitle>無法存取</CardTitle>
            <CardDescription>此頁面僅限管理者。請聯絡團隊開通 ADMIN_EMAILS。</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">管理後台</h1>
        <Badge tone="amber">Beta</Badge>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>功能規劃中</CardTitle>
          <CardDescription>
            我們正在整理管理者需要的工作流：帳號與權限、稽核紀錄、詞庫版本控管與營運監控。上線初期不影響一般使用者功能。
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-ink-secondary">
          <p>若你需要企業級管理需求，歡迎在訂閱後透過客戶入口的信箱與我們聯繫。</p>
        </CardContent>
      </Card>
    </div>
  );
}
