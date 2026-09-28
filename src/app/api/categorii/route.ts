import { NextResponse } from "next/server";
import { guardRead, isGuardError } from "@/lib/apiGuard";
import { listCategorii } from "@/lib/categorii";

/** Lista categoriilor active — pentru taburi grilă / concedii. */
export async function GET(request: Request) {
  const gated = await guardRead(request);
  if (isGuardError(gated)) return gated;
  const { workspaceId } = gated;

  try {
    const items = await listCategorii(workspaceId, { onlyActive: true });
    return NextResponse.json({
      items: items.map((c) => ({
        id: c.id,
        nume: c.nume,
        titluGrafic: c.titluGrafic,
        ordine: c.ordine,
      })),
    });
  } catch (error) {
    console.error("GET /api/categorii", error);
    return NextResponse.json(
      { error: "Nu s-au putut încărca categoriile" },
      { status: 500 },
    );
  }
}
