/** Textul exact afișat când nume e NULL: „Sheet {n}”. */
export function numeFoaieImplicit(foaie: number): string {
  return `Sheet ${foaie}`;
}

/**
 * Numele de afișare al foii.
 * Dacă `nume` e setat (după trim) → acela; altfel textul implicit identic cu înainte.
 */
export function numeFoaie(
  foaie: number,
  nume: string | null | undefined,
): string {
  const t = typeof nume === "string" ? nume.trim() : "";
  return t || numeFoaieImplicit(foaie);
}

/** Suffix titlu arhivă / export: null = nu se adaugă (comportament Foaie 1 fără nume). */
export function foaieTitleSuffix(
  foaie: number,
  nume: string | null | undefined,
): string | null {
  const custom = typeof nume === "string" ? nume.trim() : "";
  if (custom) return custom;
  if (foaie > 1) return numeFoaieImplicit(foaie);
  return null;
}

/** Suffix fișier export (slug). Gol pentru Foaie 1 fără nume custom. */
export function foaieFileSuffix(
  foaie: number,
  nume: string | null | undefined,
): string {
  const custom = typeof nume === "string" ? nume.trim() : "";
  if (custom) {
    return (
      custom
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 40) || `sheet${foaie}`
    );
  }
  if (foaie > 1) return `sheet${foaie}`;
  return "";
}

export function parseFoaie(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 50) return null;
  return n;
}

/** Normalizează input rename: null/"" = implicit; string 1–40 după trim. */
export function parseFoaieNumeInput(
  raw: unknown,
): { ok: true; nume: string | null } | { ok: false; error: string } {
  if (raw === null || raw === undefined) {
    return { ok: true, nume: null };
  }
  if (typeof raw !== "string") {
    return { ok: false, error: "Nume invalid" };
  }
  if (raw.length === 0) return { ok: true, nume: null };
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return { ok: false, error: "Numele nu poate conține doar spații" };
  }
  if (trimmed.length > 40) {
    return { ok: false, error: "Numele are maxim 40 de caractere" };
  }
  return { ok: true, nume: trimmed };
}
