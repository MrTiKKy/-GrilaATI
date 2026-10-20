/** Fundal weekend pe grilă / Excel / PDF (sâmbătă–duminică + opțiune Fundal în popup). */
export const WEEKEND_CELL_BG = "#F5C09A";

export type CellFundal = "alb" | "weekend";

export function isCellFundal(v: unknown): v is CellFundal {
  return v === "alb" || v === "weekend";
}

/** Weekend pe zi SAU fundal portocaliu setat pe casuță. */
export function cellHasWeekendBg(
  dayWeekend: boolean,
  fundalWeekend = false,
): boolean {
  return dayWeekend || fundalWeekend;
}

/**
 * Antet coloană (nr. zi + literă): portocaliu pe weekend SAU când
 * toată coloana are fundal weekend pe fiecare rând.
 */
export function columnHeaderHasWeekendBg(
  dayWeekend: boolean,
  fundalFlags: readonly boolean[],
): boolean {
  if (dayWeekend) return true;
  return fundalFlags.length > 0 && fundalFlags.every(Boolean);
}

export function fundalFromFlag(fundalWeekend: boolean): CellFundal {
  return fundalWeekend ? "weekend" : "alb";
}
