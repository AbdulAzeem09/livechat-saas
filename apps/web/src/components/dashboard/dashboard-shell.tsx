"use client";

import {
  type ComponentType,
  type FormEvent,
  useEffect,
  useMemo,
  useState
} from "react";
import { useRouter } from "next/navigation";
import {
  Accessibility,
  Archive,
  ArrowRight,
  BarChart3,
  Bell,
  Blocks,
  Bot,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  Copy,
  CreditCard,
  Database,
  Download,
  Gauge,
  Globe2,
  Home,
  Languages,
  Link2,
  LockKeyhole,
  LogOut,
  Mail,
  MapPin,
  MessageCircle,
  MessageSquareText,
  MessagesSquare,
  Monitor,
  MoreHorizontal,
  MousePointer2,
  PanelLeft,
  Paperclip,
  Plus,
  Search,
  SendHorizontal,
  Settings,
  ShieldCheck,
  ShoppingCart,
  SlidersHorizontal,
  Sparkles,
  SquareCheckBig,
  Tag,
  ThumbsUp,
  UserRound,
  UsersRound,
  X,
  Zap
} from "lucide-react";
import {
  createConversation as createConversationRequest,
  getCurrentUser,
  listConversations,
  listMessages,
  listOrganizations,
  sendMessage as sendMessageRequest
} from "@/lib/api";
import { cn } from "@/lib/cn";
import { initials } from "@/lib/format";
import { clearSession, readSession, type StoredSession } from "@/lib/session";
import type {
  AuthUser,
  Conversation,
  Message,
  Organization
} from "@/lib/types";

type IconComponent = ComponentType<{ className?: string; "aria-hidden"?: boolean }>;

const primaryNav = [
  { key: "overview", label: "Overview", icon: Home, tone: "dark" },
  { key: "chats", label: "Chats", icon: MessagesSquare, tone: "dark" },
  { key: "engage", label: "Engage", icon: Sparkles, tone: "dark" },
  { key: "automate", label: "Automate", icon: Zap, tone: "light" },
  { key: "archives", label: "Archives", icon: Archive, tone: "light" },
  { key: "team", label: "Team", icon: UsersRound, tone: "light" },
  { key: "reports", label: "Reports", icon: BarChart3, tone: "light" },
  { key: "apps", label: "Apps", icon: Blocks, tone: "light" },
  { key: "tickets", label: "Tickets", icon: SquareCheckBig, tone: "light" },
  { key: "billing", label: "Billing", icon: CreditCard, tone: "light" },
  { key: "settings", label: "Settings", icon: Settings, tone: "light" }
] as const;

type ScreenKey = (typeof primaryNav)[number]["key"];

interface SecondaryItem {
  label: string;
  count?: string;
  muted?: string;
  badge?: string;
  icon?: IconComponent;
}

const secondaryNav: Record<ScreenKey, SecondaryItem[]> = {
  overview: [
    { label: "Real time", count: "live" },
    { label: "Last 7 days", count: "1" },
    { label: "Goals", count: "0" }
  ],
  chats: [
    { label: "All chats", count: "0" },
    { label: "Messaging channels", count: "3" },
    { label: "Supervised", count: "0" },
    { label: "Queued", count: "0" }
  ],
  engage: [
    { label: "Traffic", count: "0", muted: "customers" },
    { label: "Campaigns", count: "5", muted: "active" },
    { label: "Goals", count: "0", muted: "active" },
    { label: "Targeted messages" },
    { label: "Chat assignment" }
  ],
  automate: [
    { label: "Overview" },
    { label: "Chatbots" },
    { label: "Knowledge hub" },
    { label: "Canned responses" },
    { label: "Routing rules" },
    { label: "Workflows", badge: "Beta" }
  ],
  archives: [
    { label: "Chat archives", count: "1,180" },
    { label: "Chat tags" },
    { label: "Transcripts" },
    { label: "Ratings" }
  ],
  team: [
    { label: "Agents", count: "3" },
    { label: "Chatbots" },
    { label: "Groups" },
    { label: "Roles" },
    { label: "Work scheduler" }
  ],
  reports: [
    { label: "My saved views" },
    { label: "Summary", count: "7d" },
    { label: "Chats" },
    { label: "Agents" },
    { label: "Customers" },
    { label: "Ecommerce" },
    { label: "Export raw data" },
    { label: "Reviews" }
  ],
  apps: [
    { label: "Explore apps", count: "1" },
    { label: "External integrations" },
    { label: "Partners" },
    { label: "Creators" },
    { label: "Build your app" },
    { label: "Automate with webhooks" }
  ],
  tickets: [
    { label: "Tickets home" },
    { label: "All tickets" },
    { label: "Rules" },
    { label: "SLA policies" }
  ],
  billing: [
    { label: "Subscription" },
    { label: "Invoices" },
    { label: "Account details" },
    { label: "Payment methods" }
  ],
  settings: [
    { label: "Install LiveChat", count: "ON" },
    { label: "Email by HelpDesk", count: "OFF" },
    { label: "Facebook Messenger", count: "OFF" },
    { label: "Apple Messages", count: "OFF" },
    { label: "Website widget" },
    { label: "Forms" },
    { label: "Engagement" },
    { label: "Tags" },
    { label: "Sales tracker" },
    { label: "Chat settings" },
    { label: "Security" }
  ]
};

const screenTitles: Record<ScreenKey, string> = {
  overview: "Real time overview",
  chats: "Chats",
  engage: "Traffic",
  automate: "Overview",
  archives: "Archives",
  team: "Team",
  reports: "Last 7 days",
  apps: "Explore apps",
  tickets: "Tickets",
  billing: "Subscription",
  settings: "Install LiveChat"
};

const channels = [
  { name: "Facebook Messenger", tone: "from-blue-500 to-violet-500", letter: "M" },
  { name: "WhatsApp", tone: "from-green-400 to-emerald-600", letter: "W" },
  { name: "Instagram", tone: "from-pink-500 to-orange-400", letter: "I" }
];

const appCards = [
  {
    name: "Pro+ API requests package",
    price: "$149.99 / mo",
    copy: "A monthly package of 500,000 API requests with a specialist session.",
    accent: "P+"
  },
  {
    name: "Pro API requests package",
    price: "$149.99 / mo",
    copy: "A monthly package of 500,000 API requests for high traffic workspaces.",
    accent: "P"
  },
  {
    name: "Essential API requests package",
    price: "$29.99 / mo",
    copy: "A monthly package of 100,000 API requests.",
    accent: "E"
  },
  {
    name: "ChatBot",
    price: "Free to install",
    copy: "Integrate ChatBot to get a customer service chatbot in LiveChat.",
    accent: "CB"
  },
  {
    name: "KnowledgeBase for LiveChat",
    price: "Free to install",
    copy: "Empower support with self-service answers and article suggestions.",
    accent: "KB"
  },
  {
    name: "WhatsApp Business",
    price: "Free to install",
    copy: "Manage WhatsApp conversations in the LiveChat app.",
    accent: "WA"
  }
];

const cannedResponses = [
  "Hi there, thanks for reaching out. I am checking this for you now.",
  "Could you share the email address connected to your account?",
  "I can transfer this chat to the right teammate for a faster answer.",
  "Here is the direct checkout link for the plan we discussed."
];

const chatToolItems: Array<{ icon: IconComponent; label: string }> = [
  { label: "Message sneak-peek", icon: MousePointer2 },
  { label: "Canned responses", icon: MessageSquareText },
  { label: "Chat transfer", icon: ArrowRight },
  { label: "Chat ratings", icon: ThumbsUp }
];

const settingsIntegrations: Array<{ icon: IconComponent; label: string }> = [
  { label: "Connect with Google Tag Manager", icon: Globe2 },
  { label: "Email by HelpDesk", icon: Mail },
  { label: "Facebook Messenger", icon: MessageSquareText },
  { label: "Security restrictions", icon: LockKeyhole },
  { label: "Languages", icon: Languages },
  { label: "Accessibility", icon: Accessibility },
  { label: "Data storage", icon: Database },
  { label: "Compliance", icon: ShieldCheck }
];

const agents = [
  {
    name: "Benjamin Foster",
    email: "i3540845@gmail.com",
    role: "Owner",
    status: "Accepting chats",
    tone: "bg-orange-200 text-orange-900"
  },
  {
    name: "Amber Smith",
    email: "info@thecrownpublishers.com",
    role: "Admin",
    status: "Offline",
    tone: "bg-amber-100 text-amber-900"
  },
  {
    name: "Into",
    email: "into@thecrownpublishers.com",
    role: "Admin",
    status: "Invite sent",
    tone: "bg-violet-600 text-white"
  }
];

const trafficTabs = [
  "All customers (0)",
  "Chatting (0)",
  "Supervised (0)",
  "Queued (0)",
  "Waiting for reply (0)",
  "Invited (0)"
];

