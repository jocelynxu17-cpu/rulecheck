import type { InternalOpsAuditRow } from "@/lib/admin/internal-ops-audit";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** 可供連到 `/internal/workspaces/[id]` 的工作區 UUID（避免誤連非工作區 UUID）。 */
export function collectWorkspaceLinkIds(row: InternalOpsAuditRow): string[] {
  const ids = new Set<string>();
  if (row.target_type === "workspace" && row.target_id && UUID_RE.test(row.target_id)) {
    ids.add(row.target_id);
  }
  for (const root of [row.before_json, row.after_json]) {
    const w = root.workspace;
    if (w && typeof w === "object" && w !== null) {
      const id = (w as Record<string, unknown>).id;
      if (typeof id === "string" && UUID_RE.test(id)) {
        ids.add(id);
      }
    }
  }
  return [...ids];
}
