import { NextResponse } from "next/server";
import { writeAudit } from "@/lib/audit";
import { guardSettings, isGuardError } from "@/lib/apiGuard";
import { getDb } from "@/lib/db";
import {
  DEFAULT_PDF_TEMPLATE,
  listPdfTemplates,
  mergePdfTemplate,
} from "@/lib/pdfTemplate";
import { readJsonLimited } from "@/lib/readJsonLimited";

/**
 * Resetează setările template-ului deschis la formatul inițial (păstrează numele).
 * Body: { id?: string } — fără id + zero template-uri → no-op (deja implicit).
 */
export async function POST(request: Request) {
  const gated = await guardSettings(request);
  if (isGuardError(gated)) return gated;
  const { user, workspaceId } = gated;

  try {
    const parsed = await readJsonLimited<{ id?: unknown }>(request, 4_096);
    const id =
      parsed.ok && typeof parsed.data.id === "string" ? parsed.data.id : "";

    const sql = getDb();
    const setariJson = JSON.stringify(DEFAULT_PDF_TEMPLATE);

    if (!id) {
      // fără template-uri salvate — deja pe format inițial
      const items = await listPdfTemplates(workspaceId);
      if (items.length === 0) {
        return NextResponse.json({
          setari: structuredClone(DEFAULT_PDF_TEMPLATE),
          e_implicit: true,
          versiune: 0,
          nume: "Implicit",
          id: null,
          items,
          default: DEFAULT_PDF_TEMPLATE,
        });
      }
      return NextResponse.json(
        { error: "Specifică id-ul template-ului de resetat" },
        { status: 400 },
      );
    }

    const rows = await sql`
      UPDATE export_template
      SET
        setari = ${setariJson}::jsonb,
        versiune = versiune + 1,
        updated_by = ${user.userId}::uuid,
        updated_at = now()
      WHERE id = ${id}::uuid AND workspace_id = ${workspaceId}::uuid AND tip = 'pdf'
      RETURNING id::text, nume, versiune, implicit
    `;
    if (rows.length === 0) {
      return NextResponse.json({ error: "Template negăsit" }, { status: 404 });
    }

    await writeAudit({
      userId: user.userId,
      workspaceId,
      action: "export_template_reset",
      detail: { tip: "pdf", id, action: "reset_setari" },
    });

    return NextResponse.json({
      id: rows[0].id,
      nume: rows[0].nume,
      setari: mergePdfTemplate(DEFAULT_PDF_TEMPLATE),
      versiune: Number(rows[0].versiune),
      e_implicit: false,
      implicit: Boolean(rows[0].implicit),
      items: await listPdfTemplates(workspaceId),
      default: DEFAULT_PDF_TEMPLATE,
    });
  } catch (error) {
    console.error("POST /api/setari/export-pdf/reset", error);
    return NextResponse.json(
      { error: "Nu s-a putut reseta template-ul PDF" },
      { status: 500 },
    );
  }
}
