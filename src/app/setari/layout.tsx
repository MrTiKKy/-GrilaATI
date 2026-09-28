import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { SetariNav } from "@/components/setari/SetariNav";
import { SESSION_COOKIE, readSessionPayload } from "@/lib/auth";
import { getActiveWorkspace } from "@/lib/workspace";

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

  const ws = await getActiveWorkspace(user.userId);
  if (!ws?.poateModificaSetari) {
    redirect("/");
  }

  return (
    <main className="min-h-full flex-1 bg-slate-100">
      <div className="mx-auto flex w-full max-w-[1800px] flex-col lg:min-h-[calc(100vh-3.25rem)] lg:flex-row">
        <aside className="shrink-0 border-b border-slate-200 bg-white lg:w-56 lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-3 py-3 lg:block lg:border-b-0">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Setări
              </p>
              <p className="truncate text-sm font-semibold text-slate-900">
                {ws.nume}
              </p>
            </div>
            <Link
              href="/"
              className="rounded-lg px-2 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-sky-800 lg:mt-2 lg:inline-block lg:px-0 lg:py-0"
            >
              ← Grilă
            </Link>
          </div>
          <SetariNav />
        </aside>
        <section className="flex-1 px-3 py-4 sm:px-6 sm:py-6">{children}</section>
      </div>
    </main>
  );
}
