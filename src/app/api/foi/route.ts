import { NextResponse } from "next/server";
import { writeAudit } from "@/lib/audit";
import { guardWrite } from "@/lib/apiGuard";
import { getCategorie } from "@/lib/categorii";
import {
  countFoaieCells,
  createNextFoaie,
  deleteFoaie,
  parseFoaie,
} from "@/lib/foi";
import { clientKey } from "@/lib/rateLimit";
import { readJsonLimited } from "@/lib/readJsonLimited";
import { parseMonth, parseYear } from "@/lib/validate";

function resolveCategorieId(data: { categorieId?: unknown }): string | null {
  return typeof data.categorieId === "string" && data.categorieId.trim()
    ? data.categorieId.trim()
    : null;
}

/** Creează Sheet N+1 (tabel gol) pentru luna/categorie. */
export async function POST(request: Request) {
  const gated = await guardWrite(request, { limit: 30 });
  if (gated instanceof NextResponse) return gated;
  const { user, workspaceId } = gated;

  try {
    const parsed = await readJsonLimited<{
      an?: unknown;
      luna?: unknown;
      categorieId?: unknown;
    }>(request, 2_048);
    if (!parsed.ok) return parsed.response;

    const an = parseYear(parsed.data.an);
    const luna = parseMonth(parsed.data.luna);
    const categorieId = resolveCategorieId(parsed.data);
    if (an === null || luna === null || !categorieId) {
      return NextResponse.json(
        { error: "an/luna/categorieId invalide" },
        { status: 400 },
      );
    }
    if (!(await getCategorie(workspaceId, categorieId))) {
      return NextResponse.json(
        { error: "Categorie invalidă" },
        { status: 400 },
      );
    }

    const { foaie, foi } = await createNextFoaie(
      workspaceId,
      an,
      luna,
      categorieId,
    );

    await writeAudit({
      action: "foaie_create",
      detail: { an, luna, categorieId, foaie },
      ip: clientKey(request),
      userId: user.userId,
      workspaceId,
    });

    return NextResponse.json({ foaie, foi });
  } catch (error) {
    console.error("POST /api/foi", error);
    const message =
      error instanceof Error && /Maxim 50/i.test(error.message)
        ? error.message
        : error instanceof Error && /luna_foi|foaie|categorie/i.test(error.message)
          ? "Tabelele pentru foi/categorii lipsesc"
          : "Nu s-a putut crea foaia";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * Șterge o foaie. Doar foaia cerută; dacă are casuțe, trebuie confirm=true.
 * Body: { an, luna, categorieId, foaie, confirm?: boolean }
 */
export async function DELETE(request: Request) {
  const gated = await guardWrite(request, { limit: 30 });
  if (gated instanceof NextResponse) return gated;
  const { user, workspaceId } = gated;

  try {
    const parsed = await readJsonLimited<{
      an?: unknown;
      luna?: unknown;
      categorieId?: unknown;
      foaie?: unknown;
      confirm?: unknown;
    }>(request, 2_048);
    if (!parsed.ok) return parsed.response;

    const an = parseYear(parsed.data.an);
    const luna = parseMonth(parsed.data.luna);
    const foaie = parseFoaie(parsed.data.foaie);
    const categorieId = resolveCategorieId(parsed.data);
    if (an === null || luna === null || foaie === null || !categorieId) {
      return NextResponse.json(
        { error: "an/luna/foaie/categorieId invalide" },
        { status: 400 },
      );
    }

    const filled = await countFoaieCells(
      workspaceId,
      an,
      luna,
      categorieId,
      foaie,
    );
    const confirmed = parsed.data.confirm === true;

    if (filled > 0 && !confirmed) {
      return NextResponse.json(
        {
          error: "Foaia are programări — confirmă ștergerea",
          needsConfirm: true,
          filled,
        },
        { status: 409 },
      );
    }

    const { foi, nextFoaie } = await deleteFoaie(
      workspaceId,
      an,
      luna,
      categorieId,
      foaie,
    );

    await writeAudit({
      action: "foaie_delete",
      detail: { an, luna, categorieId, foaie, filled, confirmed },
      ip: clientKey(request),
      userId: user.userId,
      workspaceId,
    });

    return NextResponse.json({ ok: true, foi, nextFoaie, filled });
  } catch (error) {
    console.error("DELETE /api/foi", error);
    const message =
      error instanceof Error &&
      /Nu poți șterge|nu există/i.test(error.message)
        ? error.message
        : error instanceof Error && /luna_foi|foaie|categorie/i.test(error.message)
          ? "Tabelele pentru foi/categorii lipsesc"
          : "Nu s-a putut șterge foaia";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
