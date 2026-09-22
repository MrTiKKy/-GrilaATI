const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseUuid(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim();
  return UUID_RE.test(v) ? v : null;
}

export function parseYear(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(n) || n < 2000 || n > 2100) return null;
  return n;
}

export function parseMonth(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 12) return null;
  return n;
}

export function parseFoaieParam(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 50) return null;
  return n;
}

export function parseUuidList(
  value: unknown,
  opts?: { max?: number },
): string[] | null {
  if (!Array.isArray(value)) return null;
  const max = opts?.max ?? 200;
  if (value.length === 0 || value.length > max) return null;
  const out: string[] = [];
  for (const item of value) {
    const id = parseUuid(item);
    if (!id) return null;
    out.push(id);
  }
  return out;
}

export function clampString(
  value: unknown,
  maxLen: number,
): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  if (!t || t.length > maxLen) return null;
  return t;
}
