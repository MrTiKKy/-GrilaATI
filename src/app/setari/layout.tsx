import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { SetariNav } from "@/components/setari/SetariNav";
import { SESSION_COOKIE, readSessionPayload } from "@/lib/auth";
import {
  getActiveWorkspace,
  getPreferredWorkspaceId,
} from "@/lib/workspace";
import { SetariContentFrame } from "@/components/setari/SetariContentFrame";

export default async function SetariLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const jar = await cookies();
  const user = await readSessionPayload(jar.get(SESSION_COOKIE)?.value);
  if (!user) {
    redirect("/login?next=/setari");
  }

  const preferred = await getPreferredWorkspaceId();
  const ws = await getActiveWorkspace(user.userId, preferred);
  if (!ws) {
    redirect("/workspaces");
  }
  if (!ws.poateModificaSetari) {
    redirect("/");
  }

  return (
    <main className="flex min-h-0 flex-1 flex-col bg-slate-100">
      <div className="mx-auto flex min-h-0 w-full max-w-[1800px] flex-1 flex-col px-2 py-2 sm:px-4 sm:py-3">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-200/60">
          <div className="shrink-0 border-b border-slate-100 px-4 pt-3 sm:px-5 sm:pt-4">
            <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">
              Workspace
            </p>
            <h1 className="mt-0.5 text-xl font-semibold tracking-tight text-slate-900">
              Setări
            </h1>
            <p className="mt-0.5 truncate text-sm text-slate-500">{ws.nume}</p>
            <div className="mt-2 -mx-4 sm:-mx-5">
              <SetariNav />
            </div>
          </div>
          <SetariContentFrame>{children}</SetariContentFrame>
        </div>
      </div>
    </main>
  );
}
