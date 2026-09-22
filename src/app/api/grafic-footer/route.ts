import { NextResponse } from "next/server";
import { writeAudit } from "@/lib/audit";
import { guardRead, guardWrite } from "@/lib/apiGuard";
import { getDb } from "@/lib/db";
import {
  isGraficFooterKey,
  type GraficFooterTexts,
} from "@/lib/graficFooter";
import { loadGraficFooter } from "@/lib/loadGraficFooter";
import { clientKey } from "@/lib/rateLimit";
import { readJsonLimited } from "@/lib/readJsonLimited";

export async function GET(request: Request) {
  const denied = await guardRead(request);
  if (denied) return denied;

  try {
    const footer = await loadGraficFooter();
    return NextResponse.json({ footer });
  } catch (error) {
    console.error("GET /api/grafic-footer", error);
    return NextResponse.json(
      { error: "Nu s-au putut încărca textele footer" },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  const denied = await guardWrite(request);
  if (denied) return denied;

  try {
    const parsed = await readJsonLimited<{
      key?: unknown;
      value?: unknown;
    }>(request, 4_096);
    if (!parsed.ok) return parsed.response;

    const key = parsed.data.key;
    if (!isGraficFooterKey(key)) {
      return NextResponse.json({ error: "cheie invalidă" }, { status: 400 });
    }

    const value = String(parsed.data.value ?? "").trim();
    if (!value || value.length > 120) {
      return NextResponse.json(
        { error: "textul trebuie să aibă între 1 și 120 caractere" },
        { status: 400 },
      );
    }

    const sql = getDb();
    await sql`
      INSERT INTO grafic_footer (key, value, updated_at)
      VALUES (${key}, ${value}, now())
      ON CONFLICT (key)
      DO UPDATE SET value = EXCLUDED.value, updated_at = now()
    `;

    await writeAudit({
      action: "grafic_footer_update",
      detail: { key, value },
      ip: clientKey(request),
    });

    const footer: GraficFooterTexts = await loadGraficFooter();
    return NextResponse.json({ footer });
  } catch (error) {
    console.error("PUT /api/grafic-footer", error);
    const message =
      error instanceof Error && /grafic_footer/i.test(error.message)
        ? "Tabelul grafic_footer lipsește — rulează sql/grafic_footer.sql în Neon"
        : "Nu s-a putut salva";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
