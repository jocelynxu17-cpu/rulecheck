import { parseAdminEmails } from "@/lib/admin/is-admin-email";
import { parseSuperAdminEmails } from "@/lib/admin/internal-ops-access";

/** 僅顯示是否設定，不暴露金鑰或完整值。 */
export type InternalRuntimeStatus = {
  nodeEnv: string;
  hasPublicSupabaseUrl: boolean;
  hasAnonKey: boolean;
  hasServiceRoleKey: boolean;
  stripeWebhookConfigured: boolean;
  stripeSecretConfigured: boolean;
  superadminEmailCount: number;
  adminEmailCount: number;
  /** 未設定 SUPERADMIN_EMAILS 時，內部後台過渡為 ADMIN_EMAILS */
  internalUsesAdminFallback: boolean;
};

export function getInternalRuntimeStatus(): InternalRuntimeStatus {
  const superList = parseSuperAdminEmails();
  const adminList = parseAdminEmails();
  return {
    nodeEnv: process.env.NODE_ENV ?? "unknown",
    hasPublicSupabaseUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()),
    hasAnonKey: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()),
    hasServiceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()),
    stripeWebhookConfigured: Boolean(process.env.STRIPE_WEBHOOK_SECRET?.trim()),
    stripeSecretConfigured: Boolean(process.env.STRIPE_SECRET_KEY?.trim()),
    superadminEmailCount: superList.length,
    adminEmailCount: adminList.length,
    internalUsesAdminFallback: superList.length === 0 && adminList.length > 0,
  };
}
