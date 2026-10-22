export type GraficFooterKey =
  | "delegat_name"
  | "delegat_label"
  | "medic_sef"
  | "as_sef";

export type GraficFooterTexts = {
  delegatName: string;
  delegatLabel: string;
  medicSef: string;
  asSef: string;
};

export const GRAFIC_FOOTER_DEFAULTS: GraficFooterTexts = {
  delegatName: "",
  delegatLabel: "",
  medicSef: "",
  asSef: "",
};

export const GRAFIC_FOOTER_FIELDS: Array<{
  key: GraficFooterKey;
  prop: keyof GraficFooterTexts;
  label: string;
}> = [
  { key: "delegat_name", prop: "delegatName", label: "Nume delegat" },
  { key: "delegat_label", prop: "delegatLabel", label: "Etichetă delegat" },
  { key: "medic_sef", prop: "medicSef", label: "Medic șef" },
  { key: "as_sef", prop: "asSef", label: "Asistent șef" },
];

const KEY_TO_PROP: Record<GraficFooterKey, keyof GraficFooterTexts> = {
  delegat_name: "delegatName",
  delegat_label: "delegatLabel",
  medic_sef: "medicSef",
  as_sef: "asSef",
};

export function isGraficFooterKey(v: unknown): v is GraficFooterKey {
  return (
    v === "delegat_name" ||
    v === "delegat_label" ||
    v === "medic_sef" ||
    v === "as_sef"
  );
}

export function mergeGraficFooter(
  partial?: Partial<GraficFooterTexts> | null,
): GraficFooterTexts {
  return {
    delegatName: partial?.delegatName?.trim() || GRAFIC_FOOTER_DEFAULTS.delegatName,
    delegatLabel: partial?.delegatLabel?.trim() || GRAFIC_FOOTER_DEFAULTS.delegatLabel,
    medicSef: partial?.medicSef?.trim() || GRAFIC_FOOTER_DEFAULTS.medicSef,
    asSef: partial?.asSef?.trim() || GRAFIC_FOOTER_DEFAULTS.asSef,
  };
}

export function footerFromDbRows(
  rows: Array<{ key: string; value: string }>,
): GraficFooterTexts {
  const next = { ...GRAFIC_FOOTER_DEFAULTS };
  for (const row of rows) {
    if (!isGraficFooterKey(row.key)) continue;
    const prop = KEY_TO_PROP[row.key];
    const value = String(row.value ?? "").trim();
    if (value) next[prop] = value;
  }
  return next;
}

/** Prefixe cunoscute (cele mai lungi primul) pentru split fără `:` / `;`. */
const FOOTER_ROLE_PREFIXES = [
  /^MEDIC\s+ȘEF\s+SECȚIE\b/i,
  /^MEDIC\s+SEF\s+SECTIE\b/i,
  /^MEDIC\s+ȘEF\b/i,
  /^MEDIC\s+SEF\b/i,
  /^ASISTENT\s+ȘEF\b/i,
  /^ASISTENT\s+SEF\b/i,
  /^AS\.?\s+ȘEF\b/i,
  /^AS\.?\s+SEF\b/i,
];

function stripFooterDecor(s: string): string {
  return s.replace(/\*/g, "").replace(/\s+/g, " ").trim();
}

function stripTrailingRolePunct(role: string): string {
  return role.replace(/\s*[:;.,]\s*$/, "").trim();
}

/**
 * Desparte semnătura footer în funcție + nume.
 * Ex. "MEDIC ȘEF SECȚIE: DR X" → { role: "MEDIC ȘEF SECȚIE", name: "DR X" }
 */
export function splitFooterSignature(
  raw: string,
): { role: string; name: string } | null {
  const t = stripFooterDecor(raw);
  if (!t) return null;

  const lines = t
    .split(/\r?\n/)
    .map((l) => stripFooterDecor(l))
    .filter(Boolean);
  if (lines.length >= 2) {
    return {
      role: stripTrailingRolePunct(lines[0]),
      name: lines.slice(1).join(" "),
    };
  }

  const sep = t.match(/^(.+?)\s*[:;]\s+(.+)$/);
  if (sep) {
    return {
      role: stripTrailingRolePunct(sep[1]),
      name: sep[2].trim(),
    };
  }

  for (const re of FOOTER_ROLE_PREFIXES) {
    const m = t.match(re);
    if (!m) continue;
    const role = m[0].trim();
    const name = t.slice(m[0].length).trim();
    if (name) return { role: stripTrailingRolePunct(role), name };
  }

  return null;
}

/** Afișare pe 2 rânduri: `FUNCȚIE;\nNUME` (sau textul original dacă nu se poate split). */
export function formatFooterSignatureLines(raw: string): string {
  return footerSignatureLineList(raw).join("\n");
}

/** Linii pentru PDF (fără `\n` în Text — react-pdf poate strica MediaBox). */
export function footerSignatureLineList(raw: string): string[] {
  const parts = splitFooterSignature(raw);
  if (!parts) {
    const t = stripFooterDecor(raw);
    return t ? [t] : [];
  }
  return [`${parts.role};`, parts.name];
}
