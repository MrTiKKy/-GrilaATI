/** Fundal weekend pe grilă / Excel / PDF (sâmbătă–duminică + sărbătoare + Fundal popup). */
export const WEEKEND_CELL_BG = "#F5C09A";

export type CellFundal = "alb" | "weekend";

export function isCellFundal(v: unknown): v is CellFundal {
  return v === "alb" || v === "weekend";
}

/** Weekend pe zi, sărbătoare legală, SAU fundal portocaliu pe casuță. */
export function cellHasWeekendBg(
  dayWeekend: boolean,
  fundalWeekend = false,
  sarbatoare = false,
): boolean {
  return dayWeekend || sarbatoare || fundalWeekend;
}

/**
 * Antet coloană (nr. zi + literă): portocaliu pe weekend / sărbătoare
 * SAU când toată coloana are fundal weekend pe fiecare rând.
 */
export function columnHeaderHasWeekendBg(
  dayWeekend: boolean,
  fundalFlags: readonly boolean[],
  sarbatoare = false,
): boolean {
  if (dayWeekend || sarbatoare) return true;
  return fundalFlags.length > 0 && fundalFlags.every(Boolean);
}

export function fundalFromFlag(fundalWeekend: boolean): CellFundal {
  return fundalWeekend ? "weekend" : "alb";
}
