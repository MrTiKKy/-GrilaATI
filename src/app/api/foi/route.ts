import { NextResponse } from "next/server";
import { writeAudit } from "@/lib/audit";
import { guardWrite } from "@/lib/apiGuard";
import {
  countFoaieCells,
  createNextFoaie,
  deleteFoaie,
  parseFoaie,
} from "@/lib/foi";
import { isAngajatPost, postFromTabParam } from "@/lib/post";
import { clientKey } from "@/lib/rateLimit";
import { readJsonLimited } from "@/lib/readJsonLimited";
import { parseMonth, parseYear } from "@/lib/validate";

function resolvePost(data: {
  post?: unknown;
  tab?: unknown;
}) {
  if (isAngajatPost(data.post)) return data.post;
  return postFromTabParam(
    typeof data.tab === "string" ? data.tab : null,
  );
}

/** Creează Sheet N+1 (tabel gol) pentru luna/post. */
export async function POST(request: Request) {
  const denied = await guardWrite(request, { limit: 30 });
  if (denied) return denied;

  try {
    const parsed = await readJsonLimited<{
      an?: unknown;
      luna?: unknown;
      post?: unknown;
      tab?: unknown;
    }>(request, 2_048);
    if (!parsed.ok) return parsed.response;

    const an = parseYear(parsed.data.an);
    const luna = parseMonth(parsed.data.luna);
    if (an === null || luna === null) {
      return NextResponse.json({ error: "an/luna invalide" }, { status: 400 });
    }

    const post = resolvePost(parsed.data);
    const { foaie, foi } = await createNextFoaie(an, luna, post);

    await writeAudit({
      action: "foaie_create",
      detail: { an, luna, post, foaie },
      ip: clientKey(request),
    });

    return NextResponse.json({ foaie, foi });
  } catch (error) {
    console.error("POST /api/foi", error);
    const message =
      error instanceof Error && /Maxim 50/i.test(error.message)
        ? error.message
        : error instanceof Error && /luna_foi|foaie/i.test(error.message)
          ? "Tabelele pentru foi lipsesc — rulează sql/add_foi.sql în Neon"
          : "Nu s-a putut crea foaia";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * Șterge o foaie. Doar foaia cerută; dacă are casuțe, trebuie confirm=true.
 * Body: { an, luna, post?, foaie, confirm?: boolean }
 */
export async function DELETE(request: Request) {
  const denied = await guardWrite(request, { limit: 30 });
  if (denied) return denied;

  try {
    const parsed = await readJsonLimited<{
      an?: unknown;
      luna?: unknown;
      post?: unknown;
      tab?: unknown;
      foaie?: unknown;
      confirm?: unknown;
    }>(request, 2_048);
    if (!parsed.ok) return parsed.response;

    const an = parseYear(parsed.data.an);
    const luna = parseMonth(parsed.data.luna);
    const foaie = parseFoaie(parsed.data.foaie);
    if (an === null || luna === null || foaie === null) {
      return NextResponse.json(
        { error: "an/luna/foaie invalide" },
        { status: 400 },
      );
    }

    const post = resolvePost(parsed.data);
    const filled = await countFoaieCells(an, luna, post, foaie);
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

    const { foi, nextFoaie } = await deleteFoaie(an, luna, post, foaie);

    await writeAudit({
      action: "foaie_delete",
      detail: { an, luna, post, foaie, filled, confirmed },
      ip: clientKey(request),
    });

    return NextResponse.json({ ok: true, foi, nextFoaie, filled });
  } catch (error) {
    console.error("DELETE /api/foi", error);
    const message =
      error instanceof Error &&
      (/Nu poți șterge|nu există/i.test(error.message))
        ? error.message
        : error instanceof Error && /luna_foi|foaie/i.test(error.message)
          ? "Tabelele pentru foi lipsesc — rulează sql/add_foi.sql în Neon"
          : "Nu s-a putut șterge foaia";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
