import { Suspense } from "react";
import { ScheduleGrid } from "@/components/schedule/ScheduleGrid";

export default function Home() {
  return (
    <main className="min-h-full flex-1 bg-slate-100 py-2 sm:py-4">
      <Suspense
        fallback={
          <div className="mx-auto max-w-[1500px] px-3 py-10 text-sm text-slate-500 sm:px-6">
            Se încarcă grila…
          </div>
        }
      >
        <ScheduleGrid />
      </Suspense>
    </main>
  );
}
