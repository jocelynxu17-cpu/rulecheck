/** Flatten Next.js `searchParams` for merging into `hrefWithPage`. */
export function flattenInternalSearchParams(
  sp: Record<string, string | string[] | undefined>
): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(sp)) {
    if (v === undefined) continue;
    const s = Array.isArray(v) ? v[0] : v;
    if (s !== undefined && s !== "") out[k] = s;
  }
  return out;
}

/** Build relative URL preserving existing search params except overridden keys. */
export function hrefWithPage(
  pathname: string,
  current: Record<string, string | string[] | undefined>,
  overrides: Record<string, string | undefined>
): string {
  const p = new URLSearchParams();
  for (const [key, val] of Object.entries(current)) {
    if (val === undefined) continue;
    const s = Array.isArray(val) ? val[0] : val;
    if (s !== undefined && s !== "") {
      if (!(key in overrides)) p.set(key, s);
    }
  }
  for (const [key, val] of Object.entries(overrides)) {
    if (val === undefined || val === "") {
      p.delete(key);
    } else {
      p.set(key, val);
    }
  }
  const q = p.toString();
  return q ? `${pathname}?${q}` : pathname;
}
