export type SetariTabId =
  | "general"
  | "categorii"
  | "coduri"
  | "ore-pe-zile"
  | "foi"
  | "texte-export"
  | "export-pdf"
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
    enabled: true,
  },
  {
    id: "coduri",
    label: "Coduri",
    href: "/setari/coduri",
    enabled: true,
  },
  {
    id: "ore-pe-zile",
    label: "Ore O.SD",
    href: "/setari/ore",
    enabled: true,
  },
  { id: "foi", label: "Foi", href: "/setari/foi", enabled: false },
  {
    id: "texte-export",
    label: "Texte",
    href: "/setari/texte",
    enabled: true,
  },
  {
    id: "export-pdf",
    label: "Export PDF",
    href: "/setari/export-pdf",
    enabled: true,
  },
  { id: "membri", label: "Membri", href: "/setari/membri", enabled: true },
  {
    id: "propuneri",
    label: "Propuneri",
    href: "/setari/propuneri",
    enabled: false,
  },
] as const;
