import { NextResponse } from "next/server";
import { guardRead, isGuardError } from "@/lib/apiGuard";
import {
  listOreCoduriForCategorie,
  rowsToByCod,
} from "@/lib/oreCoduri";
import { parseUuid } from "@/lib/validate";

/** Ore O.SD pe cod pentru categoria curentă (citire grilă). */
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

    const rows = await listOreCoduriForCategorie(workspaceId, categorieId, {
      onlyActive: false,
    });

    return NextResponse.json({
      items: rows.map((r) => ({
        codId: r.codId,
        cod: r.cod,
        eticheta: r.eticheta,
        activ: r.activ,
        oreVineri: r.oreVineri,
        oreSambata: r.oreSambata,
        oreDuminica: r.oreDuminica,
      })),
      byCod: rowsToByCod(rows),
    });
  } catch (error) {
    console.error("GET /api/ore-coduri", error);
    return NextResponse.json(
      { error: "Nu s-au putut încărca orele pe cod" },
      { status: 500 },
    );
  }
}
