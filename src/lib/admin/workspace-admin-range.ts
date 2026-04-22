export type AdminWorkspaceRange = "7d" | "30d" | "month";

const ALLOWED = new Set<AdminWorkspaceRange>(["7d", "30d", "month"]);

export function parseWorkspaceAdminRange(raw: string | string[] | undefined): AdminWorkspaceRange {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (v === "7d" || v === "30d" || v === "month") return v;
  return "30d";
}

/** ISO 字串：僅供 `created_at` 篩選（UTC 儲存）。本月份以台北日曆月起算。 */
export function sinceIsoForWorkspaceRange(range: AdminWorkspaceRange, now = new Date()): string {
  if (range === "7d") {
    return new Date(now.getTime() - 7 * 86400000).toISOString();
  }
  if (range === "30d") {
    return new Date(now.getTime() - 30 * 86400000).toISOString();
  }
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const s = fmt.format(now);
  const [yStr, mStr] = s.split("-");
  const y = Number(yStr);
  const m = Number(mStr);
  if (!Number.isFinite(y) || !Number.isFinite(m)) {
    return new Date(now.getTime() - 30 * 86400000).toISOString();
  }
  return new Date(`${y}-${String(m).padStart(2, "0")}-01T00:00:00+08:00`).toISOString();
}

export function workspaceRangeLabelZh(range: AdminWorkspaceRange): string {
  if (range === "7d") return "近 7 日";
  if (range === "30d") return "近 30 日";
  return "本月份（台北）";
}
