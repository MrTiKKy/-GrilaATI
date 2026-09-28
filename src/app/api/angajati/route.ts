import { NextResponse } from "next/server";
import { writeAudit } from "@/lib/audit";
import { guardWrite } from "@/lib/apiGuard";
import { getCategorie } from "@/lib/categorii";
import { getDb } from "@/lib/db";
import { clientKey } from "@/lib/rateLimit";
import { readJsonLimited } from "@/lib/readJsonLimited";
import { clampString } from "@/lib/validate";
import type { CreateAngajatBody, CreateAngajatResponse } from "@/lib/types";

export async function POST(request: Request) {
  const gated = await guardWrite(request);
  if (gated instanceof NextResponse) return gated;
  const { user, workspaceId } = gated;

  try {
    const parsed = await readJsonLimited<CreateAngajatBody>(request, 4_096);
    if (!parsed.ok) return parsed.response;

    const numeRaw = clampString(parsed.data.nume, 120);
    if (!numeRaw) {
      return NextResponse.json({ error: "Numele este obligatoriu" }, { status: 400 });
    }
    const numeNorm = numeRaw.toUpperCase();

    const zileCoAn =
      typeof parsed.data.zileCoAn === "number" &&
      Number.isFinite(parsed.data.zileCoAn) &&
      Number.isInteger(parsed.data.zileCoAn) &&
      parsed.data.zileCoAn >= 0 &&
      parsed.data.zileCoAn <= 366
        ? parsed.data.zileCoAn
        : 0;

    const categorieId =
      typeof parsed.data.categorieId === "string"
        ? parsed.data.categorieId.trim()
        : "";
    if (!categorieId) {
      return NextResponse.json(
        { error: "Categoria este obligatorie" },
        { status: 400 },
      );
    }
    const categorie = await getCategorie(workspaceId, categorieId);
    if (!categorie) {
      return NextResponse.json(
        { error: "Categorie invalidă" },
        { status: 400 },
      );
    }

    const sql = getDb();
    const maxRows = await sql`
      SELECT COALESCE(MAX(ordine), 0)::int AS max_ordine
      FROM angajati
      WHERE workspace_id = ${workspaceId}::uuid
        AND activ = true
        AND categorie_id = ${categorieId}::uuid
    `;
    const ordine = Number(maxRows[0]?.max_ordine ?? 0) + 1;

    const inserted = await sql`
      INSERT INTO angajati (workspace_id, nume, zile_co_an, ordine, activ, post, categorie_id)
      VALUES (
        ${workspaceId}::uuid,
        ${numeNorm},
        ${zileCoAn},
        ${ordine},
        true,
        ${categorie.postVechi},
        ${categorieId}::uuid
      )
      RETURNING id, nume, zile_co_an, ordine, categorie_id::text AS categorie_id
    `;

    const row = inserted[0];
    if (!row) {
      return NextResponse.json({ error: "Insert eșuat" }, { status: 500 });
    }

    await writeAudit({
      action: "angajat_create",
      resource: String(row.id),
      detail: {
        nume: String(row.nume),
        zileCoAn,
        categorieId,
      },
      ip: clientKey(request),
      userId: user.userId,
      workspaceId,
    });

    const response: CreateAngajatResponse = {
      angajat: {
        id: String(row.id),
        nume: String(row.nume),
        categorieId: String(row.categorie_id),
        zileCoAn: Number(row.zile_co_an),
        zileCoFolosite: 0,
        zileCoRamase: Number(row.zile_co_an),
        ordine: Number(row.ordine),
      },
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error("POST /api/angajati", error);
    return NextResponse.json(
      { error: "Nu s-a putut adăuga angajatul" },
      { status: 500 },
    );
  }
}
