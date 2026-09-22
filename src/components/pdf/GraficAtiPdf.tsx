import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";
import {
  GRAFIC_FOOTER_DEFAULTS,
  mergeGraficFooter,
  type GraficFooterTexts,
} from "@/lib/graficFooter";
import { GRAFIC_FONT } from "@/lib/graficTypography";

export type GraficPdfDay = {
  day: number;
  abbr: string;
  weekend: boolean;
};

export type GraficPdfRow = {
  name: string;
  /** Valori oficiale pe zile (fără A/R) */
  cells: string[];
  osd: string;
};

export type GraficPdfData = {
  title: string;
  days: GraficPdfDay[];
  rows: GraficPdfRow[];
  footer?: GraficFooterTexts;
};

/** A4 landscape height (pt) */
const PAGE_H = 595;
const PAGE_PAD_TOP = 14;
const PAGE_PAD_BOTTOM = 14;
const TITLE_BLOCK = 22;
const FOOTER_BLOCK = 28;
const TABLE_GAP = 8;

const FONT_FAMILY = "GraficSerif";

let fontsRegistered = false;

/** Înregistrează DejaVu Serif (suportă ăâîșț) — apelează o dată înainte de pdf(). */
export function registerGraficPdfFonts(origin: string) {
  if (fontsRegistered) return;
  const base = `${origin.replace(/\/$/, "")}/fonts`;
  Font.register({
    family: FONT_FAMILY,
    fonts: [
      { src: `${base}/DejaVuSerif.ttf`, fontWeight: "normal", fontStyle: "normal" },
      { src: `${base}/DejaVuSerif-Bold.ttf`, fontWeight: "bold", fontStyle: "normal" },
      { src: `${base}/DejaVuSerif-Italic.ttf`, fontWeight: "normal", fontStyle: "italic" },
    ],
  });
  fontsRegistered = true;
}

