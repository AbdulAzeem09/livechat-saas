"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  Bell,
  Bot,
  Building2,
  ChevronDown,
  CircleUserRound,
  Clock3,
  Inbox,
  LifeBuoy,
  LogOut,
  MessageSquareText,
  PanelLeft,
  Search,
  Settings,
  Tags,
  Ticket,
  UsersRound
} from "lucide-react";
import { getCurrentUser, listOrganizations } from "@/lib/api";
import { initials } from "@/lib/format";
import { clearSession, readSession, type StoredSession } from "@/lib/session";
import type { AuthUser, Organization } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/status-pill";

const navItems = [
  { label: "Inbox", icon: Inbox, active: true },
  { label: "Visitors", icon: CircleUserRound },
  { label: "Contacts", icon: UsersRound },
  { label: "Tickets", icon: Ticket },
  { label: "Tags", icon: Tags },
  { label: "Reports", icon: BarChart3 },
  { label: "Automation", icon: Bot },
  { label: "Settings", icon: Settings }
];

const conversations = [
  {
    name: "Maya Chen",
    company: "Northstar Studio",
    message: "Can you confirm the annual plan includes chat archives?",
    status: "Open",
    time: "2m"
  },
  {
    name: "Omar Farooq",
    company: "RetailOps",
    message: "The widget install script is ready for review.",
    status: "Queued",
    time: "6m"
  },
  {
    name: "Sara Malik",
    company: "BlueCart",
    message: "Sharing the checkout screenshot now.",
    status: "Pending",
    time: "14m"
  }
];

const metrics = [
  { label: "Open chats", value: "18", delta: "+6" },
  { label: "First response", value: "41s", delta: "-12s" },
  { label: "Rating", value: "94%", delta: "+3%" },
  { label: "Online agents", value: "7", delta: "+2" }
];

