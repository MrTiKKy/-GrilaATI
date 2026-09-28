import { NextResponse } from "next/server";
import { writeAudit } from "@/lib/audit";
import { guardSettings, isGuardError } from "@/lib/apiGuard";
import { listCategorii } from "@/lib/categorii";
import { getDb } from "@/lib/db";
import {
  listOreCoduriForCategorie,
  parseOreInput,
} from "@/lib/oreCoduri";
import { clientKey } from "@/lib/rateLimit";
import { readJsonLimited } from "@/lib/readJsonLimited";
import { parseUuid } from "@/lib/validate";

export async function GET(request: Request) {
  const gated = await guardSettings(request);
  if (isGuardError(gated)) return gated;
  const { workspaceId } = gated;

  try {
    const { searchParams } = new URL(request.url);
    const categorieId = parseUuid(searchParams.get("categorie"));
    const categorii = await listCategorii(workspaceId);

    if (!categorieId) {
      return NextResponse.json({
        categorii: categorii.map((c) => ({ id: c.id, nume: c.nume })),
        items: [],
      });
    }

    const cat = categorii.find((c) => c.id === categorieId);
    if (!cat) {
      return NextResponse.json({ error: "Categorie negăsită" }, { status: 404 });
    }

    const rows = await listOreCoduriForCategorie(workspaceId, categorieId, {
      onlyActive: true,
    });

    return NextResponse.json({
      categorii: categorii.map((c) => ({ id: c.id, nume: c.nume })),
      categorieId,
      items: rows.map((r) => ({
        codId: r.codId,
        cod: r.cod,
        eticheta: r.eticheta,
        oreVineri: r.oreVineri,
        oreSambata: r.oreSambata,
        oreDuminica: r.oreDuminica,
      })),
    });
  } catch (error) {
    console.error("GET /api/setari/ore", error);
    return NextResponse.json(
      { error: "Nu s-au putut încărca orele" },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  const gated = await guardSettings(request);
  if (isGuardError(gated)) return gated;
  const { user, workspaceId } = gated;

  try {
    const parsed = await readJsonLimited<{
      categorieId?: unknown;
      items?: unknown;
    }>(request, 64_000);
    if (!parsed.ok) return parsed.response;

    const categorieId = parseUuid(parsed.data.categorieId);
    if (!categorieId) {
      return NextResponse.json(
        { error: "categorieId obligatoriu" },
        { status: 400 },
      );
    }

    if (!Array.isArray(parsed.data.items)) {
      return NextResponse.json(
        { error: "items obligatoriu (listă)" },
        { status: 400 },
      );
    }

    const sql = getDb();
    const catCheck = await sql`
      SELECT id FROM categorii
      WHERE workspace_id = ${workspaceId}::uuid AND id = ${categorieId}::uuid
      LIMIT 1
    `;
    if (!catCheck[0]) {
      return NextResponse.json({ error: "Categorie negăsită" }, { status: 404 });
    }

    const changes: Array<{
      codId: string;
      cod: string;
      before: { v: number; s: number; d: number };
      after: { v: number; s: number; d: number };
    }> = [];

    for (const raw of parsed.data.items) {
      if (!raw || typeof raw !== "object") {
        return NextResponse.json({ error: "item invalid" }, { status: 400 });
      }
      const item = raw as Record<string, unknown>;
      const codId = parseUuid(item.codId);
      if (!codId) {
        return NextResponse.json({ error: "codId invalid" }, { status: 400 });
      }

      const oreVineri = parseOreInput(item.oreVineri);
      const oreSambata = parseOreInput(item.oreSambata);
      const oreDuminica = parseOreInput(item.oreDuminica);
      if (oreVineri === null || oreSambata === null || oreDuminica === null) {
        return NextResponse.json(
          { error: "Ore invalide (0–24, numeric)" },
          { status: 400 },
        );
      }

      const before = await sql`
        SELECT
          c.cod,
          oc.ore_vineri::float8 AS v,
          oc.ore_sambata::float8 AS s,
          oc.ore_duminica::float8 AS d
        FROM ore_coduri oc
        JOIN coduri c ON c.id = oc.cod_id
        WHERE oc.workspace_id = ${workspaceId}::uuid
          AND oc.categorie_id = ${categorieId}::uuid
          AND oc.cod_id = ${codId}::uuid
        LIMIT 1
      `;
      if (!before[0]) {
        return NextResponse.json(
          { error: `Rând ore lipsă pentru cod ${codId}` },
          { status: 404 },
        );
      }

      const bv = Number(before[0].v) || 0;
      const bs = Number(before[0].s) || 0;
      const bd = Number(before[0].d) || 0;
      if (bv === oreVineri && bs === oreSambata && bd === oreDuminica) {
        continue;
      }

      await sql`
        UPDATE ore_coduri
        SET ore_vineri = ${oreVineri},
            ore_sambata = ${oreSambata},
            ore_duminica = ${oreDuminica},
            updated_at = now()
        WHERE workspace_id = ${workspaceId}::uuid
          AND categorie_id = ${categorieId}::uuid
          AND cod_id = ${codId}::uuid
      `;

      changes.push({
        codId,
        cod: String(before[0].cod),
        before: { v: bv, s: bs, d: bd },
        after: { v: oreVineri, s: oreSambata, d: oreDuminica },
      });
    }

    if (changes.length) {
      await writeAudit({
        action: "ore_coduri_update",
        resource: categorieId,
        detail: { categorieId, changes },
        ip: clientKey(request),
        userId: user.userId,
        workspaceId,
      });
    }

    const rows = await listOreCoduriForCategorie(workspaceId, categorieId, {
      onlyActive: true,
    });
    return NextResponse.json({
      ok: true,
      items: rows.map((r) => ({
        codId: r.codId,
        cod: r.cod,
        eticheta: r.eticheta,
        oreVineri: r.oreVineri,
        oreSambata: r.oreSambata,
        oreDuminica: r.oreDuminica,
      })),
    });
  } catch (error) {
    console.error("PUT /api/setari/ore", error);
    return NextResponse.json(
      { error: "Nu s-au putut salva orele" },
      { status: 500 },
    );
  }
}
