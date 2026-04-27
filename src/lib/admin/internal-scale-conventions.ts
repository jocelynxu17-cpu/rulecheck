/**
 * Single place for internal /internal list limits — tune as data volume grows.
 * Principles: bounded reads, pagination, sampled ratios labeled as such.
 */

export const INTERNAL_LIST_PAGE_DEFAULT = 40;
export const INTERNAL_LIST_PAGE_MAX = 100;

export const INTERNAL_PAYMENT_PAGE_DEFAULT = 45;
/** Default cap for `/internal/payment-events` list (URL `page_size`). */
export const INTERNAL_PAYMENT_PAGE_MAX = 150;
/** Larger reads for internal correlation (e.g. analysis center) — not for default list UX. */
export const INTERNAL_PAYMENT_BATCH_SCAN_MAX = 500;

export const INTERNAL_AUDIT_PAGE_DEFAULT = 60;
export const INTERNAL_AUDIT_PAGE_MAX = 150;

/** Users/workspaces lists: batch scan cap for usage_events hint (existing behavior). */
export const INTERNAL_ACTIVITY_BATCH_CAP = 12000;

export function clampPageSize(n: number | undefined, fallback: number, max: number): number {
  const raw = typeof n === "number" && Number.isFinite(n) ? Math.floor(n) : fallback;
  return Math.min(Math.max(raw, 1), max);
}

export function clampPage(n: number | undefined): number {
  const raw = typeof n === "number" && Number.isFinite(n) ? Math.floor(n) : 1;
  return Math.max(1, raw);
}
