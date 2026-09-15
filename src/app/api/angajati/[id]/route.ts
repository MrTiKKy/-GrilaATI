import { NextResponse } from "next/server";
import { writeAudit } from "@/lib/audit";
import { guardWrite } from "@/lib/apiGuard";
import { getDb } from "@/lib/db";
import { clientKey } from "@/lib/rateLimit";
import { readJsonLimited } from "@/lib/readJsonLimited";
import { clampString, parseUuid } from "@/lib/validate";
import type { UpdateAngajatBody } from "@/lib/types";

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

    const parsed = await readJsonLimited<UpdateAngajatBody>(request, 4_096);
    if (!parsed.ok) return parsed.response;

    const numeRaw = clampString(parsed.data.nume, 120);
    if (!numeRaw) {
      return NextResponse.json(
        { error: "Nimic de actualizat (nume)" },
        { status: 400 },
      );
    }
    const nume = numeRaw.toUpperCase();

    const sql = getDb();
    const updated = await sql`
      UPDATE angajati
      SET nume = ${nume}
      WHERE id = ${id}::uuid AND activ = true
      RETURNING id, nume
    `;

    if (!updated[0]) {
      return NextResponse.json({ error: "Angajat negăsit" }, { status: 404 });
    }

    await writeAudit({
      action: "angajat_rename",
      resource: id,
      detail: { nume: String(updated[0].nume) },
      ip: clientKey(request),
    });

    return NextResponse.json({
      angajat: { id: String(updated[0].id), nume: String(updated[0].nume) },
    });
  } catch (error) {
    console.error("PATCH /api/angajati/[id]", error);
    return NextResponse.json(
      { error: "Nu s-a putut actualiza angajatul" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request, context: Ctx) {
  const denied = await guardWrite(request);
  if (denied) return denied;

  try {
    const { id: rawId } = await context.params;
    const id = parseUuid(rawId);
    if (!id) {
      return NextResponse.json({ error: "id invalid" }, { status: 400 });
    }

    const sql = getDb();
    const updated = await sql`
      UPDATE angajati
      SET activ = false
      WHERE id = ${id}::uuid AND activ = true
      RETURNING id
    `;

    if (!updated[0]) {
      return NextResponse.json({ error: "Angajat negăsit" }, { status: 404 });
    }

    await writeAudit({
      action: "angajat_delete",
      resource: id,
      ip: clientKey(request),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/angajati/[id]", error);
    return NextResponse.json(
      { error: "Nu s-a putut șterge angajatul" },
      { status: 500 },
    );
  }
}