export function DashboardShell() {
  const router = useRouter();
  const [session, setSession] = useState<StoredSession | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [activeScreen, setActiveScreen] = useState<ScreenKey>("overview");
  const [activeSecondary, setActiveSecondary] = useState("Real time");
  const [searchQuery, setSearchQuery] = useState("");
  const [composer, setComposer] = useState("");
  const [widgetComposer, setWidgetComposer] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isMessagesLoading, setIsMessagesLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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

  useEffect(() => {
    setActiveSecondary(secondaryNav[activeScreen][0]?.label ?? "");
    setNotice("");
    setIsMobileMenuOpen(false);
  }, [activeScreen]);

  const activeOrganization = organizations[0];
  const selectedConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === selectedConversationId) ?? null,
    [conversations, selectedConversationId]
  );
  const activeNavItem = primaryNav.find((item) => item.key === activeScreen) ?? primaryNav[0];
  const isLightScreen = activeNavItem.tone === "light";
  const chatLink = activeOrganization
    ? `https://direct.lc.chat/${activeOrganization.id.slice(0, 8)}`
    : "https://direct.lc.chat/demo";

  const filteredConversations = conversations.filter((conversation) => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) {
      return true;
    }

    return [
      conversation.subject,
      conversation.status,
      conversation.priority,
      conversation.source,
      conversation.latestMessage?.body
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query));
  });

  const openCount = conversations.filter((conversation) =>
    ["QUEUED", "OPEN", "PENDING"].includes(conversation.status)
  ).length;
  const totalChats = Math.max(conversations.length, 1);

  async function handleOpenConversation(conversation: Conversation) {
    if (!session || !activeOrganization) {
      return;
    }

    setSelectedConversationId(conversation.id);
    setIsMessagesLoading(true);
    setActiveScreen("chats");
    setNotice("");

    try {
      setMessages(await listMessages(activeOrganization.id, conversation.id, session.accessToken));
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to load messages");
    } finally {
      setIsMessagesLoading(false);
    }
  }

  async function handleCreateConversation(initialMessage = "Hi, I need help with my account.") {
    if (!session || !activeOrganization) {
      setNotice("Please sign in and select a workspace first.");
      return false;
    }

    setIsCreating(true);
    setError("");

    try {
      const conversation = await createConversationRequest(
        activeOrganization.id,
        session.accessToken,
        {
          subject: `Website visitor ${conversations.length + 1}`,
          source: "WIDGET",
          priority: "NORMAL",
          initialMessage
        }
      );

      setConversations((current) => [conversation, ...current]);
      setSelectedConversationId(conversation.id);
      setActiveScreen("chats");
      setMessages(await listMessages(activeOrganization.id, conversation.id, session.accessToken));
      setNotice("New visitor chat created.");
      return true;
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to create conversation");
      return false;
    } finally {
      setIsCreating(false);
    }
  }

  async function sendConversationMessage(body: string) {
    if (!session || !activeOrganization) {
      setNotice("Please sign in and select a workspace first.");
      return false;
    }

    if (!selectedConversation) {
      return handleCreateConversation(body);
    }

    setIsSending(true);
    setError("");

    try {
      const message = await sendMessageRequest(
        activeOrganization.id,
        selectedConversation.id,
        session.accessToken,
        { body, visibility: "PUBLIC", type: "TEXT" }
      );

      setMessages((current) => [...current, message]);
      setConversations((current) =>
        current.map((conversation) =>
          conversation.id === selectedConversation.id
            ? {
                ...conversation,
                latestMessage: message,
                lastMessageAt: message.createdAt
              }
            : conversation
        )
      );
      setNotice("Message sent.");
      return true;
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to send message");
      return false;
    } finally {
      setIsSending(false);
    }
  }

  async function handleSendMessage(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();

    const body = composer.trim();

    if (!body) {
      return;
    }

    if (await sendConversationMessage(body)) {
      setComposer("");
    }
  }

  async function handleWidgetSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = widgetComposer.trim();

    if (!body) {
      return;
    }

    if (await sendConversationMessage(body)) {
      setWidgetComposer("");
    }
  }

  async function handleCopy(text: string, copiedMessage = "Copied.") {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(text);
      }

      setNotice(copiedMessage);
    } catch {
      setNotice(text);
    }
  }

  function handleAction(message: string) {
    setNotice(message);
  }

  function handleLogout() {
    clearSession();
    router.replace("/login");
  }

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black text-white">
        <div className="rounded-xl border border-white/10 bg-[#1f1f23] px-6 py-5 shadow-2xl">
          <div className="mb-3 h-2 w-44 overflow-hidden rounded-full bg-white/10">
            <div className="h-full w-1/2 animate-pulse rounded-full bg-[#0a84ff]" />
          </div>
          <p className="text-sm font-semibold">Loading workspace...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen overflow-hidden bg-black text-white">
      <GlobalTopBar
        isNotificationOpen={isNotificationOpen}
        onCreateChat={() => void handleCreateConversation()}
        onSearchChange={setSearchQuery}
        onToggleNotifications={() => setIsNotificationOpen((current) => !current)}
        onToggleProfile={() => setIsProfileOpen((current) => !current)}
        searchQuery={searchQuery}
        user={user}
      />

      <div className="grid h-screen grid-cols-[40px_minmax(0,1fr)] pt-6 lg:grid-cols-[40px_220px_minmax(0,1fr)]">
        <IconRail
          activeScreen={activeScreen}
          onChangeScreen={setActiveScreen}
          onLogout={handleLogout}
          onToggleProfile={() => setIsProfileOpen((current) => !current)}
          user={user}
        />

        <SecondaryNav
          activeLabel={activeSecondary}
          activeScreen={activeScreen}
          isOpen={isMobileMenuOpen}
          onSelect={(label) => {
            setActiveSecondary(label);
            setNotice(`${label} selected.`);
          }}
        />

        <section className="min-w-0 px-0 pb-1 pr-1">
          <div
            className={cn(
              "relative h-full overflow-hidden rounded-tl-xl border shadow-2xl",
              isLightScreen
                ? "border-white bg-white text-[#111214]"
                : "border-[#2d2d32] bg-[#1f1f23] text-white"
            )}
          >
            <ScreenHeader
              activeScreen={activeScreen}
              isLightScreen={isLightScreen}
              onMobileMenu={() => setIsMobileMenuOpen((current) => !current)}
              onQuickAction={handleAction}
              title={screenTitles[activeScreen]}
            />

            {(notice || error) && (
              <div
                className={cn(
                  "mx-4 mt-3 flex items-center justify-between rounded-md border px-3 py-2 text-xs font-semibold",
                  error
                    ? "border-red-200 bg-red-50 text-red-700"
                    : isLightScreen
                      ? "border-blue-100 bg-blue-50 text-blue-700"
                      : "border-[#254e7d] bg-[#10243b] text-blue-200"
                )}
              >
                <span>{error || notice}</span>
                <button
                  className="rounded p-1 hover:bg-black/10"
                  onClick={() => {
                    setNotice("");
                    setError("");
                  }}
                  type="button"
                >
                  <X className="h-3.5 w-3.5" aria-hidden />
                </button>
              </div>
            )}

            <div className="h-[calc(100%-56px)] overflow-auto">
              {activeScreen === "overview" && (
                <OverviewScreen
                  onAction={handleAction}
                  onCreateChat={() => void handleCreateConversation()}
                  openCount={openCount}
                  totalChats={totalChats}
                />
              )}

              {activeScreen === "chats" && (
                <ChatsScreen
                  chatLink={chatLink}
                  composer={composer}
                  conversations={filteredConversations}
                  isCreating={isCreating}
                  isMessagesLoading={isMessagesLoading}
                  isSending={isSending}
                  messages={messages}
                  onAction={handleAction}
                  onCopy={handleCopy}
                  onCreateChat={() => void handleCreateConversation()}
                  onOpenConversation={(conversation) => void handleOpenConversation(conversation)}
                  onSendMessage={(event) => void handleSendMessage(event)}
                  selectedConversation={selectedConversation}
                  setComposer={setComposer}
                />
              )}

              {activeScreen === "engage" && (
                <TrafficScreen chatLink={chatLink} onAction={handleAction} onCopy={handleCopy} />
              )}

              {activeScreen === "automate" && (
                <AutomateScreen onAction={handleAction} />
              )}

              {activeScreen === "archives" && (
                <ArchivesScreen
                  messages={messages}
                  onAction={handleAction}
                  onOpenChat={() => {
                    setActiveScreen("chats");
                    setNotice("Archived chat reopened in Chats.");
                  }}
                  selectedConversation={selectedConversation}
                />
              )}

              {activeScreen === "team" && (
                <TeamScreen onAction={handleAction} user={user} />
              )}

              {activeScreen === "reports" && (
                <ReportsScreen totalChats={totalChats} />
              )}

              {activeScreen === "apps" && (
                <AppsScreen onAction={handleAction} />
              )}

              {activeScreen === "tickets" && (
                <TicketsScreen onAction={handleAction} />
              )}

              {activeScreen === "billing" && (
                <BillingScreen onAction={handleAction} />
              )}

              {activeScreen === "settings" && (
                <SettingsScreen chatLink={chatLink} onAction={handleAction} onCopy={handleCopy} />
              )}
            </div>
          </div>
        </section>
      </div>

      <BottomChatWidget
        draft={widgetComposer}
        onChange={setWidgetComposer}
        onSubmit={(event) => void handleWidgetSend(event)}
      />

      {isProfileOpen && (
        <ProfileMenu
          onAction={handleAction}
          onClose={() => setIsProfileOpen(false)}
          onLogout={handleLogout}
          user={user}
        />
      )}

      {isNotificationOpen && (
        <NotificationPanel onClose={() => setIsNotificationOpen(false)} />
      )}
    </main>
  );
}

