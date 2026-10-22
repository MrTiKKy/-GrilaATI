/** Cache UI pentru workspace-ul activ (localStorage) — fără schimbări API/DB. */

export const WS_UI_CACHE_KEY = "grila_ws_ui";
export const SIDEBAR_EXPANDED_KEY = "grila_sidebar_expanded";

export type WorkspaceUiCache = {
  id: string;
  nume: string;
  poateModificaSetari: boolean;
};

export function readWorkspaceUiCache(): WorkspaceUiCache | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(WS_UI_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WorkspaceUiCache;
    if (
      typeof parsed?.id !== "string" ||
      typeof parsed?.nume !== "string" ||
      typeof parsed?.poateModificaSetari !== "boolean"
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writeWorkspaceUiCache(ws: WorkspaceUiCache): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(WS_UI_CACHE_KEY, JSON.stringify(ws));
  } catch {
    // ignore
  }
}

export function readSidebarExpanded(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const v = window.localStorage.getItem(SIDEBAR_EXPANDED_KEY);
    if (v === null) return true;
    return v === "1" || v === "true";
  } catch {
    return true;
  }
}

export function writeSidebarExpanded(expanded: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SIDEBAR_EXPANDED_KEY, expanded ? "1" : "0");
  } catch {
    // ignore
  }
}

export function workspaceInitial(nume: string): string {
  const t = nume.trim();
  if (!t) return "?";
  return t.charAt(0).toLocaleUpperCase("ro-RO");
}

/** Ultima lună/categorie văzută pe grilă — folosită la preview Export PDF. */
export const GRAFIC_VIEW_CACHE_KEY = "grila_grafic_view";

export type GraficViewCache = {
  an: number;
  luna: number;
  categorieId?: string;
};

export function readGraficViewCache(): GraficViewCache | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(GRAFIC_VIEW_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GraficViewCache;
    if (
      typeof parsed?.an !== "number" ||
      !Number.isInteger(parsed.an) ||
      parsed.an < 2000 ||
      parsed.an > 2100 ||
      typeof parsed?.luna !== "number" ||
      !Number.isInteger(parsed.luna) ||
      parsed.luna < 1 ||
      parsed.luna > 12
    ) {
      return null;
    }
    return {
      an: parsed.an,
      luna: parsed.luna,
      categorieId:
        typeof parsed.categorieId === "string" && parsed.categorieId
          ? parsed.categorieId
          : undefined,
    };
  } catch {
    return null;
  }
}

export function writeGraficViewCache(view: GraficViewCache): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      GRAFIC_VIEW_CACHE_KEY,
      JSON.stringify({
        an: view.an,
        luna: view.luna,
        ...(view.categorieId ? { categorieId: view.categorieId } : {}),
      }),
    );
  } catch {
    // ignore
  }
}
