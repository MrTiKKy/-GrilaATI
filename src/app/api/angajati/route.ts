import { NextResponse } from "next/server";
import { writeAudit } from "@/lib/audit";
import { guardWrite } from "@/lib/apiGuard";
import { getDb } from "@/lib/db";
import { isAngajatPost } from "@/lib/post";
import { clientKey } from "@/lib/rateLimit";
import { readJsonLimited } from "@/lib/readJsonLimited";
import { clampString } from "@/lib/validate";
import type { CreateAngajatBody, CreateAngajatResponse } from "@/lib/types";

export async function POST(request: Request) {
  const denied = await guardWrite(request);
  if (denied) return denied;

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

    const post = isAngajatPost(parsed.data.post)
      ? parsed.data.post
      : "asistent";

    const sql = getDb();

    const maxRows = await sql`
      SELECT COALESCE(MAX(ordine), 0)::int AS max_ordine
      FROM angajati
      WHERE activ = true
    `;
    const ordine = Number(maxRows[0]?.max_ordine ?? 0) + 1;

    const inserted = await sql`
      INSERT INTO angajati (nume, zile_co_an, ordine, activ, post)
      VALUES (${numeNorm}, ${zileCoAn}, ${ordine}, true, ${post})
      RETURNING id, nume, zile_co_an, ordine, post
    `;

    const row = inserted[0];
    if (!row) {
      return NextResponse.json({ error: "Insert eșuat" }, { status: 500 });
    }

    await writeAudit({
      action: "angajat_create",
      resource: String(row.id),
      detail: { nume: String(row.nume), zileCoAn, post },
      ip: clientKey(request),
    });

    const postRaw = String(row.post ?? post);
    const response: CreateAngajatResponse = {
      angajat: {
        id: String(row.id),
        nume: String(row.nume),
        post: isAngajatPost(postRaw) ? postRaw : post,
        zileCoAn: Number(row.zile_co_an),
        zileCoFolosite: 0,
        zileCoRamase: Number(row.zile_co_an),
        ordine: Number(row.ordine),
      },
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error("POST /api/angajati", error);
    const message =
      error instanceof Error && /column .*post/i.test(error.message)
        ? "Coloana post lipsește — rulează sql/add_post.sql în Neon"
        : "Nu s-a putut adăuga angajatul";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
