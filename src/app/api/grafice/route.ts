import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import type {
  CreateGraficBody,
  GraficFinalMeta,
  GraficSnapshot,
  GraficeListResponse,
} from "@/lib/types";

function isSnapshot(value: unknown): value is GraficSnapshot {
  if (!value || typeof value !== "object") return false;
  const s = value as GraficSnapshot;
  return (
    typeof s.title === "string" &&
    Array.isArray(s.days) &&
    Array.isArray(s.rows)
  );
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const anParam = searchParams.get("an");
    const lunaParam = searchParams.get("luna");

    const sql = getDb();

    let rows;
    if (anParam && lunaParam) {
      const an = Number(anParam);
      const luna = Number(lunaParam);
      if (!Number.isInteger(an) || !Number.isInteger(luna) || luna < 1 || luna > 12) {
        return NextResponse.json({ error: "an/luna invalide" }, { status: 400 });
      }
      rows = await sql`
        SELECT id, an, luna, titlu, created_at
        FROM grafice_finale
        WHERE an = ${an} AND luna = ${luna}
        ORDER BY created_at DESC
      `;
    } else if (anParam) {
      const an = Number(anParam);
      if (!Number.isInteger(an)) {
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

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CreateGraficBody;
    const { an, luna, titlu, snapshot } = body;

    if (!Number.isInteger(an) || an < 2000 || an > 2100) {
      return NextResponse.json({ error: "an invalid" }, { status: 400 });
    }
    if (!Number.isInteger(luna) || luna < 1 || luna > 12) {
      return NextResponse.json({ error: "luna invalidă" }, { status: 400 });
    }
    if (!titlu?.trim()) {
      return NextResponse.json({ error: "titlu obligatoriu" }, { status: 400 });
    }
    if (!isSnapshot(snapshot)) {
      return NextResponse.json({ error: "snapshot invalid" }, { status: 400 });
    }

    const sql = getDb();
    const inserted = await sql`
      INSERT INTO grafice_finale (an, luna, titlu, snapshot)
      VALUES (${an}, ${luna}, ${titlu.trim()}, ${JSON.stringify(snapshot)}::jsonb)
      RETURNING id, an, luna, titlu, created_at
    `;

    const row = inserted[0];
    if (!row) {
      return NextResponse.json({ error: "Salvare eșuată" }, { status: 500 });
    }

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
