/** Culori text pe casuța de programare — vii, contrast puternic */
export const CULOARE_VALUES = [
  "black",
  "red",
  "blue",
  "green",
  "yellow",
] as const;

export type ProgramareCuloare = (typeof CULOARE_VALUES)[number];

export const CULOARE_OPTIONS: Array<{
  id: ProgramareCuloare;
  label: string;
  /** Hex saturat pentru text/swatch */
  hex: string;
}> = [
  { id: "black", label: "Negru", hex: "#111111" },
  { id: "red", label: "Roșu", hex: "#E11D48" },
  { id: "blue", label: "Albastru", hex: "#2563EB" },
  { id: "green", label: "Verde", hex: "#16A34A" },
  { id: "yellow", label: "Galben", hex: "#CA8A04" },
];

export function isProgramareCuloare(v: unknown): v is ProgramareCuloare {
  return (
    v === "black" ||
    v === "red" ||
    v === "blue" ||
    v === "green" ||
    v === "yellow"
  );
}

export function culoareHex(c: ProgramareCuloare | null | undefined): string {
  const id = c && isProgramareCuloare(c) ? c : "black";
  return CULOARE_OPTIONS.find((o) => o.id === id)?.hex ?? "#111111";
}

/** Pentru DB: black → null */
export function culoareToDb(
  c: ProgramareCuloare | null | undefined,
): string | null {
  if (!c || c === "black") return null;
  return c;
}

export function culoareFromDb(raw: unknown): ProgramareCuloare {
  if (raw === null || raw === undefined || raw === "" || raw === "black") {
    return "black";
  }
  const s = String(raw);
  return isProgramareCuloare(s) ? s : "black";
}
