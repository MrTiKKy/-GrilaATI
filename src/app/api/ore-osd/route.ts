import { NextResponse } from "next/server";
import { writeAudit } from "@/lib/audit";
import { guardRead, guardWrite } from "@/lib/apiGuard";
import { getDb } from "@/lib/db";
import { loadOreOsdCells } from "@/lib/loadOreOsd";
import { isAngajatPost } from "@/lib/post";
import {
  isOreOsdSchimb,
  isOreOsdZi,
  type OreOsdCell,
} from "@/lib/oreOsd";
import { clientKey } from "@/lib/rateLimit";
import { readJsonLimited } from "@/lib/readJsonLimited";

export async function GET(request: Request) {
  const denied = await guardRead(request);
  if (denied) return denied;

  try {
    const items = await loadOreOsdCells();
    return NextResponse.json({ items });
  } catch (error) {
    console.error("GET /api/ore-osd", error);
    const message =
      error instanceof Error && /ore_osd/i.test(error.message)
        ? "Tabelul ore_osd lipsește — rulează sql/ore_osd.sql în Neon"
        : "Nu s-au putut încărca orele O.SD";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const denied = await guardWrite(request);
  if (denied) return denied;

  try {
    const parsed = await readJsonLimited<{
      post?: unknown;
      zi?: unknown;
      schimb?: unknown;
      ore?: unknown;
    }>(request, 4_096);
    if (!parsed.ok) return parsed.response;

    const post = parsed.data.post;
    const zi = parsed.data.zi;
    const schimb = parsed.data.schimb;
    if (!isAngajatPost(post) || !isOreOsdZi(zi) || !isOreOsdSchimb(schimb)) {
      return NextResponse.json(
        { error: "post / zi / schimb invalide" },
        { status: 400 },
      );
    }

    // Vineri: doar 1/3 e editabil
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
    // Păstrăm maxim o zecimală
    const ore = Math.round(oreRaw * 10) / 10;

    const sql = getDb();
    await sql`
      INSERT INTO ore_osd (post, zi, schimb, ore, updated_at)
      VALUES (${post}, ${zi}, ${schimb}, ${ore}, now())
      ON CONFLICT (post, zi, schimb)
      DO UPDATE SET ore = EXCLUDED.ore, updated_at = now()
    `;

    await writeAudit({
      action: "ore_osd_update",
      detail: { post, zi, schimb, ore },
      ip: clientKey(request),
    });

    const item: OreOsdCell = { post, zi, schimb, ore };
    return NextResponse.json({ item });
  } catch (error) {
    console.error("PUT /api/ore-osd", error);
    const message =
      error instanceof Error && /ore_osd/i.test(error.message)
        ? "Tabelul ore_osd lipsește — rulează sql/ore_osd.sql în Neon"
        : "Nu s-a putut salva";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
