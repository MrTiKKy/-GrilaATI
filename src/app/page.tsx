import { Suspense } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ScheduleGrid } from "@/components/schedule/ScheduleGrid";
import { SESSION_COOKIE, readSessionPayload } from "@/lib/auth";
import {
  getActiveWorkspace,
  getPreferredWorkspaceId,
} from "@/lib/workspace";

export default async function Home() {
  const jar = await cookies();
  const user = await readSessionPayload(jar.get(SESSION_COOKIE)?.value);
  const preferred = await getPreferredWorkspaceId();
  const ws = user
    ? await getActiveWorkspace(user.userId, preferred)
    : null;

  if (!ws) {
    redirect("/workspaces");
  }

  const showSetari = Boolean(ws.poateModificaSetari);

  return (
    <main className="min-h-full flex-1 bg-slate-100 py-2 sm:py-4">
      <Suspense
        fallback={
          <div className="mx-auto max-w-[1500px] px-3 py-10 text-sm text-slate-500 sm:px-6">
            Se încarcă grila…
          </div>
        }
      >
        <ScheduleGrid showSetari={showSetari} />
      </Suspense>
    </main>
  );
}
