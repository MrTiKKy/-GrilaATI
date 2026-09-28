import { NextResponse } from "next/server";
import { guardRead } from "@/lib/apiGuard";
import { getCategorie } from "@/lib/categorii";
import { loadOreOsdCellsForCategorie } from "@/lib/loadOreOsd";

/** Legacy read-only. Scrie orele în /api/setari/ore (ore_coduri). */
export async function GET(request: Request) {
  const gated = await guardRead(request);
  if (gated instanceof NextResponse) return gated;
  const { workspaceId } = gated;

  try {
    const { searchParams } = new URL(request.url);
    const categorieId = searchParams.get("categorie");
    if (!categorieId) {
      return NextResponse.json(
        { error: "Parametru categorie obligatoriu" },
        { status: 400 },
      );
    }
    if (!(await getCategorie(workspaceId, categorieId))) {
      return NextResponse.json(
        { error: "Categorie invalidă" },
        { status: 400 },
      );
    }
    const items = await loadOreOsdCellsForCategorie(workspaceId, categorieId);
    return NextResponse.json({ items });
  } catch (error) {
    console.error("GET /api/ore-osd", error);
    const message =
      error instanceof Error && /ore_osd|categorie/i.test(error.message)
        ? "Tabelul ore_osd / categorii lipsește"
        : "Nu s-au putut încărca orele O.SD";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Scrierea pe ore_osd e dezactivată — folosește /api/setari/ore. */
export async function PUT() {
  return NextResponse.json(
    {
      error:
        "Scrierea pe /api/ore-osd e dezactivată. Folosește /api/setari/ore (ore_coduri).",
    },
    { status: 410 },
  );
}
