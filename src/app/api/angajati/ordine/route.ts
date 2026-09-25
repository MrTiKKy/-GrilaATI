import { NextResponse } from "next/server";
import { writeAudit } from "@/lib/audit";
import { guardWrite } from "@/lib/apiGuard";
import { getDb } from "@/lib/db";
import { clientKey } from "@/lib/rateLimit";
import { readJsonLimited } from "@/lib/readJsonLimited";
import { parseUuidList } from "@/lib/validate";
import type { OrdineBody } from "@/lib/types";

export async function PUT(request: Request) {
  const gated = await guardWrite(request);
  if (gated instanceof NextResponse) return gated;
  const { user, workspaceId } = gated;

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

    const owned = await sql`
      SELECT id::text FROM angajati
      WHERE workspace_id = ${workspaceId}::uuid
        AND activ = true
        AND id = ANY(${ids}::uuid[])
    `;
    const ownedSet = new Set(owned.map((r) => String(r.id)));
    for (const id of ids) {
      if (!ownedSet.has(id)) {
        return NextResponse.json(
          { error: "Unul sau mai mulți angajați nu aparțin workspace-ului" },
          { status: 400 },
        );
      }
    }

    for (let i = 0; i < ids.length; i++) {
      await sql`
        UPDATE angajati
        SET ordine = ${i + 1}
        WHERE id = ${ids[i]}::uuid
          AND workspace_id = ${workspaceId}::uuid
          AND activ = true
      `;
    }

    await writeAudit({
      action: "angajat_ordine",
      detail: { count: ids.length },
      ip: clientKey(request),
      userId: user.userId,
      workspaceId,
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
