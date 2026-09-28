export type SetariTabId =
  | "general"
  | "categorii"
  | "programari"
  | "ore-pe-zile"
  | "foi"
  | "texte-export"
  | "membri"
  | "propuneri";

export type SetariTab = {
  id: SetariTabId;
  label: string;
  href: string;
  /** false = „în curând”, neclickabil */
  enabled: boolean;
};

/** Ordinea tab-urilor din /setari — activează pe rând setând enabled: true */
export const SETARI_TABS: readonly SetariTab[] = [
  { id: "general", label: "General", href: "/setari", enabled: true },
  {
    id: "categorii",
    label: "Categorii",
    href: "/setari/categorii",
    enabled: false,
  },
  {
    id: "programari",
    label: "Programări",
    href: "/setari/programari",
    enabled: false,
  },
  {
    id: "ore-pe-zile",
    label: "Ore pe zile",
    href: "/setari/ore-pe-zile",
    enabled: false,
  },
  { id: "foi", label: "Foi", href: "/setari/foi", enabled: false },
  {
    id: "texte-export",
    label: "Texte și export",
    href: "/setari/texte-export",
    enabled: false,
  },
  { id: "membri", label: "Membri", href: "/setari/membri", enabled: false },
  {
    id: "propuneri",
    label: "Propuneri",
    href: "/setari/propuneri",
    enabled: false,
  },
] as const;
