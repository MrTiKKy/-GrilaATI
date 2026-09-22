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
  delegatName: "MARCULESCU",
  delegatLabel: "DELEGAT",
  medicSef: "*MEDIC SEF: DR SUSANU CAROLIN*",
  asSef: "AS SEF POPA NICOLETA",
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
