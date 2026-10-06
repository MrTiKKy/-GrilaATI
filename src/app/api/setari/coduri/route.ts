import { NextResponse } from "next/server";
import { writeAudit } from "@/lib/audit";
import { guardSettings, isGuardError } from "@/lib/apiGuard";
import { getDb } from "@/lib/db";
import { clientKey } from "@/lib/rateLimit";
import { readJsonLimited } from "@/lib/readJsonLimited";
import { parseUuid } from "@/lib/validate";
import {
  listAllCoduri,
  getCodById,
  isCodUsedInProgramari,
  isDuplicateCod,
  isSistem,
  validateCodKey,
  type CodDto,
} from "@/lib/coduri";
import { listCategorii } from "@/lib/categorii";
import { CELL_TEXT_MAX, cellTextError, parseCellText } from "@/lib/cellText";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

function codToJson(c: CodDto) {
  return {
    id: c.id,
    categorieId: c.categorieId,
    cod: c.cod,
    eticheta: c.eticheta,
    culoare: c.culoare,
    ordine: c.ordine,
    activ: c.activ,
    sistem: c.sistem,
    comportamentVechi: c.comportamentVechi,
  };
}

// ---------------------------------------------------------------------------
// GET — all codes (incl. inactive) + categories with permiteTextLiber
// ---------------------------------------------------------------------------

