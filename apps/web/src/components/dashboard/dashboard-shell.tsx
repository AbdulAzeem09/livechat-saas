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
  Plus,
  RefreshCcw,
  Search,
  SendHorizontal,
  Settings,
  Tags,
  Ticket,
  UsersRound
} from "lucide-react";
import {
  createConversation,
  getCurrentUser,
  listConversations,
  listMessages,
  listOrganizations,
  sendMessage
} from "@/lib/api";
import { initials } from "@/lib/format";
import { clearSession, readSession, type StoredSession } from "@/lib/session";
import type {
  AuthUser,
  Conversation,
  ConversationStatus,
  Message,
  Organization
} from "@/lib/types";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/status-pill";

const navItems = [
  { label: "Inbox", icon: Inbox },
  { label: "Visitors", icon: CircleUserRound },
  { label: "Contacts", icon: UsersRound },
  { label: "Tickets", icon: Ticket },
  { label: "Tags", icon: Tags },
  { label: "Reports", icon: BarChart3 },
  { label: "Automation", icon: Bot },
  { label: "Settings", icon: Settings }
] as const;

type DashboardView = (typeof navItems)[number]["label"];

export function DashboardShell() {
  const router = useRouter();
  const [session, setSession] = useState<StoredSession | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<DashboardView>("Inbox");
  const [searchQuery, setSearchQuery] = useState("");
  const [composer, setComposer] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isConversationsLoading, setIsConversationsLoading] = useState(false);
  const [isMessagesLoading, setIsMessagesLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isOrgMenuOpen, setIsOrgMenuOpen] = useState(false);

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
        const primaryOrganization = orgs[0];

        setUser(currentUser);
        setOrganizations(orgs);

        if (primaryOrganization) {
          const loadedConversations = await listConversations(primaryOrganization.id, accessToken, {
            limit: 50
          });
          const firstConversation = loadedConversations[0];

          setConversations(loadedConversations);
          setSelectedConversationId(firstConversation?.id ?? null);

          if (firstConversation) {
            setMessages(await listMessages(primaryOrganization.id, firstConversation.id, accessToken));
          }
        }
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : "Unable to load workspace");
      } finally {
        setIsLoading(false);
      }
    }

    void loadWorkspace();
  }, [router]);

  const activeOrganization = organizations[0];
  const selectedConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === selectedConversationId) ?? null,
    [conversations, selectedConversationId]
  );
  const filteredConversations = conversations.filter((conversation) => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) {
      return true;
    }

    return [
      conversation.subject,
      conversation.status,
      conversation.priority,
      conversation.latestMessage?.body
    ]
      .filter(Boolean)
      .some((value) => value?.toLowerCase().includes(query));
  });
  const metrics = buildMetrics(conversations, organizations);

  function handleLogout() {
    clearSession();
    router.replace("/login");
  }

  async function refreshConversations() {
    if (!session || !activeOrganization) {
      return;
    }

    setIsConversationsLoading(true);
    setError("");

    try {
      const loadedConversations = await listConversations(activeOrganization.id, session.accessToken, {
        limit: 50
      });
      const nextSelectedId =
        selectedConversationId && loadedConversations.some((item) => item.id === selectedConversationId)
          ? selectedConversationId
          : loadedConversations[0]?.id ?? null;

      setConversations(loadedConversations);
      setSelectedConversationId(nextSelectedId);

      if (nextSelectedId) {
        setMessages(await listMessages(activeOrganization.id, nextSelectedId, session.accessToken));
      } else {
        setMessages([]);
      }

      setNotice("Inbox refreshed");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to refresh conversations");
    } finally {
      setIsConversationsLoading(false);
    }
  }

  async function handleCreateConversation() {
    if (!session || !activeOrganization) {
      setError("Create an organization first");
      return;
    }

    setIsCreating(true);
    setError("");

    try {
      const createdConversation = await createConversation(
        activeOrganization.id,
        session.accessToken,
        {
          initialMessage: "Hi, this manual chat is ready for testing.",
          priority: "NORMAL",
          source: "MANUAL",
          subject: `Manual chat ${new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit"
          })}`
        }
      );

      setConversations((currentConversations) => [
        createdConversation,
        ...currentConversations.filter((conversation) => conversation.id !== createdConversation.id)
      ]);
      setSelectedConversationId(createdConversation.id);
      setMessages(createdConversation.latestMessage ? [createdConversation.latestMessage] : []);
      setActiveView("Inbox");
      setNotice("New chat created");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to create chat");
    } finally {
      setIsCreating(false);
    }
  }

  async function handleSelectConversation(conversationId: string) {
    if (!session || !activeOrganization) {
      return;
    }

    setSelectedConversationId(conversationId);
    setIsMessagesLoading(true);
    setError("");

    try {
      setMessages(await listMessages(activeOrganization.id, conversationId, session.accessToken));
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to load messages");
    } finally {
      setIsMessagesLoading(false);
    }
  }

  async function handleSendMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!session || !activeOrganization || !selectedConversation) {
      setError("Select a conversation first");
      return;
    }

    const body = composer.trim();

    if (!body) {
      return;
    }

    setIsSending(true);
    setError("");

    try {
      const sentMessage = await sendMessage(
        activeOrganization.id,
        selectedConversation.id,
        session.accessToken,
        {
          body,
          idempotencyKey: `agent-${Date.now()}`
        }
      );

      setMessages((currentMessages) => [...currentMessages, sentMessage]);
      setConversations((currentConversations) =>
        currentConversations.map((conversation) =>
          conversation.id === sentMessage.conversationId
            ? {
                ...conversation,
                latestMessage: sentMessage,
                lastMessageAt: sentMessage.createdAt
              }
            : conversation
        )
      );
      setComposer("");
      setNotice("Message sent");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to send message");
    } finally {
      setIsSending(false);
    }
  }

  function handleNavChange(view: DashboardView) {
    setActiveView(view);
    setIsSidebarOpen(false);
    setNotice(view === "Inbox" ? "Inbox opened" : `${view} module selected`);
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
            <button
              className="flex w-full items-center justify-between rounded-md border border-line bg-surface px-3 py-2 text-left"
              onClick={() => setIsOrgMenuOpen((isOpen) => !isOpen)}
              type="button"
            >
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
            {isOrgMenuOpen ? (
              <div className="mt-2 rounded-md border border-line bg-white p-2 text-xs text-ink-600">
                {organizations.length ? (
                  organizations.map((organization) => (
                    <div className="rounded-md px-2 py-1.5" key={organization.id}>
                      <span className="block font-semibold text-ink-950">{organization.name}</span>
                      <span>{organization.status} plan</span>
                    </div>
                  ))
                ) : (
                  <p className="px-2 py-1.5">No organizations loaded</p>
                )}
              </div>
            ) : null}
          </div>

          <nav className="flex-1 space-y-1 overflow-y-auto p-3">
            {navItems.map((item) => (
              <button
                className={[
                  "flex h-10 w-full items-center gap-3 rounded-md px-3 text-sm font-semibold transition",
                  activeView === item.label
                    ? "bg-brand-500/10 text-brand-700"
                    : "text-ink-600 hover:bg-surface hover:text-ink-950"
                ].join(" ")}
                key={item.label}
                onClick={() => handleNavChange(item.label)}
                type="button"
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
                type="button"
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
            type="button"
          />
        ) : null}

        <section className="min-w-0 flex-1">
          <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-line bg-white/95 px-4 backdrop-blur lg:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <button
                aria-label="Open navigation"
                className="rounded-md border border-line bg-white p-2 text-ink-600 lg:hidden"
                onClick={() => setIsSidebarOpen(true)}
                type="button"
              >
                <PanelLeft className="h-4 w-4" aria-hidden />
              </button>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink-950">{activeView}</p>
                <p className="truncate text-xs text-ink-500">
                  {activeOrganization?.status ?? "Workspace"} - {activeOrganization?.planCode ?? "plan"}
                </p>
              </div>
            </div>
            <div className="flex min-w-0 items-center gap-2">
              <label className="hidden h-10 min-w-[220px] items-center gap-2 rounded-md border border-line bg-white px-3 text-sm font-medium text-ink-500 sm:flex">
                <Search className="h-4 w-4 shrink-0" aria-hidden />
                <input
                  className="min-w-0 flex-1 bg-transparent text-sm text-ink-950 outline-none placeholder:text-ink-500"
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search chats"
                  value={searchQuery}
                />
              </label>
              <button
                aria-label="Notifications"
                className="rounded-md border border-line bg-white p-2.5 text-ink-600"
                onClick={() => setNotice("No unread notifications")}
                type="button"
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
            {notice ? (
              <div className="rounded-md border border-brand-500/30 bg-brand-500/10 px-4 py-3 text-sm font-medium text-brand-700">
                {notice}
              </div>
            ) : null}

            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {metrics.map((metric) => (
                <article className="rounded-md border border-line bg-white p-4 shadow-sm" key={metric.label}>
                  <p className="text-sm font-medium text-ink-500">{metric.label}</p>
                  <div className="mt-3 flex items-end justify-between gap-3">
                    <p className="text-3xl font-semibold tracking-normal text-ink-950">
                      {metric.value}
                    </p>
                    <StatusPill tone={metric.tone}>{metric.delta}</StatusPill>
                  </div>
                </article>
              ))}
            </section>

            {activeView === "Inbox" ? (
              <section className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
                <article className="rounded-md border border-line bg-white shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-4">
                    <div>
                      <h2 className="text-base font-semibold">Inbox</h2>
                      <p className="text-sm text-ink-500">
                        {filteredConversations.length} conversation
                        {filteredConversations.length === 1 ? "" : "s"}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        icon={<RefreshCcw className="h-4 w-4" aria-hidden />}
                        isLoading={isConversationsLoading}
                        onClick={() => void refreshConversations()}
                        type="button"
                        variant="secondary"
                      >
                        Refresh
                      </Button>
                      <Button
                        icon={<Plus className="h-4 w-4" aria-hidden />}
                        isLoading={isCreating}
                        onClick={() => void handleCreateConversation()}
                        type="button"
                      >
                        New chat
                      </Button>
                    </div>
                  </div>
                  <div className="divide-y divide-line">
                    {filteredConversations.length ? (
                      filteredConversations.map((conversation) => (
                        <button
                          className={[
                            "grid w-full gap-2 p-4 text-left transition sm:grid-cols-[1fr_auto]",
                            selectedConversationId === conversation.id
                              ? "bg-brand-500/10"
                              : "hover:bg-surface"
                          ].join(" ")}
                          key={conversation.id}
                          onClick={() => void handleSelectConversation(conversation.id)}
                          type="button"
                        >
                          <span className="min-w-0">
                            <span className="flex items-center gap-2">
                              <span className="truncate text-sm font-semibold text-ink-950">
                                {conversation.subject ?? "Untitled chat"}
                              </span>
                              <span className="text-xs text-ink-500">{conversation.source}</span>
                            </span>
                            <span className="mt-1 block truncate text-sm text-ink-600">
                              {conversation.latestMessage?.body ?? "No messages yet"}
                            </span>
                          </span>
                          <span className="flex items-center gap-2 sm:justify-end">
                            <StatusPill tone={statusTone(conversation.status)}>
                              {conversation.status}
                            </StatusPill>
                            <span className="text-xs font-semibold text-ink-500">
                              {formatChatTime(conversation.lastMessageAt ?? conversation.createdAt)}
                            </span>
                          </span>
                        </button>
                      ))
                    ) : (
                      <div className="grid gap-3 p-6 text-sm text-ink-600">
                        <p className="font-semibold text-ink-950">No conversations yet</p>
                        <p>Create a manual chat to test the realtime conversation API.</p>
                        <Button
                          className="w-fit"
                          icon={<Plus className="h-4 w-4" aria-hidden />}
                          isLoading={isCreating}
                          onClick={() => void handleCreateConversation()}
                          type="button"
                        >
                          New chat
                        </Button>
                      </div>
                    )}
                  </div>
                </article>

                <article className="rounded-md border border-line bg-white shadow-sm">
                  <div className="flex items-center justify-between border-b border-line p-4">
                    <div className="min-w-0">
                      <h2 className="truncate text-base font-semibold">
                        {selectedConversation?.subject ?? "Select a conversation"}
                      </h2>
                      <p className="text-sm text-ink-500">
                        {selectedConversation
                          ? `${selectedConversation.status} - ${selectedConversation.priority}`
                          : "Messages will appear here"}
                      </p>
                    </div>
                    {selectedConversation ? (
                      <StatusPill tone={statusTone(selectedConversation.status)}>
                        {selectedConversation.status}
                      </StatusPill>
                    ) : null}
                  </div>

                  <div className="grid min-h-[380px] content-end gap-3 p-4">
                    {isMessagesLoading ? (
                      <div className="rounded-md border border-line bg-surface p-4 text-sm font-medium text-ink-600">
                        Loading messages
                      </div>
                    ) : messages.length ? (
                      messages.map((message) => (
                        <div
                          className={[
                            "max-w-[82%] rounded-md border px-3 py-2 text-sm",
                            message.senderType === "AGENT"
                              ? "ml-auto border-brand-500/30 bg-brand-500/10 text-ink-950"
                              : "border-line bg-surface text-ink-800"
                          ].join(" ")}
                          key={message.id}
                        >
                          <p>{message.body ?? message.type}</p>
                          <p className="mt-1 text-[11px] font-semibold uppercase text-ink-500">
                            {message.senderType} - {formatChatTime(message.createdAt)}
                          </p>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-md border border-line bg-surface p-4 text-sm text-ink-600">
                        Pick a chat or create a new one to start messaging.
                      </div>
                    )}
                  </div>

                  <form className="border-t border-line p-4" onSubmit={(event) => void handleSendMessage(event)}>
                    <label className="grid gap-2 text-sm font-semibold text-ink-800">
                      Reply
                      <textarea
                        className="min-h-[92px] resize-none rounded-md border border-line bg-white p-3 text-sm text-ink-950 outline-none transition placeholder:text-ink-500 focus:border-brand-600"
                        disabled={!selectedConversation || isSending}
                        onChange={(event) => setComposer(event.target.value)}
                        placeholder="Type a reply"
                        value={composer}
                      />
                    </label>
                    <div className="mt-3 flex justify-end">
                      <Button
                        disabled={!selectedConversation || !composer.trim()}
                        icon={<SendHorizontal className="h-4 w-4" aria-hidden />}
                        isLoading={isSending}
                        type="submit"
                      >
                        Send
                      </Button>
                    </div>
                  </form>
                </article>
              </section>
            ) : (
              <FeaturePanel activeView={activeView} />
            )}

            <section className="grid gap-5 xl:grid-cols-[1fr_1fr]">
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
                  <Button
                    className="bg-white text-ink-950 hover:bg-white/90"
                    onClick={() => void handleCreateConversation()}
                    type="button"
                    variant="secondary"
                  >
                    Take chat
                  </Button>
                  <Button
                    onClick={() => {
                      setActiveView("Inbox");
                      setSearchQuery("");
                      setNotice("Queue opened");
                    }}
                    type="button"
                    variant="ghost"
                  >
                    View queue
                  </Button>
                </div>
              </article>
            </section>

            <article className="rounded-md border border-line bg-white p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <LifeBuoy className="h-5 w-5 text-brand-700" aria-hidden />
                <h2 className="text-base font-semibold">Next modules</h2>
              </div>
              <div className="mt-4 grid gap-2 text-sm text-ink-600 sm:grid-cols-3">
                <p>Visitor widget</p>
                <p>Socket client live updates</p>
                <p>Conversation transfer UI</p>
              </div>
            </article>
          </div>
        </section>
      </div>
    </main>
  );
}

function FeaturePanel({ activeView }: { activeView: Exclude<DashboardView, "Inbox"> }) {
  const descriptions: Record<Exclude<DashboardView, "Inbox">, string> = {
    Automation: "Routing rules, inactivity messages, and workflow triggers will live here.",
    Contacts: "CRM profiles, notes, tags, and visitor history will live here.",
    Reports: "Chat volume, response time, ratings, and exports will live here.",
    Settings: "Widget setup, team permissions, billing, and security settings will live here.",
    Tags: "Chat tags and filtering tools will live here.",
    Tickets: "Ticket queues, assignees, priorities, and SLA state will live here.",
    Visitors: "Live visitor tracking and page-view context will live here."
  };

  return (
    <section className="rounded-md border border-line bg-white p-6 shadow-sm">
      <div className="max-w-2xl">
        <p className="text-sm font-semibold uppercase text-brand-700">{activeView}</p>
        <h2 className="mt-2 text-2xl font-semibold text-ink-950">{activeView} module</h2>
        <p className="mt-3 text-sm leading-6 text-ink-600">{descriptions[activeView]}</p>
      </div>
    </section>
  );
}

function buildMetrics(conversations: Conversation[], organizations: Organization[]) {
  const openCount = conversations.filter((conversation) =>
    ["QUEUED", "OPEN", "PENDING"].includes(conversation.status)
  ).length;
  const resolvedCount = conversations.filter(
    (conversation) => conversation.status === "RESOLVED"
  ).length;

  return [
    { label: "Open chats", value: String(openCount), delta: "+live", tone: "green" as const },
    { label: "Conversations", value: String(conversations.length), delta: "total", tone: "gray" as const },
    { label: "Resolved", value: String(resolvedCount), delta: "done", tone: "green" as const },
    {
      label: "Online agents",
      value: String(organizations.filter((organization) => organization.membership).length),
      delta: "team",
      tone: "amber" as const
    }
  ];
}

function statusTone(status: ConversationStatus): "green" | "amber" | "gray" | "red" {
  if (status === "OPEN") {
    return "green";
  }

  if (status === "QUEUED" || status === "PENDING") {
    return "amber";
  }

  if (status === "SPAM") {
    return "red";
  }

  return "gray";
}

function formatChatTime(value: string | null): string {
  if (!value) {
    return "now";
  }

  const timestamp = new Date(value).getTime();

  if (Number.isNaN(timestamp)) {
    return "now";
  }

  const diffMs = Date.now() - timestamp;
  const minutes = Math.max(0, Math.floor(diffMs / 60000));

  if (minutes < 1) {
    return "now";
  }

  if (minutes < 60) {
    return `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);

  if (hours < 24) {
    return `${hours}h`;
  }

  return `${Math.floor(hours / 24)}d`;
}
