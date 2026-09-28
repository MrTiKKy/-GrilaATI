import { NextResponse } from "next/server";
import { guardRead, isGuardError } from "@/lib/apiGuard";
import { getDb } from "@/lib/db";
import {
  buildComportamentMap,
  listCoduriForCategorie,
  toOption,
} from "@/lib/coduri";
import { parseUuid } from "@/lib/validate";

export async function GET(request: Request) {
  const gated = await guardRead(request);
  if (isGuardError(gated)) return gated;
  const { workspaceId } = gated;

  try {
    const { searchParams } = new URL(request.url);
    const categorieId = parseUuid(searchParams.get("categorie"));
    if (!categorieId) {
      return NextResponse.json(
        { error: "Parametru categorie invalid" },
        { status: 400 },
      );
    }

    const sql = getDb();

    const catRows = await sql`
      SELECT permite_text_liber
      FROM categorii
      WHERE workspace_id = ${workspaceId}::uuid
        AND id = ${categorieId}::uuid
      LIMIT 1
    `;
    if (!catRows[0]) {
      return NextResponse.json(
        { error: "Categorie negăsită" },
        { status: 404 },
      );
    }
    const permiteTextLiber = Boolean(catRows[0].permite_text_liber);

    // Toate (incl. inactive) pentru culori / ore pe celule vechi
    const all = await listCoduriForCategorie(workspaceId, categorieId, {
      onlyActive: false,
    });
    const active = all.filter((c) => c.activ);

    const culoareByCod: Record<string, string> = {};
    for (const c of all) {
      // Preferă specific pe categorie față de comun (ordine: specific vin după în listă?)
      // Specific are categorieId set — dacă există, îl preferăm.
      if (c.categorieId || culoareByCod[c.cod] === undefined) {
        culoareByCod[c.cod] = c.culoare;
      }
    }

    return NextResponse.json({
      items: active.map(toOption),
      permiteTextLiber,
      culoareByCod,
      comportamentMap: buildComportamentMap(all),
    });
  } catch (error) {
    console.error("GET /api/coduri", error);
    return NextResponse.json(
      { error: "Nu s-au putut încărca codurile" },
      { status: 500 },
    );
  }
}
