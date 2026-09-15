import { NextResponse } from "next/server";
import { writeAudit } from "@/lib/audit";
import { guardWrite } from "@/lib/apiGuard";
import { getDb } from "@/lib/db";
import { clientKey } from "@/lib/rateLimit";
import { readJsonLimited } from "@/lib/readJsonLimited";
import { parseUuidList } from "@/lib/validate";
import type { OrdineBody } from "@/lib/types";

export async function PUT(request: Request) {
  const denied = await guardWrite(request);
  if (denied) return denied;

  try {
    const parsed = await readJsonLimited<OrdineBody>(request, 32_768);
    if (!parsed.ok) return parsed.response;

    const ids = parseUuidList(parsed.data.ids, { max: 200 });
    if (!ids) {
      return NextResponse.json(
        { error: "ids trebuie să fie un array de UUID-uri (1–200)" },
        { status: 400 },
      );
    }

    const sql = getDb();

    for (let i = 0; i < ids.length; i++) {
      await sql`
        UPDATE angajati
        SET ordine = ${i + 1}
        WHERE id = ${ids[i]}::uuid AND activ = true
      `;
    }

    await writeAudit({
      action: "angajat_ordine",
      detail: { count: ids.length },
      ip: clientKey(request),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("PUT /api/angajati/ordine", error);
    return NextResponse.json(
      { error: "Nu s-a putut salva ordinea" },
      { status: 500 },
    );
  }
}
