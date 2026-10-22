import { NextResponse } from "next/server";
import { writeAudit } from "@/lib/audit";
import { guardWrite } from "@/lib/apiGuard";
import { clientKey } from "@/lib/rateLimit";
import { readJsonLimited } from "@/lib/readJsonLimited";
import {
  isValidSarbatoareDate,
  setSarbatoareLegala,
} from "@/lib/sarbatori";

type Body = {
  data?: string;
  /** true = marchează sărbătoare; false = anulează */
  activ?: boolean;
};

export async function PUT(request: Request) {
  const gated = await guardWrite(request, { limit: 60 });
  if (gated instanceof NextResponse) return gated;
  const { user, workspaceId } = gated;

  try {
    const parsed = await readJsonLimited<Body>(request, 1_024);
    if (!parsed.ok) return parsed.response;
    const data = typeof parsed.data.data === "string" ? parsed.data.data : "";
    if (!isValidSarbatoareDate(data)) {
      return NextResponse.json(
        { error: "data trebuie YYYY-MM-DD" },
        { status: 400 },
      );
    }
    const activ = Boolean(parsed.data.activ);

    const next = await setSarbatoareLegala(workspaceId, data, activ);

    await writeAudit({
      action: activ ? "sarbatoare_set" : "sarbatoare_clear",
      resource: data,
      detail: { data, activ: next },
      ip: clientKey(request),
      userId: user.userId,
      workspaceId,
    });

    return NextResponse.json({ ok: true, data, activ: next });
  } catch (error) {
    console.error("PUT /api/sarbatori", error);
    const msg =
      error instanceof Error && /sarbatori_legale/i.test(error.message)
        ? "Tabelul sarbatori_legale lipsește — rulează sql/add_sarbatori_legale.sql"
        : "Nu s-a putut salva sărbătoarea";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
