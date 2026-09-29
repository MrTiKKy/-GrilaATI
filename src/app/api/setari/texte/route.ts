import { NextResponse } from "next/server";
import { writeAudit } from "@/lib/audit";
import { guardSettings, isGuardError } from "@/lib/apiGuard";
import { loadGraficFooter } from "@/lib/loadGraficFooter";
import {
  getTexte,
  isTexteCheie,
  listTexteOverrides,
  parseTexteValoare,
  resetTexte,
  resetTexteSection,
  TEXTE_REGISTRY,
  TEXTE_SECTIONS,
  upsertTexte,
} from "@/lib/texte";
import {
  GRAFIC_FOOTER_FIELDS,
  isGraficFooterKey,
} from "@/lib/graficFooter";
import { getDb } from "@/lib/db";
import { clientKey } from "@/lib/rateLimit";
import { readJsonLimited } from "@/lib/readJsonLimited";

export async function GET(request: Request) {
  const gated = await guardSettings(request);
  if (isGuardError(gated)) return gated;
  const { workspaceId } = gated;

  try {
    const [texte, overrides, footer] = await Promise.all([
      getTexte(workspaceId),
      listTexteOverrides(workspaceId),
      loadGraficFooter(workspaceId),
    ]);
    return NextResponse.json({
      sections: TEXTE_SECTIONS,
      registry: TEXTE_REGISTRY,
      texte,
      overrides,
      footer,
      footerFields: GRAFIC_FOOTER_FIELDS,
    });
  } catch (error) {
    console.error("GET /api/setari/texte", error);
    return NextResponse.json(
      { error: "Nu s-au putut încărca textele" },
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
      cheie?: unknown;
      valoare?: unknown;
      /** Footer field (grafic_footer) — alternativ la cheie din registru */
      footerKey?: unknown;
      footerValue?: unknown;
      confirmEmpty?: unknown;
    }>(request, 8_192);
    if (!parsed.ok) return parsed.response;

    // Footer update via same endpoint (settings UI)
    if (parsed.data.footerKey !== undefined) {
      const key = parsed.data.footerKey;
      if (!isGraficFooterKey(key)) {
        return NextResponse.json({ error: "Cheie footer invalidă" }, { status: 400 });
      }
      const value = String(parsed.data.footerValue ?? "").trim();
      if (value.length > 120) {
        return NextResponse.json(
          { error: "Maxim 120 caractere" },
          { status: 400 },
        );
      }
      if (value.length === 0 && parsed.data.confirmEmpty !== true) {
        return NextResponse.json(
          {
            error: "Confirmă golirea câmpului",
            needsConfirm: true,
          },
          { status: 409 },
        );
      }

      const sql = getDb();
      const prev = await sql`
        SELECT value FROM grafic_footer
        WHERE workspace_id = ${workspaceId}::uuid AND key = ${key}
        LIMIT 1
      `;
      const before = prev[0] ? String(prev[0].value) : null;

      await sql`
        INSERT INTO grafic_footer (workspace_id, key, value, updated_at)
        VALUES (${workspaceId}::uuid, ${key}, ${value}, now())
        ON CONFLICT (workspace_id, key)
        DO UPDATE SET value = EXCLUDED.value, updated_at = now()
      `;

      await writeAudit({
        action: "grafic_footer_update",
        detail: { key, before, after: value, via: "setari_texte" },
        ip: clientKey(request),
        userId: user.userId,
        workspaceId,
      });

      const footer = await loadGraficFooter(workspaceId);
      return NextResponse.json({ ok: true, footer });
    }

    const cheie = parsed.data.cheie;
    if (!isTexteCheie(cheie)) {
      return NextResponse.json({ error: "Cheie necunoscută" }, { status: 400 });
    }
    const parsedVal = parseTexteValoare(cheie, parsed.data.valoare);
    if (!parsedVal.ok) {
      return NextResponse.json({ error: parsedVal.error }, { status: 400 });
    }

    const { before, after } = await upsertTexte(
      workspaceId,
      cheie,
      parsedVal.valoare,
      user.userId,
    );

    await writeAudit({
      action: "texte_update",
      detail: { cheie, before, after },
      ip: clientKey(request),
      userId: user.userId,
      workspaceId,
    });

    const texte = await getTexte(workspaceId);
    const overrides = await listTexteOverrides(workspaceId);
    return NextResponse.json({
      ok: true,
      cheie,
      valoare: after,
      texte,
      overrides,
    });
  } catch (error) {
    console.error("PUT /api/setari/texte", error);
    return NextResponse.json(
      { error: "Nu s-a putut salva textul" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  const gated = await guardSettings(request);
  if (isGuardError(gated)) return gated;
  const { user, workspaceId } = gated;

  try {
    const parsed = await readJsonLimited<{
      cheie?: unknown;
      section?: unknown;
    }>(request, 4_096);
    if (!parsed.ok) return parsed.response;

    if (typeof parsed.data.section === "string" && parsed.data.section) {
      const section = parsed.data.section;
      const reset = await resetTexteSection(workspaceId, section);
      await writeAudit({
        action: "texte_reset_section",
        detail: { section, keys: reset },
        ip: clientKey(request),
        userId: user.userId,
        workspaceId,
      });
      const texte = await getTexte(workspaceId);
      const overrides = await listTexteOverrides(workspaceId);
      return NextResponse.json({ ok: true, reset, texte, overrides });
    }

    const cheie = parsed.data.cheie;
    if (!isTexteCheie(cheie)) {
      return NextResponse.json({ error: "Cheie necunoscută" }, { status: 400 });
    }
    const { before } = await resetTexte(workspaceId, cheie);
    await writeAudit({
      action: "texte_reset",
      detail: { cheie, before, after: null },
      ip: clientKey(request),
      userId: user.userId,
      workspaceId,
    });
    const texte = await getTexte(workspaceId);
    const overrides = await listTexteOverrides(workspaceId);
    return NextResponse.json({
      ok: true,
      cheie,
      texte,
      overrides,
    });
  } catch (error) {
    console.error("DELETE /api/setari/texte", error);
    return NextResponse.json(
      { error: "Nu s-a putut reseta textul" },
      { status: 500 },
    );
  }
}
