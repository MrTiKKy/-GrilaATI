/**
 * Tipografie comună grafic — PDF, Excel, Word și grila din ecran.
 * Valorile sunt în pt (ecran: px aproximativ 1:1 la 96dpi).
 */
export const GRAFIC_FONT = {
  title: 13,
  cell: 15,
  name: 11,
  header: 11,
  abbr: 10,
  footer: 10,
  osd: 10,
} as const;

/** docx folosește half-points (24 = 12pt) */
export const GRAFIC_FONT_DOCX = {
  title: GRAFIC_FONT.title * 2,
  cell: GRAFIC_FONT.cell * 2,
  name: GRAFIC_FONT.name * 2,
  header: GRAFIC_FONT.header * 2,
  abbr: GRAFIC_FONT.abbr * 2,
  footer: GRAFIC_FONT.footer * 2,
} as const;
