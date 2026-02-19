import { useQuery } from "@tanstack/react-query";
import { Bell, ChevronLeft, ChevronRight, LogOut, MessageSquare, Search, Settings } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { getAccounts } from "../api/backend";
import { useAuth } from "../auth/AuthProvider";
import { ChatWidget } from "../components/ChatWidget";
import { APP_MAIN_NAV_ITEMS } from "../config/navigation";
import type { AppSubNavItem } from "../config/navigation";
import { buildFallbackAccountFromSession } from "../lib/accountFallback";
import { getAvatarColor, getUserInitials } from "../lib/avatar";

type AppLayoutProps = {
  userName: string;
};

type TeamPreviewMember = {
  id: string;
  name: string;
  email: string | null;
  position: string | null;
  avatarUrl: string | null;
  isOnline: boolean;
};

function sidebarNavClassName(isActive: boolean) {
  if (isActive) {
    return "group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-white shadow-sm shadow-sky-900/25 transition-colors bg-sky-500";
  }

  return "group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-slate-200 transition-colors hover:bg-sky-500/15 hover:text-white";
}

function railIconClassName(isActive: boolean) {
  if (isActive) {
    return "flex h-10 w-10 items-center justify-center rounded-lg bg-sky-500 text-white shadow-md shadow-sky-900/25 transition-all duration-300";
  }

  return "flex h-10 w-10 items-center justify-center rounded-lg text-slate-300 transition-all duration-300 hover:bg-sky-500/12 hover:text-white";
}

function mobileNavClassName(isActive: boolean) {
  if (isActive) {
    return "inline-flex items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-medium text-sky-700";
  }

  return "inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600";
}

function mobileSubNavClassName(isActive: boolean) {
  if (isActive) {
    return "inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-slate-900 px-3 py-2 text-sm font-medium text-white";
  }

  return "inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600";
}

function getActiveMainNavItem(pathname: string) {
  const exactMatch = APP_MAIN_NAV_ITEMS.find((item) => item.to === pathname);
  if (exactMatch) {
    return exactMatch;
  }

  return APP_MAIN_NAV_ITEMS.find((item) => pathname.startsWith(`${item.to}/`)) ?? APP_MAIN_NAV_ITEMS[0];
}

function getActiveSubNavItem(pathname: string, subItems: AppSubNavItem[]) {
  const exactMatch = subItems.find((item) => item.to === pathname);
  if (exactMatch) {
    return exactMatch;
  }

  return subItems.find((item) => pathname.startsWith(`${item.to}/`)) ?? subItems[0];
}