export function DashboardShell() {
  const router = useRouter();
  const [session, setSession] = useState<StoredSession | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const currentSession = readSession();

    if (!currentSession) {
      router.replace("/login");
      return;
    }

    setSession(currentSession);
    const accessToken = currentSession.accessToken;

    async function loadWorkspace() {
      try {
        const [currentUser, orgs] = await Promise.all([
          getCurrentUser(accessToken),
          listOrganizations(accessToken)
        ]);
        setUser(currentUser);
        setOrganizations(orgs);
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : "Unable to load workspace");
      } finally {
        setIsLoading(false);
      }
    }

    void loadWorkspace();
  }, [router]);

  const activeOrganization = useMemo(() => organizations[0], [organizations]);

  function handleLogout() {
    clearSession();
    router.replace("/login");
  }

  if (isLoading) {
    return (
      <main className="grid min-h-screen place-items-center bg-surface p-6">
        <div className="rounded-md border border-line bg-white p-6 text-sm font-semibold text-ink-800 shadow-panel">
          Loading workspace
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-surface text-ink-950">
      <div className="flex min-h-screen">
        <aside
          className={[
            "fixed inset-y-0 left-0 z-30 flex w-[272px] flex-col border-r border-line bg-white transition-transform lg:static lg:translate-x-0",
            isSidebarOpen ? "translate-x-0" : "-translate-x-full"
          ].join(" ")}
        >
          <div className="flex h-16 items-center gap-3 border-b border-line px-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-brand-700 text-white">
              <MessageSquareText className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <p className="text-sm font-semibold">LiveChat SaaS</p>
              <p className="text-xs text-ink-500">Agent workspace</p>
            </div>
          </div>

          <div className="border-b border-line p-4">
            <button className="flex w-full items-center justify-between rounded-md border border-line bg-surface px-3 py-2 text-left">
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">
                  {activeOrganization?.name ?? "No organization"}
                </span>
                <span className="block truncate text-xs text-ink-500">
                  {activeOrganization?.slug ?? "workspace"}
                </span>
              </span>
              <ChevronDown className="h-4 w-4 shrink-0 text-ink-500" aria-hidden />
            </button>
          </div>

          <nav className="flex-1 space-y-1 overflow-y-auto p-3">
            {navItems.map((item) => (
              <button
                className={[
                  "flex h-10 w-full items-center gap-3 rounded-md px-3 text-sm font-semibold transition",
                  item.active
                    ? "bg-brand-500/10 text-brand-700"
                    : "text-ink-600 hover:bg-surface hover:text-ink-950"
                ].join(" ")}
                key={item.label}
              >
                <item.icon className="h-4 w-4" aria-hidden />
                {item.label}
              </button>
            ))}
          </nav>

          <div className="border-t border-line p-4">
            <div className="flex items-center gap-3 rounded-md bg-surface p-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-ink-950 text-sm font-bold text-white">
                {user ? initials(user.name, user.email) : "LC"}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{user?.name ?? session?.user.name}</p>
                <p className="truncate text-xs text-ink-500">{user?.email ?? session?.user.email}</p>
              </div>
              <button
                aria-label="Log out"
                className="rounded-md p-2 text-ink-500 hover:bg-white hover:text-ink-950"
                onClick={handleLogout}
              >
                <LogOut className="h-4 w-4" aria-hidden />
              </button>
            </div>
          </div>
        </aside>

        {isSidebarOpen ? (
          <button
            aria-label="Close navigation"
            className="fixed inset-0 z-20 bg-ink-950/30 lg:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        ) : null}

        <section className="min-w-0 flex-1">
          <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-line bg-white/95 px-4 backdrop-blur lg:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <button
                aria-label="Open navigation"
                className="rounded-md border border-line bg-white p-2 text-ink-600 lg:hidden"
                onClick={() => setIsSidebarOpen(true)}
              >
                <PanelLeft className="h-4 w-4" aria-hidden />
              </button>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink-950">Agent dashboard</p>
                <p className="truncate text-xs text-ink-500">
                  {activeOrganization?.status ?? "Workspace"} - {activeOrganization?.planCode ?? "plan"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                aria-label="Search"
                className="hidden h-10 items-center gap-2 rounded-md border border-line bg-white px-3 text-sm font-medium text-ink-500 sm:flex"
              >
                <Search className="h-4 w-4" aria-hidden />
                Search
              </button>
              <button
                aria-label="Notifications"
                className="rounded-md border border-line bg-white p-2.5 text-ink-600"
              >
                <Bell className="h-4 w-4" aria-hidden />
              </button>
            </div>
          </header>

          <div className="grid gap-5 p-4 lg:p-6">
            {error ? (
              <div className="rounded-md border border-coral-500/30 bg-coral-500/10 px-4 py-3 text-sm font-medium text-coral-500">
                {error}
              </div>
            ) : null}

            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {metrics.map((metric) => (
                <article
                  className="rounded-md border border-line bg-white p-4 shadow-sm"
                  key={metric.label}
                >
                  <p className="text-sm font-medium text-ink-500">{metric.label}</p>
                  <div className="mt-3 flex items-end justify-between gap-3">
                    <p className="text-3xl font-semibold tracking-normal text-ink-950">
                      {metric.value}
                    </p>
                    <StatusPill tone="green">{metric.delta}</StatusPill>
                  </div>
                </article>
              ))}
            </section>

            <section className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
              <article className="rounded-md border border-line bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-line p-4">
                  <div>
                    <h2 className="text-base font-semibold">Inbox</h2>
                    <p className="text-sm text-ink-500">Open and queued conversations</p>
                  </div>
                  <StatusPill tone="amber">Live</StatusPill>
                </div>
                <div className="divide-y divide-line">
                  {conversations.map((conversation) => (
                    <button
                      className="grid w-full gap-2 p-4 text-left transition hover:bg-surface sm:grid-cols-[1fr_auto]"
                      key={conversation.name}
                    >
                      <span className="min-w-0">
                        <span className="flex items-center gap-2">
                          <span className="truncate text-sm font-semibold text-ink-950">
                            {conversation.name}
                          </span>
                          <span className="text-xs text-ink-500">{conversation.company}</span>
                        </span>
                        <span className="mt-1 block truncate text-sm text-ink-600">
                          {conversation.message}
                        </span>
                      </span>
                      <span className="flex items-center gap-2 sm:justify-end">
                        <StatusPill
                          tone={conversation.status === "Open" ? "green" : "gray"}
                        >
                          {conversation.status}
                        </StatusPill>
                        <span className="text-xs font-semibold text-ink-500">
                          {conversation.time}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              </article>

              <aside className="grid gap-5">
                <article className="rounded-md border border-line bg-white p-4 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-md bg-brand-500/10 text-brand-700">
                      <Building2 className="h-5 w-5" aria-hidden />
                    </div>
                    <div>
                      <h2 className="text-base font-semibold">Workspace</h2>
                      <p className="text-sm text-ink-500">
                        {organizations.length} organization{organizations.length === 1 ? "" : "s"}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-2">
                    {organizations.map((organization) => (
                      <div
                        className="flex items-center justify-between rounded-md border border-line px-3 py-2"
                        key={organization.id}
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold">
                            {organization.name}
                          </span>
                          <span className="block truncate text-xs text-ink-500">
                            {organization.slug}
                          </span>
                        </span>
                        <StatusPill tone="green">{organization.status}</StatusPill>
                      </div>
                    ))}
                  </div>
                </article>

                <article className="rounded-md border border-line bg-ink-950 p-4 text-white shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-md bg-white/10">
                      <Clock3 className="h-5 w-5 text-brand-500" aria-hidden />
                    </div>
                    <div>
                      <h2 className="text-base font-semibold">Queue health</h2>
                      <p className="text-sm text-white/60">Response target under 60s</p>
                    </div>
                  </div>
                  <div className="mt-5 h-2 rounded-full bg-white/10">
                    <div className="h-2 w-[68%] rounded-full bg-brand-500" />
                  </div>
                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <Button className="bg-white text-ink-950 hover:bg-white/90" variant="secondary">
                      Take chat
                    </Button>
                    <Button variant="ghost">View queue</Button>
                  </div>
                </article>

                <article className="rounded-md border border-line bg-white p-4 shadow-sm">
                  <div className="flex items-center gap-3">
                    <LifeBuoy className="h-5 w-5 text-brand-700" aria-hidden />
                    <h2 className="text-base font-semibold">Next modules</h2>
                  </div>
                  <div className="mt-4 grid gap-2 text-sm text-ink-600">
                    <p>Realtime gateway</p>
                    <p>Visitor widget</p>
                    <p>Conversation APIs</p>
                  </div>
                </article>
              </aside>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}
