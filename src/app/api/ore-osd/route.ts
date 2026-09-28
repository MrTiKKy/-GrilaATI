import { NextResponse } from "next/server";
import { writeAudit } from "@/lib/audit";
import { guardRead, guardWrite } from "@/lib/apiGuard";
import { getCategorie } from "@/lib/categorii";
import { getDb } from "@/lib/db";
import { loadOreOsdCellsForCategorie } from "@/lib/loadOreOsd";
import {
  isOreOsdSchimb,
  isOreOsdZi,
  type OreOsdCell,
} from "@/lib/oreOsd";
import { clientKey } from "@/lib/rateLimit";
import { readJsonLimited } from "@/lib/readJsonLimited";

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

export async function PUT(request: Request) {
  const gated = await guardWrite(request);
  if (gated instanceof NextResponse) return gated;
  const { user, workspaceId } = gated;

  try {
    const parsed = await readJsonLimited<{
      categorieId?: unknown;
      zi?: unknown;
      schimb?: unknown;
      ore?: unknown;
    }>(request, 4_096);
    if (!parsed.ok) return parsed.response;

    const categorieId =
      typeof parsed.data.categorieId === "string"
        ? parsed.data.categorieId.trim()
        : "";
    const zi = parsed.data.zi;
    const schimb = parsed.data.schimb;
    if (
      !categorieId ||
      !isOreOsdZi(zi) ||
      !isOreOsdSchimb(schimb)
    ) {
      return NextResponse.json(
        { error: "categorieId / zi / schimb invalide" },
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

    if (zi === "V" && schimb !== "1/3") {
      return NextResponse.json(
        { error: "Pe vineri doar schimbul 1/3 are ore" },
        { status: 400 },
      );
    }

    const oreRaw = Number(parsed.data.ore);
    if (!Number.isFinite(oreRaw) || oreRaw < 0 || oreRaw > 48) {
      return NextResponse.json(
        { error: "ore trebuie să fie între 0 și 48" },
        { status: 400 },
      );
    }
    const ore = Math.round(oreRaw * 10) / 10;

    const sql = getDb();
    await sql`
      INSERT INTO ore_osd (workspace_id, categorie_id, post, zi, schimb, ore, updated_at)
      VALUES (
        ${workspaceId}::uuid,
        ${categorieId}::uuid,
        ${categorie.postVechi},
        ${zi},
        ${schimb},
        ${ore},
        now()
      )
      ON CONFLICT (workspace_id, categorie_id, zi, schimb)
      DO UPDATE SET ore = EXCLUDED.ore, updated_at = now()
    `;

    await writeAudit({
      action: "ore_osd_update",
      detail: { categorieId, zi, schimb, ore },
      ip: clientKey(request),
      userId: user.userId,
      workspaceId,
    });

    const item: OreOsdCell = { categorieId, zi, schimb, ore };
    return NextResponse.json({ item });
  } catch (error) {
    console.error("PUT /api/ore-osd", error);
    const message =
      error instanceof Error && /ore_osd|categorie/i.test(error.message)
        ? "Tabelul ore_osd / categorii lipsește"
        : "Nu s-a putut salva";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
