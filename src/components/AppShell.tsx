"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";
import {
  Archive,
  ArrowLeftRight,
  CalendarDays,
  Inbox,
  LayoutGrid,
  LogOut,
  Menu,
  MessageSquarePlus,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Users,
  X,
} from "lucide-react";
import { PropunereButton } from "@/components/PropunereButton";
import {
  readSidebarExpanded,
  readWorkspaceUiCache,
  workspaceInitial,
  writeSidebarExpanded,
  writeWorkspaceUiCache,
  type WorkspaceUiCache,
} from "@/lib/workspaceUiCache";
import { handleUnauthorized } from "@/lib/authClient";

type WsItem = {
  id: string;
  nume: string;
  poateModificaSetari: boolean;
};

type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  match: (pathname: string) => boolean;
};

const MAIN_NAV: NavItem[] = [
  {
    href: "/",
    label: "Grilă",
    icon: LayoutGrid,
    match: (p) => p === "/",
  },
  {
    href: "/concedii",
    label: "Concedii",
    icon: CalendarDays,
    match: (p) => p.startsWith("/concedii"),
  },
  {
    href: "/istoric",
    label: "Arhivă",
    icon: Archive,
    match: (p) => p.startsWith("/istoric"),
  },
];

function NavLink({
  href,
  label,
  icon: Icon,
  active,
  expanded,
  onNavigate,
  badge,
}: {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  active: boolean;
  expanded: boolean;
  onNavigate?: () => void;
  badge?: number;
}) {
  return (
    <Link
      href={href}
      title={expanded ? undefined : label}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={[
        "relative flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
        expanded ? "justify-start" : "justify-center",
        active
          ? "bg-sky-50 text-sky-800"
          : "text-slate-700 hover:bg-slate-100",
      ].join(" ")}
    >
      {active && (
        <span
          aria-hidden
          className="absolute top-1/2 left-0 h-5 w-0.5 -translate-y-1/2 rounded-full bg-sky-600"
        />
      )}
      <span className="relative shrink-0">
        <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
        {badge != null && badge > 0 && (
          <span className="absolute -top-1.5 -right-1.5 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-rose-500 px-0.5 text-[10px] font-bold text-white">
            {badge > 9 ? "9+" : badge}
          </span>
        )}
      </span>
      {expanded && <span className="truncate">{label}</span>}
    </Link>
  );
}