function GlobalTopBar({
  isNotificationOpen,
  onCreateChat,
  onSearchChange,
  onToggleNotifications,
  onToggleProfile,
  searchQuery,
  user
}: {
  isNotificationOpen: boolean;
  onCreateChat: () => void;
  onSearchChange: (value: string) => void;
  onToggleNotifications: () => void;
  onToggleProfile: () => void;
  searchQuery: string;
  user: AuthUser | null;
}) {
  return (
    <div className="fixed inset-x-0 top-0 z-30 flex h-7 items-center justify-center bg-black">
      <label className="relative hidden h-7 w-[420px] max-w-[42vw] items-center sm:flex">
        <Search className="pointer-events-none absolute left-3 h-4 w-4 text-white/80" aria-hidden />
        <input
          aria-label="Search workspace"
          className="h-full w-full rounded-b-lg bg-[#1e1e22] px-9 text-sm font-semibold text-white outline-none placeholder:text-white/70"
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search"
          value={searchQuery}
        />
        <span className="absolute right-11 top-1 rounded bg-black px-1.5 py-0.5 text-xs font-bold text-white">
          Ctrl
        </span>
        <span className="absolute right-3 top-1 rounded bg-black px-1.5 py-0.5 text-xs font-bold text-white">
          K
        </span>
      </label>

      <div className="absolute right-2 top-0 flex h-7 items-center gap-1.5">
        <button
          className={cn(
            "relative grid h-7 w-7 place-items-center rounded-full border border-white/20 bg-[#1f1f23] text-white",
            isNotificationOpen && "border-blue-500"
          )}
          onClick={onToggleNotifications}
          type="button"
        >
          <Bell className="h-4 w-4" aria-hidden />
          <span className="absolute -right-0.5 -top-0.5 grid h-4 w-4 place-items-center rounded-full bg-red-600 text-[10px] font-bold">
            1
          </span>
        </button>
        <button
          className="grid h-7 w-7 place-items-center rounded-full border border-white/20 bg-[#1f1f23]"
          onClick={onCreateChat}
          title="New chat"
          type="button"
        >
          <Plus className="h-4 w-4" aria-hidden />
        </button>
        <button
          className="grid h-7 w-7 place-items-center overflow-hidden rounded-full border border-blue-500 bg-[#2f2f36] text-xs font-bold text-white"
          onClick={onToggleProfile}
          type="button"
        >
          {initials(user?.name, user?.email ?? "agent@example.com")}
        </button>
      </div>
    </div>
  );
}

function IconRail({
  activeScreen,
  onChangeScreen,
  onLogout,
  onToggleProfile,
  user
}: {
  activeScreen: ScreenKey;
  onChangeScreen: (screen: ScreenKey) => void;
  onLogout: () => void;
  onToggleProfile: () => void;
  user: AuthUser | null;
}) {
  return (
    <aside className="z-20 flex h-full w-10 flex-col items-center justify-between bg-black pb-2 pt-2">
      <div className="flex w-full flex-col items-center gap-1 overflow-y-auto">
        {primaryNav.map((item) => {
          const Icon = item.icon;
          const isActive = activeScreen === item.key;

          return (
            <button
              className={cn(
                "grid h-9 w-9 place-items-center rounded-md text-white/70 transition hover:bg-[#2f2f33] hover:text-white",
                isActive && "bg-[#2f2f33] text-white"
              )}
              key={item.key}
              onClick={() => onChangeScreen(item.key)}
              title={item.label}
              type="button"
            >
              <Icon className="h-5 w-5" aria-hidden />
            </button>
          );
        })}
      </div>

      <div className="flex flex-col items-center gap-1">
        <button
          className="relative grid h-9 w-9 place-items-center rounded-md text-white/70 hover:bg-[#2f2f33] hover:text-white"
          onClick={onLogout}
          title="Log out"
          type="button"
        >
          <LogOut className="h-5 w-5" aria-hidden />
        </button>
        <button
          className="relative grid h-8 w-8 place-items-center overflow-hidden rounded-full border border-white/20 bg-white text-xs font-bold text-black"
          onClick={onToggleProfile}
          title="Profile"
          type="button"
        >
          {initials(user?.name, user?.email ?? "agent@example.com")}
          <span className="absolute -right-0.5 top-0 h-2.5 w-2.5 rounded-full border border-black bg-emerald-500" />
        </button>
      </div>
    </aside>
  );
}

function SecondaryNav({
  activeLabel,
  activeScreen,
  isOpen,
  onSelect
}: {
  activeLabel: string;
  activeScreen: ScreenKey;
  isOpen: boolean;
  onSelect: (label: string) => void;
}) {
  const activePrimary = primaryNav.find((item) => item.key === activeScreen) ?? primaryNav[0];

  return (
    <aside
      className={cn(
        "absolute left-10 top-6 z-20 h-[calc(100vh-24px)] w-[220px] bg-black px-4 py-5 text-white lg:static lg:block",
        isOpen ? "block" : "hidden"
      )}
    >
      <h2 className="mb-6 px-2 text-lg font-bold">{activePrimary.label}</h2>
      <nav className="space-y-1">
        {secondaryNav[activeScreen].map((item) => (
          <button
            className={cn(
              "flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm font-semibold text-white/80 transition hover:bg-[#2f2f2f] hover:text-white",
              activeLabel === item.label && "bg-[#2f2f2f] text-white"
            )}
            key={item.label}
            onClick={() => onSelect(item.label)}
            type="button"
          >
            <span className="flex min-w-0 items-center gap-2">
              {item.icon && <item.icon className="h-4 w-4" aria-hidden />}
              <span className="truncate">{item.label}</span>
              {item.badge && (
                <span className="rounded bg-violet-700 px-1.5 py-0.5 text-[10px]">{item.badge}</span>
              )}
            </span>
            {item.count && (
              <span
                className={cn(
                  "ml-2 rounded-full px-2 py-0.5 text-xs",
                  item.count === "ON"
                    ? "text-emerald-400"
                    : item.count === "OFF"
                      ? "text-slate-400"
                      : "bg-slate-600 text-white"
                )}
              >
                {item.count}
              </span>
            )}
          </button>
        ))}
      </nav>
    </aside>
  );
}