export function AppLayout({ userName }: AppLayoutProps) {
  const { session, isUserOnline, signOut } = useAuth();
  const location = useLocation();
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);
  const [pendingChatUser, setPendingChatUser] = useState<{ id: string; name: string; avatarUrl: string | null; isOnline: boolean } | null>(null);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!isUserMenuOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => { document.removeEventListener("mousedown", handleClickOutside); };
  }, [isUserMenuOpen]);
  const activeMainNavItem = useMemo(() => getActiveMainNavItem(location.pathname), [location.pathname]);
  const activeSubNavItem = useMemo(
    () => getActiveSubNavItem(location.pathname, activeMainNavItem.subItems),
    [location.pathname, activeMainNavItem]
  );
  const railMainItems = useMemo(() => APP_MAIN_NAV_ITEMS.filter((item) => item.to !== "/account"), []);
  const settingsRailItem = useMemo(() => APP_MAIN_NAV_ITEMS.find((item) => item.to === "/account"), []);
  const userInitials = useMemo(() => getUserInitials(userName), [userName]);
  const fallbackAccount = useMemo(
    () => buildFallbackAccountFromSession(session, userName),
    [session, userName]
  );
  const accountsQuery = useQuery({
    queryKey: ["accounts-list", session?.access_token],
    queryFn: () => getAccounts(session!.access_token),
    enabled: Boolean(session?.access_token),
    refetchInterval: 15000
  });
  const teamPreviewMembers = useMemo<TeamPreviewMember[]>(
    () =>
      ((accountsQuery.data?.accounts && accountsQuery.data.accounts.length > 0
        ? accountsQuery.data.accounts
        : fallbackAccount
          ? [fallbackAccount]
          : []) ?? [])
        .map((account) => ({
          id: account.id,
          name: account.name,
          email: account.email,
          position: account.position,
          avatarUrl: account.avatarUrl,
          isOnline: isUserOnline(account.id)
        }))
        .sort((left, right) => Number(right.isOnline) - Number(left.isOnline) || left.name.localeCompare(right.name)),
    [accountsQuery.data?.accounts, fallbackAccount, isUserOnline]
  );
  return (
    <div className="min-h-screen bg-slate-100">
      <aside
        className={`fixed inset-y-4 left-4 hidden transition-all duration-300 lg:block ${
          isSidebarExpanded ? "w-[380px]" : "w-16"
        }`}
      >
        <div
          className={`group relative flex h-[calc(100vh-2rem)] overflow-visible rounded-2xl transition-all duration-300 ${
            isSidebarExpanded ? "w-[380px]" : "w-16"
          }`}
          style={{
            boxShadow: "0 8px 24px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.08)"
          }}
        >
          <div
            className="flex w-16 flex-shrink-0 flex-col items-center gap-2.5 rounded-l-[15px] rounded-r-[0px] bg-slate-950 px-[10px] py-6"
            style={{ boxShadow: "2px 0 8px rgba(0, 0, 0, 0.06)" }}
          >
            <button
              type="button"
              className="group relative flex h-[52px] w-[52px] flex-shrink-0 items-center justify-center rounded-xl bg-sky-500/60 p-2 text-sm font-bold text-white transition-all duration-300 hover:scale-110 hover:ring-2 hover:ring-sky-400/40"
              title="Dem-Bud logo"
            >
              DB
              <span className="pointer-events-none absolute left-full ml-2 whitespace-nowrap rounded bg-slate-900 px-2 py-1 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
                Dem-Bud
              </span>
            </button>

            <div className="mt-0 flex flex-1 flex-col gap-3 rounded-[20px] bg-slate-900 px-[4px] pb-0 pt-[10px]">
              {railMainItems.map((item) => {
                const Icon = item.icon;

                return (
                  <NavLink key={item.to} to={item.to} className={({ isActive }) => railIconClassName(isActive)} title={item.label}>
                    <Icon className="h-5 w-5" />
                  </NavLink>
                );
              })}
            </div>

            {settingsRailItem && (
              <NavLink
                to={settingsRailItem.to}
                className={({ isActive }) =>
                  `mt-1 ${railIconClassName(isActive)}`
                }
                title={settingsRailItem.label}
              >
                <settingsRailItem.icon className="h-5 w-5" />
              </NavLink>
            )}
          </div>

          {isSidebarExpanded && (
            <div
              className="relative ml-[1px] flex flex-1 flex-col overflow-hidden rounded-l-[0px] rounded-r-[15px] bg-[#111827] p-4 text-slate-100"
              style={{ borderLeft: "1px solid rgba(71, 85, 105, 0.5)" }}
            >
              <button
                type="button"
                onClick={() => setIsSidebarExpanded(false)}
                className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition-all hover:border-sky-500 hover:text-sky-600"
                title="Ukryj menu"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <div className="mb-4 shrink-0 border-b border-slate-700/70 pb-4">
                <div className="mb-2 flex items-center gap-3">
                  <div className={`grid h-12 w-12 place-items-center rounded-full text-sm font-semibold text-white ring-2 ring-sky-500/25 ${getAvatarColor(userName)}`}>
                    {userInitials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-100">{userName}</p>
                    <p className="truncate text-xs text-slate-300">Kierownik projektu</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void signOut()}
                    title="Wyloguj"
                    className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-red-500/15 hover:text-red-400"
                  >
                    <LogOut className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="mb-4 shrink-0">
                <h2 className="text-lg font-semibold text-slate-100">{activeMainNavItem.label}</h2>
                <p className="mt-1 text-xs text-slate-400">Podsekcja: {activeSubNavItem?.label}</p>
              </div>

              <div className="flex flex-1 flex-col overflow-hidden">
                <div className="mb-6 shrink-0">
                  <h3 className="mb-3 text-xs uppercase tracking-wider text-slate-400">Nawigacja</h3>
                  <div className="space-y-1">
                    {activeMainNavItem.subItems.map((item) => {
                      const Icon = item.icon;

                      return (
                        <NavLink key={item.to} to={item.to} className={({ isActive }) => sidebarNavClassName(isActive)}>
                          {({ isActive }) => (
                            <>
                              <Icon className="h-4 w-4 flex-shrink-0" />
                              <div className="min-w-0 flex-1 text-left">
                                <p className="truncate text-sm font-medium leading-5">{item.label}</p>
                                <p className={`truncate text-[11px] leading-4 ${isActive ? "text-sky-100" : "text-slate-400"}`}>
                                  {item.description}
                                </p>
                              </div>
                              {item.badge && (
                                <span
                                  className={`min-w-[20px] flex-shrink-0 rounded-full px-2 py-0.5 text-center text-xs font-semibold ${
                                    isActive ? "bg-white/20 text-white" : "bg-red-500 text-white"
                                  }`}
                                >
                                  {item.badge}
                                </span>
                              )}
                            </>
                          )}
                        </NavLink>
                      );
                    })}
                  </div>
                </div>

                <div className="flex flex-1 flex-col overflow-hidden">
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-xs uppercase tracking-wider text-slate-400">Zespol</h3>
                    <span className="text-xs text-slate-400">
                      {accountsQuery.isLoading ? "..." : `${teamPreviewMembers.length} Osoby`}
                    </span>
                  </div>

                  <div className="-mr-4 flex-1 overflow-y-auto pr-4">
                    <div className="space-y-1.5 pb-4">
                      {accountsQuery.isLoading && (
                        <p className="rounded-lg bg-slate-800/40 p-2 text-xs text-slate-400">Ladowanie listy kont...</p>
                      )}

                      {accountsQuery.isError && (
                        <p className="rounded-lg bg-red-500/10 p-2 text-xs text-red-200">
                          Nie udalo sie pobrac pelnej listy kont. Wyswietlam konto biezacego uzytkownika.
                        </p>
                      )}

                      {!accountsQuery.isLoading && !accountsQuery.isError && teamPreviewMembers.length === 0 && (
                        <p className="rounded-lg bg-slate-800/40 p-2 text-xs text-slate-400">Brak kont do wyswietlenia.</p>
                      )}

                      {teamPreviewMembers.slice(0, 10).map((member) => {
                        const roleClassName = member.isOnline
                          ? "bg-emerald-500/15 text-emerald-200"
                          : "bg-slate-500/15 text-slate-300";
                        const memberLabel =
                          member.id === session?.user.id ? `${member.name} (Ty)` : member.name;

                        return (
                          <button
                            key={member.id}
                            type="button"
                            onClick={() => {
                              if (member.id !== session?.user.id) {
                                setPendingChatUser(member);
                              }
                            }}
                            className="group/item flex w-full items-center justify-between rounded-lg p-2 text-left transition-all hover:bg-sky-500"
                          >
                            <div className="flex min-w-0 items-center gap-3">
                              <div className="relative h-9 w-9 flex-shrink-0">
                                {member.avatarUrl ? (
                                  <img
                                    src={member.avatarUrl}
                                    alt={memberLabel}
                                    className="h-9 w-9 rounded-full border border-slate-700 object-cover"
                                  />
                                ) : (
                                  <div className={`grid h-9 w-9 place-items-center rounded-full text-xs font-semibold text-white ${getAvatarColor(member.name)}`}>
                                    {getUserInitials(member.name)}
                                  </div>
                                )}
                                <span
                                  className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border border-slate-900 ${
                                    member.isOnline ? "bg-emerald-400" : "bg-slate-500"
                                  }`}
                                />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium text-slate-100 group-hover/item:text-white">
                                  {memberLabel}
                                </p>
                                <div className="flex items-center gap-2">
                                  <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] ${roleClassName}`}>
                                    {member.position ?? "Uzytkownik"}
                                  </span>
                                  <span className="text-[10px] text-slate-400">{member.isOnline ? "Online" : "Offline"}</span>
                                </div>
                              </div>
                            </div>
                            <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-slate-700/40 text-slate-300 opacity-0 transition-all group-hover/item:opacity-100">
                              <MessageSquare className="h-4 w-4" />
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {!isSidebarExpanded && (
            <div className="absolute -right-3 top-1/2 z-20 -translate-y-1/2 opacity-0 transition-opacity group-hover:opacity-100">
              <button
                type="button"
                onClick={() => setIsSidebarExpanded(true)}
                className="relative flex h-7 w-7 items-center justify-center rounded-full border border-slate-200/60 bg-white text-sky-600 shadow-sm transition-all hover:scale-110 hover:border-sky-500 hover:bg-sky-500 hover:text-white"
                title="Rozwin menu"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      </aside>

      <div
        className={`min-h-screen px-3 pb-6 pt-3 transition-all duration-300 lg:px-4 lg:pt-4 ${
          isSidebarExpanded ? "lg:ml-[404px]" : "lg:ml-[88px]"
        }`}
      >
        <header className="sticky top-3 z-30 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.09)] backdrop-blur lg:top-4">
          <div className="h-16 border-b border-slate-200/90 px-4 lg:px-5">
            <div className="flex h-full items-center justify-between gap-3">
              <div className="relative hidden w-full max-w-xl md:block">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Szukaj projektow, zadan i dokumentow..."
                  className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm text-slate-700 outline-none transition focus:border-sky-300 focus:bg-white focus:ring-2 focus:ring-sky-100"
                />
              </div>

              <div className="ml-auto flex items-center gap-2 sm:gap-3">
                <button
                  type="button"
                  className="grid h-9 w-9 place-items-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                  title="Powiadomienia"
                >
                  <Bell className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  className="grid h-9 w-9 place-items-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                  title="Wiadomosci"
                >
                  <MessageSquare className="h-5 w-5" />
                </button>
                <div ref={userMenuRef} className="relative hidden sm:block">
                  <button
                    type="button"
                    onClick={() => { setIsUserMenuOpen((prev) => !prev); }}
                    className="flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-1.5 transition hover:bg-slate-200"
                  >
                    <div className={`grid h-7 w-7 place-items-center rounded-full text-xs font-semibold text-white ${getAvatarColor(userName)}`}>
                      {userInitials}
                    </div>
                    <p className="text-sm font-medium text-slate-700">Czesc, {userName}</p>
                  </button>

                  {isUserMenuOpen && (
                    <div className="absolute right-0 top-full z-50 mt-2 w-48 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                      <NavLink
                        to="/account"
                        onClick={() => { setIsUserMenuOpen(false); }}
                        className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 transition hover:bg-slate-50"
                      >
                        <Settings className="h-4 w-4 text-slate-400" />
                        Ustawienia konta
                      </NavLink>
                      <div className="mx-3 border-t border-slate-100" />
                      <button
                        type="button"
                        onClick={() => { setIsUserMenuOpen(false); void signOut(); }}
                        className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 transition hover:bg-red-50"
                      >
                        <LogOut className="h-4 w-4" />
                        Wyloguj
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-100 px-4 py-3 lg:hidden">
            <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-slate-500">Sekcje</p>
            <nav className="mt-2 flex gap-2 overflow-x-auto pb-1">
              {APP_MAIN_NAV_ITEMS.map((item) => {
                const Icon = item.icon;

                return (
                  <NavLink key={item.to} to={item.to} className={({ isActive }) => mobileNavClassName(isActive)}>
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </nav>

            <p className="mt-3 text-[11px] font-medium uppercase tracking-[0.12em] text-slate-500">Podsekcje</p>
            <nav className="mt-2 flex gap-2 overflow-x-auto pb-1">
              {activeMainNavItem.subItems.map((item) => {
                const Icon = item.icon;

                return (
                  <NavLink key={item.to} to={item.to} className={({ isActive }) => mobileSubNavClassName(isActive)}>
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </nav>
          </div>
        </header>

        <main className="mt-4">
          <Outlet />
        </main>
      </div>

      <ChatWidget
        chatUsers={teamPreviewMembers.map((m) => ({
          id: m.id,
          name: m.name,
          avatarUrl: m.avatarUrl,
          isOnline: m.isOnline,
        }))}
        pendingUser={pendingChatUser}
        onPendingUserConsumed={() => setPendingChatUser(null)}
      />
    </div>
  );
}
