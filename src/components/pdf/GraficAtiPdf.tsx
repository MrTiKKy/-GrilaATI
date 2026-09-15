import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";

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
};

export const PDF_ROWS_PER_PAGE = 28;

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
    paddingTop: 18,
    paddingBottom: 16,
    paddingHorizontal: 16,
    fontFamily: FONT_FAMILY,
    fontSize: 7,
    color: "#000",
  },
  title: {
    fontFamily: FONT_FAMILY,
    fontWeight: "bold",
    fontSize: 11,
    textAlign: "center",
    textTransform: "uppercase",
    marginBottom: 8,
  },
  pageHint: {
    fontFamily: FONT_FAMILY,
    fontSize: 7,
    textAlign: "right",
    marginBottom: 6,
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
    paddingVertical: 2,
    paddingHorizontal: 3,
    justifyContent: "center",
  },
  nameText: {
    fontFamily: FONT_FAMILY,
    fontWeight: "bold",
    fontSize: 6.5,
    textTransform: "uppercase",
  },
  dayCell: {
    flexGrow: 1,
    flexBasis: 0,
    borderRightWidth: 0.6,
    borderBottomWidth: 0.6,
    borderColor: "#000",
    paddingVertical: 1.5,
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
    paddingVertical: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: {
    fontFamily: FONT_FAMILY,
    fontWeight: "bold",
    fontSize: 6.5,
    textAlign: "center",
  },
  abbrText: {
    fontFamily: FONT_FAMILY,
    fontSize: 5.5,
    textAlign: "center",
  },
  cellText: {
    fontFamily: FONT_FAMILY,
    fontSize: 6.5,
    textAlign: "center",
  },
  footer: {
    marginTop: 12,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerText: {
    fontFamily: FONT_FAMILY,
    fontStyle: "italic",
    fontSize: 8,
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

function TableHeader({ days }: { days: GraficPdfDay[] }) {
  return (
    <>
      <View style={styles.row}>
        <View style={[styles.nameCell, { paddingVertical: 3 }]}>
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
        <View style={[styles.osdCell, { paddingVertical: 3 }]}>
          <Text style={styles.headerText}>O.SD</Text>
        </View>
      </View>
      <View style={styles.row}>
        <View style={[styles.nameCell, { paddingVertical: 2 }]}>
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
}: {
  rows: GraficPdfRow[];
  days: GraficPdfDay[];
  rowOffset: number;
}) {
  const dayCount = days.length;
  return (
    <>
      {rows.map((row, idx) => (
        <View key={`${rowOffset + idx}-${row.name}`} style={styles.row} wrap={false}>
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

export function GraficAtiPdf({ data }: { data: GraficPdfData }) {
  const pages = chunkRows(data.rows, PDF_ROWS_PER_PAGE);
  const totalPages = pages.length;

  return (
    <Document
      title={data.title}
      author="Grila ATI"
      subject="Grafic asistenți ATI"
    >
      {pages.map((pageRows, pageIndex) => (
        <Page
          key={`page-${pageIndex}`}
          size="A4"
          orientation="landscape"
          style={styles.page}
          wrap={false}
        >
          <Text style={styles.title}>{data.title}</Text>
          {totalPages > 1 && (
            <Text style={styles.pageHint}>
              Pagina {pageIndex + 1} / {totalPages}
            </Text>
          )}

          <View style={styles.table}>
            <TableHeader days={data.days} />
            <StaffTableRows
              rows={pageRows}
              days={data.days}
              rowOffset={pageIndex * PDF_ROWS_PER_PAGE}
            />
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>
              MEDIC SEF: DR. SUSANU CAROLINA
            </Text>
            <Text style={styles.footerText}>DELEGAT</Text>
            <Text style={styles.footerText}>AS SEF: POPA NICOLETA</Text>
          </View>
        </Page>
      ))}
    </Document>
  );
}