export async function GET(request: Request) {
  const gated = await guardSettings(request);
  if (isGuardError(gated)) return gated;
  const { workspaceId } = gated;

  try {
    const sql = getDb();
    const codes = await listAllCoduri(workspaceId);
    const categorii = await listCategorii(workspaceId);

    // Fetch permite_text_liber for each category
    const catTextLiber: Record<string, boolean> = {};
    for (const cat of categorii) {
      const rows = await sql`
        SELECT permite_text_liber
        FROM categorii
        WHERE id = ${cat.id}::uuid AND workspace_id = ${workspaceId}::uuid
        LIMIT 1
      `;
      catTextLiber[cat.id] = Boolean(rows[0]?.permite_text_liber ?? false);
    }

    return NextResponse.json({
      items: codes.map(codToJson),
      categorii: categorii.map((c) => ({
        id: c.id,
        nume: c.nume,
        permiteTextLiber: catTextLiber[c.id] ?? false,
      })),
    });
  } catch (error) {
    console.error("GET /api/setari/coduri", error);
    return NextResponse.json(
      { error: "Nu s-au putut încărca codurile" },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// POST — create a new code
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  const gated = await guardSettings(request);
  if (isGuardError(gated)) return gated;
  const { user, workspaceId } = gated;

  try {
    const parsed = await readJsonLimited<{
      cod?: unknown;
      eticheta?: unknown;
      culoare?: unknown;
      categorieId?: unknown;
      ordine?: unknown;
    }>(request, 4_096);
    if (!parsed.ok) return parsed.response;

    const cod = validateCodKey(String(parsed.data.cod ?? ""));
    if (!cod) {
      return NextResponse.json(
        { error: `Codul este obligatoriu (max ${CELL_TEXT_MAX} caractere)` },
        { status: 400 },
      );
    }

    const etichetaRaw =
      typeof parsed.data.eticheta === "string" && parsed.data.eticheta.trim()
        ? parsed.data.eticheta
        : cod;
    const etichetaErr = cellTextError(etichetaRaw);
    if (etichetaErr) {
      return NextResponse.json({ error: `Etichetă: ${etichetaErr}` }, { status: 400 });
    }
    const eticheta = parseCellText(etichetaRaw);
    if (!eticheta) {
      return NextResponse.json(
        { error: `Eticheta este obligatorie (max ${CELL_TEXT_MAX} caractere)` },
        { status: 400 },
      );
    }

    const culoare = String(parsed.data.culoare ?? "#111111");
    if (!HEX_RE.test(culoare)) {
      return NextResponse.json(
        { error: "Culoarea trebuie să fie hex (#RRGGBB)" },
        { status: 400 },
      );
    }

    const categorieId =
      parsed.data.categorieId === null || parsed.data.categorieId === undefined
        ? null
        : parseUuid(parsed.data.categorieId);

    if (parsed.data.categorieId && !categorieId) {
      return NextResponse.json(
        { error: "categorieId invalid" },
        { status: 400 },
      );
    }

    // Validate FK: category must belong to workspace
    if (categorieId) {
      const sql = getDb();
      const catCheck = await sql`
        SELECT id FROM categorii
        WHERE id = ${categorieId}::uuid AND workspace_id = ${workspaceId}::uuid
        LIMIT 1
      `;
      if (!catCheck[0]) {
        return NextResponse.json(
          { error: "Categorie negăsită" },
          { status: 404 },
        );
      }
    }

    // Check duplicate
    const dup = await isDuplicateCod(workspaceId, cod, categorieId);
    if (dup) {
      return NextResponse.json(
        { error: `Codul „${cod}" există deja în acest domeniu` },
        { status: 409 },
      );
    }

    const sql = getDb();

    // Compute ordine
    let ordine: number;
    if (typeof parsed.data.ordine === "number" && Number.isFinite(parsed.data.ordine)) {
      ordine = Math.max(1, Math.round(parsed.data.ordine));
    } else {
      const maxRows = await sql`
        SELECT COALESCE(MAX(ordine), 0)::int AS max_ordine
        FROM coduri
        WHERE workspace_id = ${workspaceId}::uuid
      `;
      ordine = Number(maxRows[0]?.max_ordine ?? 0) + 1;
    }

    const inserted = await sql`
      INSERT INTO coduri (workspace_id, categorie_id, cod, eticheta, culoare, ordine, activ)
      VALUES (
        ${workspaceId}::uuid,
        ${categorieId}::uuid,
        ${cod},
        ${eticheta},
        ${culoare},
        ${ordine},
        true
      )
      RETURNING id::text AS id
    `;
    const newId = String(inserted[0]?.id ?? "");

    const { seedOreCoduriForNewCod } = await import("@/lib/oreCoduri");
    await seedOreCoduriForNewCod(workspaceId, newId, categorieId);

    await writeAudit({
      action: "cod_create",
      resource: newId,
      detail: { cod, eticheta, culoare, categorieId, ordine },
      ip: clientKey(request),
      userId: user.userId,
      workspaceId,
    });

    const created = await getCodById(workspaceId, newId);
    return NextResponse.json(
      { item: created ? codToJson(created) : { id: newId } },
      { status: 201 },
    );
  } catch (error) {
    console.error("POST /api/setari/coduri", error);
    return NextResponse.json(
      { error: "Nu s-a putut crea codul" },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// PUT — update code, reorder, or toggle permite_text_liber
// ---------------------------------------------------------------------------

export async function PUT(request: Request) {
  const gated = await guardSettings(request);
  if (isGuardError(gated)) return gated;
  const { user, workspaceId } = gated;

  try {
    const parsed = await readJsonLimited<{
      id?: unknown;
      eticheta?: unknown;
      culoare?: unknown;
      activ?: unknown;
      cod?: unknown;
      ordineIds?: unknown;
      // For permite_text_liber toggle
      categorieId?: unknown;
      permiteTextLiber?: unknown;
    }>(request, 8_192);
    if (!parsed.ok) return parsed.response;

    const sql = getDb();

    // ---- Toggle permite_text_liber for a category ----
    if (typeof parsed.data.permiteTextLiber === "boolean") {
      const catId = parseUuid(parsed.data.categorieId);
      if (!catId) {
        return NextResponse.json(
          { error: "categorieId obligatoriu" },
          { status: 400 },
        );
      }

      await sql`
        UPDATE categorii
        SET permite_text_liber = ${parsed.data.permiteTextLiber}
        WHERE workspace_id = ${workspaceId}::uuid AND id = ${catId}::uuid
      `;

      await writeAudit({
        action: "categorie_text_liber_update",
        resource: catId,
        detail: { permiteTextLiber: parsed.data.permiteTextLiber },
        ip: clientKey(request),
        userId: user.userId,
        workspaceId,
      });

      return NextResponse.json({ ok: true });
    }

    // ---- Reorder: { ordineIds: string[] } ----
    if (Array.isArray(parsed.data.ordineIds)) {
      const ids = parsed.data.ordineIds.filter(
        (x): x is string => typeof x === "string" && x.length > 0,
      );
      if (ids.length === 0) {
        return NextResponse.json(
          { error: "Lista de ordine este goală" },
          { status: 400 },
        );
      }
      for (let i = 0; i < ids.length; i++) {
        await sql`
          UPDATE coduri
          SET ordine = ${i + 1}
          WHERE workspace_id = ${workspaceId}::uuid AND id = ${ids[i]}::uuid
        `;
      }

      await writeAudit({
        action: "cod_ordine",
        detail: { ids },
        ip: clientKey(request),
        userId: user.userId,
        workspaceId,
      });

      const items = await listAllCoduri(workspaceId);
      return NextResponse.json({ items: items.map(codToJson) });
    }

    // ---- Update single code ----
    const id = parseUuid(parsed.data.id);
    if (!id) {
      return NextResponse.json({ error: "id obligatoriu" }, { status: 400 });
    }

    const current = await getCodById(workspaceId, id);
    if (!current) {
      return NextResponse.json({ error: "Cod negăsit" }, { status: 404 });
    }

    const sistemCode = isSistem(current);

    // Build patch
    let eticheta = current.eticheta;
    let culoare = current.culoare;
    let activ = current.activ;
    let cod = current.cod;

    // Culoare — always editable
    if (parsed.data.culoare !== undefined) {
      const c = String(parsed.data.culoare ?? "#111111");
      if (!HEX_RE.test(c)) {
        return NextResponse.json(
          { error: "Culoarea trebuie să fie hex (#RRGGBB)" },
          { status: 400 },
        );
      }
      culoare = c;
    }

    // Eticheta — reject for sistem
    if (parsed.data.eticheta !== undefined) {
      if (sistemCode) {
        return NextResponse.json(
          { error: "Nu poți redenumi un cod sistem (CO/CM/CIC)" },
          { status: 403 },
        );
      }
      const eParsed = parseCellText(String(parsed.data.eticheta ?? ""));
      if (eParsed === null) {
        return NextResponse.json(
          {
            error:
              cellTextError(String(parsed.data.eticheta ?? "")) ??
              `Etichetă invalidă (max ${CELL_TEXT_MAX})`,
          },
          { status: 400 },
        );
      }
      if (!eParsed) {
        return NextResponse.json(
          { error: "Eticheta nu poate fi goală" },
          { status: 400 },
        );
      }
      eticheta = eParsed;
    }

    // Activ toggle — reject deactivating sistem
    if (typeof parsed.data.activ === "boolean") {
      if (sistemCode && !parsed.data.activ) {
        return NextResponse.json(
          { error: "Nu poți dezactiva un cod sistem (CO/CM/CIC)" },
          { status: 403 },
        );
      }
      activ = parsed.data.activ;
    }

    // Change cod value — only if not sistem and not used in programari
    if (parsed.data.cod !== undefined) {
      if (sistemCode) {
        return NextResponse.json(
          { error: "Nu poți redenumi un cod sistem (CO/CM/CIC)" },
          { status: 403 },
        );
      }
      const newCod = validateCodKey(String(parsed.data.cod ?? ""));
      if (!newCod) {
        return NextResponse.json(
          { error: `Codul este obligatoriu (max ${CELL_TEXT_MAX} caractere)` },
          { status: 400 },
        );
      }
      if (newCod !== current.cod) {
        const used = await isCodUsedInProgramari(workspaceId, current.cod);
        if (used) {
          return NextResponse.json(
            { error: "Nu poți schimba codul — este folosit în programări" },
            { status: 409 },
          );
        }
        const dup = await isDuplicateCod(
          workspaceId,
          newCod,
          current.categorieId,
          id,
        );
        if (dup) {
          return NextResponse.json(
            { error: `Codul „${newCod}" există deja` },
            { status: 409 },
          );
        }
        cod = newCod;
      }
    }

    await sql`
      UPDATE coduri
      SET eticheta = ${eticheta},
          culoare = ${culoare},
          activ = ${activ},
          cod = ${cod}
      WHERE workspace_id = ${workspaceId}::uuid AND id = ${id}::uuid
    `;

    await writeAudit({
      action: "cod_update",
      resource: id,
      detail: {
        cod,
        eticheta,
        culoare,
        activ,
        before: {
          cod: current.cod,
          eticheta: current.eticheta,
          culoare: current.culoare,
          activ: current.activ,
        },
      },
      ip: clientKey(request),
      userId: user.userId,
      workspaceId,
    });

    const updated = await getCodById(workspaceId, id);
    return NextResponse.json({
      item: updated ? codToJson(updated) : { id },
    });
  } catch (error) {
    console.error("PUT /api/setari/coduri", error);
    return NextResponse.json(
      { error: "Nu s-a putut actualiza codul" },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// DELETE — only if unused in any programari for workspace
// ---------------------------------------------------------------------------

export async function DELETE(request: Request) {
  const gated = await guardSettings(request);
  if (isGuardError(gated)) return gated;
  const { user, workspaceId } = gated;

  try {
    const parsed = await readJsonLimited<{ id?: unknown }>(request, 2_048);
    if (!parsed.ok) return parsed.response;

    const id = parseUuid(parsed.data.id);
    if (!id) {
      return NextResponse.json({ error: "id obligatoriu" }, { status: 400 });
    }

    const current = await getCodById(workspaceId, id);
    if (!current) {
      return NextResponse.json({ error: "Cod negăsit" }, { status: 404 });
    }

    if (isSistem(current)) {
      return NextResponse.json(
        { error: "Nu poți șterge un cod sistem (CO/CM/CIC)" },
        { status: 403 },
      );
    }

    const used = await isCodUsedInProgramari(workspaceId, current.cod);
    if (used) {
      return NextResponse.json(
        {
          error:
            "Codul este folosit în programări — poți doar să-l dezactivezi",
        },
        { status: 409 },
      );
    }

    const sql = getDb();
    await sql`
      DELETE FROM coduri
      WHERE workspace_id = ${workspaceId}::uuid AND id = ${id}::uuid
    `;

    await writeAudit({
      action: "cod_delete",
      resource: id,
      detail: { cod: current.cod, eticheta: current.eticheta },
      ip: clientKey(request),
      userId: user.userId,
      workspaceId,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/setari/coduri", error);
    return NextResponse.json(
      { error: "Nu s-a putut șterge codul" },
      { status: 500 },
    );
  }
}
