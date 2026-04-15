import { createClient } from "@/lib/supabase/server";
import { AppChrome } from "@/components/app/AppChrome";

export default async function AnalyzeLayout({ children }: { children: React.ReactNode }) {
  let user = null;
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    user = null;
  }

  return <AppChrome user={user}>{children}</AppChrome>;
}
