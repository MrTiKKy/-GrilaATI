import { NextResponse } from "next/server";
import { writeAudit } from "@/lib/audit";
import { guardWrite } from "@/lib/apiGuard";
import { getDb } from "@/lib/db";
import { clientKey } from "@/lib/rateLimit";
import { readJsonLimited } from "@/lib/readJsonLimited";
import { parseUuid } from "@/lib/validate";
import type { UpdateConcediuBody } from "@/lib/types";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Ctx) {
  const denied = await guardWrite(request);
  if (denied) return denied;

  try {
    const { id: rawId } = await context.params;
    const id = parseUuid(rawId);
    if (!id) {
      return NextResponse.json({ error: "id invalid" }, { status: 400 });
    }

    const parsed = await readJsonLimited<UpdateConcediuBody>(request, 4_096);
    if (!parsed.ok) return parsed.response;
    const body = parsed.data;

    let zileCoAn = 0;
    if (body.zileCoAn !== null && body.zileCoAn !== undefined) {
      if (
        typeof body.zileCoAn !== "number" ||
        !Number.isFinite(body.zileCoAn) ||
        !Number.isInteger(body.zileCoAn) ||
        body.zileCoAn < 0 ||
        body.zileCoAn > 366
      ) {
        return NextResponse.json(
          { error: "zileCoAn trebuie să fie întreg 0–366 sau null" },
          { status: 400 },
        );
      }
      zileCoAn = body.zileCoAn;
    }

    const sql = getDb();
    const updated = await sql`
      UPDATE angajati
      SET zile_co_an = ${zileCoAn}
      WHERE id = ${id}::uuid AND activ = true
      RETURNING id, nume, zile_co_an
    `;

    if (!updated[0]) {
      return NextResponse.json({ error: "Angajat negăsit" }, { status: 404 });
    }

    await writeAudit({
      action: "concediu_update",
      resource: id,
      detail: { zileCoAn },
      ip: clientKey(request),
    });

    return NextResponse.json({
      angajat: {
        id: String(updated[0].id),
        nume: String(updated[0].nume),
        zileCoAn: Number(updated[0].zile_co_an),
      },
    });
  } catch (error) {
    console.error("PATCH /api/angajati/[id]/concediu", error);
    return NextResponse.json(
      { error: "Nu s-a putut actualiza concediul" },
      { status: 500 },
    );
  }
}