const styles = StyleSheet.create({
  page: {
    paddingTop: PAGE_PAD_TOP,
    paddingBottom: PAGE_PAD_BOTTOM,
    paddingHorizontal: 14,
    fontFamily: FONT_FAMILY,
    fontSize: 7,
    color: "#000",
    height: "100%",
  },
  title: {
    fontFamily: FONT_FAMILY,
    fontWeight: "bold",
    fontSize: GRAFIC_FONT.title,
    textAlign: "center",
    textTransform: "uppercase",
    marginBottom: 6,
    height: TITLE_BLOCK - 6,
  },
  pageHint: {
    fontFamily: FONT_FAMILY,
    fontSize: 7,
    textAlign: "right",
    marginBottom: 4,
    color: "#333",
  },
  table: {
    width: "100%",
    borderTopWidth: 0.6,
    borderLeftWidth: 0.6,
    borderColor: "#000",
  },
  row: {
    flexDirection: "row",
  },
  nameCell: {
    width: "11%",
    borderRightWidth: 0.6,
    borderBottomWidth: 0.6,
    borderColor: "#000",
    paddingHorizontal: 3,
    justifyContent: "center",
  },
  nameText: {
    fontFamily: FONT_FAMILY,
    fontWeight: "bold",
    fontSize: GRAFIC_FONT.name,
    textTransform: "uppercase",
  },
  dayCell: {
    flexGrow: 1,
    flexBasis: 0,
    borderRightWidth: 0.6,
    borderBottomWidth: 0.6,
    borderColor: "#000",
    alignItems: "center",
    justifyContent: "center",
  },
  weekend: {
    backgroundColor: "#d9d9d9",
  },
  osdCell: {
    width: "4.5%",
    borderRightWidth: 0.6,
    borderBottomWidth: 0.6,
    borderColor: "#000",
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: {
    fontFamily: FONT_FAMILY,
    fontWeight: "bold",
    fontSize: GRAFIC_FONT.header,
    textAlign: "center",
  },
  abbrText: {
    fontFamily: FONT_FAMILY,
    fontWeight: "bold",
    fontSize: GRAFIC_FONT.abbr,
    textAlign: "center",
  },
  cellText: {
    fontFamily: FONT_FAMILY,
    fontSize: GRAFIC_FONT.cell,
    textAlign: "center",
  },
  delegatMerged: {
    flexGrow: 1,
    flexBasis: 0,
    borderRightWidth: 0.6,
    borderBottomWidth: 0.6,
    borderColor: "#000",
    alignItems: "center",
    justifyContent: "center",
  },
  footer: {
    marginTop: TABLE_GAP,
    height: FOOTER_BLOCK - TABLE_GAP,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  footerText: {
    fontFamily: FONT_FAMILY,
    fontStyle: "italic",
    fontSize: GRAFIC_FONT.footer,
    textTransform: "uppercase",
  },
});

function chunkRows<T>(rows: T[], size: number): T[][] {
  if (rows.length === 0) return [[]];
  const pages: T[][] = [];
  for (let i = 0; i < rows.length; i += size) {
    pages.push(rows.slice(i, i + size));
  }
  return pages;
}

function TableHeader({
  days,
  rowH,
}: {
  days: GraficPdfDay[];
  rowH: number;
}) {
  return (
    <>
      <View style={[styles.row, { height: rowH }]}>
        <View style={styles.nameCell}>
          <Text style={styles.headerText}> </Text>
        </View>
        {days.map((d) => (
          <View
            key={`n-${d.day}`}
            style={[styles.dayCell, d.weekend ? styles.weekend : undefined]}
          >
            <Text style={styles.headerText}>{d.day}</Text>
          </View>
        ))}
        <View style={styles.osdCell}>
          <Text style={[styles.headerText, { fontSize: GRAFIC_FONT.osd }]}>
            O.SD
          </Text>
        </View>
      </View>
      <View style={[styles.row, { height: rowH }]}>
        <View style={styles.nameCell}>
          <Text style={styles.headerText}> </Text>
        </View>
        {days.map((d) => (
          <View
            key={`a-${d.day}`}
            style={[styles.dayCell, d.weekend ? styles.weekend : undefined]}
          >
            <Text style={styles.abbrText}>{d.abbr}</Text>
          </View>
        ))}
        <View style={styles.osdCell}>
          <Text style={styles.abbrText}> </Text>
        </View>
      </View>
    </>
  );
}

function StaffTableRows({
  rows,
  days,
  rowOffset,
  rowH,
}: {
  rows: GraficPdfRow[];
  days: GraficPdfDay[];
  rowOffset: number;
  rowH: number;
}) {
  const dayCount = days.length;
  return (
    <>
      {rows.map((row, idx) => (
        <View
          key={`${rowOffset + idx}-${row.name}`}
          style={[styles.row, { height: rowH }]}
          wrap={false}
        >
          <View style={styles.nameCell}>
            <Text style={styles.nameText}>{row.name}</Text>
          </View>
          {Array.from({ length: dayCount }, (_, i) => {
            const d = days[i];
            const value = row.cells[i] ?? "";
            return (
              <View
                key={`${rowOffset + idx}-${d.day}`}
                style={[styles.dayCell, d.weekend ? styles.weekend : undefined]}
              >
                <Text style={styles.cellText}>{value}</Text>
              </View>
            );
          })}
          <View style={styles.osdCell}>
            <Text style={styles.cellText}>{row.osd || ""}</Text>
          </View>
        </View>
      ))}
    </>
  );
}

function EmptyRows({
  count,
  days,
  rowH,
}: {
  count: number;
  days: GraficPdfDay[];
  rowH: number;
}) {
  const dayCount = days.length;
  return (
    <>
      {Array.from({ length: count }, (_, idx) => (
        <View
          key={`empty-${idx}`}
          style={[styles.row, { height: rowH }]}
          wrap={false}
        >
          <View style={styles.nameCell}>
            <Text style={styles.cellText}> </Text>
          </View>
          {Array.from({ length: dayCount }, (_, i) => (
            <View key={`e-${idx}-${days[i].day}`} style={styles.dayCell}>
              <Text style={styles.cellText}> </Text>
            </View>
          ))}
          <View style={styles.osdCell}>
            <Text style={styles.cellText}> </Text>
          </View>
        </View>
      ))}
    </>
  );
}

function DelegatRow({
  footer,
  rowH,
}: {
  footer: GraficFooterTexts;
  rowH: number;
}) {
  return (
    <View style={[styles.row, { height: rowH }]} wrap={false}>
      <View style={styles.nameCell}>
        <Text style={styles.nameText}>{footer.delegatName}</Text>
      </View>
      <View style={styles.delegatMerged}>
        <Text style={styles.cellText}>{footer.delegatLabel}</Text>
      </View>
    </View>
  );
}

export function GraficAtiPdf({ data }: { data: GraficPdfData }) {
  const footer = mergeGraficFooter(data.footer ?? GRAFIC_FOOTER_DEFAULTS);
  // Tot pe o pagină când e rezonabil; altfel chunk
  const maxPerPage = 40;
  const pages = chunkRows(data.rows, maxPerPage);
  const totalPages = pages.length;

  return (
    <Document
      title={data.title}
      author="Grila ATI"
      subject="Grafic asistenți ATI"
    >
      {pages.map((pageRows, pageIndex) => {
        const isLast = pageIndex === totalPages - 1;
        const hasHint = totalPages > 1;
        const includeDelegatBlock = isLast;
        const effectiveStaff = pageRows.length;
        const tableRowCount = includeDelegatBlock
          ? 2 + effectiveStaff + 2 + 1
          : 2 + effectiveStaff;
        const hint = hasHint ? 12 : 0;
        const usable =
          PAGE_H -
          PAGE_PAD_TOP -
          PAGE_PAD_BOTTOM -
          TITLE_BLOCK -
          hint -
          FOOTER_BLOCK;
        const h = Math.max(10, usable / tableRowCount);

        return (
          <Page
            key={`page-${pageIndex}`}
            size="A4"
            orientation="landscape"
            style={styles.page}
            wrap={false}
          >
            <Text style={styles.title}>{data.title}</Text>
            {hasHint && (
              <Text style={styles.pageHint}>
                Pagina {pageIndex + 1} / {totalPages}
              </Text>
            )}

            <View style={styles.table}>
              <TableHeader days={data.days} rowH={h} />
              <StaffTableRows
                rows={pageRows}
                days={data.days}
                rowOffset={pageIndex * maxPerPage}
                rowH={h}
              />
              {includeDelegatBlock && (
                <>
                  <EmptyRows count={2} days={data.days} rowH={h} />
                  <DelegatRow footer={footer} rowH={h} />
                </>
              )}
            </View>

            {includeDelegatBlock && (
              <View style={styles.footer}>
                <Text style={styles.footerText}>{footer.medicSef}</Text>
                <Text style={styles.footerText}>{footer.asSef}</Text>
              </View>
            )}
          </Page>
        );
      })}
    </Document>
  );
}

// păstrat pentru compat importuri vechi
export const PDF_ROWS_PER_PAGE = 40;
