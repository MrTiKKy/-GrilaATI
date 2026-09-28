import { NextResponse } from "next/server";
import { writeAudit } from "@/lib/audit";
import { guardSettings, isGuardError } from "@/lib/apiGuard";
import { getDb } from "@/lib/db";
import { clientKey } from "@/lib/rateLimit";
import { readJsonLimited } from "@/lib/readJsonLimited";

const MAX_NUME = 120;

export async function GET(request: Request) {
  const gated = await guardSettings(request);
  if (isGuardError(gated)) return gated;
  const { workspaceId, rol, isOwner } = gated;

  try {
    const sql = getDb();
    const rows = await sql`
      SELECT nume
      FROM workspaces
      WHERE id = ${workspaceId}::uuid
      LIMIT 1
    `;
    const row = rows[0];
    if (!row) {
      return NextResponse.json(
        { error: "Workspace negăsit" },
        { status: 404 },
      );
    }
    return NextResponse.json({
      nume: String(row.nume ?? ""),
      rol,
      isOwner,
    });
  } catch (error) {
    console.error("GET /api/setari/general", error);
    return NextResponse.json(
      { error: "Nu s-au putut încărca setările" },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  const gated = await guardSettings(request);
  if (isGuardError(gated)) return gated;
  const { user, workspaceId } = gated;

  try {
    const parsed = await readJsonLimited<{ nume?: unknown }>(request, 4_096);
    if (!parsed.ok) return parsed.response;

    const raw = parsed.data.nume;
    if (typeof raw !== "string") {
      return NextResponse.json(
        { error: "Numele workspace-ului este obligatoriu" },
        { status: 400 },
      );
    }
    const nume = raw.trim().replace(/\s+/g, " ");
    if (!nume) {
      return NextResponse.json(
        { error: "Numele workspace-ului nu poate fi gol" },
        { status: 400 },
      );
    }
    if (nume.length > MAX_NUME) {
      return NextResponse.json(
        { error: `Numele poate avea maxim ${MAX_NUME} caractere` },
        { status: 400 },
      );
    }

    const sql = getDb();
    const prev = await sql`
      SELECT nume
      FROM workspaces
      WHERE id = ${workspaceId}::uuid
      LIMIT 1
    `;
    const oldNume = prev[0] ? String(prev[0].nume ?? "") : null;
    if (oldNume === null) {
      return NextResponse.json(
        { error: "Workspace negăsit" },
        { status: 404 },
      );
    }

    if (oldNume !== nume) {
      await sql`
        UPDATE workspaces
        SET nume = ${nume}
        WHERE id = ${workspaceId}::uuid
      `;
      await writeAudit({
        action: "setari_general_update",
        resource: "workspaces",
        detail: { workspaceId, oldNume, nume },
        ip: clientKey(request),
        userId: user.userId,
        workspaceId,
      });
    }

    return NextResponse.json({
      nume,
      rol: gated.rol,
      isOwner: gated.isOwner,
    });
  } catch (error) {
    console.error("PUT /api/setari/general", error);
    return NextResponse.json(
      { error: "Nu s-a putut salva numele" },
      { status: 500 },
    );
  }
}