function SidebarPanel({
  expanded,
  onToggleExpanded,
  workspace,
  canSettings,
  showConturi,
  isDev,
  inviteCount,
  pathname,
  onNavigate,
  onLogout,
  showCollapseToggle,
}: {
  expanded: boolean;
  onToggleExpanded?: () => void;
  workspace: WorkspaceUiCache | null;
  canSettings: boolean;
  showConturi: boolean;
  isDev: boolean;
  inviteCount: number;
  pathname: string;
  onNavigate?: () => void;
  onLogout: () => void;
  showCollapseToggle: boolean;
}) {
  const initial = workspaceInitial(workspace?.nume ?? "");
  const wsLabel = workspace?.nume?.trim() || "Workspace";

  return (
    <div className="flex h-full flex-col bg-white">
      <div
        className={[
          "flex border-b border-slate-200 py-3",
          expanded
            ? "items-center gap-2 px-3"
            : "flex-col items-center gap-1.5 px-2",
        ].join(" ")}
      >
        <div
          title={wsLabel}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sm font-semibold text-sky-800"
        >
          {initial}
        </div>
        {expanded && (
          <p className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-900">
            {wsLabel}
          </p>
        )}
        {showCollapseToggle && onToggleExpanded && (
          <button
            type="button"
            onClick={onToggleExpanded}
            title={expanded ? "Restrânge meniul" : "Extinde meniul"}
            aria-label={expanded ? "Restrânge meniul" : "Extinde meniul"}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
          >
            {expanded ? (
              <PanelLeftClose className="h-4 w-4" strokeWidth={2} />
            ) : (
              <PanelLeftOpen className="h-4 w-4" strokeWidth={2} />
            )}
          </button>
        )}
      </div>

      <nav
        aria-label="Principal"
        className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2"
      >
        {MAIN_NAV.map((item) => (
          <NavLink
            key={item.href}
            href={item.href}
            label={item.label}
            icon={item.icon}
            active={item.match(pathname)}
            expanded={expanded}
            onNavigate={onNavigate}
          />
        ))}
        {canSettings && (
          <NavLink
            href="/setari"
            label="Setări"
            icon={Settings}
            active={pathname.startsWith("/setari")}
            expanded={expanded}
            onNavigate={onNavigate}
          />
        )}
        {showConturi && (
          <NavLink
            href="/conturi"
            label="Conturi"
            icon={Users}
            active={pathname.startsWith("/conturi")}
            expanded={expanded}
            onNavigate={onNavigate}
          />
        )}
      </nav>

      <div className="mt-auto flex flex-col gap-0.5 border-t border-slate-200 p-2">
        <PropunereButton
          title={expanded ? undefined : "Propune o îmbunătățire"}
          className={[
            "relative flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100",
            expanded ? "justify-start" : "justify-center",
          ].join(" ")}
        >
          <MessageSquarePlus className="h-[18px] w-[18px] shrink-0" strokeWidth={2} />
          {expanded && <span className="truncate">Propune o îmbunătățire</span>}
        </PropunereButton>

        {isDev && (
          <NavLink
            href="/dezvoltator/propuneri"
            label="Propuneri"
            icon={Inbox}
            active={pathname.startsWith("/dezvoltator")}
            expanded={expanded}
            onNavigate={onNavigate}
          />
        )}

        <NavLink
          href="/workspaces"
          label="Schimbă workspace"
          icon={ArrowLeftRight}
          active={false}
          expanded={expanded}
          onNavigate={onNavigate}
          badge={inviteCount}
        />

        <button
          type="button"
          title={expanded ? undefined : "Ieșire"}
          onClick={onLogout}
          className={[
            "flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100",
            expanded ? "justify-start" : "justify-center",
          ].join(" ")}
        >
          <LogOut className="h-[18px] w-[18px] shrink-0" strokeWidth={2} />
          {expanded && <span className="truncate">Ieșire</span>}
        </button>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const hideShell = pathname === "/login" || pathname === "/workspaces";

  const [expanded, setExpanded] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [workspace, setWorkspace] = useState<WorkspaceUiCache | null>(null);
  const [canSettings, setCanSettings] = useState(false);
  const [isDev, setIsDev] = useState(false);
  const [inviteCount, setInviteCount] = useState(0);

  useEffect(() => {
    setExpanded(readSidebarExpanded());
    setWorkspace(readWorkspaceUiCache());
  }, []);

  const loadMeta = useCallback(async () => {
    try {
      const [meRes, invRes, wsRes, genRes] = await Promise.all([
        fetch("/api/conturi/me"),
        fetch("/api/invitatii"),
        fetch("/api/workspaces"),
        fetch("/api/setari/general"),
      ]);

      if (
        handleUnauthorized(meRes) ||
        handleUnauthorized(invRes) ||
        handleUnauthorized(wsRes)
      ) {
        return;
      }

      if (meRes.ok) {
        const me = (await meRes.json()) as { user?: { isDev?: boolean } };
        setIsDev(Boolean(me.user?.isDev));
      } else {
        setIsDev(false);
      }

      if (invRes.ok) {
        const inv = (await invRes.json()) as { items?: unknown[] };
        setInviteCount(inv.items?.length ?? 0);
      }

      let items: WsItem[] = [];
      if (wsRes.ok) {
        const data = (await wsRes.json()) as { items?: WsItem[] };
        items = data.items ?? [];
      }

      const cache = readWorkspaceUiCache();
      let next: WorkspaceUiCache | null = null;

      if (genRes.ok) {
        const gen = (await genRes.json()) as { nume?: string };
        const nume = typeof gen.nume === "string" ? gen.nume : "";
        const matched =
          (cache && items.find((i) => i.id === cache.id)) ||
          items.find((i) => i.nume === nume) ||
          items[0];
        next = {
          id: matched?.id ?? cache?.id ?? "",
          nume: nume || matched?.nume || cache?.nume || "",
          poateModificaSetari: true,
        };
        setCanSettings(true);
      } else {
        setCanSettings(false);
        if (cache) {
          const matched = items.find((i) => i.id === cache.id);
          next = matched
            ? {
                id: matched.id,
                nume: matched.nume,
                poateModificaSetari: matched.poateModificaSetari,
              }
            : cache;
          setCanSettings(Boolean(matched?.poateModificaSetari ?? cache.poateModificaSetari));
        } else if (items.length === 1) {
          next = {
            id: items[0].id,
            nume: items[0].nume,
            poateModificaSetari: items[0].poateModificaSetari,
          };
          setCanSettings(items[0].poateModificaSetari);
        }
      }

      if (next) {
        setWorkspace(next);
        writeWorkspaceUiCache(next);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (hideShell) {
      setMobileOpen(false);
      return;
    }
    void loadMeta();
  }, [hideShell, pathname, loadMeta]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  function toggleExpanded() {
    setExpanded((prev) => {
      const next = !prev;
      writeSidebarExpanded(next);
      return next;
    });
  }

  async function onLogout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // ignore
    }
    router.replace("/login");
    router.refresh();
  }

  if (hideShell) {
    return <>{children}</>;
  }

  const isDevPage = pathname.startsWith("/dezvoltator");
  const showConturi = !isDevPage;

  const desktopWidth = expanded ? "md:w-[220px]" : "md:w-14";

  return (
    <div className="flex h-dvh min-h-0 flex-1">
      <aside
        className={[
          "sticky top-0 hidden h-dvh shrink-0 border-r border-slate-200 md:flex md:flex-col",
          desktopWidth,
        ].join(" ")}
      >
        <SidebarPanel
          expanded={expanded}
          onToggleExpanded={toggleExpanded}
          workspace={workspace}
          canSettings={canSettings}
          showConturi={showConturi}
          isDev={isDev}
          inviteCount={inviteCount}
          pathname={pathname}
          onLogout={() => void onLogout()}
          showCollapseToggle
        />
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            aria-label="Închide meniul"
            className="absolute inset-0 bg-slate-900/40"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute top-0 left-0 flex h-full w-[220px] flex-col border-r border-slate-200 bg-white shadow-lg">
            <div className="flex items-center justify-end border-b border-slate-100 px-2 py-2">
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                aria-label="Închide"
              >
                <X className="h-5 w-5" strokeWidth={2} />
              </button>
            </div>
            <SidebarPanel
              expanded
              workspace={workspace}
              canSettings={canSettings}
              showConturi={showConturi}
              isDev={isDev}
              inviteCount={inviteCount}
              pathname={pathname}
              onNavigate={() => setMobileOpen(false)}
              onLogout={() => void onLogout()}
              showCollapseToggle={false}
            />
          </aside>
        </div>
      )}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="sticky top-0 z-30 flex items-center gap-2 border-b border-slate-200 bg-white/95 px-2 py-2 backdrop-blur md:hidden">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="rounded-lg p-2 text-slate-700 hover:bg-slate-100"
            aria-label="Deschide meniul"
          >
            <Menu className="h-5 w-5" strokeWidth={2} />
          </button>
          <span className="truncate text-sm font-semibold text-slate-800">
            {workspace?.nume?.trim() || "Grila ATI"}
          </span>
        </div>
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      </div>
    </div>
  );
}
