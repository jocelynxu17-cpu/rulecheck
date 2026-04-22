import { isAdminEmail } from "@/lib/admin/is-admin-email";

/**
 * SUPERADMIN_EMAILS：逗號分隔、不分大小寫。未設定時，內部營運後台改以 ADMIN_EMAILS 作為過渡（避免既有部署鎖死）。
 */
export function parseSuperAdminEmails(): string[] {
  return (
    process.env.SUPERADMIN_EMAILS?.split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean) ?? []
  );
}

export function isSuperAdminEmail(email: string | null | undefined): boolean {
  const list = parseSuperAdminEmails();
  if (!email || list.length === 0) return false;
  return list.includes(email.trim().toLowerCase());
}

/** 可進入 `/internal/*` 與呼叫 `/api/admin/*`（營運 API）。 */
export function canAccessInternalOps(email: string | null | undefined): boolean {
  const superList = parseSuperAdminEmails();
  if (superList.length > 0) return isSuperAdminEmail(email);
  return isAdminEmail(email);
}
