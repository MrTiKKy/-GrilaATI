import { NextResponse } from "next/server";
import { writeAudit } from "@/lib/audit";
import { guardRead, guardWrite } from "@/lib/apiGuard";
import {
  buildGraficSnapshotFromDb,
  buildMonthTitle,
} from "@/lib/buildGraficSnapshot";
import { getDb } from "@/lib/db";
import { clientKey } from "@/lib/rateLimit";
import { readJsonLimited } from "@/lib/readJsonLimited";
import { parseMonth, parseYear } from "@/lib/validate";
import type { GraficFinalMeta, GraficeListResponse } from "@/lib/types";

export async function GET(request: Request) {
  const denied = await guardRead(request);
  if (denied) return denied;

  try {
    const { searchParams } = new URL(request.url);
    const anParam = searchParams.get("an");
    const lunaParam = searchParams.get("luna");

    const sql = getDb();

    let rows;
    if (anParam && lunaParam) {
      const an = parseYear(anParam);
      const luna = parseMonth(lunaParam);
      if (an === null || luna === null) {
        return NextResponse.json({ error: "an/luna invalide" }, { status: 400 });
      }
      rows = await sql`
        SELECT id, an, luna, titlu, created_at
        FROM grafice_finale
        WHERE an = ${an} AND luna = ${luna}
        ORDER BY created_at DESC
      `;
    } else if (anParam) {
      const an = parseYear(anParam);
      if (an === null) {
        return NextResponse.json({ error: "an invalid" }, { status: 400 });
      }
      rows = await sql`
        SELECT id, an, luna, titlu, created_at
        FROM grafice_finale
        WHERE an = ${an}
        ORDER BY luna DESC, created_at DESC
      `;
    } else {
      rows = await sql`
        SELECT id, an, luna, titlu, created_at
        FROM grafice_finale
        ORDER BY an DESC, luna DESC, created_at DESC
        LIMIT 200
      `;
    }

    const items: GraficFinalMeta[] = rows.map((row) => ({
      id: String(row.id),
      an: Number(row.an),
      luna: Number(row.luna),
      titlu: String(row.titlu),
      createdAt:
        row.created_at instanceof Date
          ? row.created_at.toISOString()
          : String(row.created_at),
    }));

    const body: GraficeListResponse = { items };
    return NextResponse.json(body);
  } catch (error) {
    console.error("GET /api/grafice", error);
    const message =
      error instanceof Error && /grafice_finale/i.test(error.message)
        ? "Tabelul grafice_finale lipsește — rulează sql/grafice_finale.sql în Neon"
        : "Nu s-a putut încărca arhiva";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Salvează snapshot construit pe server din DB (nu din body client). */
export async function POST(request: Request) {
  const denied = await guardWrite(request, { limit: 20, windowMs: 60_000 });
  if (denied) return denied;

  try {
    const parsed = await readJsonLimited<{ an?: unknown; luna?: unknown }>(
      request,
      4_096,
    );
    if (!parsed.ok) return parsed.response;

    const an = parseYear(parsed.data.an);
    const luna = parseMonth(parsed.data.luna);
    if (an === null) {
      return NextResponse.json({ error: "an invalid" }, { status: 400 });
    }
    if (luna === null) {
      return NextResponse.json({ error: "luna invalidă" }, { status: 400 });
    }

    const snapshot = await buildGraficSnapshotFromDb(an, luna);
    const titlu = buildMonthTitle(an, luna);

    const sql = getDb();
    const inserted = await sql`
      INSERT INTO grafice_finale (an, luna, titlu, snapshot)
      VALUES (${an}, ${luna}, ${titlu}, ${JSON.stringify(snapshot)}::jsonb)
      RETURNING id, an, luna, titlu, created_at
    `;

    const row = inserted[0];
    if (!row) {
      return NextResponse.json({ error: "Salvare eșuată" }, { status: 500 });
    }

    await writeAudit({
      action: "grafic_save",
      resource: String(row.id),
      detail: { an, luna, rows: snapshot.rows.length },
      ip: clientKey(request),
    });

    return NextResponse.json(
      {
        item: {
          id: String(row.id),
          an: Number(row.an),
          luna: Number(row.luna),
          titlu: String(row.titlu),
          createdAt:
            row.created_at instanceof Date
              ? row.created_at.toISOString()
              : String(row.created_at),
        },
        snapshot,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("POST /api/grafice", error);
    const message =
      error instanceof Error && /grafice_finale/i.test(error.message)
        ? "Tabelul grafice_finale lipsește — rulează sql/grafice_finale.sql în Neon"
        : "Nu s-a putut salva graficul";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
