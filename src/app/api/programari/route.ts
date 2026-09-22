import { NextResponse } from "next/server";
import { writeAudit } from "@/lib/audit";
import { guardWrite } from "@/lib/apiGuard";
import {
  culoareFromDb,
  culoareToDb,
  isProgramareCuloare,
} from "@/lib/culoare";
import { getDb } from "@/lib/db";
import { clientKey } from "@/lib/rateLimit";
import { readJsonLimited } from "@/lib/readJsonLimited";
import { parseUuid } from "@/lib/validate";
import {
  isProgramareValoare,
  isSectieValoare,
  type UpsertProgramareBody,
} from "@/lib/types";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function PUT(request: Request) {
  const denied = await guardWrite(request, { limit: 180 });
  if (denied) return denied;

  try {
    const parsed = await readJsonLimited<UpsertProgramareBody>(request, 4_096);
    if (!parsed.ok) return parsed.response;
    const body = parsed.data;

    const angajatId = parseUuid(body.angajatId);
    if (!angajatId) {
      return NextResponse.json({ error: "angajatId invalid" }, { status: 400 });
    }
    if (!body.data || !DATE_RE.test(body.data)) {
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

    let culoare: string | null = null;
    if (
      body.culoare === null ||
      body.culoare === undefined ||
      body.culoare === "" ||
      body.culoare === "black"
    ) {
      culoare = null;
    } else if (isProgramareCuloare(body.culoare)) {
      culoare = culoareToDb(body.culoare);
    } else {
      return NextResponse.json({ error: "culoare invalidă" }, { status: 400 });
    }

    if (valoareRaw === null && ciorna === null) {
      await sql`
        DELETE FROM programari
        WHERE angajat_id = ${angajatId}::uuid
          AND data = ${body.data}::date
      `;
      await writeAudit({
        action: "programare_delete",
        resource: angajatId,
        detail: { data: body.data },
        ip: clientKey(request),
      });
      return NextResponse.json({ ok: true, deleted: true });
    }

    await sql`
      INSERT INTO programari (angajat_id, data, valoare, ciorna, culoare)
      VALUES (${angajatId}::uuid, ${body.data}::date, ${valoareRaw}, ${ciorna}, ${culoare})
      ON CONFLICT (angajat_id, data)
      DO UPDATE SET
        valoare = EXCLUDED.valoare,
        ciorna = EXCLUDED.ciorna,
        culoare = EXCLUDED.culoare
    `;

    await writeAudit({
      action: "programare_upsert",
      resource: angajatId,
      detail: { data: body.data, valoare: valoareRaw, ciorna, culoare },
      ip: clientKey(request),
    });

    return NextResponse.json({
      ok: true,
      deleted: false,
      valoare: valoareRaw,
      ciorna,
      culoare: culoareFromDb(culoare),
    });
  } catch (error) {
    console.error("PUT /api/programari", error);
    const message =
      error instanceof Error && /culoare/i.test(error.message)
        ? "Coloana culoare lipsește — rulează sql/add_culoare.sql în Neon"
        : error instanceof Error && /ciorna/i.test(error.message)
          ? "Coloana ciorna lipsește — rulează sql/add_ciorna.sql în Neon"
          : "Nu s-a putut salva programarea";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
