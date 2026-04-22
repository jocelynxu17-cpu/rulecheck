import { createClient } from "@/lib/supabase/server";
import { AppChrome } from "@/components/app/AppChrome";
import { canAccessInternalOps } from "@/lib/admin/internal-ops-access";

/** 使用者端 App shell：極簡工作區，不含內部營運工具（營運入口僅限具權限者於頂欄顯示）。 */
export default async function WebAppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const showInternalEntry = canAccessInternalOps(user?.email);

  return (
    <AppChrome user={user} variant="consumer" showInternalEntry={showInternalEntry}>
      {children}
    </AppChrome>
  );
}
