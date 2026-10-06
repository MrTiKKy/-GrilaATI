import { NextResponse } from "next/server";
import { writeAudit } from "@/lib/audit";
import { guardSettings, isGuardError } from "@/lib/apiGuard";
import { getDb } from "@/lib/db";
import {
  DEFAULT_PDF_TEMPLATE,
  PDF_TEMPLATE_MAX_PER_WORKSPACE,
  listPdfTemplates,
  loadPdfTemplateForWorkspace,
  mergePdfTemplate,
  parsePdfTemplateStrict,
} from "@/lib/pdfTemplate";
import { readJsonLimited } from "@/lib/readJsonLimited";

export async function GET(request: Request) {
  const gated = await guardSettings(request);
  if (isGuardError(gated)) return gated;
  const { workspaceId } = gated;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const items = await listPdfTemplates(workspaceId);
    const loaded = await loadPdfTemplateForWorkspace(workspaceId, id);
    return NextResponse.json({
      items,
      active: loaded,
      setari: loaded.setari,
      default: DEFAULT_PDF_TEMPLATE,
      e_implicit: loaded.e_implicit,
      versiune: loaded.versiune,
      nume: loaded.nume,
      id: loaded.id || null,
      max: PDF_TEMPLATE_MAX_PER_WORKSPACE,
    });
  } catch (error) {
    console.error("GET /api/setari/export-pdf", error);
    return NextResponse.json(
      { error: "Nu s-a putut încărca template-ul PDF" },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  const gated = await guardSettings(request);
  if (isGuardError(gated)) return gated;
  const { user, workspaceId } = gated;

  try {
    const parsed = await readJsonLimited<{
      id?: unknown;
      setari?: unknown;
      nume?: unknown;
      action?: unknown;
    }>(request, 64_000);
    if (!parsed.ok) return parsed.response;

    const action =
      typeof parsed.data.action === "string" ? parsed.data.action : "save";
    const sql = getDb();

    // --- rename ---
    if (action === "rename") {
      const id = String(parsed.data.id ?? "");
      const nume = String(parsed.data.nume ?? "").trim().slice(0, 80);
      if (!id || !nume) {
        return NextResponse.json(
          { error: "id și nume obligatorii" },
          { status: 400 },
        );
      }
      const rows = await sql`
        UPDATE export_template
        SET nume = ${nume}, updated_by = ${user.userId}::uuid, updated_at = now()
        WHERE id = ${id}::uuid AND workspace_id = ${workspaceId}::uuid AND tip = 'pdf'
        RETURNING id::text, nume, versiune, implicit
      `;
      if (rows.length === 0) {
        return NextResponse.json({ error: "Template negăsit" }, { status: 404 });
      }
      await writeAudit({
        userId: user.userId,
        workspaceId,
        action: "export_template_upsert",
        detail: { tip: "pdf", action: "rename", id, nume },
      });
      return NextResponse.json({ item: rows[0], items: await listPdfTemplates(workspaceId) });
    }

    // --- set implicit ---
    if (action === "set_implicit") {
      const id = String(parsed.data.id ?? "");
      if (!id) {
        return NextResponse.json({ error: "id obligatoriu" }, { status: 400 });
      }
      await sql`
        UPDATE export_template
        SET implicit = false, updated_at = now()
        WHERE workspace_id = ${workspaceId}::uuid AND tip = 'pdf' AND implicit = true
      `;
      const rows = await sql`
        UPDATE export_template
        SET implicit = true, updated_by = ${user.userId}::uuid, updated_at = now()
        WHERE id = ${id}::uuid AND workspace_id = ${workspaceId}::uuid AND tip = 'pdf'
        RETURNING id::text, nume, implicit
      `;
      if (rows.length === 0) {
        return NextResponse.json({ error: "Template negăsit" }, { status: 404 });
      }
      await writeAudit({
        userId: user.userId,
        workspaceId,
        action: "export_template_upsert",
        detail: { tip: "pdf", action: "set_implicit", id },
      });
      return NextResponse.json({ item: rows[0], items: await listPdfTemplates(workspaceId) });
    }

    // --- duplicate ---
    if (action === "duplicate") {
      const id = String(parsed.data.id ?? "");
      const count = await sql`
        SELECT count(*)::int AS n FROM export_template
        WHERE workspace_id = ${workspaceId}::uuid AND tip = 'pdf'
      `;
      if (Number(count[0]?.n) >= PDF_TEMPLATE_MAX_PER_WORKSPACE) {
        return NextResponse.json(
          { error: `Maxim ${PDF_TEMPLATE_MAX_PER_WORKSPACE} template-uri` },
          { status: 400 },
        );
      }
      const src = await sql`
        SELECT nume, setari FROM export_template
        WHERE id = ${id}::uuid AND workspace_id = ${workspaceId}::uuid AND tip = 'pdf'
        LIMIT 1
      `;
      if (src.length === 0) {
        return NextResponse.json({ error: "Template negăsit" }, { status: 404 });
      }
      let base = `${String(src[0].nume)} (copie)`;
      base = base.slice(0, 80);
      // uniquify
      let nume = base;
      for (let i = 2; i < 20; i++) {
        const exists = await sql`
          SELECT 1 FROM export_template
          WHERE workspace_id = ${workspaceId}::uuid AND tip = 'pdf' AND nume = ${nume}
          LIMIT 1
        `;
        if (exists.length === 0) break;
        nume = `${base} ${i}`.slice(0, 80);
      }
      const setariJson = JSON.stringify(mergePdfTemplate(src[0].setari));
      const rows = await sql`
        INSERT INTO export_template (
          workspace_id, tip, nume, setari, versiune, implicit, updated_by
        ) VALUES (
          ${workspaceId}::uuid, 'pdf', ${nume}, ${setariJson}::jsonb, 1, false, ${user.userId}::uuid
        )
        RETURNING id::text, nume, implicit, versiune
      `;
      await writeAudit({
        userId: user.userId,
        workspaceId,
        action: "export_template_upsert",
        detail: { tip: "pdf", action: "duplicate", from: id, id: rows[0]?.id },
      });
      return NextResponse.json({
        item: rows[0],
        setari: mergePdfTemplate(src[0].setari),
        items: await listPdfTemplates(workspaceId),
      });
    }

    // --- create new from default ---
    if (action === "create") {
      const count = await sql`
        SELECT count(*)::int AS n FROM export_template
        WHERE workspace_id = ${workspaceId}::uuid AND tip = 'pdf'
      `;
      if (Number(count[0]?.n) >= PDF_TEMPLATE_MAX_PER_WORKSPACE) {
        return NextResponse.json(
          { error: `Maxim ${PDF_TEMPLATE_MAX_PER_WORKSPACE} template-uri` },
          { status: 400 },
        );
      }
      let nume =
        typeof parsed.data.nume === "string" && parsed.data.nume.trim()
          ? parsed.data.nume.trim().slice(0, 80)
          : "Nou";
      const existing = await listPdfTemplates(workspaceId);
      if (existing.some((e) => e.nume === nume)) {
        nume = `${nume} ${existing.length + 1}`.slice(0, 80);
      }
      const setari =
        parsed.data.setari !== undefined
          ? parsePdfTemplateStrict(parsed.data.setari)
          : { ok: true as const, setari: structuredClone(DEFAULT_PDF_TEMPLATE) };
      if (!setari.ok) {
        return NextResponse.json({ error: setari.error }, { status: 400 });
      }
      const makeImplicit = existing.length === 0;
      if (makeImplicit) {
        // nothing to clear
      }
      const setariJson = JSON.stringify(setari.setari);
      const rows = await sql`
        INSERT INTO export_template (
          workspace_id, tip, nume, setari, versiune, implicit, updated_by
        ) VALUES (
          ${workspaceId}::uuid, 'pdf', ${nume}, ${setariJson}::jsonb, 1, ${makeImplicit}, ${user.userId}::uuid
        )
        RETURNING id::text, nume, implicit, versiune
      `;
      await writeAudit({
        userId: user.userId,
        workspaceId,
        action: "export_template_upsert",
        detail: { tip: "pdf", action: "create", id: rows[0]?.id },
      });
      return NextResponse.json({
        item: rows[0],
        setari: setari.setari,
        e_implicit: false,
        items: await listPdfTemplates(workspaceId),
        default: DEFAULT_PDF_TEMPLATE,
      });
    }

    // --- save settings (update existing or create first) ---
    const checked = parsePdfTemplateStrict(parsed.data.setari);
    if (!checked.ok) {
      return NextResponse.json({ error: checked.error }, { status: 400 });
    }
    const id = typeof parsed.data.id === "string" ? parsed.data.id : "";
    const numeIn =
      typeof parsed.data.nume === "string" && parsed.data.nume.trim()
        ? parsed.data.nume.trim().slice(0, 80)
        : null;
    const setariJson = JSON.stringify(checked.setari);

    if (id) {
      const rows = await sql`
        UPDATE export_template
        SET
          setari = ${setariJson}::jsonb,
          nume = COALESCE(${numeIn}, nume),
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
        action: "export_template_upsert",
        detail: { tip: "pdf", action: "save", id, versiune: rows[0]?.versiune },
      });
      return NextResponse.json({
        id: rows[0].id,
        nume: rows[0].nume,
        setari: checked.setari,
        versiune: Number(rows[0].versiune),
        e_implicit: false,
        implicit: Boolean(rows[0].implicit),
        items: await listPdfTemplates(workspaceId),
        default: DEFAULT_PDF_TEMPLATE,
      });
    }

    // no id: create first template as implicit
    const count = await sql`
      SELECT count(*)::int AS n FROM export_template
      WHERE workspace_id = ${workspaceId}::uuid AND tip = 'pdf'
    `;
    if (Number(count[0]?.n) >= PDF_TEMPLATE_MAX_PER_WORKSPACE) {
      return NextResponse.json(
        { error: `Maxim ${PDF_TEMPLATE_MAX_PER_WORKSPACE} template-uri` },
        { status: 400 },
      );
    }
    const nume = numeIn || "Implicit";
    const rows = await sql`
      INSERT INTO export_template (
        workspace_id, tip, nume, setari, versiune, implicit, updated_by
      ) VALUES (
        ${workspaceId}::uuid, 'pdf', ${nume}, ${setariJson}::jsonb, 1, true, ${user.userId}::uuid
      )
      RETURNING id::text, nume, versiune, implicit
    `;
    await writeAudit({
      userId: user.userId,
      workspaceId,
      action: "export_template_upsert",
      detail: { tip: "pdf", action: "save_new", id: rows[0]?.id },
    });
    return NextResponse.json({
      id: rows[0].id,
      nume: rows[0].nume,
      setari: checked.setari,
      versiune: Number(rows[0].versiune),
      e_implicit: false,
      implicit: true,
      items: await listPdfTemplates(workspaceId),
      default: DEFAULT_PDF_TEMPLATE,
    });
  } catch (error) {
    console.error("PUT /api/setari/export-pdf", error);
    const msg = error instanceof Error ? error.message : "";
    if (/unique|duplicate/i.test(msg)) {
      return NextResponse.json(
        { error: "Numele template-ului există deja" },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: "Nu s-a putut salva template-ul PDF" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  const gated = await guardSettings(request);
  if (isGuardError(gated)) return gated;
  const { user, workspaceId } = gated;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id obligatoriu" }, { status: 400 });
    }
    const sql = getDb();
    const count = await sql`
      SELECT count(*)::int AS n FROM export_template
      WHERE workspace_id = ${workspaceId}::uuid AND tip = 'pdf'
    `;
    if (Number(count[0]?.n) <= 1) {
      return NextResponse.json(
        { error: "Nu poți șterge ultimul template" },
        { status: 400 },
      );
    }
    const target = await sql`
      SELECT id::text, implicit FROM export_template
      WHERE id = ${id}::uuid AND workspace_id = ${workspaceId}::uuid AND tip = 'pdf'
      LIMIT 1
    `;
    if (target.length === 0) {
      return NextResponse.json({ error: "Template negăsit" }, { status: 404 });
    }
    const wasImplicit = Boolean(target[0].implicit);
    await sql`
      DELETE FROM export_template
      WHERE id = ${id}::uuid AND workspace_id = ${workspaceId}::uuid AND tip = 'pdf'
    `;
    if (wasImplicit) {
      await sql`
        UPDATE export_template
        SET implicit = true, updated_at = now()
        WHERE id = (
          SELECT id FROM export_template
          WHERE workspace_id = ${workspaceId}::uuid AND tip = 'pdf'
          ORDER BY updated_at DESC
          LIMIT 1
        )
      `;
    }
    await writeAudit({
      userId: user.userId,
      workspaceId,
      action: "export_template_reset",
      detail: { tip: "pdf", action: "delete", id },
    });
    return NextResponse.json({
      ok: true,
      items: await listPdfTemplates(workspaceId),
    });
  } catch (error) {
    console.error("DELETE /api/setari/export-pdf", error);
    return NextResponse.json(
      { error: "Nu s-a putut șterge template-ul" },
      { status: 500 },
    );
  }
}