function ScreenHeader({
  activeScreen,
  isLightScreen,
  onMobileMenu,
  onQuickAction,
  title
}: {
  activeScreen: ScreenKey;
  isLightScreen: boolean;
  onMobileMenu: () => void;
  onQuickAction: (message: string) => void;
  title: string;
}) {
  return (
    <header
      className={cn(
        "flex h-14 items-center justify-between border-b px-4",
        isLightScreen ? "border-slate-200 bg-white" : "border-[#303036] bg-[#1f1f23]"
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <button
          className={cn(
            "grid h-8 w-8 place-items-center rounded-md lg:hidden",
            isLightScreen ? "hover:bg-slate-100" : "hover:bg-white/10"
          )}
          onClick={onMobileMenu}
          type="button"
        >
          <PanelLeft className="h-4 w-4" aria-hidden />
        </button>
        <PanelLeft className="hidden h-4 w-4 opacity-80 sm:block" aria-hidden />
        <h1 className="truncate text-lg font-bold">{title}</h1>
      </div>

      <div className="flex items-center gap-2">
        {activeScreen === "settings" && (
          <button
            className="hidden items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-100 sm:flex"
            onClick={() => onQuickAction("Preview opened.")}
            type="button"
          >
            <Monitor className="h-4 w-4" aria-hidden />
            Preview live
          </button>
        )}
        <button
          className={cn(
            "grid h-8 w-8 place-items-center rounded-md",
            isLightScreen ? "hover:bg-slate-100" : "hover:bg-white/10"
          )}
          onClick={() => onQuickAction("More options opened.")}
          type="button"
        >
          <MoreHorizontal className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </header>
  );
}

function OverviewScreen({
  onAction,
  onCreateChat,
  openCount,
  totalChats
}: {
  onAction: (message: string) => void;
  onCreateChat: () => void;
  openCount: number;
  totalChats: number;
}) {
  const bars = [totalChats, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05];
  const max = Math.max(...bars, 2);

  return (
    <div className="mx-auto max-w-5xl px-5 py-5 text-white">
      <section>
        <h2 className="mb-3 text-sm font-bold">Real time overview</h2>
        <div className="grid gap-3 md:grid-cols-3">
          <DarkMetric label="Customers online" value="0" />
          <DarkMetric label="Ongoing chats" value={String(openCount)} />
          <DarkMetric label="Logged in agents" suffix="of 3" value="1" />
        </div>
        <p className="mt-3 text-xs text-blue-200">
          Tip: Some customers may not be shown because your plan has a tracking limit.
          <button
            className="ml-1 font-semibold text-[#4ea2ff] hover:underline"
            onClick={() => onAction("Upgrade flow opened.")}
            type="button"
          >
            Upgrade to see more customers
          </button>
        </p>
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-bold">Last 7 days</h2>
        <div className="rounded-md bg-[#242428] p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold">Total chats</p>
              <div className="mt-5 flex items-center gap-2">
                <span className="text-lg font-bold">{totalChats}</span>
                <span className="rounded bg-[#34343a] px-2 py-1 text-[11px] text-white/80">
                  -4 from previous 7 days
                </span>
              </div>
            </div>
            <SegmentedControl first="My stats" second="All agents" />
          </div>

          <div className="mt-7 grid h-48 grid-cols-[28px_minmax(0,1fr)] gap-2">
            <div className="flex flex-col justify-between pb-7 text-xs text-white/70">
              <span>2</span>
              <span>1</span>
              <span>0</span>
            </div>
            <div className="relative border-b border-[#38383f]">
              <div className="absolute inset-x-0 top-0 border-t border-[#333338]" />
              <div className="absolute inset-x-0 top-1/2 border-t border-[#333338]" />
              <div className="absolute inset-x-0 bottom-0 border-t border-[#333338]" />
              <div className="relative z-10 flex h-full items-end justify-around pb-6">
                {["Wed", "Thu", "Fri", "Sat", "Sun", "Mon", "Tue"].map((day, index) => (
                  <div className="flex h-full w-14 flex-col items-center justify-end gap-2" key={day}>
                    <div
                      className="w-12 rounded-t-sm bg-[#0a84ff]"
                      style={{ height: `${Math.max(((bars[index] ?? 0) / max) * 120, 2)}px` }}
                    />
                    <span className="text-xs text-white/80">{day}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-3 border-t border-[#34343a] pt-4 md:grid-cols-2">
            <MetricRow icon={UsersRound} label="Queued visitors" value="0" />
            <MetricRow buttonLabel="+ Add" icon={ShoppingCart} label="Goals" value="" onClick={() => onAction("Goal builder opened.")} />
            <MetricRow icon={ThumbsUp} label="Chat satisfaction" value="-" />
            <MetricRow buttonLabel="+ Add" icon={ShoppingCart} label="Sales" value="" onClick={() => onAction("Sales tracker opened.")} />
          </div>
        </div>
      </section>

      <button
        className="mt-5 rounded-md bg-[#0a84ff] px-4 py-2 text-sm font-bold text-white hover:bg-[#006fe0]"
        onClick={onCreateChat}
        type="button"
      >
        Start test chat
      </button>
    </div>
  );
}

function ChatsScreen({
  chatLink,
  composer,
  conversations,
  isCreating,
  isMessagesLoading,
  isSending,
  messages,
  onAction,
  onCopy,
  onCreateChat,
  onOpenConversation,
  onSendMessage,
  selectedConversation,
  setComposer
}: {
  chatLink: string;
  composer: string;
  conversations: Conversation[];
  isCreating: boolean;
  isMessagesLoading: boolean;
  isSending: boolean;
  messages: Message[];
  onAction: (message: string) => void;
  onCopy: (text: string, copiedMessage?: string) => Promise<void>;
  onCreateChat: () => void;
  onOpenConversation: (conversation: Conversation) => void;
  onSendMessage: (event: FormEvent<HTMLFormElement>) => void;
  selectedConversation: Conversation | null;
  setComposer: (value: string) => void;
}) {
  return (
    <div className="grid min-h-full grid-cols-1 bg-[#1f1f23] text-white xl:grid-cols-[330px_minmax(0,1fr)_320px]">
      <aside className="border-b border-[#111214] bg-[#202024] xl:border-b-0 xl:border-r">
        <div className="flex h-12 items-center justify-between border-b border-[#303036] px-4">
          <h2 className="text-lg font-bold">Chats</h2>
          <button
            className="rounded-md bg-[#0a84ff] px-3 py-1.5 text-xs font-bold hover:bg-[#006fe0]"
            disabled={isCreating}
            onClick={onCreateChat}
            type="button"
          >
            {isCreating ? "Creating..." : "New chat"}
          </button>
        </div>

        <div className="max-h-[280px] overflow-auto xl:max-h-[calc(100vh-140px)]">
          {conversations.length === 0 ? (
            <div className="space-y-5 px-6 py-5">
              {[0, 1, 2].map((item) => (
                <div className="flex gap-4" key={item}>
                  <div className="h-11 w-11 rounded-full bg-[#303036]" />
                  <div className="flex-1 space-y-3 pt-1">
                    <div className="h-3 w-20 rounded bg-[#303036]" />
                    <div className="h-3 w-32 rounded bg-[#303036]" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            conversations.map((conversation) => (
              <button
                className={cn(
                  "flex w-full gap-3 border-b border-[#303036] px-4 py-4 text-left transition hover:bg-[#2a2a30]",
                  selectedConversation?.id === conversation.id && "bg-[#2a2a30]"
                )}
                key={conversation.id}
                onClick={() => onOpenConversation(conversation)}
                type="button"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#34343a] text-sm font-bold">
                  {initials(conversation.subject, "visitor@example.com")}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold">
                    {conversation.subject ?? "Unnamed customer"}
                  </span>
                  <span className="mt-1 block truncate text-xs text-white/55">
                    {conversation.latestMessage?.body ?? "No messages yet"}
                  </span>
                </span>
                <span className="text-[10px] uppercase text-white/40">{conversation.status}</span>
              </button>
            ))
          )}
        </div>
      </aside>

      <section className="flex min-h-[500px] flex-col border-b border-[#111214] xl:border-b-0 xl:border-r">
        {selectedConversation ? (
          <>
            <div className="flex h-14 items-center justify-between border-b border-[#303036] px-5">
              <div className="min-w-0">
                <p className="truncate text-lg font-bold">{selectedConversation.subject ?? "Unnamed customer"}</p>
                <p className="text-xs text-white/50">
                  {selectedConversation.status} - {selectedConversation.source} - {selectedConversation.priority}
                </p>
              </div>
              <div className="flex gap-1">
                <IconButton dark icon={Paperclip} label="Attach file" onClick={() => onAction("File sharing panel opened.")} />
                <IconButton dark icon={Link2} label="Copy chat link" onClick={() => void onCopy(chatLink, "Chat link copied.")} />
                <IconButton dark icon={MoreHorizontal} label="More chat actions" onClick={() => onAction("Chat actions opened.")} />
              </div>
            </div>

            <div className="flex-1 overflow-auto px-5 py-5">
              {isMessagesLoading ? (
                <div className="space-y-3">
                  <div className="h-10 w-2/3 rounded-lg bg-white/10" />
                  <div className="ml-auto h-10 w-1/2 rounded-lg bg-blue-600/40" />
                </div>
              ) : (
                <MessageTimeline messages={messages} />
              )}
            </div>

            <form className="border-t border-[#303036] p-4" onSubmit={onSendMessage}>
              <div className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-slate-900 shadow-lg">
                <input
                  className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-500"
                  onChange={(event) => setComposer(event.target.value)}
                  placeholder="Write a message..."
                  value={composer}
                />
                <button
                  className="grid h-9 w-9 place-items-center rounded-full bg-slate-200 text-slate-800 hover:bg-slate-300"
                  disabled={isSending}
                  type="submit"
                >
                  <SendHorizontal className="h-4 w-4" aria-hidden />
                </button>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {cannedResponses.slice(0, 3).map((response) => (
                  <button
                    className="rounded-full border border-white/15 px-3 py-1 text-xs text-white/75 hover:bg-white/10"
                    key={response}
                    onClick={() => setComposer(response)}
                    type="button"
                  >
                    {response.slice(0, 34)}...
                  </button>
                ))}
              </div>
            </form>
          </>
        ) : (
          <ChannelSetup onAction={onAction} />
        )}
      </section>

      <aside className="bg-[#202024]">
        <div className="flex h-14 items-center justify-between border-b border-[#303036] px-5">
          <div className="flex gap-4">
            <UserRound className="h-5 w-5 text-white/80" aria-hidden />
            <Plus className="h-5 w-5 text-white/80" aria-hidden />
          </div>
          <button className="text-white/80 hover:text-white" onClick={() => onAction("Details panel closed.")} type="button">
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <div className="space-y-6 px-5 py-6">
          <SkeletonLines />
          <div className="rounded-lg border border-[#303036] p-4">
            <p className="text-sm font-bold">Chat tools</p>
            <div className="mt-3 grid gap-2">
              {chatToolItems.map(({ icon: Icon, label }) => (
                <button
                  className="flex items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-white/75 hover:bg-white/10"
                  key={String(label)}
                  onClick={() => onAction(`${label} opened.`)}
                  type="button"
                >
                  <Icon className="h-4 w-4" aria-hidden />
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}

function ChannelSetup({ onAction }: { onAction: (message: string) => void }) {
  return (
    <div className="flex h-full items-center justify-center px-6 py-10 text-center">
      <div className="w-full max-w-lg">
        <h2 className="text-2xl font-bold">Add channels to reach more customers</h2>
        <p className="mt-3 text-sm font-semibold text-white/85">
          Add more communication channels so customers can reach you wherever they are.
        </p>
        <div className="mt-6 space-y-3">
          {channels.map((channel) => (
            <button
              className="flex h-20 w-full items-center gap-4 rounded-2xl bg-[#303036] px-7 text-left text-lg font-bold hover:bg-[#383840]"
              key={channel.name}
              onClick={() => onAction(`${channel.name} setup opened.`)}
              type="button"
            >
              <span className={cn("grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br text-sm", channel.tone)}>
                {channel.letter}
              </span>
              {channel.name}
            </button>
          ))}
        </div>
        <button
          className="mt-5 text-sm font-bold text-[#4ea2ff] hover:underline"
          onClick={() => onAction("All channels opened.")}
          type="button"
        >
          See all channels -&gt;
        </button>
      </div>
    </div>
  );
}

function TrafficScreen({
  chatLink,
  onAction,
  onCopy
}: {
  chatLink: string;
  onAction: (message: string) => void;
  onCopy: (text: string, copiedMessage?: string) => Promise<void>;
}) {
  return (
    <div className="min-h-full bg-[#1f1f23] text-white">
      <div className="flex overflow-x-auto border-b border-[#303036]">
        {trafficTabs.map((tab, index) => (
          <button
            className={cn(
              "shrink-0 border-b-2 px-4 py-4 text-sm font-bold",
              index === 0 ? "border-[#4ea2ff] text-[#4ea2ff]" : "border-transparent text-white hover:bg-white/5"
            )}
            key={tab}
            onClick={() => onAction(`${tab} selected.`)}
            type="button"
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-[#303036] px-4 py-3">
        <button className="grid h-9 w-9 place-items-center rounded-md bg-[#4ea2ff] text-black" type="button">
          <MousePointer2 className="h-4 w-4" aria-hidden />
        </button>
        <button
          className="flex h-9 items-center gap-3 rounded-md border border-[#595960] px-4 text-sm font-bold hover:bg-white/5"
          onClick={() => onAction("All filters matched.")}
          type="button"
        >
          Match all filters
          <ChevronDown className="h-4 w-4" aria-hidden />
        </button>
        <button
          className="flex h-9 items-center gap-2 rounded-md border border-[#595960] px-4 text-sm font-bold hover:bg-white/5"
          onClick={() => onAction("Filter builder opened.")}
          type="button"
        >
          <Plus className="h-4 w-4" aria-hidden />
          Add filter
        </button>
      </div>

      <div className="grid grid-cols-[1.2fr_1fr_1fr_1fr_1fr] border-b border-[#303036] text-sm font-bold text-white/60">
        {["Name", "Email", "Actions", "Activity", "Chatting with"].map((heading) => (
          <div className="border-r border-[#303036] px-4 py-3 last:border-r-0" key={heading}>
            {heading}
          </div>
        ))}
      </div>

      <div className="flex min-h-[350px] items-center justify-center px-6 text-center">
        <div className="max-w-lg">
          <h2 className="text-xl font-bold">Bring in customers from Facebook</h2>
          <p className="mt-3 text-sm text-white/75">
            Connect your Facebook page and respond to messages directly in the app.
          </p>
          <button
            className="mt-7 rounded-md bg-[#66adff] px-5 py-3 text-sm font-bold text-black hover:bg-[#4ea2ff]"
            onClick={() => onAction("Facebook page connection opened.")}
            type="button"
          >
            Connect Facebook page
          </button>
          <p className="mt-8 text-sm font-semibold text-white/80">
            Or share your chat link everywhere your customers are
          </p>
          <div className="mt-4 flex overflow-hidden rounded-md border border-[#595960] bg-[#29292f] text-left">
            <span className="min-w-0 flex-1 truncate px-4 py-3 text-sm font-bold">{chatLink}</span>
            <button
              className="flex items-center gap-2 border-l border-[#595960] px-4 text-sm font-bold hover:bg-white/10"
              onClick={() => void onCopy(chatLink, "Chat link copied.")}
              type="button"
            >
              <Copy className="h-4 w-4" aria-hidden />
              Copy
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AutomateScreen({ onAction }: { onAction: (message: string) => void }) {
  return (
    <div className="min-h-full bg-white px-6 py-8 text-black">
      <section className="mx-auto max-w-5xl text-center">
        <h2 className="text-2xl font-bold">
          Save <span className="text-[#5b21ff]">up to 50% of time</span> by automating customer service
        </h2>
        <div className="mt-6 flex flex-wrap justify-center gap-8 text-sm">
          {["provide 24/7 availability", "respond 3x faster", "improve customer satisfaction"].map((item) => (
            <span className="flex items-center gap-2" key={item}>
              <CheckCircle2 className="h-5 w-5 text-[#6d28d9]" aria-hidden />
              {item}
            </span>
          ))}
        </div>
      </section>

      <section className="mx-auto mt-12 grid max-w-5xl gap-6 rounded-2xl bg-[#e7f3ff] px-7 py-12 md:grid-cols-[1fr_1fr]">
        <div className="flex flex-col justify-center">
          <h3 className="text-2xl font-bold">Support and sell automatically with ChatBot</h3>
          <p className="mt-4 max-w-sm text-base leading-7">
            Build a bot with no coding skills that provides round-the-clock support and handles thousands of chats at the same time.
          </p>
          <button
            className="mt-5 w-fit rounded-md bg-[#111214] px-4 py-3 text-sm font-bold text-white hover:bg-black"
            onClick={() => onAction("ChatBot setup opened.")}
            type="button"
          >
            Set up ChatBot
          </button>
        </div>

        <div className="flex min-h-[260px] items-center justify-center">
          <div className="w-full max-w-md space-y-3">
            <div className="mr-auto w-fit rounded-xl bg-white px-5 py-4 text-sm shadow-lg">Hi there!</div>
            <div className="ml-auto max-w-xs rounded-xl bg-[#0067ff] px-5 py-4 text-sm leading-6 text-white shadow-lg">
              Hey Anne! Good to see you again. How are you liking your new TV?
            </div>
            <div className="ml-auto flex w-fit items-center gap-2 rounded-full bg-white px-3 py-2 text-sm shadow">
              <Bot className="h-4 w-4 text-[#0067ff]" aria-hidden />
              AI suggested reply
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function ArchivesScreen({
  messages,
  onAction,
  onOpenChat,
  selectedConversation
}: {
  messages: Message[];
  onAction: (message: string) => void;
  onOpenChat: () => void;
  selectedConversation: Conversation | null;
}) {
  const archiveItems = Array.from({ length: 8 }, (_, index) => ({
    date: index < 1 ? "10 Jun 2026" : index < 3 ? "09 Jun 2026" : "08 Jun 2026",
    preview: index === 0 ? "AS: Hey there! AS: It's Amber here" : "AS: Are you looking to get your book published?"
  }));

  return (
    <div className="grid min-h-full grid-cols-1 bg-white text-black xl:grid-cols-[330px_minmax(0,1fr)_320px]">
      <aside className="border-b border-slate-200 xl:border-b-0 xl:border-r">
        <div className="flex h-14 items-center justify-between border-b border-slate-200 px-4">
          <h2 className="text-xl font-bold">Archives</h2>
          <SlidersHorizontal className="h-5 w-5" aria-hidden />
        </div>
        <div className="p-4">
          <label className="relative block">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-500" aria-hidden />
            <input
              className="h-10 w-full rounded-md border border-slate-300 pl-9 text-sm outline-none focus:border-[#0067ff]"
              placeholder="Search in archives..."
            />
          </label>
          <button
            className="mt-3 flex h-9 items-center gap-2 rounded-md border border-slate-300 px-4 text-sm font-bold hover:bg-slate-50"
            onClick={() => onAction("Archive filter opened.")}
            type="button"
          >
            <Plus className="h-4 w-4" aria-hidden />
            Add filter
          </button>
          <div className="mt-3 flex items-center justify-between text-sm">
            <span className="text-slate-500">1,180 chats</span>
            <button className="flex items-center gap-2 font-bold" type="button">
              Newest
              <ChevronDown className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>
        <div className="max-h-[420px] overflow-auto">
          {archiveItems.map((item, index) => (
            <button
              className={cn(
                "w-full border-b border-slate-100 px-5 py-3 text-left hover:bg-slate-50",
                index === 0 && "bg-slate-100"
              )}
              key={`${item.date}-${index}`}
              onClick={() => onAction("Archived chat selected.")}
              type="button"
            >
              <div className="flex justify-between gap-3">
                <span className="font-bold text-slate-700">Unnamed customer</span>
                <span className="text-xs text-slate-500">{item.date}</span>
              </div>
              <p className="mt-1 text-sm text-slate-500">Agent: Amber Smith</p>
              <p className="mt-2 truncate text-sm text-slate-700">{item.preview}</p>
            </button>
          ))}
        </div>
      </aside>

      <section className="flex min-h-[520px] flex-col">
        <div className="flex h-14 items-center justify-between border-b border-slate-200 px-5">
          <h2 className="truncate text-lg font-bold">
            {(selectedConversation?.subject ?? "Unnamed customer") + " and Amber Smith"}
          </h2>
          <div className="flex gap-3 text-slate-700">
            <Link2 className="h-5 w-5" aria-hidden />
            <MoreHorizontal className="h-5 w-5" aria-hidden />
          </div>
        </div>
        <div className="flex-1 overflow-auto px-6 py-7">
          <div className="mb-7 flex items-center gap-3 text-xs text-slate-500">
            <span className="h-px flex-1 bg-slate-200" />
            <span className="rounded-full bg-slate-50 px-3 py-1">Started - Wed 06/10/2026 05:15 pm</span>
            <span className="h-px flex-1 bg-slate-200" />
          </div>
          <ArchiveTranscript messages={messages} />
        </div>
        <div className="border-t border-slate-200 px-6 py-5 text-center">
          <p className="text-sm">This chat has been archived.</p>
          <button
            className="mt-4 rounded-md border border-slate-300 px-10 py-2 text-sm font-bold hover:bg-slate-50"
            onClick={onOpenChat}
            type="button"
          >
            Open chat
          </button>
          <button
            className="mt-5 flex items-center gap-2 text-sm font-bold"
            onClick={() => onAction("Tag picker opened.")}
            type="button"
          >
            <Tag className="h-4 w-4" aria-hidden />
            Add tag
          </button>
        </div>
      </section>

      <aside className="border-t border-slate-200 xl:border-l xl:border-t-0">
        <div className="flex h-14 items-center gap-4 border-b border-slate-200 px-5">
          <UserRound className="h-5 w-5" aria-hidden />
          <Plus className="h-5 w-5" aria-hidden />
          <X className="ml-auto h-5 w-5" aria-hidden />
        </div>
        <div className="space-y-3 p-4">
          <DetailCard title="General info">
            <div className="flex items-center gap-4">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-violet-600 text-xl font-bold text-white">U</span>
              <span className="font-bold">Unnamed customer</span>
            </div>
            <InfoLine icon={Clock3} label="06:49 pm local time" />
            <InfoLine icon={MapPin} label="Geneva, Geneva, Switzerland" />
            <button className="mt-3 w-full rounded-md border border-slate-300 py-2 text-sm font-bold hover:bg-slate-50" type="button">
              View all chats
            </button>
          </DetailCard>
          <DetailCard title="Chat info">
            <p className="text-sm text-slate-600">Chat ID: TG2FX02Q1N</p>
            <p className="text-sm text-slate-600">Chatting time: 4 min 23 s</p>
            <p className="text-sm text-slate-600">Source: Website widget</p>
          </DetailCard>
        </div>
      </aside>
    </div>
  );
}

function TeamScreen({ onAction, user }: { onAction: (message: string) => void; user: AuthUser | null }) {
  return (
    <div className="grid min-h-full grid-cols-1 bg-white text-black xl:grid-cols-[minmax(0,1fr)_330px]">
      <section>
        <div className="border-b border-slate-200 px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-7 text-sm font-semibold">
              {["Agents", "Chatbots", "Groups", "Suspended agents"].map((tab, index) => (
                <button
                  className={cn("border-b-2 py-2", index === 0 ? "border-[#0067ff] text-[#0067ff]" : "border-transparent")}
                  key={tab}
                  onClick={() => onAction(`${tab} selected.`)}
                  type="button"
                >
                  {tab}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button className="rounded-md border border-slate-300 px-3 py-2 text-sm font-bold hover:bg-slate-50" type="button">
                Add new chatbot
              </button>
              <button
                className="rounded-md bg-[#0067ff] px-3 py-2 text-sm font-bold text-white hover:bg-[#0050c7]"
                onClick={() => onAction("Invite agents modal opened.")}
                type="button"
              >
                + Invite agents
              </button>
            </div>
          </div>
          <label className="relative mt-4 block w-full max-w-xs">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" aria-hidden />
            <input className="h-9 w-full rounded-md border border-slate-300 pl-9 text-sm outline-none" placeholder="Search agent" />
          </label>
        </div>

        <div className="px-4 py-4">
          <h3 className="mb-4 text-sm font-bold">Active (3)</h3>
          <div className="grid grid-cols-[minmax(220px,1fr)_180px_220px_42px] border-b border-slate-200 px-3 py-2 text-xs text-slate-500">
            <span>Name</span>
            <span>Role</span>
            <span>Status</span>
            <span />
          </div>
          <button
            className="flex w-full items-center gap-4 border-b border-slate-100 px-3 py-4 text-left hover:bg-slate-50"
            onClick={() => onAction("Add new agent form opened.")}
            type="button"
          >
            <span className="grid h-9 w-9 place-items-center rounded-full border border-slate-300">
              <Plus className="h-5 w-5" aria-hidden />
            </span>
            <span className="text-sm">Add new agent</span>
          </button>

          {agents.map((agent, index) => (
            <button
              className={cn(
                "grid w-full grid-cols-[minmax(220px,1fr)_180px_220px_42px] items-center border-b border-slate-100 px-3 py-3 text-left hover:bg-slate-50",
                index === 0 && "bg-slate-100"
              )}
              key={agent.email}
              onClick={() => onAction(`${agent.name} details opened.`)}
              type="button"
            >
              <span className="flex items-center gap-3">
                <span className={cn("grid h-10 w-10 place-items-center rounded-full text-sm font-bold", agent.tone)}>
                  {initials(agent.name, agent.email)}
                </span>
                <span>
                  <span className="block text-sm font-bold">
                    {index === 0 ? user?.name ?? agent.name : agent.name}
                    {index === 0 && " (You)"}
                  </span>
                  <span className="block text-xs text-slate-600">{index === 0 ? user?.email ?? agent.email : agent.email}</span>
                </span>
              </span>
              <span>
                <span className={cn("rounded px-2 py-1 text-xs font-bold", index === 0 ? "bg-black text-white" : "bg-blue-100 text-blue-700")}>
                  {agent.role}
                </span>
              </span>
              <span className="text-sm">
                <span className={cn("mr-2 inline-block h-2 w-2 rounded-full", agent.status === "Accepting chats" ? "bg-emerald-500" : "bg-slate-400")} />
                {agent.status}
              </span>
              <MoreHorizontal className="h-5 w-5" aria-hidden />
            </button>
          ))}
        </div>
      </section>

      <aside className="border-t border-slate-200 xl:border-l xl:border-t-0">
        <div className="flex h-14 items-center justify-between border-b border-slate-200 px-5">
          <h3 className="font-bold">Details</h3>
          <X className="h-5 w-5" aria-hidden />
        </div>
        <div className="space-y-5 p-5">
          <div className="flex gap-4">
            <span className="relative grid h-14 w-14 place-items-center rounded-full bg-orange-200 text-lg font-bold text-orange-900">
              BF
              <span className="absolute right-0 top-0 h-3 w-3 rounded-full border-2 border-white bg-emerald-500" />
            </span>
            <div>
              <p className="font-bold">Benjamin Foster <span className="rounded bg-black px-1.5 py-0.5 text-[10px] text-white">Owner</span></p>
              <p className="text-sm text-slate-600">Head of Production</p>
              <p className="text-sm text-slate-600">i3540845@gmail.com</p>
            </div>
          </div>
          <div className="space-y-2 border-t border-slate-200 pt-4 text-sm text-slate-700">
            <p>Chat limit: <b>6 concurrent chats</b></p>
            <p>Login status: <b>Accepting chats</b></p>
            <p>Last seen: <b>Just now</b></p>
          </div>
          <DetailAccordion title="Groups (1)" value="General" />
          <DetailAccordion title="Working hours" value="Set working hours to better manage staffing." />
          <DetailAccordion title="Performance" value="Total chats, goals, and ratings." />
        </div>
      </aside>
    </div>
  );
}

function ReportsScreen({ totalChats }: { totalChats: number }) {
  const bars = [totalChats, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05];
  const max = Math.max(...bars, 2);

  return (
    <div className="min-h-full bg-white px-7 py-6 text-black">
      <div className="rounded-md border border-slate-200 p-4">
        <div className="flex flex-wrap justify-between gap-3">
          <div>
            <p className="text-sm font-bold">Total chats</p>
            <div className="mt-7 flex items-center gap-2">
              <span className="text-lg font-bold">{totalChats}</span>
              <span className="rounded bg-slate-100 px-2 py-1 text-[11px] text-slate-500">
                -4 from previous 7 days
              </span>
            </div>
          </div>
          <SegmentedControl first="My stats" light second="All agents" />
        </div>
        <div className="mt-8 grid h-48 grid-cols-[24px_minmax(0,1fr)] gap-2">
          <div className="flex flex-col justify-between pb-7 text-xs text-slate-500">
            <span>2</span>
            <span>1</span>
            <span>0</span>
          </div>
          <div className="relative border-b border-slate-200">
            <div className="absolute inset-x-0 top-0 border-t border-slate-200" />
            <div className="absolute inset-x-0 top-1/2 border-t border-slate-200" />
            <div className="absolute inset-x-0 bottom-0 border-t border-slate-200" />
            <div className="relative z-10 flex h-full items-end justify-around pb-6">
              {["Wed", "Thu", "Fri", "Sat", "Sun", "Mon", "Tue"].map((day, index) => (
                <div className="flex h-full w-14 flex-col items-center justify-end gap-2" key={day}>
                  <div
                    className="w-14 rounded-t-sm bg-[#0a84ff]"
                    style={{ height: `${Math.max(((bars[index] ?? 0) / max) * 120, 2)}px` }}
                  />
                  <span className="text-xs text-slate-600">{day}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-5 grid gap-4 border-t border-slate-200 pt-5 md:grid-cols-2">
          <LightMetric icon={UsersRound} label="Queued visitors" value="0" />
          <LightMetric buttonLabel="+ Add" icon={ShoppingCart} label="Goals" value="" />
          <LightMetric icon={ThumbsUp} label="Chat satisfaction" value="-" />
          <LightMetric buttonLabel="+ Add" icon={ShoppingCart} label="Sales" value="" />
        </div>
      </div>
      <p className="mt-3 text-center text-xs text-slate-400">
        This report was generated on 16 Jun 2026 at 09:50:34 PM
      </p>
    </div>
  );
}

function AppsScreen({ onAction }: { onAction: (message: string) => void }) {
  return (
    <div className="min-h-full bg-white px-6 py-6 text-black">
      <h2 className="mb-5 text-lg font-bold">Collections</h2>
      <div className="grid gap-4 lg:grid-cols-4">
        {[
          ["By text", "Apps from the Text team designed to simplify your day-to-day tasks.", "bg-slate-100"],
          ["AI-Powered", "Extend your workspace with AI apps that boost customer service.", "bg-violet-50"],
          ["New & Noteworthy", "High-quality apps recognized by LiveChat experts.", "bg-blue-50"],
          ["Staff Top Picks", "Feature-rich apps with a great experience.", "bg-green-100"]
        ].map(([title, copy, tone]) => (
          <button
            className={cn("min-h-[102px] rounded-md p-4 text-left hover:shadow-md", tone)}
            key={title}
            onClick={() => onAction(`${title} collection opened.`)}
            type="button"
          >
            <p className="font-bold">{title}</p>
            <p className="mt-2 text-sm leading-5 text-slate-700">{copy}</p>
          </button>
        ))}
      </div>

      <div className="mt-7 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold">All Apps</h2>
        <div className="flex flex-wrap gap-2">
          {["Categories: all", "Payment type: all", "Placement: all"].map((filter) => (
            <button
              className="rounded-md border border-slate-300 px-3 py-2 text-xs font-bold hover:bg-slate-50"
              key={filter}
              onClick={() => onAction(`${filter} filter opened.`)}
              type="button"
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 grid gap-4 lg:grid-cols-3">
        {appCards.map((card) => (
          <button
            className="rounded-md border border-slate-300 p-4 text-left hover:border-[#0067ff] hover:shadow-sm"
            key={card.name}
            onClick={() => onAction(`${card.name} opened.`)}
            type="button"
          >
            <div className="flex gap-4">
              <span className="grid h-11 w-11 place-items-center border-4 border-black text-sm font-black">
                {card.accent}
              </span>
              <span>
                <span className="block text-base font-bold text-slate-700">{card.name}</span>
                <span className="mt-1 block text-xs text-slate-500">{card.price}</span>
              </span>
            </div>
            <p className="mt-3 text-sm leading-5 text-slate-700">{card.copy}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

function TicketsScreen({ onAction }: { onAction: (message: string) => void }) {
  return (
    <div className="flex min-h-full items-center justify-center bg-white px-8 py-10 text-black">
      <div className="grid w-full max-w-4xl gap-10 md:grid-cols-[1fr_320px]">
        <div className="flex items-center gap-5">
          <SquareCheckBig className="h-10 w-10 text-emerald-500" aria-hidden />
          <div>
            <h2 className="max-w-lg text-2xl font-bold">
              Save 670 working hours per year on support with the ticketing system
            </h2>
            <p className="mt-5 max-w-lg text-sm leading-6">
              Transform chats and emails into tickets and reclaim hundreds of hours each year.
            </p>
            <button
              className="mt-5 rounded-md bg-[#0067ff] px-5 py-3 text-sm font-bold text-white hover:bg-[#0050c7]"
              onClick={() => onAction("HelpDesk ticketing setup opened.")}
              type="button"
            >
              Add HelpDesk ticketing system
            </button>
          </div>
        </div>
        <div className="rounded-xl bg-green-100 p-5 shadow-xl">
          <TicketFlow />
        </div>
      </div>
    </div>
  );
}

function BillingScreen({ onAction }: { onAction: (message: string) => void }) {
  return (
    <div className="min-h-full bg-white px-8 py-8 text-black">
      <div className="mx-auto grid max-w-4xl gap-10 lg:grid-cols-[1fr_240px]">
        <section>
          <div className="mb-8 flex items-center justify-between">
            <h2 className="font-bold">Your subscription</h2>
            <button
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-bold hover:bg-slate-50"
              onClick={() => onAction("Subscription management opened.")}
              type="button"
            >
              Manage
            </button>
          </div>
          <div className="border-t border-slate-200 py-4">
            <p className="mb-3 text-xs uppercase text-slate-500">Current plan</p>
            <div className="flex items-start justify-between gap-4">
              <div className="flex gap-3">
                <span className="grid h-7 w-7 place-items-center rounded-md border border-orange-500 text-orange-500">
                  <MessageCircle className="h-4 w-4" aria-hidden />
                </span>
                <div>
                  <p className="font-bold">Team plan for 3 agents</p>
                  <p className="text-xs text-slate-500">Renews on: Jul 03, 2026 (Monthly)</p>
                </div>
              </div>
              <p className="font-bold">$177 / mo</p>
            </div>
          </div>
          <div className="border-t border-slate-200 py-4">
            <p className="mb-3 text-xs uppercase text-slate-500">Add-ons</p>
            <p className="text-sm text-slate-600">
              No addons yet. <button className="font-semibold text-[#0067ff]" onClick={() => onAction("Marketplace opened.")} type="button">Explore Marketplace</button>
            </p>
          </div>
          <div className="flex justify-between border-t border-slate-200 py-5 font-bold">
            <span>Monthly total</span>
            <span>$177 / mo</span>
          </div>
        </section>

        <aside className="rounded-md border border-slate-200 p-5">
          <h3 className="font-bold">Get more with Business plan</h3>
          <div className="mt-5 space-y-4 text-sm">
            <InfoLine icon={Clock3} label="Set your team's working hours" />
            <InfoLine icon={Gauge} label="Track agent performance and activity" />
            <InfoLine icon={Mail} label="Get custom reports delivered to your mailbox" />
          </div>
          <button
            className="mt-5 w-full rounded-md bg-[#0067ff] py-3 text-sm font-bold text-white hover:bg-[#0050c7]"
            onClick={() => onAction("Upgrade flow opened.")}
            type="button"
          >
            Upgrade now
          </button>
        </aside>
      </div>
    </div>
  );
}

function SettingsScreen({
  chatLink,
  onAction,
  onCopy
}: {
  chatLink: string;
  onAction: (message: string) => void;
  onCopy: (text: string, copiedMessage?: string) => Promise<void>;
}) {
  const snippet = `<script>
  window.LiveChatWidget = window.LiveChatWidget || {};
  window.LiveChatWidget.license = "100170061";
  window.LiveChatWidget.chatLink = "${chatLink}";
</script>`;

  return (
    <div className="min-h-full bg-white px-6 py-6 text-black">
      <div className="mb-4">
        <h2 className="font-bold">Install website widget <span className="rounded bg-emerald-100 px-2 py-1 text-xs text-emerald-700">Installed</span></h2>
        <p className="mt-2 text-sm text-slate-600">
          To see LiveChat on your website, add a bit of code or configure an integration.
          <button className="ml-1 text-[#0067ff]" onClick={() => onAction("Install guide opened.")} type="button">Learn more</button>
        </p>
      </div>

      <div className="max-w-md rounded-md border border-[#0067ff] p-5">
        <div className="flex items-start gap-4">
          <Monitor className="h-8 w-8 text-slate-600" aria-hidden />
          <div>
            <h3 className="font-bold">Install chat widget manually</h3>
            <p className="mt-4 text-sm leading-6">
              Copy and paste this code before the <b>&lt;/body&gt;</b> tag on every page of your website.
            </p>
          </div>
        </div>

        <div className="relative mx-auto mt-8 max-h-48 overflow-hidden rounded-md bg-white p-6 shadow-xl">
          <button
            className="absolute right-3 top-[-18px] flex items-center gap-2 rounded-md bg-[#0067ff] px-4 py-2 text-sm font-bold text-white hover:bg-[#0050c7]"
            onClick={() => void onCopy(snippet, "Widget code copied.")}
            type="button"
          >
            <Copy className="h-4 w-4" aria-hidden />
            Copy code
          </button>
          <pre className="whitespace-pre-wrap text-xs leading-5 text-slate-600">{snippet}</pre>
        </div>

        <div className="mt-6">
          <p className="mb-2 text-sm font-bold">Need help?</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              className="rounded-md border border-slate-300 py-2 text-sm font-bold hover:bg-slate-50"
              onClick={() => onAction("Developer invite opened.")}
              type="button"
            >
              + Invite your developer
            </button>
            <button
              className="rounded-md border border-slate-300 py-2 text-sm font-bold hover:bg-slate-50"
              onClick={() => onAction("Install guide opened.")}
              type="button"
            >
              Check install guide
            </button>
          </div>
        </div>
      </div>

      <div className="mt-8 grid max-w-md gap-3">
        {settingsIntegrations.map(({ icon: Icon, label }) => (
          <button
            className="flex items-center justify-between rounded-md border border-slate-200 px-4 py-3 text-left text-sm font-bold hover:bg-slate-50"
            key={String(label)}
            onClick={() => onAction(`${label} opened.`)}
            type="button"
          >
            <span className="flex items-center gap-3">
              <Icon className="h-4 w-4" aria-hidden />
              {label}
            </span>
            <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
        ))}
      </div>
    </div>
  );
}

function BottomChatWidget({
  draft,
  onChange,
  onSubmit
}: {
  draft: string;
  onChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div className="fixed bottom-3 right-3 z-40 flex max-w-[calc(100vw-56px)] items-center gap-2">
      <form
        className="flex h-12 w-[260px] max-w-[70vw] items-center gap-2 rounded-full bg-white px-4 text-slate-900 shadow-xl"
        onSubmit={onSubmit}
      >
        <input
          className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-slate-500"
          onChange={(event) => onChange(event.target.value)}
          placeholder="Write a message..."
          value={draft}
        />
        <button className="grid h-9 w-9 place-items-center rounded-full bg-slate-200 text-slate-700" type="submit">
          <SendHorizontal className="h-4 w-4" aria-hidden />
        </button>
      </form>
      <button
        className="grid h-14 w-14 place-items-center rounded-full bg-[#ff5a00] text-white shadow-xl hover:bg-[#e84f00]"
        type="button"
      >
        <MessageCircle className="h-7 w-7" aria-hidden />
      </button>
    </div>
  );
}

function ProfileMenu({
  onAction,
  onClose,
  onLogout,
  user
}: {
  onAction: (message: string) => void;
  onClose: () => void;
  onLogout: () => void;
  user: AuthUser | null;
}) {
  return (
    <div className="fixed bottom-10 left-1 z-50 w-56 overflow-hidden rounded-sm bg-white text-[#172033] shadow-2xl">
      <div className="flex items-center justify-between border-b border-slate-200 p-3">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-orange-100 text-sm font-bold text-orange-900">
            {initials(user?.name, user?.email ?? "agent@example.com")}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold">{user?.name ?? "Benjamin Foster"}</p>
            <p className="truncate text-xs text-slate-600">{user?.email ?? "i3540845@gmail.com"}</p>
          </div>
        </div>
        <button onClick={onClose} type="button">
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
      <div className="divide-y divide-slate-200 text-sm">
        <ToggleRow checked label="Accept chats" />
        <ToggleRow checked label="Dark mode" />
        <button className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-slate-50" onClick={() => onAction("Notification preferences opened.")} type="button">
          Notification preferences
          <span className="grid h-4 w-4 place-items-center rounded-full bg-red-600 text-[10px] font-bold text-white">1</span>
        </button>
        <button className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-slate-50" onClick={() => onAction("Download apps opened.")} type="button">
          Download apps
          <span className="flex gap-2 text-slate-500">
            <Monitor className="h-4 w-4" aria-hidden />
            <Download className="h-4 w-4" aria-hidden />
          </span>
        </button>
        {["Help Center", "Report an issue", "Keyboard shortcuts", "Company details"].map((item) => (
          <button
            className="block w-full px-3 py-2 text-left hover:bg-slate-50"
            key={item}
            onClick={() => onAction(`${item} opened.`)}
            type="button"
          >
            {item}
          </button>
        ))}
        <button className="block w-full px-3 py-3 text-left text-sm hover:bg-slate-50" onClick={onLogout} type="button">
          Log out
        </button>
      </div>
    </div>
  );
}

function NotificationPanel({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed right-2 top-9 z-50 w-72 rounded-lg border border-[#303036] bg-[#1f1f23] p-4 text-white shadow-2xl">
      <div className="flex items-center justify-between">
        <h3 className="font-bold">Notifications</h3>
        <button onClick={onClose} type="button">
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
      <div className="mt-4 rounded-md bg-[#29292f] p-3 text-sm">
        <p className="font-bold">New ticket rule ready</p>
        <p className="mt-1 text-white/60">Automation can route urgent billing chats to owners.</p>
      </div>
    </div>
  );
}

function DarkMetric({ label, suffix, value }: { label: string; suffix?: string; value: string }) {
  return (
    <div className="rounded-md bg-[#242428] p-5">
      <p className="text-xs font-bold">{label}</p>
      <div className="mt-3 flex items-end gap-2">
        <span className="text-5xl font-bold leading-none">{value}</span>
        {suffix && <span className="pb-1 text-xs font-bold">{suffix}</span>}
      </div>
    </div>
  );
}

function SegmentedControl({ first, light, second }: { first: string; light?: boolean; second: string }) {
  return (
    <div className={cn("flex rounded-md border p-0.5", light ? "border-slate-200" : "border-[#424249]")}>
      {[first, second].map((label, index) => (
        <button
          className={cn(
            "rounded px-3 py-1.5 text-xs font-bold",
            index === 1
              ? light
                ? "bg-slate-100"
                : "bg-[#33333a]"
              : "bg-transparent"
          )}
          key={label}
          type="button"
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function MetricRow({
  buttonLabel,
  icon: Icon,
  label,
  onClick,
  value
}: {
  buttonLabel?: string;
  icon: IconComponent;
  label: string;
  onClick?: () => void;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-3">
      <span className="flex items-center gap-2 text-xs font-bold">
        <Icon className="h-4 w-4" aria-hidden />
        {label}
      </span>
      {buttonLabel ? (
        <button
          className="rounded-md border border-[#55555c] px-3 py-1.5 text-xs font-bold hover:bg-white/10"
          onClick={onClick}
          type="button"
        >
          {buttonLabel}
        </button>
      ) : (
        <span className="font-bold">{value}</span>
      )}
    </div>
  );
}

function LightMetric({
  buttonLabel,
  icon: Icon,
  label,
  value
}: {
  buttonLabel?: string;
  icon: IconComponent;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="flex items-center gap-2 text-sm font-semibold">
        <Icon className="h-4 w-4" aria-hidden />
        {label}
      </span>
      {buttonLabel ? (
        <button className="rounded-md border border-slate-300 px-4 py-2 text-sm font-bold hover:bg-slate-50" type="button">
          {buttonLabel}
        </button>
      ) : (
        <span className="font-bold">{value}</span>
      )}
    </div>
  );
}

function MessageTimeline({ messages }: { messages: Message[] }) {
  if (messages.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-center">
        <div>
          <MessageSquareText className="mx-auto h-10 w-10 text-white/35" aria-hidden />
          <p className="mt-3 text-sm font-bold text-white/70">No messages yet</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {messages.map((message) => {
        const isAgent = message.senderType === "AGENT";

        return (
          <div className={cn("flex", isAgent ? "justify-end" : "justify-start")} key={message.id}>
            <div
              className={cn(
                "max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm",
                isAgent ? "rounded-br-md bg-[#0067ff] text-white" : "rounded-bl-md bg-[#303036] text-white"
              )}
            >
              <p>{message.body ?? "Attachment"}</p>
              <p className={cn("mt-2 text-[10px]", isAgent ? "text-blue-100" : "text-white/45")}>
                {formatTime(message.createdAt)}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ArchiveTranscript({ messages }: { messages: Message[] }) {
  const fallback = [
    "Hey there!",
    "It's Amber here",
    "Are you looking to get your book published?",
    "Also, I'm a live representative here to assist"
  ];
  const transcript = messages.length > 0 ? messages.map((message) => message.body ?? "Attachment") : fallback;

  return (
    <div className="space-y-2">
      {transcript.map((body, index) => (
        <div className="flex justify-end" key={`${body}-${index}`}>
          <div className="max-w-[78%] rounded-xl rounded-br-sm bg-[#0067ff] px-5 py-3 text-sm text-white">
            {body}
          </div>
        </div>
      ))}
      <p className="pt-4 text-center text-xs text-slate-500">Archived - customer left the chat - 05:20 pm</p>
    </div>
  );
}

function IconButton({
  dark,
  icon: Icon,
  label,
  onClick
}: {
  dark?: boolean;
  icon: IconComponent;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-label={label}
      className={cn(
        "grid h-9 w-9 place-items-center rounded-md",
        dark ? "text-white/80 hover:bg-white/10 hover:text-white" : "text-slate-700 hover:bg-slate-100"
      )}
      onClick={onClick}
      title={label}
      type="button"
    >
      <Icon className="h-4 w-4" aria-hidden />
    </button>
  );
}

function SkeletonLines() {
  return (
    <div className="space-y-5">
      {[0, 1, 2].map((row) => (
        <div className="space-y-2" key={row}>
          <div className="h-3 w-24 rounded bg-[#303036]" />
          <div className="h-3 w-40 rounded bg-[#303036]" />
        </div>
      ))}
    </div>
  );
}

function DetailCard({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <div className="rounded-md border border-slate-200 p-4">
      <h3 className="mb-4 text-lg font-bold">{title}</h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function InfoLine({ icon: Icon, label }: { icon: IconComponent; label: string }) {
  return (
    <p className="flex items-center gap-2 text-sm">
      <Icon className="h-4 w-4" aria-hidden />
      <span>{label}</span>
    </p>
  );
}

function DetailAccordion({ title, value }: { title: string; value: string }) {
  return (
    <div className="border-t border-slate-200 pt-4">
      <button className="flex w-full items-center justify-between text-left font-bold" type="button">
        {title}
        <ChevronDown className="h-4 w-4" aria-hidden />
      </button>
      <p className="mt-3 rounded-md bg-slate-50 p-3 text-sm text-slate-600">{value}</p>
    </div>
  );
}

function TicketFlow() {
  return (
    <div className="space-y-4 text-sm">
      <div className="rounded-lg bg-white p-3 shadow">
        <p className="font-bold">Can't access account</p>
        <p className="text-xs text-slate-500">Peter Lawson - To: Help Center</p>
      </div>
      <div className="mx-auto w-fit rounded-md bg-white px-4 py-2 font-bold shadow">New ticket</div>
      <div className="mx-auto w-fit rounded-md bg-white px-4 py-2 font-bold text-red-600 shadow">Urgent</div>
      <div className="mx-auto w-fit rounded-md bg-white px-4 py-2 font-bold text-blue-700 shadow">IT Support</div>
      <div className="mx-auto w-fit rounded-md bg-emerald-600 px-4 py-2 font-bold text-white shadow">
        Automatically send a reply
      </div>
      <div className="rounded-lg bg-white p-3 shadow">
        <p className="font-bold">All tickets</p>
        <div className="mt-3 space-y-2 text-xs text-slate-600">
          <p>Peter Lawson - Can't access account</p>
          <p>Carla Zin - Issue with payment</p>
        </div>
      </div>
    </div>
  );
}

function ToggleRow({ checked, label }: { checked?: boolean; label: string }) {
  return (
    <button className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-slate-50" type="button">
      {label}
      <span className={cn("flex h-4 w-7 items-center rounded-full px-0.5", checked ? "justify-end bg-emerald-600" : "justify-start bg-slate-300")}>
        <span className="h-3 w-3 rounded-full bg-white shadow" />
      </span>
    </button>
  );
}

function formatTime(value: string | null) {
  if (!value) {
    return "Just now";
  }

  return new Intl.DateTimeFormat("en", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}
