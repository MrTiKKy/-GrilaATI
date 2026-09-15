import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import {
  isProgramareValoare,
  isSectieValoare,
  type UpsertProgramareBody,
} from "@/lib/types";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as UpsertProgramareBody;
    const { angajatId, data } = body;

    if (!angajatId || typeof angajatId !== "string") {
      return NextResponse.json({ error: "angajatId obligatoriu" }, { status: 400 });
    }
    if (!data || !DATE_RE.test(data)) {
      return NextResponse.json(
        { error: "data trebuie YYYY-MM-DD" },
        { status: 400 },
      );
    }

    const sql = getDb();

    const valoareRaw =
      body.valoare === null || body.valoare === undefined || body.valoare === ""
        ? null
        : String(body.valoare);

    if (valoareRaw !== null && !isProgramareValoare(valoareRaw)) {
      return NextResponse.json({ error: "valoare invalidă" }, { status: 400 });
    }

    let ciorna: string | null = null;
    if (body.ciorna === null || body.ciorna === "" || body.ciorna === undefined) {
      ciorna = null;
    } else if (isSectieValoare(body.ciorna)) {
      ciorna = body.ciorna;
    } else {
      return NextResponse.json(
        { error: "secție invalidă (doar A sau R)" },
        { status: 400 },
      );
    }

    if (valoareRaw === null && ciorna === null) {
      await sql`
        DELETE FROM programari
        WHERE angajat_id = ${angajatId}::uuid
          AND data = ${data}::date
      `;
      return NextResponse.json({ ok: true, deleted: true });
    }

    await sql`
      INSERT INTO programari (angajat_id, data, valoare, ciorna)
      VALUES (${angajatId}::uuid, ${data}::date, ${valoareRaw}, ${ciorna})
      ON CONFLICT (angajat_id, data)
      DO UPDATE SET
        valoare = EXCLUDED.valoare,
        ciorna = EXCLUDED.ciorna
    `;

    return NextResponse.json({
      ok: true,
      deleted: false,
      valoare: valoareRaw,
      ciorna,
    });
  } catch (error) {
    console.error("PUT /api/programari", error);
    const message =
      error instanceof Error && /ciorna/i.test(error.message)
        ? "Coloana ciorna lipsește — rulează sql/add_ciorna.sql în Neon"
        : "Nu s-a putut salva programarea";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
