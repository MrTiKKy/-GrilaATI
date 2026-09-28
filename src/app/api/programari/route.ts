import { NextResponse } from "next/server";
import { writeAudit } from "@/lib/audit";
import { guardWrite } from "@/lib/apiGuard";
import { validateProgramareValoare } from "@/lib/coduri";
import {
  culoareFromDb,
  culoareToDb,
  isProgramareCuloare,
} from "@/lib/culoare";
import { getDb } from "@/lib/db";
import { parseFoaie } from "@/lib/foi";
import { clientKey } from "@/lib/rateLimit";
import { readJsonLimited } from "@/lib/readJsonLimited";
import { parseUuid } from "@/lib/validate";
import {
  isSectieValoare,
  type UpsertProgramareBody,
} from "@/lib/types";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function PUT(request: Request) {
  const gated = await guardWrite(request, { limit: 180 });
  if (gated instanceof NextResponse) return gated;
  const { user, workspaceId } = gated;

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

    const foaie = parseFoaie(body.foaie ?? 1) ?? 1;
    const sql = getDb();

    const angajatCheck = await sql`
      SELECT id, categorie_id::text AS categorie_id
      FROM angajati
      WHERE id = ${angajatId}::uuid
        AND workspace_id = ${workspaceId}::uuid
        AND activ = true
      LIMIT 1
    `;
    if (!angajatCheck[0]) {
      return NextResponse.json({ error: "Angajat negăsit" }, { status: 404 });
    }
    const categorieId = String(angajatCheck[0].categorie_id);

    const valoareRaw =
      body.valoare === null || body.valoare === undefined || body.valoare === ""
        ? null
        : String(body.valoare);

    if (valoareRaw !== null) {
      const err = await validateProgramareValoare(
        workspaceId,
        categorieId,
        valoareRaw,
      );
      if (err) {
        return NextResponse.json({ error: err }, { status: 400 });
      }
    }

    let ciorna: string | null = null;
    if (
      body.ciorna === null ||
      body.ciorna === "" ||
      body.ciorna === undefined
    ) {
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
          AND workspace_id = ${workspaceId}::uuid
          AND data = ${body.data}::date
          AND foaie = ${foaie}
      `;
      await writeAudit({
        action: "programare_delete",
        resource: angajatId,
        detail: { data: body.data, foaie },
        ip: clientKey(request),
        userId: user.userId,
        workspaceId,
      });
      return NextResponse.json({ ok: true, deleted: true });
    }

    await sql`
      INSERT INTO programari (workspace_id, angajat_id, data, valoare, ciorna, culoare, foaie)
      VALUES (
        ${workspaceId}::uuid,
        ${angajatId}::uuid,
        ${body.data}::date,
        ${valoareRaw},
        ${ciorna},
        ${culoare},
        ${foaie}
      )
      ON CONFLICT (angajat_id, data, foaie)
      DO UPDATE SET
        valoare = EXCLUDED.valoare,
        ciorna = EXCLUDED.ciorna,
        culoare = EXCLUDED.culoare
    `;

    await writeAudit({
      action: "programare_upsert",
      resource: angajatId,
      detail: { data: body.data, valoare: valoareRaw, ciorna, culoare, foaie },
      ip: clientKey(request),
      userId: user.userId,
      workspaceId,
    });

    return NextResponse.json({
      ok: true,
      deleted: false,
      valoare: valoareRaw,
      ciorna,
      culoare: culoareFromDb(culoare),
      foaie,
    });
  } catch (error) {
    console.error("PUT /api/programari", error);
    return NextResponse.json(
      { error: "Nu s-a putut salva programarea" },
      { status: 500 },
    );
  }
}
