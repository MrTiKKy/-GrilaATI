import { NextResponse } from "next/server";
import { writeAudit } from "@/lib/audit";
import { guardSettings, isGuardError } from "@/lib/apiGuard";
import {
  listCategorii,
  type CategorieDto,
} from "@/lib/categorii";
import { seedOreCoduriForNewCategorie } from "@/lib/oreCoduri";
import { getDb } from "@/lib/db";
import { clientKey } from "@/lib/rateLimit";
import { readJsonLimited } from "@/lib/readJsonLimited";
import { clampString } from "@/lib/validate";

function toJson(c: CategorieDto) {
  return {
    id: c.id,
    nume: c.nume,
    titluGrafic: c.titluGrafic,
    ordine: c.ordine,
    activ: c.activ,
    postVechi: c.postVechi,
  };
}

export async function GET(request: Request) {
  const gated = await guardSettings(request);
  if (isGuardError(gated)) return gated;

  try {
    const items = await listCategorii(gated.workspaceId);
    return NextResponse.json({ items: items.map(toJson) });
  } catch (error) {
    console.error("GET /api/setari/categorii", error);
    return NextResponse.json(
      { error: "Nu s-au putut încărca categoriile" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const gated = await guardSettings(request);
  if (isGuardError(gated)) return gated;
  const { user, workspaceId } = gated;

  try {
    const parsed = await readJsonLimited<{
      nume?: unknown;
      titluGrafic?: unknown;
    }>(request, 4_096);
    if (!parsed.ok) return parsed.response;

    const nume = clampString(parsed.data.nume, 80);
    const titluGrafic = clampString(parsed.data.titluGrafic, 200);
    if (!nume) {
      return NextResponse.json({ error: "Numele este obligatoriu" }, { status: 400 });
    }
    if (!titluGrafic) {
      return NextResponse.json(
        { error: "Titlul graficului este obligatoriu" },
        { status: 400 },
      );
    }

    const sql = getDb();
    const maxRows = await sql`
      SELECT COALESCE(MAX(ordine), 0)::int AS max_ordine
      FROM categorii
      WHERE workspace_id = ${workspaceId}::uuid
    `;
    const ordine = Number(maxRows[0]?.max_ordine ?? 0) + 1;

    const inserted = await sql`
      INSERT INTO categorii (workspace_id, nume, titlu_grafic, ordine, activ, post_vechi)
      VALUES (
        ${workspaceId}::uuid,
        ${nume},
        ${titluGrafic},
        ${ordine},
        true,
        NULL
      )
      RETURNING id::text AS id, nume, titlu_grafic, ordine, activ, post_vechi
    `;
    const row = inserted[0];
    if (!row) {
      return NextResponse.json({ error: "Insert eșuat" }, { status: 500 });
    }

    await seedOreCoduriForNewCategorie(workspaceId, String(row.id));

    await writeAudit({
      action: "categorie_create",
      resource: String(row.id),
      detail: { nume, titluGrafic, ordine },
      ip: clientKey(request),
      userId: user.userId,
      workspaceId,
    });

    return NextResponse.json(
      {
        item: toJson({
          id: String(row.id),
          nume: String(row.nume),
          titluGrafic: String(row.titlu_grafic),
          ordine: Number(row.ordine),
          activ: Boolean(row.activ),
          postVechi: null,
        }),
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("POST /api/setari/categorii", error);
    return NextResponse.json(
      { error: "Nu s-a putut crea categoria" },
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
      nume?: unknown;
      titluGrafic?: unknown;
      activ?: unknown;
      ordineIds?: unknown;
    }>(request, 8_192);
    if (!parsed.ok) return parsed.response;

    const sql = getDb();

    // Reorder: { ordineIds: string[] }
    if (Array.isArray(parsed.data.ordineIds)) {
      const ids = parsed.data.ordineIds
        .filter((x): x is string => typeof x === "string" && x.length > 0);
      const existing = await listCategorii(workspaceId);
      if (
        ids.length !== existing.length ||
        new Set(ids).size !== ids.length ||
        !existing.every((c) => ids.includes(c.id))
      ) {
        return NextResponse.json(
          { error: "Lista de ordine este invalidă" },
          { status: 400 },
        );
      }
      for (let i = 0; i < ids.length; i++) {
        await sql`
          UPDATE categorii
          SET ordine = ${i + 1}
          WHERE workspace_id = ${workspaceId}::uuid AND id = ${ids[i]}::uuid
        `;
      }
      await writeAudit({
        action: "categorie_ordine",
        detail: { ids },
        ip: clientKey(request),
        userId: user.userId,
        workspaceId,
      });
      const items = await listCategorii(workspaceId);
      return NextResponse.json({ items: items.map(toJson) });
    }

    const id =
      typeof parsed.data.id === "string" ? parsed.data.id.trim() : "";
    if (!id) {
      return NextResponse.json({ error: "id obligatoriu" }, { status: 400 });
    }

    const current = (await listCategorii(workspaceId)).find((c) => c.id === id);
    if (!current) {
      return NextResponse.json({ error: "Categorie negăsită" }, { status: 404 });
    }

    let nume = current.nume;
    let titluGrafic = current.titluGrafic;
    let activ = current.activ;

    if (parsed.data.nume !== undefined) {
      const n = clampString(parsed.data.nume, 80);
      if (!n) {
        return NextResponse.json(
          { error: "Numele nu poate fi gol" },
          { status: 400 },
        );
      }
      nume = n;
    }
    if (parsed.data.titluGrafic !== undefined) {
      const t = clampString(parsed.data.titluGrafic, 200);
      if (!t) {
        return NextResponse.json(
          { error: "Titlul graficului nu poate fi gol" },
          { status: 400 },
        );
      }
      titluGrafic = t;
    }
    if (typeof parsed.data.activ === "boolean") {
      if (parsed.data.activ === false) {
        const activeCount = (await listCategorii(workspaceId)).filter(
          (c) => c.activ && c.id !== id,
        ).length;
        if (activeCount < 1) {
          return NextResponse.json(
            { error: "Trebuie să rămână cel puțin o categorie activă" },
            { status: 400 },
          );
        }
      }
      activ = parsed.data.activ;
    }

    await sql`
      UPDATE categorii
      SET nume = ${nume},
          titlu_grafic = ${titluGrafic},
          activ = ${activ}
      WHERE workspace_id = ${workspaceId}::uuid AND id = ${id}::uuid
    `;

    await writeAudit({
      action: "categorie_update",
      resource: id,
      detail: {
        nume,
        titluGrafic,
        activ,
        before: {
          nume: current.nume,
          titluGrafic: current.titluGrafic,
          activ: current.activ,
        },
      },
      ip: clientKey(request),
      userId: user.userId,
      workspaceId,
    });

    return NextResponse.json({
      item: toJson({
        id,
        nume,
        titluGrafic,
        ordine: current.ordine,
        activ,
        postVechi: current.postVechi,
      }),
    });
  } catch (error) {
    console.error("PUT /api/setari/categorii", error);
    return NextResponse.json(
      { error: "Nu s-a putut actualiza categoria" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  const gated = await guardSettings(request);
  if (isGuardError(gated)) return gated;
  const { user, workspaceId } = gated;

  try {
    const parsed = await readJsonLimited<{ id?: unknown }>(request, 2_048);
    if (!parsed.ok) return parsed.response;
    const id =
      typeof parsed.data.id === "string" ? parsed.data.id.trim() : "";
    if (!id) {
      return NextResponse.json({ error: "id obligatoriu" }, { status: 400 });
    }

    const sql = getDb();
    const current = (await listCategorii(workspaceId)).find((c) => c.id === id);
    if (!current) {
      return NextResponse.json({ error: "Categorie negăsită" }, { status: 404 });
    }

    const activeOthers = (await listCategorii(workspaceId)).filter(
      (c) => c.activ && c.id !== id,
    ).length;
    if (current.activ && activeOthers < 1) {
      return NextResponse.json(
        { error: "Trebuie să rămână cel puțin o categorie activă" },
        { status: 400 },
      );
    }

    const ang = await sql`
      SELECT COUNT(*)::int AS n
      FROM angajati
      WHERE workspace_id = ${workspaceId}::uuid AND categorie_id = ${id}::uuid
    `;
    const prog = await sql`
      SELECT COUNT(*)::int AS n
      FROM programari p
      INNER JOIN angajati a
        ON a.id = p.angajat_id AND a.workspace_id = p.workspace_id
      WHERE a.workspace_id = ${workspaceId}::uuid
        AND a.categorie_id = ${id}::uuid
    `;
    const angN = Number(ang[0]?.n ?? 0);
    const progN = Number(prog[0]?.n ?? 0);
    if (angN > 0 || progN > 0) {
      return NextResponse.json(
        {
          error:
            "Categoria are angajați sau programări — poți doar să o dezactivezi",
          angajati: angN,
          programari: progN,
        },
        { status: 409 },
      );
    }

    await sql`
      DELETE FROM ore_coduri
      WHERE workspace_id = ${workspaceId}::uuid AND categorie_id = ${id}::uuid
    `;
    await sql`
      DELETE FROM ore_osd
      WHERE workspace_id = ${workspaceId}::uuid AND categorie_id = ${id}::uuid
    `;
    await sql`
      DELETE FROM luna_foi
      WHERE workspace_id = ${workspaceId}::uuid AND categorie_id = ${id}::uuid
    `;
    await sql`
      DELETE FROM categorii
      WHERE workspace_id = ${workspaceId}::uuid AND id = ${id}::uuid
    `;

    await writeAudit({
      action: "categorie_delete",
      resource: id,
      detail: { nume: current.nume },
      ip: clientKey(request),
      userId: user.userId,
      workspaceId,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/setari/categorii", error);
    return NextResponse.json(
      { error: "Nu s-a putut șterge categoria" },
      { status: 500 },
    );
  }
}
