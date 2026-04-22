/**
 * ADMIN_EMAILS: comma-separated, case-insensitive.
 * When unset or empty, no user is treated as admin for routing/UI (configure to enable admin).
 */
export function parseAdminEmails(): string[] {
  return (
    process.env.ADMIN_EMAILS?.split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean) ?? []
  );
}

export function isAdminEmail(email: string | null | undefined): boolean {
  const admins = parseAdminEmails();
  if (!email || admins.length === 0) return false;
  return admins.includes(email.trim().toLowerCase());
}
