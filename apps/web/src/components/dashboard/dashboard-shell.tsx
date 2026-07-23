"use client";

import {
  type ComponentType,
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { useRouter } from "next/navigation";
import { io, type Socket } from "socket.io-client";
import {
  Accessibility,
  Archive,
  ArrowRight,
  BarChart3,
  Bell,
  Blocks,
  BookOpen,
  Bot,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Ban,
  ClipboardList,
  Clock3,
  Ticket as TicketIcon,
  Copy,
  CreditCard,
  Database,
  Download,
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
  Volume2,
  VolumeX,
  X,
  Zap
} from "lucide-react";
import {
  assignConversation as assignConversationRequest,
  cancelSubscription as cancelSubscriptionRequest,
  convertConversationToTicket as convertConversationToTicketRequest,
  listInvoices,
  downloadInvoicePdf,
  createAutomationRule as createAutomationRuleRequest,
  createCampaign as createCampaignRequest,
  createCannedResponse as createCannedResponseRequest,
  createApiKey as createApiKeyRequest,
  createConversation as createConversationRequest,
  createDepartment as createDepartmentRequest,
  createGoal as createGoalRequest,
  createKnowledge as createKnowledgeRequest,
  createTicket as createTicketRequest,
  createWebhook as createWebhookRequest,
  deleteAutomationRule as deleteAutomationRuleRequest,
  deleteCampaign as deleteCampaignRequest,
  deleteCannedResponse as deleteCannedResponseRequest,
  deleteDepartment as deleteDepartmentRequest,
  deleteGoal as deleteGoalRequest,
  deleteKnowledge as deleteKnowledgeRequest,
  deleteTicket as deleteTicketRequest,
  deleteWebhook as deleteWebhookRequest,
  listApiKeys,
  listCampaigns,
  listGoals,
  listKnowledge,
  listTickets,
  listWebhooks,
  updateKnowledge as updateKnowledgeRequest,
  revokeApiKey as revokeApiKeyRequest,
  updateCampaign as updateCampaignRequest,
  updateTicket as updateTicketRequest,
  getBillingOverview,
  listAutomationRules,
  updateAutomationRule as updateAutomationRuleRequest,
  getDefaultWidgetInstall,
  getCurrentUser,
  getReportSummary,
  subscribePlan as subscribePlanRequest,
  inviteMember as inviteMemberRequest,
  removeMember as removeMemberRequest,
  updateMember as updateMemberRequest,
  updateOrganization as updateOrganizationRequest,
  listCannedResponses,
  listConversations,
  listDepartments,
  listLiveVisitors,
  clearVisitorData as clearVisitorDataRequest,
  exportOrgData,
  listMembers,
  listMessages,
  listOrganizations,
  refreshAccessToken,
  setDepartmentAgents as setDepartmentAgentsRequest,
  sendMessage as sendMessageRequest,
  suggestReply as suggestReplyRequest,
  updateConversation as updateConversationRequest,
  updateConversationTags as updateConversationTagsRequest,
  updateWidgetInstall as updateWidgetInstallRequest,
  uploadAttachment as uploadAttachmentRequest
} from "@/lib/api";
import { cn } from "@/lib/cn";
import { initials } from "@/lib/format";
import { playChime, primeAudio, requestNotificationPermission, showBrowserNotification, speak } from "@/lib/notify";
import type { VoiceGender } from "@/lib/notify";
import { clearSession, readSession, type StoredSession } from "@/lib/session";
import type {
  ApiKey,
  AuthUser,
  AutomationRule,
  BillingInvoice,
  BillingOverview,
  BillingPlan,
  Campaign,
  FormField,
  MenuOption,
  CannedResponse,
  Conversation,
  ConversationStatus,
  Department,
  Goal,
  KnowledgeArticle,
  LiveVisitor,
  Ticket,
  Webhook,
  Message,
  Organization,
  OrganizationMember,
  ReportSummary,
  WidgetInstall
} from "@/lib/types";

type IconComponent = ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
type ChatSocket = Socket;

function agentLabel(member?: OrganizationMember): string {
  if (!member) {
    return "Unassigned";
  }

  return member.displayName || member.name || member.email;
}

interface MessageAttachment {
  fileName: string;
  mimeType: string;
  fileSize: number;
  url: string;
}

function readAttachment(message: Message): MessageAttachment | null {
  if (typeof message.metadata !== "object" || message.metadata === null) {
    return null;
  }

  const raw = (message.metadata as Record<string, unknown>).attachment;

  if (!raw || typeof raw !== "object") {
    return null;
  }

  const attachment = raw as Record<string, unknown>;

  if (typeof attachment.url !== "string" || typeof attachment.fileName !== "string") {
    return null;
  }

  return {
    fileName: attachment.fileName,
    mimeType: typeof attachment.mimeType === "string" ? attachment.mimeType : "",
    fileSize: typeof attachment.fileSize === "number" ? attachment.fileSize : 0,
    url: attachment.url
  };
}

interface ProductCard {
  title: string;
  price: string;
  image: string;
  url: string;
  description: string;
  buttonLabel: string;
}

function readProductCard(message: Message): ProductCard | null {
  if (typeof message.metadata !== "object" || message.metadata === null) {
    return null;
  }

  const raw = (message.metadata as Record<string, unknown>).productCard;
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const card = raw as Record<string, unknown>;
  const str = (value: unknown) => (typeof value === "string" ? value : "");
  if (!str(card.title)) {
    return null;
  }

  return {
    title: str(card.title),
    price: str(card.price),
    image: str(card.image),
    url: str(card.url),
    description: str(card.description),
    buttonLabel: str(card.buttonLabel)
  };
}

function readConversationTags(conversation: Conversation | null): string[] {
  if (!conversation || typeof conversation.metadata !== "object" || conversation.metadata === null) {
    return [];
  }

  const tags = (conversation.metadata as Record<string, unknown>).tags;
  return Array.isArray(tags) ? tags.filter((tag): tag is string => typeof tag === "string") : [];
}

function agentStatusLabel(agentStatus: string): string {
  switch (agentStatus) {
    case "ONLINE":
      return "Accepting chats";
    case "AWAY":
      return "Away";
    case "BUSY":
      return "Busy";
    default:
      return "Offline";
  }
}

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
    { label: "Goals", count: "0", muted: "active" }
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
    { label: "Summary" },
    { label: "Total chats" },
    { label: "Chat engagement" },
    { label: "Missed chats" },
    { label: "Campaigns conversion" },
    { label: "Tags usage" },
    { label: "Chat satisfaction" },
    { label: "Chat availability" },
    { label: "Chat duration" },
    { label: "Agents" },
    { label: "Customers" },
    { label: "Insights" },
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
    { label: "Company details" },
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

const chatToolItems: Array<{ icon: IconComponent; label: string }> = [
  { label: "Message sneak-peek", icon: MousePointer2 },
  { label: "Canned responses", icon: MessageSquareText },
  { label: "Chat transfer", icon: ArrowRight },
  { label: "Chat ratings", icon: ThumbsUp }
];

const settingsIntegrations: Array<{ icon: IconComponent; label: string }> = [
  { label: "Forms builder", icon: ClipboardList },
  { label: "Banned visitors", icon: Ban },
  { label: "Inactivity messages", icon: Clock3 },
  { label: "Working hours", icon: Clock3 },
  { label: "Eye-catcher", icon: Sparkles },
  { label: "Slack notifications", icon: Bell },
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

export function DashboardShell() {
  const router = useRouter();
  const [session, setSession] = useState<StoredSession | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [widgetInstall, setWidgetInstall] = useState<WidgetInstall | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isUpdatingConversation, setIsUpdatingConversation] = useState(false);
  const [unread, setUnread] = useState<Record<string, number>>({});
  const [connection, setConnection] = useState<"connecting" | "online" | "offline">("connecting");
  const [cannedResponses, setCannedResponses] = useState<CannedResponse[]>([]);
  const [report, setReport] = useState<ReportSummary | null>(null);
  const [liveVisitors, setLiveVisitors] = useState<LiveVisitor[]>([]);
  const [visitorPreviews, setVisitorPreviews] = useState<Record<string, string>>({});
  // Voice announcement for new visitors ("off" | "female" | "male"), persisted per browser.
  const [voiceAlert, setVoiceAlert] = useState<"off" | VoiceGender>("off");
  const seenVisitorIdsRef = useRef<Set<string>>(new Set());
  const voiceAlertRef = useRef<"off" | VoiceGender>("off");
  const visitorPreviewTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const [departments, setDepartments] = useState<Department[]>([]);
  const [billing, setBilling] = useState<BillingOverview | null>(null);
  const [invoices, setInvoices] = useState<BillingInvoice[]>([]);
  const [isBillingBusy, setIsBillingBusy] = useState(false);
  const [automationRules, setAutomationRules] = useState<AutomationRule[]>([]);
  const [knowledge, setKnowledge] = useState<KnowledgeArticle[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [revealedSecret, setRevealedSecret] = useState<{ label: string; secret: string } | null>(null);
  const [isSuggestingAi, setIsSuggestingAi] = useState(false);
  const [visitorTyping, setVisitorTyping] = useState<{ conversationId: string; preview: string } | null>(
    null
  );
  const typingClearRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const agentTypingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Guards against double-send (Enter + Send button) while a message is in flight.
  const sendingRef = useRef(false);
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
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [cardModalPlan, setCardModalPlan] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showNotifBanner, setShowNotifBanner] = useState(true);
  const selectedConversationIdRef = useRef<string | null>(null);
  const socketRef = useRef<ChatSocket | null>(null);

  useEffect(() => {
    const currentSession = readSession();

    if (!currentSession) {
      router.replace("/login");
      return;
    }

    setSession(currentSession);
    requestNotificationPermission();
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
          const [loadedConversations, install, loadedMembers, loadedCanned] = await Promise.all([
            listConversations(primaryOrganization.id, accessToken, {
              limit: 50
            }),
            getDefaultWidgetInstall(primaryOrganization.id, accessToken),
            listMembers(primaryOrganization.id, accessToken).catch(() => []),
            listCannedResponses(primaryOrganization.id, accessToken).catch(() => [])
          ]);
          const firstConversation = loadedConversations[0];

          setConversations(loadedConversations);
          setMembers(loadedMembers);
          setCannedResponses(loadedCanned);
          setWidgetInstall(install);
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

  // Proactively rotate the access token (TTL 15m) before it expires so the
  // session never dies mid-use; keep in-memory token + socket fresh.
  useEffect(() => {
    if (!session) {
      return;
    }

    const interval = setInterval(
      () => {
        void refreshAccessToken().then((token) => {
          if (token) {
            const fresh = readSession();
            if (fresh) {
              setSession(fresh);
            }
          }
        });
      },
      12 * 60 * 1000
    );

    return () => clearInterval(interval);
  }, [session]);

  // When apiRequest transparently refreshes the token, sync our in-memory session so
  // we stop sending the stale token (which caused repeated refreshes → random reloads).
  useEffect(() => {
    const sync = () => {
      const fresh = readSession();
      if (fresh) {
        setSession((current) =>
          current && current.accessToken === fresh.accessToken ? current : fresh
        );
      }
    };
    window.addEventListener("livechat:session-refreshed", sync);
    return () => window.removeEventListener("livechat:session-refreshed", sync);
  }, []);

  useEffect(() => {
    const organizationId = organizations[0]?.id;

    if (activeScreen !== "reports" && activeScreen !== "overview") {
      return;
    }

    if (!session?.accessToken || !organizationId) {
      return;
    }

    let cancelled = false;

    getReportSummary(organizationId, session.accessToken)
      .then((summary) => {
        if (!cancelled) {
          setReport(summary);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [activeScreen, session?.accessToken, organizations]);

  useEffect(() => {
    const organizationId = organizations[0]?.id;

    if (activeScreen !== "engage" && activeScreen !== "overview") {
      return;
    }

    if (!session?.accessToken || !organizationId) {
      return;
    }

    let cancelled = false;
    // First poll seeds the "seen" set silently so we don't announce everyone at once.
    let primed = false;

    const load = () => {
      listLiveVisitors(organizationId, session.accessToken)
        .then((visitors) => {
          if (cancelled) {
            return;
          }
          setLiveVisitors(visitors);

          const seen = seenVisitorIdsRef.current;
          const arrivals = visitors.filter((visitor) => !seen.has(visitor.id));
          for (const visitor of visitors) {
            seen.add(visitor.id);
          }

          if (primed && arrivals.length > 0 && voiceAlertRef.current !== "off") {
            playChime();
            const phrase = arrivals.length > 1 ? `${arrivals.length} new visitors` : "New visitor";
            speak(phrase, voiceAlertRef.current);
          }
          primed = true;
        })
        .catch(() => {});
    };

    load();
    const interval = setInterval(load, 10000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [activeScreen, session?.accessToken, organizations]);

  useEffect(() => {
    const organizationId = organizations[0]?.id;

    if (activeScreen !== "engage") {
      return;
    }

    if (!session?.accessToken || !organizationId) {
      return;
    }

    let cancelled = false;

    Promise.all([
      listCampaigns(organizationId, session.accessToken).catch(() => [] as Campaign[]),
      listGoals(organizationId, session.accessToken).catch(() => [] as Goal[])
    ]).then(([loadedCampaigns, loadedGoals]) => {
      if (!cancelled) {
        setCampaigns(loadedCampaigns);
        setGoals(loadedGoals);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [activeScreen, session?.accessToken, organizations]);

  useEffect(() => {
    const organizationId = organizations[0]?.id;

    if (activeScreen !== "apps") {
      return;
    }

    if (!session?.accessToken || !organizationId) {
      return;
    }

    let cancelled = false;

    Promise.all([
      listApiKeys(organizationId, session.accessToken).catch(() => [] as ApiKey[]),
      listWebhooks(organizationId, session.accessToken).catch(() => [] as Webhook[])
    ]).then(([loadedKeys, loadedWebhooks]) => {
      if (!cancelled) {
        setApiKeys(loadedKeys);
        setWebhooks(loadedWebhooks);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [activeScreen, session?.accessToken, organizations]);

  useEffect(() => {
    const organizationId = organizations[0]?.id;

    if (activeScreen !== "tickets") {
      return;
    }

    if (!session?.accessToken || !organizationId) {
      return;
    }

    let cancelled = false;

    listTickets(organizationId, session.accessToken)
      .then((loaded) => {
        if (!cancelled) {
          setTickets(loaded);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [activeScreen, session?.accessToken, organizations]);

  useEffect(() => {
    const organizationId = organizations[0]?.id;

    if (activeScreen !== "team") {
      return;
    }

    if (!session?.accessToken || !organizationId) {
      return;
    }

    let cancelled = false;

    listDepartments(organizationId, session.accessToken)
      .then((items) => {
        if (!cancelled) {
          setDepartments(items);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [activeScreen, session?.accessToken, organizations]);

  useEffect(() => {
    const organizationId = organizations[0]?.id;

    if (activeScreen !== "billing") {
      return;
    }

    if (!session?.accessToken || !organizationId) {
      return;
    }

    let cancelled = false;

    getBillingOverview(organizationId, session.accessToken)
      .then((overview) => {
        if (!cancelled) {
          setBilling(overview);
        }
      })
      .catch(() => {});

    listInvoices(organizationId, session.accessToken)
      .then((rows) => {
        if (!cancelled) {
          setInvoices(rows);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [activeScreen, session?.accessToken, organizations]);

  useEffect(() => {
    const organizationId = organizations[0]?.id;

    if (activeScreen !== "automate") {
      return;
    }

    if (!session?.accessToken || !organizationId) {
      return;
    }

    let cancelled = false;

    listAutomationRules(organizationId, session.accessToken)
      .then((rules) => {
        if (!cancelled) {
          setAutomationRules(rules);
        }
      })
      .catch(() => {});

    listKnowledge(organizationId, session.accessToken)
      .then((articles) => {
        if (!cancelled) {
          setKnowledge(articles);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [activeScreen, session?.accessToken, organizations]);

  useEffect(() => {
    // Browsers block audio until the user interacts; unlock the chime on first gesture.
    const unlock = () => primeAudio();

    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });

    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  useEffect(() => {
    // Restore the saved new-visitor voice-alert preference.
    try {
      const saved = window.localStorage.getItem("livechat:voice-alert");
      if (saved === "female" || saved === "male" || saved === "off") {
        setVoiceAlert(saved);
        voiceAlertRef.current = saved;
      }
    } catch {
      // ignore storage failures
    }
  }, []);

  useEffect(() => {
    voiceAlertRef.current = voiceAlert;
    try {
      window.localStorage.setItem("livechat:voice-alert", voiceAlert);
    } catch {
      // ignore storage failures
    }
  }, [voiceAlert]);

  useEffect(() => {
    selectedConversationIdRef.current = selectedConversationId;
  }, [selectedConversationId]);

  useEffect(() => {
    // Keep the current sub-tab if it's valid for the new screen (lets navigate()
    // pre-select a sub-tab); otherwise fall back to the first item.
    setActiveSecondary((current) => {
      const items = secondaryNav[activeScreen];
      return items.some((item) => item.label === current) ? current : (items[0]?.label ?? "");
    });
    setNotice("");
    setIsMobileMenuOpen(false);
  }, [activeScreen]);

  const activeOrganization = organizations[0];

  // Being in the dashboard means you're online — flip the agent ONLINE once on load
  // so the Team "Login status" and auto-routing reflect reality (was stuck "Offline").
  const didSetOnlineRef = useRef(false);
  useEffect(() => {
    if (didSetOnlineRef.current || !session || !activeOrganization || !user) {
      return;
    }
    const me = members.find((member) => member.userId === user.id);
    if (me && me.agentStatus === "OFFLINE") {
      didSetOnlineRef.current = true;
      void updateMemberRequest(activeOrganization.id, me.id, session.accessToken, {
        agentStatus: "ONLINE"
      })
        .then((updated) => setMembers((current) => current.map((m) => (m.id === updated.id ? updated : m))))
        .catch(() => {});
    }
  }, [members, user, session, activeOrganization]);

  const selectedConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === selectedConversationId) ?? null,
    [conversations, selectedConversationId]
  );
  const activeNavItem = primaryNav.find((item) => item.key === activeScreen) ?? primaryNav[0];
  // Engage > Campaigns is a light panel; Traffic and Goals stay dark (matches LiveChat).
  const isLightScreen =
    activeScreen === "engage"
      ? activeSecondary === "Campaigns"
      : activeNavItem.tone === "light";
  const chatLink = activeOrganization
    ? `https://direct.lc.chat/${activeOrganization.id.slice(0, 8)}`
    : "https://direct.lc.chat/demo";

  // Guard against any accidental duplicate entries (unique React keys + no visual dupes).
  const uniqueConversations = Array.from(
    new Map(conversations.map((conversation) => [conversation.id, conversation])).values()
  );

  const filteredConversations = uniqueConversations.filter((conversation) => {
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

  useEffect(() => {
    if (!session?.accessToken || !activeOrganization?.id) {
      return;
    }

    const socket = io(getSocketUrl(), {
      auth: {
        token: session.accessToken,
        organizationId: activeOrganization.id
      },
      // Fall back to polling if the websocket upgrade is blocked, and keep retrying.
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 15000
    });

    socketRef.current = socket;

    let wasConnected = false;
    socket.on("connect", () => {
      setConnection("online");

      if (wasConnected) {
        // Reconnected after a drop — re-sync the list so no chat was missed while offline.
        void listConversations(activeOrganization.id, session.accessToken, { limit: 50 })
          .then(setConversations)
          .catch(() => {});
      }

      wasConnected = true;
    });
    socket.on("disconnect", () => setConnection("offline"));
    socket.io.on("reconnect_attempt", () => setConnection("connecting"));
    socket.io.on("reconnect", () => setConnection("online"));
    // A failed auth (expired token) rejects the connection — refresh so the effect
    // re-runs with a fresh token instead of retrying the stale one forever.
    socket.on("connect_error", () => {
      setConnection("connecting");
      void refreshAccessToken();
    });

    socket.on("chat.ready", () => {
      if (selectedConversationIdRef.current) {
        socket.emit("conversation.join", {
          conversationId: selectedConversationIdRef.current
        });
      }
    });
    socket.on("chat.error", (payload: { message?: string }) => {
      setNotice(payload.message ?? "Realtime connection failed.");
    });
    socket.on("conversation.created", (payload: { conversation?: Conversation }) => {
      if (!payload.conversation || payload.conversation.organizationId !== activeOrganization.id) {
        return;
      }

      setConversations((current) =>
        current.some((conversation) => conversation.id === payload.conversation?.id)
          ? current
          : [payload.conversation as Conversation, ...current]
      );
      setNotice("New visitor chat received.");
    });
    socket.on("conversation.updated", (payload: { conversation?: Conversation }) => {
      if (!payload.conversation || payload.conversation.organizationId !== activeOrganization.id) {
        return;
      }

      setConversations((current) =>
        current.some((conversation) => conversation.id === payload.conversation?.id)
          ? current.map((conversation) =>
              conversation.id === payload.conversation?.id
                ? (payload.conversation as Conversation)
                : conversation
            )
          : [payload.conversation as Conversation, ...current]
      );
    });
    socket.on("message.created", (payload: { message?: Message }) => {
      const message = payload.message;

      if (!message || message.organizationId !== activeOrganization.id) {
        return;
      }

      setConversations((current) =>
        current.map((conversation) =>
          conversation.id === message.conversationId
            ? {
                ...conversation,
                latestMessage: message,
                lastMessageAt: message.createdAt
              }
            : conversation
        )
      );

      const isIncomingVisitorMessage =
        message.senderType === "VISITOR" &&
        message.conversationId !== selectedConversationIdRef.current;

      if (isIncomingVisitorMessage) {
        setUnread((current) => ({
          ...current,
          [message.conversationId]: (current[message.conversationId] ?? 0) + 1
        }));
        playChime();
        showBrowserNotification("New chat message", message.body ?? "A visitor sent a message");
        setNotice("🔔 New message from a visitor");
      }

      if (message.conversationId === selectedConversationIdRef.current) {
        setMessages((current) =>
          current.some((existingMessage) => existingMessage.id === message.id)
            ? current
            : [...current, message]
        );
      }
    });

    socket.on(
      "typing.updated",
      (payload: {
        conversationId?: string;
        senderType?: string;
        isTyping?: boolean;
        preview?: string;
      }) => {
        if (payload.senderType !== "VISITOR" || !payload.conversationId) {
          return;
        }

        if (payload.conversationId !== selectedConversationIdRef.current) {
          return;
        }

        if (typingClearRef.current) {
          clearTimeout(typingClearRef.current);
        }

        if (payload.isTyping) {
          setVisitorTyping({ conversationId: payload.conversationId, preview: payload.preview ?? "" });
          typingClearRef.current = setTimeout(() => setVisitorTyping(null), 4000);
        } else {
          setVisitorTyping(null);
        }
      }
    );

    // Message sneak-peek: what any visitor is typing (even before a chat exists).
    socket.on(
      "visitor.preview",
      (payload: { visitorId?: string; isTyping?: boolean; preview?: string }) => {
        const visitorId = payload.visitorId;
        if (!visitorId) {
          return;
        }
        const timers = visitorPreviewTimers.current;
        if (timers[visitorId]) {
          clearTimeout(timers[visitorId]);
          delete timers[visitorId];
        }
        if (payload.isTyping && payload.preview) {
          setVisitorPreviews((current) => ({ ...current, [visitorId]: payload.preview as string }));
          timers[visitorId] = setTimeout(() => {
            setVisitorPreviews((current) => {
              const next = { ...current };
              delete next[visitorId];
              return next;
            });
          }, 6000);
        } else {
          setVisitorPreviews((current) => {
            const next = { ...current };
            delete next[visitorId];
            return next;
          });
        }
      }
    );

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [activeOrganization?.id, session?.accessToken]);

  useEffect(() => {
    if (selectedConversationId && socketRef.current?.connected) {
      socketRef.current.emit("conversation.join", {
        conversationId: selectedConversationId
      });
    }
  }, [selectedConversationId]);

  // Drafts are per-chat: clear the composer when switching chats so an unsent draft
  // never leaks into a different conversation (wrong-reply-to-wrong-customer risk).
  const previousConversationId = useRef<string | null>(null);
  useEffect(() => {
    if (previousConversationId.current !== selectedConversationId) {
      previousConversationId.current = selectedConversationId;
      setComposer("");
    }
  }, [selectedConversationId]);

  async function handleOpenConversation(conversation: Conversation) {
    if (!session || !activeOrganization) {
      return;
    }

    setSelectedConversationId(conversation.id);
    setVisitorTyping(null);
    setIsMessagesLoading(true);
    setActiveScreen("chats");
    setNotice("");
    setUnread((current) => {
      if (!current[conversation.id]) {
        return current;
      }

      const next = { ...current };
      delete next[conversation.id];
      return next;
    });

    try {
      setMessages(await listMessages(activeOrganization.id, conversation.id, session.accessToken));
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to load messages");
    } finally {
      setIsMessagesLoading(false);
    }
  }

  function handleOpenConversationById(conversationId: string) {
    const conversation = conversations.find((item) => item.id === conversationId);

    if (conversation) {
      void handleOpenConversation(conversation);
    } else {
      setActiveScreen("chats");
      setNotice("Opening chat…");
    }
  }

  async function handleCreateConversation(
    initialMessage = "Hi, I need help with my account.",
    simulateVisitor = true
  ) {
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
          initialMessage,
          // Test-chat button → attribute to a visitor; agent-typed new chat → agent message.
          simulateVisitor
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

  async function sendConversationMessage(body: string, internal = false) {
    if (!session || !activeOrganization) {
      setNotice("Please sign in and select a workspace first.");
      return false;
    }

    if (!selectedConversation) {
      // Agent is starting a brand-new outbound chat → this message IS from the agent.
      return handleCreateConversation(body, false);
    }

    setIsSending(true);
    setError("");

    try {
      const message = await sendMessageRequest(
        activeOrganization.id,
        selectedConversation.id,
        session.accessToken,
        { body, visibility: internal ? "INTERNAL" : "PUBLIC", type: "TEXT" }
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

  async function handleSendProductCard(card: {
    title: string;
    price: string;
    image: string;
    url: string;
    description: string;
    buttonLabel: string;
  }) {
    if (!session || !activeOrganization || !selectedConversation) {
      setNotice("Open a conversation first.");
      return false;
    }

    setIsSending(true);
    setError("");

    try {
      const summary = card.price ? `${card.title} — ${card.price}` : card.title;
      const message = await sendMessageRequest(
        activeOrganization.id,
        selectedConversation.id,
        session.accessToken,
        {
          body: summary,
          visibility: "PUBLIC",
          type: "TEXT",
          metadata: {
            productCard: {
              title: card.title,
              ...(card.price ? { price: card.price } : {}),
              ...(card.image ? { image: card.image } : {}),
              ...(card.url ? { url: card.url } : {}),
              ...(card.description ? { description: card.description } : {}),
              ...(card.buttonLabel ? { buttonLabel: card.buttonLabel } : {})
            }
          }
        }
      );

      setMessages((current) => [...current, message]);
      setConversations((current) =>
        current.map((conversation) =>
          conversation.id === selectedConversation.id
            ? { ...conversation, latestMessage: message, lastMessageAt: message.createdAt }
            : conversation
        )
      );
      setNotice("Product sent.");
      return true;
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to send product");
      return false;
    } finally {
      setIsSending(false);
    }
  }

  function handleAgentTyping(value: string) {
    const socket = socketRef.current;
    const conversationId = selectedConversationIdRef.current;

    if (!socket || !conversationId) {
      return;
    }

    socket.emit("typing.update", {
      conversationId,
      isTyping: value.length > 0,
      preview: value
    });

    if (agentTypingTimerRef.current) {
      clearTimeout(agentTypingTimerRef.current);
    }

    agentTypingTimerRef.current = setTimeout(() => {
      socket.emit("typing.update", { conversationId, isTyping: false, preview: "" });
    }, 2500);
  }

  async function handleSendMessage(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();

    // Block a second submit (e.g. Enter then Send button) while one is in flight.
    if (sendingRef.current) {
      return;
    }

    const body = composer.trim();

    if (!body) {
      return;
    }

    sendingRef.current = true;
    setComposer(""); // clear immediately so the agent sees it sent (no re-typing/re-sending)
    try {
      const ok = await sendConversationMessage(body);
      if (!ok) {
        setComposer(body); // restore on failure so nothing is lost
      }
    } finally {
      sendingRef.current = false;
    }
  }

  async function handleSendNote() {
    if (sendingRef.current) {
      return;
    }
    const body = composer.trim();
    if (!body) {
      setNotice("Type a note first — it stays private to your team.");
      return;
    }
    sendingRef.current = true;
    setComposer("");
    try {
      const ok = await sendConversationMessage(body, true);
      if (!ok) {
        setComposer(body);
      }
    } finally {
      sendingRef.current = false;
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

  function applyConversationUpdate(updated: Conversation) {
    setConversations((current) =>
      current.some((conversation) => conversation.id === updated.id)
        ? current.map((conversation) => {
            if (conversation.id !== updated.id) {
              return conversation;
            }
            const merged = { ...conversation, ...updated };
            // Status/assign updates don't carry the last message — keep the existing one
            // so the sidebar preview doesn't reset to "No messages yet".
            if (updated.latestMessage == null && conversation.latestMessage != null) {
              merged.latestMessage = conversation.latestMessage;
            }
            if (updated.lastMessageAt == null && conversation.lastMessageAt != null) {
              merged.lastMessageAt = conversation.lastMessageAt;
            }
            return merged;
          })
        : [updated, ...current]
    );
  }

  async function handleAssignConversation(agentMembershipId: string) {
    if (!session || !activeOrganization || !selectedConversation) {
      return;
    }

    setIsUpdatingConversation(true);
    setError("");

    try {
      const updated = await assignConversationRequest(
        activeOrganization.id,
        selectedConversation.id,
        session.accessToken,
        agentMembershipId
      );

      applyConversationUpdate(updated);
      const agent = members.find((member) => member.id === agentMembershipId);
      setNotice(`Chat assigned to ${agentLabel(agent)}.`);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to assign chat");
    } finally {
      setIsUpdatingConversation(false);
    }
  }

  async function handleUpdateConversationStatus(status: ConversationStatus) {
    if (!session || !activeOrganization || !selectedConversation) {
      return;
    }

    setIsUpdatingConversation(true);
    setError("");

    try {
      const updated = await updateConversationRequest(
        activeOrganization.id,
        selectedConversation.id,
        session.accessToken,
        { status }
      );

      applyConversationUpdate(updated);
      setNotice(`Chat marked ${status.toLowerCase()}.`);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to update chat");
    } finally {
      setIsUpdatingConversation(false);
    }
  }

  async function handleConvertToTicket() {
    if (!session || !activeOrganization || !selectedConversation) {
      setNotice("Open a conversation first.");
      return;
    }

    setIsUpdatingConversation(true);
    setError("");

    try {
      const ticket = await convertConversationToTicketRequest(
        activeOrganization.id,
        selectedConversation.id,
        session.accessToken,
        { resolveConversation: false }
      );
      setTickets((current) => [ticket, ...current]);
      setNotice("Chat converted to a ticket. Auto-reply sent to the visitor.");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to convert to ticket");
    } finally {
      setIsUpdatingConversation(false);
    }
  }

  async function handleInviteAgent(email: string) {
    if (!session || !activeOrganization) {
      return false;
    }

    setError("");

    try {
      const invitation = await inviteMemberRequest(activeOrganization.id, session.accessToken, { email });
      if (invitation.token) {
        const link = `${window.location.origin}/invite/${invitation.token}`;
        setInviteLink(link);
        await navigator.clipboard.writeText(link).catch(() => {});
        setNotice(`Invite link copied — share it with ${email}.`);
      } else {
        setNotice(`Invitation sent to ${email}.`);
      }
      return true;
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to send invite");
      return false;
    }
  }

  const currentMembership = members.find((member) => member.userId === user?.id) ?? null;
  const isAcceptingChats = currentMembership?.agentStatus === "ONLINE";

  async function handleUpdateOrganization(input: {
    name?: string;
    slug?: string;
    metadata?: Record<string, unknown>;
  }): Promise<boolean> {
    if (!session || !activeOrganization) {
      return false;
    }
    setError("");
    try {
      const updated = await updateOrganizationRequest(activeOrganization.id, session.accessToken, input);
      setOrganizations((current) =>
        current.map((org) => (org.id === updated.id ? { ...org, ...updated } : org))
      );
      setNotice("Company details saved.");
      return true;
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to save company details");
      return false;
    }
  }

  async function handleToggleAcceptChats() {
    if (!session || !activeOrganization || !currentMembership) {
      return;
    }
    const next = isAcceptingChats ? "OFFLINE" : "ONLINE";
    // Optimistic flip so the toggle responds instantly.
    setMembers((current) =>
      current.map((m) => (m.id === currentMembership.id ? { ...m, agentStatus: next } : m))
    );
    try {
      const updated = await updateMemberRequest(
        activeOrganization.id,
        currentMembership.id,
        session.accessToken,
        { agentStatus: next }
      );
      setMembers((current) => current.map((m) => (m.id === updated.id ? updated : m)));
      setNotice(next === "ONLINE" ? "You're now accepting chats." : "You've stopped accepting chats.");
    } catch (caughtError) {
      // Revert on failure.
      setMembers((current) =>
        current.map((m) =>
          m.id === currentMembership.id ? { ...m, agentStatus: currentMembership.agentStatus } : m
        )
      );
      setError(caughtError instanceof Error ? caughtError.message : "Unable to update status");
    }
  }

  async function handleRemoveMember(membershipId: string) {
    if (!session || !activeOrganization) {
      return;
    }
    setError("");
    try {
      await removeMemberRequest(activeOrganization.id, membershipId, session.accessToken);
      setMembers((current) => current.filter((member) => member.id !== membershipId));
      setNotice("Member removed. Billing updated for the new seat count.");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to remove member");
    }
  }

  async function handleCreateDepartment(name: string) {
    if (!session || !activeOrganization) {
      return false;
    }

    setError("");

    try {
      const department = await createDepartmentRequest(activeOrganization.id, session.accessToken, {
        name
      });
      setDepartments((current) => [...current, department]);
      setNotice(`Department "${department.name}" created.`);
      return true;
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to create department");
      return false;
    }
  }

  async function handleDeleteDepartment(departmentId: string) {
    if (!session || !activeOrganization) {
      return;
    }

    setError("");
    const previous = departments;
    setDepartments((current) => current.filter((department) => department.id !== departmentId));

    try {
      await deleteDepartmentRequest(activeOrganization.id, departmentId, session.accessToken);
      setNotice("Department deleted.");
    } catch (caughtError) {
      setDepartments(previous);
      setError(caughtError instanceof Error ? caughtError.message : "Unable to delete department");
    }
  }

  async function handleSetDepartmentAgents(departmentId: string, membershipIds: string[]) {
    if (!session || !activeOrganization) {
      return;
    }

    setError("");

    try {
      const updated = await setDepartmentAgentsRequest(
        activeOrganization.id,
        departmentId,
        session.accessToken,
        membershipIds
      );
      setDepartments((current) =>
        current.map((department) => (department.id === departmentId ? updated : department))
      );
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to update agents");
    }
  }

  function handleSubscribe(planCode: string) {
    // With a real gateway we must collect card details first (Accept.js tokenization).
    if (billing?.gatewayConfigured && billing.acceptJs) {
      setCardModalPlan(planCode);
      return;
    }
    void runSubscribe(planCode);
  }

  async function runSubscribe(
    planCode: string,
    payment?: { descriptor: string; value: string; cardholderName: string }
  ) {
    if (!session || !activeOrganization) {
      return;
    }

    setIsBillingBusy(true);
    setError("");

    try {
      await subscribePlanRequest(activeOrganization.id, session.accessToken, {
        planCode,
        ...(payment
          ? {
              opaqueDataDescriptor: payment.descriptor,
              opaqueDataValue: payment.value,
              cardholderName: payment.cardholderName
            }
          : {})
      });
      const [overview, rows] = await Promise.all([
        getBillingOverview(activeOrganization.id, session.accessToken),
        listInvoices(activeOrganization.id, session.accessToken)
      ]);
      setBilling(overview);
      setInvoices(rows);
      setCardModalPlan(null);
      setNotice(`Subscribed to ${overview.subscription?.planName ?? planCode}.`);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to subscribe");
    } finally {
      setIsBillingBusy(false);
    }
  }

  async function handleDownloadInvoice(invoice: BillingInvoice) {
    if (!session || !activeOrganization) {
      return;
    }

    try {
      await downloadInvoicePdf(
        activeOrganization.id,
        invoice.id,
        session.accessToken,
        `invoice-${invoice.number}.pdf`
      );
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to download invoice");
    }
  }

  async function handleCancelSubscription() {
    if (!session || !activeOrganization) {
      return;
    }

    setIsBillingBusy(true);
    setError("");

    try {
      await cancelSubscriptionRequest(activeOrganization.id, session.accessToken);
      const overview = await getBillingOverview(activeOrganization.id, session.accessToken);
      setBilling(overview);
      setNotice("Subscription canceled.");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to cancel");
    } finally {
      setIsBillingBusy(false);
    }
  }

  async function handleCreateAutomationRule(input: {
    name: string;
    replyMessage: string;
    isGreeting: boolean;
    keywords: string[];
  }) {
    if (!session || !activeOrganization) {
      return false;
    }

    setError("");

    try {
      const rule = await createAutomationRuleRequest(activeOrganization.id, session.accessToken, input);
      setAutomationRules((current) => [...current, rule]);
      setNotice(`Rule "${rule.name}" created.`);
      return true;
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to create rule");
      return false;
    }
  }

  async function handleToggleAutomationRule(rule: AutomationRule) {
    if (!session || !activeOrganization) {
      return;
    }

    setError("");

    try {
      const updated = await updateAutomationRuleRequest(
        activeOrganization.id,
        rule.id,
        session.accessToken,
        { enabled: !rule.enabled }
      );
      setAutomationRules((current) =>
        current.map((item) => (item.id === rule.id ? updated : item))
      );
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to update rule");
    }
  }

  async function handleDeleteAutomationRule(ruleId: string) {
    if (!session || !activeOrganization) {
      return;
    }

    setError("");
    const previous = automationRules;
    setAutomationRules((current) => current.filter((item) => item.id !== ruleId));

    try {
      await deleteAutomationRuleRequest(activeOrganization.id, ruleId, session.accessToken);
      setNotice("Rule deleted.");
    } catch (caughtError) {
      setAutomationRules(previous);
      setError(caughtError instanceof Error ? caughtError.message : "Unable to delete rule");
    }
  }

  async function handleToggleCampaign(campaign: Campaign) {
    if (!session || !activeOrganization) {
      return;
    }

    setError("");
    setCampaigns((current) =>
      current.map((item) => (item.id === campaign.id ? { ...item, enabled: !item.enabled } : item))
    );

    try {
      await updateCampaignRequest(activeOrganization.id, campaign.id, session.accessToken, {
        enabled: !campaign.enabled
      });
      setNotice(`Campaign "${campaign.name}" ${campaign.enabled ? "paused" : "activated"}.`);
    } catch (caughtError) {
      setCampaigns((current) =>
        current.map((item) => (item.id === campaign.id ? { ...item, enabled: campaign.enabled } : item))
      );
      setError(caughtError instanceof Error ? caughtError.message : "Unable to update campaign");
    }
  }

  async function handleCreateCampaign(input: {
    name: string;
    type: string;
    triggerType: string;
    message: string;
  }): Promise<boolean> {
    if (!session || !activeOrganization) {
      return false;
    }

    setError("");
    try {
      const created = await createCampaignRequest(activeOrganization.id, session.accessToken, input);
      setCampaigns((current) => [...current, created]);
      setNotice(`Campaign "${created.name}" created.`);
      return true;
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to create campaign");
      return false;
    }
  }

  async function handleDeleteCampaign(campaignId: string) {
    if (!session || !activeOrganization) {
      return;
    }

    setError("");
    const previous = campaigns;
    setCampaigns((current) => current.filter((item) => item.id !== campaignId));

    try {
      await deleteCampaignRequest(activeOrganization.id, campaignId, session.accessToken);
      setNotice("Campaign deleted.");
    } catch (caughtError) {
      setCampaigns(previous);
      setError(caughtError instanceof Error ? caughtError.message : "Unable to delete campaign");
    }
  }

  async function handleCreateGoal(input: {
    name: string;
    type: string;
    target: string;
    valueCents: number;
  }): Promise<boolean> {
    if (!session || !activeOrganization) {
      return false;
    }

    setError("");
    try {
      const created = await createGoalRequest(activeOrganization.id, session.accessToken, input);
      setGoals((current) => [...current, created]);
      setNotice(`Goal "${created.name}" created.`);
      return true;
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to create goal");
      return false;
    }
  }

  async function handleDeleteGoal(goalId: string) {
    if (!session || !activeOrganization) {
      return;
    }

    setError("");
    const previous = goals;
    setGoals((current) => current.filter((item) => item.id !== goalId));

    try {
      await deleteGoalRequest(activeOrganization.id, goalId, session.accessToken);
      setNotice("Goal deleted.");
    } catch (caughtError) {
      setGoals(previous);
      setError(caughtError instanceof Error ? caughtError.message : "Unable to delete goal");
    }
  }

  async function handleCreateApiKey(name: string): Promise<boolean> {
    if (!session || !activeOrganization || !name.trim()) {
      return false;
    }

    setError("");
    try {
      const created = await createApiKeyRequest(activeOrganization.id, session.accessToken, {
        name: name.trim()
      });
      setApiKeys((current) => [
        {
          id: created.id,
          name: created.name,
          keyPrefix: created.keyPrefix,
          scopes: created.scopes,
          lastUsedAt: created.lastUsedAt,
          revokedAt: created.revokedAt,
          createdAt: created.createdAt
        },
        ...current
      ]);
      setRevealedSecret({ label: `API key "${created.name}"`, secret: created.secret });
      return true;
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to create API key");
      return false;
    }
  }

  async function handleRevokeApiKey(apiKeyId: string) {
    if (!session || !activeOrganization) {
      return;
    }

    setError("");
    const previous = apiKeys;
    setApiKeys((current) => current.filter((item) => item.id !== apiKeyId));

    try {
      await revokeApiKeyRequest(activeOrganization.id, apiKeyId, session.accessToken);
      setNotice("API key revoked.");
    } catch (caughtError) {
      setApiKeys(previous);
      setError(caughtError instanceof Error ? caughtError.message : "Unable to revoke API key");
    }
  }

  async function handleCreateWebhook(url: string, events: string[]): Promise<boolean> {
    if (!session || !activeOrganization || !url.trim()) {
      return false;
    }

    setError("");
    try {
      const created = await createWebhookRequest(activeOrganization.id, session.accessToken, {
        url: url.trim(),
        ...(events.length > 0 ? { events } : {})
      });
      setWebhooks((current) => [
        {
          id: created.id,
          url: created.url,
          events: created.events,
          isActive: created.isActive,
          lastSuccessAt: created.lastSuccessAt,
          lastFailureAt: created.lastFailureAt,
          createdAt: created.createdAt
        },
        ...current
      ]);
      setRevealedSecret({ label: `Webhook signing secret`, secret: created.secret });
      return true;
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to create webhook");
      return false;
    }
  }

  async function handleDeleteWebhook(webhookId: string) {
    if (!session || !activeOrganization) {
      return;
    }

    setError("");
    const previous = webhooks;
    setWebhooks((current) => current.filter((item) => item.id !== webhookId));

    try {
      await deleteWebhookRequest(activeOrganization.id, webhookId, session.accessToken);
      setNotice("Webhook deleted.");
    } catch (caughtError) {
      setWebhooks(previous);
      setError(caughtError instanceof Error ? caughtError.message : "Unable to delete webhook");
    }
  }

  async function handleCreateTicket(input: {
    subject: string;
    requesterName: string;
    requesterEmail: string;
    description: string;
    priority: string;
  }): Promise<boolean> {
    if (!session || !activeOrganization || !input.subject.trim()) {
      return false;
    }

    setError("");
    try {
      const created = await createTicketRequest(activeOrganization.id, session.accessToken, {
        subject: input.subject.trim(),
        priority: input.priority,
        ...(input.requesterName.trim() ? { requesterName: input.requesterName.trim() } : {}),
        ...(input.requesterEmail.trim() ? { requesterEmail: input.requesterEmail.trim() } : {}),
        ...(input.description.trim() ? { description: input.description.trim() } : {})
      });
      setTickets((current) => [created, ...current]);
      setNotice(`Ticket "${created.subject}" created.`);
      return true;
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to create ticket");
      return false;
    }
  }

  async function handleUpdateTicketStatus(ticketId: string, status: string) {
    if (!session || !activeOrganization) {
      return;
    }

    setError("");
    const previous = tickets;
    setTickets((current) =>
      current.map((item) => (item.id === ticketId ? { ...item, status } : item))
    );

    try {
      const updated = await updateTicketRequest(activeOrganization.id, ticketId, session.accessToken, {
        status
      });
      setTickets((current) => current.map((item) => (item.id === ticketId ? updated : item)));
      setNotice(`Ticket marked ${status.toLowerCase()}.`);
    } catch (caughtError) {
      setTickets(previous);
      setError(caughtError instanceof Error ? caughtError.message : "Unable to update ticket");
    }
  }

  async function handleDeleteTicket(ticketId: string) {
    if (!session || !activeOrganization) {
      return;
    }

    setError("");
    const previous = tickets;
    setTickets((current) => current.filter((item) => item.id !== ticketId));

    try {
      await deleteTicketRequest(activeOrganization.id, ticketId, session.accessToken);
      setNotice("Ticket deleted.");
    } catch (caughtError) {
      setTickets(previous);
      setError(caughtError instanceof Error ? caughtError.message : "Unable to delete ticket");
    }
  }

  async function handleCreateKnowledge(input: {
    title: string;
    content: string;
    category: string;
  }): Promise<boolean> {
    if (!session || !activeOrganization || !input.title.trim()) {
      return false;
    }
    setError("");
    try {
      const created = await createKnowledgeRequest(activeOrganization.id, session.accessToken, input);
      setKnowledge((current) => [created, ...current]);
      setNotice(`Article "${created.title}" saved.`);
      return true;
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to save article");
      return false;
    }
  }

  async function handleToggleKnowledge(article: KnowledgeArticle) {
    if (!session || !activeOrganization) {
      return;
    }
    setError("");
    setKnowledge((current) =>
      current.map((item) => (item.id === article.id ? { ...item, published: !item.published } : item))
    );
    try {
      await updateKnowledgeRequest(activeOrganization.id, article.id, session.accessToken, {
        published: !article.published
      });
    } catch (caughtError) {
      setKnowledge((current) =>
        current.map((item) => (item.id === article.id ? { ...item, published: article.published } : item))
      );
      setError(caughtError instanceof Error ? caughtError.message : "Unable to update article");
    }
  }

  async function handleDeleteKnowledge(articleId: string) {
    if (!session || !activeOrganization) {
      return;
    }
    setError("");
    const previous = knowledge;
    setKnowledge((current) => current.filter((item) => item.id !== articleId));
    try {
      await deleteKnowledgeRequest(activeOrganization.id, articleId, session.accessToken);
      setNotice("Article deleted.");
    } catch (caughtError) {
      setKnowledge(previous);
      setError(caughtError instanceof Error ? caughtError.message : "Unable to delete article");
    }
  }

  async function handleAiSuggest() {
    if (!session || !activeOrganization || !selectedConversation) {
      setNotice("Open a conversation first.");
      return;
    }

    setIsSuggestingAi(true);
    setError("");

    try {
      const result = await suggestReplyRequest(
        activeOrganization.id,
        selectedConversation.id,
        session.accessToken
      );
      setComposer(result.suggestion);
      setNotice(result.usedAI ? "AI drafted a reply ✨" : "Drafted a reply (add an AI key for smarter suggestions).");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to draft a reply");
    } finally {
      setIsSuggestingAi(false);
    }
  }

  async function handleUploadFile(file: File) {
    if (!session || !activeOrganization || !selectedConversation) {
      return;
    }

    setIsSending(true);
    setError("");

    try {
      const message = await uploadAttachmentRequest(
        activeOrganization.id,
        selectedConversation.id,
        session.accessToken,
        file
      );

      setMessages((current) =>
        current.some((existing) => existing.id === message.id) ? current : [...current, message]
      );
      setConversations((current) =>
        current.map((conversation) =>
          conversation.id === selectedConversation.id
            ? { ...conversation, latestMessage: message, lastMessageAt: message.createdAt }
            : conversation
        )
      );
      setNotice(`File "${file.name}" sent.`);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to upload file");
    } finally {
      setIsSending(false);
    }
  }

  async function handleUpdateWidget(input: {
    name?: string;
    welcomeMessage?: string;
    offlineMessage?: string;
    accentColor?: string;
    position?: "left" | "right";
    preChatEnabled?: boolean;
    gtmContainerId?: string;
    allowedDomains?: string[];
    language?: string;
    highContrast?: boolean;
    largeText?: boolean;
    cookieConsent?: boolean;
    emailForwardTo?: string;
    emailForwardEnabled?: boolean;
    workingHoursEnabled?: boolean;
    workingHours?: { timezone?: string; days?: Array<{ on: boolean; from: string; to: string }> };
    eyeCatcher?: string;
    eyeCatcherEnabled?: boolean;
    slackWebhookUrl?: string;
    preChatFields?: Array<{ id: string; label: string; type: string; required: boolean }>;
    postChatEnabled?: boolean;
    postChatMessage?: string;
    bannedIps?: string[];
    inactivityEnabled?: boolean;
    inactivityMessage?: string;
    inactivitySeconds?: number;
    menuOptions?: Array<{ id: string; label: string; reply: string }>;
  }) {
    if (!session || !activeOrganization) {
      return false;
    }

    setError("");

    try {
      const updated = await updateWidgetInstallRequest(
        activeOrganization.id,
        session.accessToken,
        input
      );
      setWidgetInstall(updated);
      setNotice("Widget settings saved.");
      return true;
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to save widget settings");
      return false;
    }
  }

  async function handleExportData() {
    if (!session || !activeOrganization) {
      return;
    }
    setError("");
    try {
      const data = await exportOrgData(activeOrganization.id, session.accessToken);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `livechat-data-export-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
      setNotice("Data exported — download started.");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to export data");
    }
  }

  async function handleClearVisitorData() {
    if (!session || !activeOrganization) {
      return;
    }
    setError("");
    try {
      const result = await clearVisitorDataRequest(activeOrganization.id, session.accessToken);
      setNotice(`Visitor data erased (${result.anonymizedVisitors} visitors anonymized).`);
      setLiveVisitors([]);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to clear visitor data");
    }
  }

  async function handleUpdateTags(tags: string[]) {
    if (!session || !activeOrganization || !selectedConversation) {
      return;
    }

    setError("");

    try {
      const updated = await updateConversationTagsRequest(
        activeOrganization.id,
        selectedConversation.id,
        session.accessToken,
        tags
      );
      applyConversationUpdate(updated);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to update tags");
    }
  }

  async function handleSaveCannedResponse(input: { title: string; shortcut: string; body: string }) {
    if (!session || !activeOrganization) {
      return false;
    }

    setError("");

    try {
      const created = await createCannedResponseRequest(
        activeOrganization.id,
        session.accessToken,
        input
      );
      setCannedResponses((current) => [created, ...current]);
      setNotice(`Canned response "${created.shortcut}" saved.`);
      return true;
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to save canned response");
      return false;
    }
  }

  async function handleDeleteCannedResponse(cannedResponseId: string) {
    if (!session || !activeOrganization) {
      return;
    }

    setError("");
    const previous = cannedResponses;
    setCannedResponses((current) => current.filter((item) => item.id !== cannedResponseId));

    try {
      await deleteCannedResponseRequest(activeOrganization.id, cannedResponseId, session.accessToken);
      setNotice("Canned response deleted.");
    } catch (caughtError) {
      setCannedResponses(previous);
      setError(caughtError instanceof Error ? caughtError.message : "Unable to delete canned response");
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

  function navigate(screen: ScreenKey, secondary?: string) {
    if (secondary) {
      setActiveSecondary(secondary);
    }
    setActiveScreen(screen);
    setIsProfileOpen(false);
  }

  // --- URL routing: keep the active screen/tab in the address bar (shareable + back/forward) ---
  useEffect(() => {
    const validScreens = new Set(primaryNav.map((item) => item.key as string));

    function applyFromUrl() {
      const params = new URLSearchParams(window.location.search);
      const view = params.get("view");
      const tab = params.get("tab");
      if (view && validScreens.has(view)) {
        setActiveScreen(view as ScreenKey);
      }
      if (tab) {
        setActiveSecondary(tab);
      }
    }

    applyFromUrl();
    window.addEventListener("popstate", applyFromUrl);
    return () => window.removeEventListener("popstate", applyFromUrl);
    // Run once on mount; subsequent syncs are handled by the writer effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const skipFirstUrlWrite = useRef(true);
  useEffect(() => {
    // Skip the mount write so we don't clobber a shared URL before the reader applies it.
    if (skipFirstUrlWrite.current) {
      skipFirstUrlWrite.current = false;
      return;
    }
    const params = new URLSearchParams(window.location.search);
    params.set("view", activeScreen);
    if (activeSecondary) {
      params.set("tab", activeSecondary);
    } else {
      params.delete("tab");
    }
    const nextUrl = `${window.location.pathname}?${params.toString()}`;
    const currentUrl = `${window.location.pathname}${window.location.search}`;
    if (nextUrl !== currentUrl) {
      window.history.pushState(null, "", nextUrl);
    }
  }, [activeScreen, activeSecondary]);

  // Clear any stale error/notice banner when switching screens (e.g. a transient
  // 401 shouldn't keep showing "Invalid or expired access token" on another page).
  useEffect(() => {
    setError("");
    setNotice("");
  }, [activeScreen]);

  // Ctrl/Cmd+K focuses the workspace search.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        const input = document.querySelector<HTMLInputElement>('input[aria-label="Search workspace"]');
        input?.focus();
        input?.select();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Auto-dismiss banners so a transient error (e.g. a one-off 401) never sticks around.
  useEffect(() => {
    if (!error) {
      return;
    }
    const timer = setTimeout(() => setError(""), 7000);
    return () => clearTimeout(timer);
  }, [error]);

  useEffect(() => {
    if (!notice) {
      return;
    }
    const timer = setTimeout(() => setNotice(""), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  function handleLogout() {
    clearSession();
    router.replace("/login");
  }

  if (isLoading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-black text-white">
        <div className="lc-pop flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#FF5100] shadow-lg shadow-orange-900/40">
            <MessageCircle className="h-6 w-6 text-white" aria-hidden />
          </span>
          <span className="text-2xl font-bold tracking-tight">LiveChat</span>
        </div>
        <div className="h-1.5 w-52 overflow-hidden rounded-full bg-white/10">
          <div className="h-full w-1/3 animate-pulse rounded-full bg-[#FF5100]" />
        </div>
        <p className="text-sm font-medium text-white/50">Loading your workspace…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen overflow-hidden bg-black text-white">
      {showNotifBanner && (
        <NeverMissBanner
          onClose={() => setShowNotifBanner(false)}
          onEnable={() => {
            requestNotificationPermission();
            handleAction("Browser notifications enabled.");
          }}
        />
      )}

      <GlobalTopBar
        bannerVisible={showNotifBanner}
        isNotificationOpen={isNotificationOpen}
        onCreateChat={() => void handleCreateConversation()}
        onSearchChange={(value) => {
          setSearchQuery(value);
          // Jump to Chats so the filtered results are actually visible as you type.
          if (value.trim() && activeScreen !== "chats") {
            setActiveScreen("chats");
          }
        }}
        onToggleNotifications={() => setIsNotificationOpen((current) => !current)}
        onToggleProfile={() => setIsProfileOpen((current) => !current)}
        searchQuery={searchQuery}
        user={user}
      />

      <div
        className={cn(
          "grid grid-cols-[40px_minmax(0,1fr)] [grid-template-rows:minmax(0,1fr)] lg:grid-cols-[40px_220px_minmax(0,1fr)]",
          showNotifBanner ? "mt-[52px] h-[calc(100dvh-52px)]" : "mt-7 h-[calc(100dvh-28px)]"
        )}
      >
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
              "relative flex h-full flex-col overflow-hidden rounded-tl-xl border shadow-2xl",
              isLightScreen
                ? "border-white bg-white text-[#111214]"
                : "border-[#2d2d32] bg-[#1f1f23] text-white"
            )}
          >
            <ScreenHeader
              activeScreen={activeScreen}
              isLightScreen={isLightScreen}
              onMobileMenu={() => setIsMobileMenuOpen((current) => !current)}
              onPreview={() => {
                const url =
                  widgetInstall?.demoUrl ??
                  (typeof window !== "undefined"
                    ? `${window.location.origin}/widget-demo`
                    : "/widget-demo");
                if (typeof window !== "undefined") {
                  window.open(url, "_blank", "noopener,noreferrer");
                }
                handleAction("Opening live widget preview in a new tab…");
              }}
              onQuickAction={handleAction}
              title={
                activeScreen === "engage" ||
                activeScreen === "reports" ||
                activeScreen === "automate" ||
                activeScreen === "apps" ||
                activeScreen === "billing" ||
                activeScreen === "settings"
                  ? activeSecondary || screenTitles[activeScreen]
                  : screenTitles[activeScreen]
              }
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

            <div className="lc-fade-in lc-scroll min-h-0 flex-1 overflow-auto" key={activeScreen}>
              {activeScreen === "overview" && (
                <OverviewScreen
                  agentsOnline={Math.max(1, members.filter((m) => m.agentStatus === "ONLINE").length)}
                  agentsTotal={Math.max(members.length, 1)}
                  customersOnline={liveVisitors.filter((v) => v.activity !== "Left website").length}
                  onAction={handleAction}
                  onCreateChat={() => void handleCreateConversation()}
                  onNavigate={navigate}
                  openCount={openCount}
                  report={report}
                  totalChats={totalChats}
                  userName={user?.name ?? user?.email ?? "there"}
                />
              )}

              {activeScreen === "chats" && (
                <ChatsScreen
                  cannedResponses={cannedResponses}
                  chatLink={chatLink}
                  composer={composer}
                  connection={connection}
                  conversations={filteredConversations}
                  onSaveCannedResponse={handleSaveCannedResponse}
                  onTyping={handleAgentTyping}
                  onUpdateTags={(tags) => void handleUpdateTags(tags)}
                  onUploadFile={(file) => void handleUploadFile(file)}
                  visitorTypingPreview={
                    visitorTyping && selectedConversation && visitorTyping.conversationId === selectedConversation.id
                      ? visitorTyping.preview
                      : null
                  }
                  isCreating={isCreating}
                  isMessagesLoading={isMessagesLoading}
                  isSending={isSending}
                  isSuggestingAi={isSuggestingAi}
                  isUpdatingConversation={isUpdatingConversation}
                  members={members}
                  messages={messages}
                  onAction={handleAction}
                  onAiSuggest={() => void handleAiSuggest()}
                  onAssign={(agentId) => void handleAssignConversation(agentId)}
                  onCopy={handleCopy}
                  onCreateChat={() => void handleCreateConversation()}
                  onOpenConversation={(conversation) => void handleOpenConversation(conversation)}
                  onConvertToTicket={() => void handleConvertToTicket()}
                  onSendMessage={(event) => void handleSendMessage(event)}
                  onSendNote={() => void handleSendNote()}
                  onSendProduct={() => setProductModalOpen(true)}
                  onUpdateStatus={(status) => void handleUpdateConversationStatus(status)}
                  selectedConversation={selectedConversation}
                  setComposer={setComposer}
                  unread={unread}
                />
              )}

              {activeScreen === "engage" && activeSecondary === "Traffic" && (
                <TrafficScreen
                  chatLink={chatLink}
                  liveVisitors={liveVisitors}
                  members={members}
                  onAction={handleAction}
                  onCopy={handleCopy}
                  onOpenConversation={handleOpenConversationById}
                  typingPreviews={visitorPreviews}
                  voiceAlert={voiceAlert}
                  onChangeVoiceAlert={setVoiceAlert}
                />
              )}

              {activeScreen === "engage" && activeSecondary === "Campaigns" && (
                <CampaignsScreen
                  campaigns={campaigns}
                  onCreate={handleCreateCampaign}
                  onDelete={(id) => void handleDeleteCampaign(id)}
                  onToggle={(campaign) => void handleToggleCampaign(campaign)}
                />
              )}

              {activeScreen === "engage" && activeSecondary === "Goals" && (
                <GoalsScreen
                  goals={goals}
                  onCreate={handleCreateGoal}
                  onDelete={(id) => void handleDeleteGoal(id)}
                  report={report}
                  totalVisitors={liveVisitors.length}
                />
              )}

              {activeScreen === "automate" && activeSecondary === "Overview" && (
                <AutomateOverview
                  onGoCanned={() => setActiveSecondary("Canned responses")}
                  onGoChat={() => navigate("chats")}
                  onGoChatbots={() => setActiveSecondary("Chatbots")}
                />
              )}

              {activeScreen === "automate" && activeSecondary === "Canned responses" && (
                <CannedResponsesManager
                  cannedResponses={cannedResponses}
                  onCopy={handleCopy}
                  onDelete={(id) => void handleDeleteCannedResponse(id)}
                  onSave={handleSaveCannedResponse}
                />
              )}

              {activeScreen === "automate" && activeSecondary === "Knowledge hub" && (
                <KnowledgeHubScreen
                  articles={knowledge}
                  onCreate={handleCreateKnowledge}
                  onDelete={(id) => void handleDeleteKnowledge(id)}
                  onToggle={(article) => void handleToggleKnowledge(article)}
                />
              )}

              {activeScreen === "automate" && activeSecondary === "Chatbots" && (
                <ChatbotFlowBuilder
                  menuOptions={widgetInstall?.menuOptions ?? []}
                  onCreateRule={handleCreateAutomationRule}
                  onDeleteRule={(id) => void handleDeleteAutomationRule(id)}
                  onSaveMenu={(options) => handleUpdateWidget({ menuOptions: options })}
                  onToggleRule={(rule) => void handleToggleAutomationRule(rule)}
                  rules={automationRules}
                />
              )}

              {activeScreen === "automate" &&
                activeSecondary !== "Overview" &&
                activeSecondary !== "Canned responses" &&
                activeSecondary !== "Knowledge hub" &&
                activeSecondary !== "Chatbots" && (
                  <AutomateScreen
                    heading={activeSecondary}
                    isBusy={false}
                    onCreate={handleCreateAutomationRule}
                    onDelete={(id) => void handleDeleteAutomationRule(id)}
                    onToggle={(rule) => void handleToggleAutomationRule(rule)}
                    rules={automationRules}
                  />
                )}

              {activeScreen === "archives" && (
                <ArchivesScreen
                  conversations={conversations}
                  members={members}
                  messages={messages}
                  onOpenConversation={(conversation) => void handleOpenConversation(conversation)}
                  selectedConversation={selectedConversation}
                />
              )}

              {activeScreen === "team" && (
                <TeamScreen
                  departments={departments}
                  inviteLink={inviteLink}
                  members={members}
                  onCopy={handleCopy}
                  onCreateDepartment={handleCreateDepartment}
                  onDeleteDepartment={(id) => void handleDeleteDepartment(id)}
                  onInvite={handleInviteAgent}
                  onRemoveMember={(id) => void handleRemoveMember(id)}
                  onSetDepartmentAgents={(id, ids) => void handleSetDepartmentAgents(id, ids)}
                  user={user}
                />
              )}

              {activeScreen === "reports" && (
                <ReportsScreen members={members} report={report} view={activeSecondary} />
              )}

              {activeScreen === "apps" &&
                (activeSecondary === "Automate with webhooks" ||
                activeSecondary === "External integrations" ||
                activeSecondary === "Build your app") ? (
                <IntegrationsScreen
                  apiKeys={apiKeys}
                  onCopy={handleCopy}
                  onCreateApiKey={handleCreateApiKey}
                  onCreateWebhook={handleCreateWebhook}
                  onDeleteWebhook={(id) => void handleDeleteWebhook(id)}
                  onRevokeApiKey={(id) => void handleRevokeApiKey(id)}
                  webhooks={webhooks}
                />
              ) : activeScreen === "apps" ? (
                <AppsScreen onAction={handleAction} />
              ) : null}

              {activeScreen === "tickets" && (
                <TicketsScreen
                  onCreate={handleCreateTicket}
                  onDelete={(id) => void handleDeleteTicket(id)}
                  onUpdateStatus={(id, status) => void handleUpdateTicketStatus(id, status)}
                  tickets={tickets}
                />
              )}

              {activeScreen === "billing" && (
                <BillingScreen
                  billing={billing}
                  invoices={invoices}
                  isBusy={isBillingBusy}
                  onCancel={() => void handleCancelSubscription()}
                  onDownloadInvoice={(invoice) => void handleDownloadInvoice(invoice)}
                  onSubscribe={(planCode) => void handleSubscribe(planCode)}
                />
              )}

              {activeScreen === "settings" && (
                <SettingsScreen
                  activeSecondary={activeSecondary}
                  onAction={handleAction}
                  onClearVisitorData={() => void handleClearVisitorData()}
                  onCopy={handleCopy}
                  onExportData={() => void handleExportData()}
                  onUpdateOrganization={handleUpdateOrganization}
                  onUpdateWidget={handleUpdateWidget}
                  organization={activeOrganization ?? null}
                  widgetInstall={widgetInstall}
                />
              )}
            </div>
          </div>
        </section>
      </div>

      <BottomChatWidget
        clientEmail={user?.email ?? ""}
        clientName={user?.name ?? user?.email ?? "Client"}
        clientOrgId={activeOrganization?.id ?? ""}
        clientOrgName={activeOrganization?.name ?? "Workspace"}
        clientPlan={billing?.subscription?.planName ?? activeOrganization?.planCode ?? ""}
      />

      {isProfileOpen && (
        <ProfileMenu
          isAcceptingChats={isAcceptingChats}
          onAction={handleAction}
          onClose={() => setIsProfileOpen(false)}
          onLogout={handleLogout}
          onNavigate={navigate}
          onToggleAcceptChats={() => void handleToggleAcceptChats()}
          user={user}
        />
      )}

      {isNotificationOpen && (
        <NotificationPanel onClose={() => setIsNotificationOpen(false)} />
      )}

      {revealedSecret && (
        <SecretRevealModal
          label={revealedSecret.label}
          onClose={() => setRevealedSecret(null)}
          onCopy={handleCopy}
          secret={revealedSecret.secret}
        />
      )}

      {productModalOpen && (
        <ProductCardModal
          isSending={isSending}
          onClose={() => setProductModalOpen(false)}
          onSubmit={async (card) => {
            const ok = await handleSendProductCard(card);
            if (ok) {
              setProductModalOpen(false);
            }
          }}
        />
      )}

      {cardModalPlan && billing?.acceptJs && (
        <CardPaymentModal
          acceptJs={billing.acceptJs}
          isBusy={isBillingBusy}
          plan={billing.plans.find((p) => p.code === cardModalPlan) ?? null}
          onClose={() => setCardModalPlan(null)}
          onToken={(payment) => void runSubscribe(cardModalPlan, payment)}
        />
      )}
    </main>
  );
}

interface AcceptDispatchResponse {
  messages: { resultCode: string; message: Array<{ code: string; text: string }> };
  opaqueData?: { dataDescriptor: string; dataValue: string };
}

function CardPaymentModal({
  acceptJs,
  isBusy,
  onClose,
  onToken,
  plan
}: {
  acceptJs: { apiLoginId: string; clientKey: string; environment: string };
  isBusy: boolean;
  onClose: () => void;
  onToken: (payment: { descriptor: string; value: string; cardholderName: string }) => void;
  plan: BillingPlan | null;
}) {
  const [name, setName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [expMonth, setExpMonth] = useState("");
  const [expYear, setExpYear] = useState("");
  const [cardCode, setCardCode] = useState("");
  const [scriptReady, setScriptReady] = useState(false);
  const [error, setError] = useState("");
  const [isTokenizing, setIsTokenizing] = useState(false);

  useEffect(() => {
    const src =
      acceptJs.environment === "production"
        ? "https://js.authorize.net/v1/Accept.js"
        : "https://jstest.authorize.net/v1/Accept.js";
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
    if (existing) {
      setScriptReady(true);
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => setScriptReady(true);
    script.onerror = () => setError("Could not load the secure payment library.");
    document.head.appendChild(script);
  }, [acceptJs.environment]);

  function submit() {
    setError("");
    const accept = (window as unknown as { Accept?: { dispatchData: (data: unknown, cb: (r: AcceptDispatchResponse) => void) => void } }).Accept;
    if (!accept) {
      setError("Payment library not ready yet. Please wait a moment.");
      return;
    }
    if (!cardNumber.trim() || !expMonth.trim() || !expYear.trim() || !cardCode.trim()) {
      setError("Please fill in all card details.");
      return;
    }
    setIsTokenizing(true);
    accept.dispatchData(
      {
        authData: { clientKey: acceptJs.clientKey, apiLoginID: acceptJs.apiLoginId },
        cardData: {
          cardNumber: cardNumber.replace(/\s+/g, ""),
          month: expMonth.padStart(2, "0"),
          year: expYear.length === 2 ? expYear : expYear.slice(-2),
          cardCode: cardCode.trim()
        }
      },
      (response) => {
        setIsTokenizing(false);
        if (response.messages.resultCode !== "Ok" || !response.opaqueData) {
          setError(response.messages.message[0]?.text ?? "Card was declined. Please check the details.");
          return;
        }
        onToken({
          descriptor: response.opaqueData.dataDescriptor,
          value: response.opaqueData.dataValue,
          cardholderName: name.trim()
        });
      }
    );
  }

  const busy = isBusy || isTokenizing;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal>
      <div className="w-full max-w-md rounded-xl bg-white p-6 text-black shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold">
            Subscribe{plan ? ` — ${plan.name}` : ""}
          </h3>
          <button className="text-slate-400 hover:text-slate-600" onClick={onClose} type="button">
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        {plan ? (
          <p className="mt-1 text-sm text-slate-500">
            {formatPrice(plan.priceCents, plan.currency)} / {plan.interval === "YEARLY" ? "year" : "month"}
          </p>
        ) : null}

        {error ? (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <div className="mt-4 space-y-3">
          <label className="block text-xs font-semibold text-slate-600">
            Cardholder name
            <input
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
              onChange={(event) => setName(event.target.value)}
              placeholder="Azeem Khan"
              value={name}
            />
          </label>
          <label className="block text-xs font-semibold text-slate-600">
            Card number
            <input
              autoComplete="cc-number"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
              inputMode="numeric"
              onChange={(event) => setCardNumber(event.target.value)}
              placeholder="4111 1111 1111 1111"
              value={cardNumber}
            />
          </label>
          <div className="grid grid-cols-3 gap-3">
            <label className="block text-xs font-semibold text-slate-600">
              Month
              <input
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
                inputMode="numeric"
                onChange={(event) => setExpMonth(event.target.value)}
                placeholder="MM"
                value={expMonth}
              />
            </label>
            <label className="block text-xs font-semibold text-slate-600">
              Year
              <input
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
                inputMode="numeric"
                onChange={(event) => setExpYear(event.target.value)}
                placeholder="YYYY"
                value={expYear}
              />
            </label>
            <label className="block text-xs font-semibold text-slate-600">
              CVC
              <input
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
                inputMode="numeric"
                onChange={(event) => setCardCode(event.target.value)}
                placeholder="123"
                value={cardCode}
              />
            </label>
          </div>
        </div>

        <p className="mt-3 text-[11px] text-slate-400">
          Card details are tokenized directly by Authorize.net — they never touch our servers.
          {acceptJs.environment !== "production" ? " (Sandbox mode — use test card 4111 1111 1111 1111.)" : ""}
        </p>

        <div className="mt-5 flex justify-end gap-2">
          <button
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-50"
            onClick={onClose}
            type="button"
          >
            Cancel
          </button>
          <button
            className="rounded-md bg-[#0067ff] px-4 py-2 text-sm font-bold text-white hover:bg-[#0050c7] disabled:opacity-60"
            disabled={busy || !scriptReady}
            onClick={submit}
            type="button"
          >
            {busy ? "Processing…" : scriptReady ? "Pay & subscribe" : "Loading…"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ProductCardModal({
  isSending,
  onClose,
  onSubmit
}: {
  isSending: boolean;
  onClose: () => void;
  onSubmit: (card: {
    title: string;
    price: string;
    image: string;
    url: string;
    description: string;
    buttonLabel: string;
  }) => void;
}) {
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [image, setImage] = useState("");
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [buttonLabel, setButtonLabel] = useState("View product");

  const canSend = title.trim().length > 0;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal>
      <div className="w-full max-w-md rounded-xl bg-white p-6 text-black shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold">Send a product card</h3>
          <button className="text-slate-400 hover:text-slate-600" onClick={onClose} type="button">
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <form
          className="mt-4 space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (canSend) {
              onSubmit({
                title: title.trim(),
                price: price.trim(),
                image: image.trim(),
                url: url.trim(),
                description: description.trim(),
                buttonLabel: buttonLabel.trim()
              });
            }
          }}
        >
          <label className="block text-xs font-semibold text-slate-600">
            Product name*
            <input
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Wireless headphones"
              value={title}
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs font-semibold text-slate-600">
              Price
              <input
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
                onChange={(event) => setPrice(event.target.value)}
                placeholder="$59.00"
                value={price}
              />
            </label>
            <label className="block text-xs font-semibold text-slate-600">
              Button label
              <input
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
                onChange={(event) => setButtonLabel(event.target.value)}
                placeholder="View product"
                value={buttonLabel}
              />
            </label>
          </div>
          <label className="block text-xs font-semibold text-slate-600">
            Image URL
            <input
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
              onChange={(event) => setImage(event.target.value)}
              placeholder="https://…/product.jpg"
              value={image}
            />
          </label>
          <label className="block text-xs font-semibold text-slate-600">
            Product URL
            <input
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://shop.example.com/p/123"
              value={url}
            />
          </label>
          <label className="block text-xs font-semibold text-slate-600">
            Description
            <textarea
              className="mt-1 w-full resize-none rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Short product blurb"
              rows={2}
              value={description}
            />
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <button
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-50"
              onClick={onClose}
              type="button"
            >
              Cancel
            </button>
            <button
              className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
              disabled={!canSend || isSending}
              type="submit"
            >
              Send product
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function NeverMissBanner({ onClose, onEnable }: { onClose: () => void; onEnable: () => void }) {
  return (
    <div className="fixed inset-x-0 top-0 z-40 flex h-6 items-center justify-center gap-3 bg-[#0a84ff] px-3 text-xs font-semibold text-white">
      <span>Never miss a chat!</span>
      <button
        className="inline-flex items-center gap-1.5 rounded-md bg-white px-2.5 py-0.5 text-[11px] font-bold text-[#0a1f44] transition hover:bg-white/90"
        onClick={onEnable}
        type="button"
      >
        <Bell className="h-3 w-3" aria-hidden />
        Enable browser notifications
      </button>
      <button
        aria-label="Dismiss"
        className="absolute right-2 grid h-5 w-5 place-items-center rounded text-white/90 hover:bg-white/20"
        onClick={onClose}
        type="button"
      >
        <X className="h-3.5 w-3.5" aria-hidden />
      </button>
    </div>
  );
}

function GlobalTopBar({
  bannerVisible,
  isNotificationOpen,
  onCreateChat,
  onSearchChange,
  onToggleNotifications,
  onToggleProfile,
  searchQuery,
  user
}: {
  bannerVisible: boolean;
  isNotificationOpen: boolean;
  onCreateChat: () => void;
  onSearchChange: (value: string) => void;
  onToggleNotifications: () => void;
  onToggleProfile: () => void;
  searchQuery: string;
  user: AuthUser | null;
}) {
  return (
    <div
      className={cn(
        "fixed inset-x-0 z-30 flex h-7 items-center justify-center bg-black",
        bannerVisible ? "top-6" : "top-0"
      )}
    >
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
  onPreview,
  onQuickAction,
  title
}: {
  activeScreen: ScreenKey;
  isLightScreen: boolean;
  onMobileMenu: () => void;
  onPreview: () => void;
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
            onClick={onPreview}
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

function greetingForHour(): string {
  const hour = new Date().getHours();
  if (hour < 12) {
    return "Good Morning";
  }
  if (hour < 17) {
    return "Good Afternoon";
  }
  return "Good Evening";
}

function OverviewScreen({
  agentsOnline,
  agentsTotal,
  customersOnline,
  onAction,
  onCreateChat,
  onNavigate,
  openCount,
  report,
  totalChats,
  userName
}: {
  agentsOnline: number;
  agentsTotal: number;
  customersOnline: number;
  onAction: (message: string) => void;
  onCreateChat: () => void;
  onNavigate: (screen: ScreenKey, secondary?: string) => void;
  openCount: number;
  report: ReportSummary | null;
  totalChats: number;
  userName: string;
}) {
  const days = report?.last7Days ?? [];
  const max = Math.max(...days.map((day) => day.count), 1);
  const last7Total = days.reduce((sum, day) => sum + day.count, 0);
  const totalChatsValue = report?.totalConversations ?? totalChats;
  const ongoing = report?.openCount ?? openCount;
  const firstName = userName.split(/[@ ]/)[0] ?? userName;

  return (
    <div className="mx-auto max-w-5xl px-5 py-5 text-white">
      <section className="mb-7 flex items-center gap-3">
        <span className="grid h-12 w-12 place-items-center rounded-full bg-[#caa84a] text-base font-bold text-[#3a2e00]">
          {initials(userName, userName)}
        </span>
        <div>
          <h2 className="text-2xl font-bold">
            {greetingForHour()}, {firstName}!
          </h2>
          <p className="mt-0.5 flex items-center gap-1.5 text-sm text-white/60">
            <Plus className="h-3.5 w-3.5 text-[#4ea2ff]" aria-hidden />
            Check your stats and suggestions for using LiveChat
          </p>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-bold">Real time overview</h2>
        <div className="grid gap-3 md:grid-cols-3">
          <DarkMetric label="Customers online" value={String(customersOnline)} />
          <DarkMetric label="Ongoing chats" value={String(ongoing)} />
          <DarkMetric label="Logged in agents" suffix={`of ${agentsTotal}`} value={String(agentsOnline)} />
        </div>
        <p className="mt-3 text-xs text-white/50">
          Tip: Some customers may not be shown because your plan has a 400 customers tracking limit.
          <button
            className="ml-1 font-semibold text-[#4ea2ff] hover:underline"
            onClick={() => onNavigate("billing")}
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
                <span className="text-lg font-bold">{totalChatsValue}</span>
                <span className="rounded bg-[#34343a] px-2 py-1 text-[11px] text-white/80">
                  {last7Total} in last 7 days
                </span>
              </div>
            </div>
            <SegmentedControl first="My stats" second="All agents" />
          </div>

          <div className="mt-7 grid h-48 grid-cols-[28px_minmax(0,1fr)] gap-2">
            <div className="flex flex-col justify-between pb-7 text-xs text-white/70">
              <span>{max}</span>
              <span>{Math.round(max / 2)}</span>
              <span>0</span>
            </div>
            <div className="relative border-b border-[#38383f]">
              <div className="absolute inset-x-0 top-0 border-t border-[#333338]" />
              <div className="absolute inset-x-0 top-1/2 border-t border-[#333338]" />
              <div className="absolute inset-x-0 bottom-0 border-t border-[#333338]" />
              <div className="relative z-10 flex h-full items-end justify-around pb-6">
                {days.map((day) => (
                  <div className="flex h-full w-14 flex-col items-center justify-end gap-2" key={day.date}>
                    <span className="text-[11px] font-bold text-white/80">{day.count || ""}</span>
                    <div
                      className="w-12 rounded-t-sm bg-[#0a84ff]"
                      style={{ height: `${Math.max((day.count / max) * 120, 2)}px` }}
                    />
                    <span className="text-[10px] text-white/80">{day.date.slice(5)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-3 border-t border-[#34343a] pt-4 md:grid-cols-2">
            <MetricRow icon={UsersRound} label="Queued visitors" value={String(report?.byStatus.QUEUED ?? 0)} />
            <MetricRow icon={MessageCircle} label="Open chats" value={String(report?.byStatus.OPEN ?? 0)} />
            <MetricRow icon={CheckCircle2} label="Resolved" value={String(report?.byStatus.RESOLVED ?? 0)} />
            <MetricRow buttonLabel="+ Add" icon={ShoppingCart} label="Goals" value="" onClick={() => onAction("Goal builder opened.")} />
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
  cannedResponses,
  chatLink,
  composer,
  connection,
  conversations,
  isCreating,
  isMessagesLoading,
  isSending,
  isSuggestingAi,
  isUpdatingConversation,
  members,
  messages,
  onAction,
  onAiSuggest,
  onAssign,
  onCopy,
  onCreateChat,
  onOpenConversation,
  onSaveCannedResponse,
  onConvertToTicket,
  onSendMessage,
  onSendNote,
  onSendProduct,
  onTyping,
  onUpdateStatus,
  onUpdateTags,
  onUploadFile,
  selectedConversation,
  setComposer,
  unread,
  visitorTypingPreview
}: {
  cannedResponses: CannedResponse[];
  chatLink: string;
  composer: string;
  connection: "connecting" | "online" | "offline";
  conversations: Conversation[];
  isCreating: boolean;
  isMessagesLoading: boolean;
  isSending: boolean;
  isSuggestingAi: boolean;
  isUpdatingConversation: boolean;
  members: OrganizationMember[];
  messages: Message[];
  onAction: (message: string) => void;
  onAiSuggest: () => void;
  onAssign: (agentMembershipId: string) => void;
  onCopy: (text: string, copiedMessage?: string) => Promise<void>;
  onCreateChat: () => void;
  onOpenConversation: (conversation: Conversation) => void;
  onSaveCannedResponse: (input: { title: string; shortcut: string; body: string }) => Promise<boolean>;
  onConvertToTicket: () => void;
  onSendMessage: (event: FormEvent<HTMLFormElement>) => void;
  onSendNote: () => void;
  onSendProduct: () => void;
  onTyping: (value: string) => void;
  onUpdateStatus: (status: ConversationStatus) => void;
  onUpdateTags: (tags: string[]) => void;
  onUploadFile: (file: File) => void;
  selectedConversation: Conversation | null;
  setComposer: (value: string) => void;
  unread: Record<string, number>;
  visitorTypingPreview: string | null;
}) {
  const totalUnread = Object.values(unread).reduce((sum, count) => sum + count, 0);
  const connectionMeta =
    connection === "online"
      ? { color: "bg-emerald-500", label: "Live" }
      : connection === "offline"
        ? { color: "bg-red-500", label: "Offline" }
        : { color: "bg-amber-400", label: "Connecting" };
  const conversationTags = readConversationTags(selectedConversation);
  return (
    <div className="grid min-h-full grid-cols-1 bg-[#1f1f23] text-white md:h-full md:grid-cols-[280px_minmax(0,1fr)] md:overflow-hidden 2xl:grid-cols-[320px_minmax(0,1fr)_340px]">
      <aside className="flex flex-col border-b border-[#111214] bg-[#202024] md:h-full md:min-h-0 md:border-b-0 md:border-r">
        <div className="flex h-12 items-center justify-between border-b border-[#303036] px-4">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold">Chats</h2>
            {totalUnread > 0 ? (
              <span className="grid h-5 min-w-5 place-items-center rounded-full bg-red-500 px-1.5 text-[11px] font-bold text-white">
                {totalUnread}
              </span>
            ) : null}
            <span className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-white/45">
              <span className={cn("inline-block h-2 w-2 rounded-full", connectionMeta.color)} />
              {connectionMeta.label}
            </span>
          </div>
          <button
            className="rounded-md bg-[#0a84ff] px-3 py-1.5 text-xs font-bold hover:bg-[#006fe0]"
            disabled={isCreating}
            onClick={onCreateChat}
            type="button"
          >
            {isCreating ? "Creating..." : "New chat"}
          </button>
        </div>

        <div className="max-h-[280px] overflow-auto md:max-h-none md:flex-1 md:min-h-0">
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
                  <span
                    className={cn(
                      "block truncate text-sm font-bold",
                      unread[conversation.id] ? "text-white" : "text-white/90"
                    )}
                  >
                    {conversation.subject ?? "Unnamed customer"}
                  </span>
                  <span
                    className={cn(
                      "mt-1 block truncate text-xs",
                      unread[conversation.id] ? "font-semibold text-white/80" : "text-white/55"
                    )}
                  >
                    {conversation.latestMessage?.body ?? "No messages yet"}
                  </span>
                </span>
                <span className="flex flex-col items-end gap-1">
                  <span className="text-[10px] uppercase text-white/40">{conversation.status}</span>
                  {unread[conversation.id] ? (
                    <span className="grid h-5 min-w-5 place-items-center rounded-full bg-red-500 px-1.5 text-[11px] font-bold text-white">
                      {unread[conversation.id]}
                    </span>
                  ) : null}
                </span>
              </button>
            ))
          )}
        </div>
      </aside>

      <section className="flex min-h-[420px] flex-col border-b border-[#111214] md:h-full md:min-h-0 md:border-b-0 2xl:border-r">
        {selectedConversation ? (
          <>
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-[#303036] px-5 py-2">
              <div className="min-w-0">
                <p className="truncate text-lg font-bold">{selectedConversation.subject ?? "Unnamed customer"}</p>
                <p className="truncate text-xs text-white/50">
                  {selectedConversation.status} · {selectedConversation.source} ·{" "}
                  {agentLabel(members.find((member) => member.id === selectedConversation.assignedAgentId))}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  aria-label="Assign agent"
                  className="rounded-md border border-[#3a3a42] bg-[#2a2a30] px-2 py-1.5 text-xs text-white outline-none focus:border-[#0a84ff]"
                  disabled={isUpdatingConversation || members.length === 0}
                  onChange={(event) => {
                    if (event.target.value) {
                      onAssign(event.target.value);
                    }
                  }}
                  value={selectedConversation.assignedAgentId ?? ""}
                >
                  <option value="">Unassigned</option>
                  {members.map((member) => (
                    <option key={member.id} value={member.id}>
                      {agentLabel(member)}
                    </option>
                  ))}
                </select>
                {selectedConversation.status !== "RESOLVED" ? (
                  <button
                    className="rounded-md bg-emerald-600 px-2.5 py-1.5 text-xs font-bold hover:bg-emerald-500 disabled:opacity-60"
                    disabled={isUpdatingConversation}
                    onClick={() => onUpdateStatus("RESOLVED")}
                    type="button"
                  >
                    Resolve
                  </button>
                ) : null}
                {selectedConversation.status !== "CLOSED" ? (
                  <button
                    className="rounded-md border border-[#3a3a42] px-2.5 py-1.5 text-xs font-bold hover:bg-white/10 disabled:opacity-60"
                    disabled={isUpdatingConversation}
                    onClick={() => onUpdateStatus("CLOSED")}
                    type="button"
                  >
                    Close
                  </button>
                ) : null}
                <button
                  className="flex items-center gap-1 rounded-md border border-[#3a3a42] px-2.5 py-1.5 text-xs font-bold hover:bg-white/10 disabled:opacity-60"
                  disabled={isUpdatingConversation}
                  onClick={onConvertToTicket}
                  title="Create a ticket from this chat and auto-reply to the visitor"
                  type="button"
                >
                  <TicketIcon className="h-3.5 w-3.5" aria-hidden /> Ticket
                </button>
                <IconButton dark icon={Link2} label="Copy chat link" onClick={() => void onCopy(chatLink, "Chat link copied.")} />
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-[#303036] bg-[#1b1b1f] px-5 py-2">
              <span className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-white/40">
                <Tag className="h-3 w-3" aria-hidden />
                Tags
              </span>
              {conversationTags.map((tag) => (
                <span
                  className="flex items-center gap-1 rounded-full bg-[#2a2a30] px-2 py-0.5 text-xs text-white/80"
                  key={tag}
                >
                  {tag}
                  <button
                    aria-label={`Remove tag ${tag}`}
                    className="text-white/45 hover:text-white"
                    onClick={() => onUpdateTags(conversationTags.filter((current) => current !== tag))}
                    type="button"
                  >
                    ×
                  </button>
                </span>
              ))}
              <button
                className="rounded-full border border-dashed border-white/25 px-2 py-0.5 text-xs text-white/60 hover:bg-white/10"
                onClick={() => {
                  const tag = window.prompt("Add a tag (e.g. sales, bug, vip):");

                  if (!tag || !tag.trim()) {
                    return;
                  }

                  const normalized = tag.trim().toLowerCase();

                  if (conversationTags.includes(normalized)) {
                    return;
                  }

                  onUpdateTags([...conversationTags, normalized]);
                }}
                type="button"
              >
                + Tag
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-auto px-5 py-5">
              {isMessagesLoading ? (
                <div className="space-y-3">
                  <div className="h-10 w-2/3 rounded-lg bg-white/10" />
                  <div className="ml-auto h-10 w-1/2 rounded-lg bg-blue-600/40" />
                </div>
              ) : (
                <MessageTimeline messages={messages} />
              )}
            </div>

            {visitorTypingPreview !== null ? (
              <div className="flex shrink-0 items-center gap-2 border-t border-[#303036] bg-[#15151a] px-5 py-2">
                <span className="flex gap-1">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-400 [animation-delay:-0.2s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-400 [animation-delay:-0.1s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-400" />
                </span>
                <span className="min-w-0 flex-1 truncate text-xs italic text-emerald-300/90">
                  {visitorTypingPreview
                    ? `Visitor is typing: "${visitorTypingPreview}"`
                    : "Visitor is typing…"}
                </span>
              </div>
            ) : null}

            <form className="shrink-0 border-t border-[#303036] p-4" onSubmit={onSendMessage}>
              <div className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-slate-900 shadow-lg">
                <label
                  className="grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-full text-slate-500 hover:bg-slate-100"
                  title="Attach file"
                >
                  <Paperclip className="h-4 w-4" aria-hidden />
                  <input
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];

                      if (file) {
                        onUploadFile(file);
                      }

                      event.target.value = "";
                    }}
                    type="file"
                  />
                </label>
                <input
                  className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-500"
                  onChange={(event) => {
                    setComposer(event.target.value);
                    onTyping(event.target.value);
                  }}
                  placeholder="Write a message..."
                  value={composer}
                />
                <button
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#0067ff] text-white hover:bg-[#0050c7]"
                  disabled={isSending}
                  type="submit"
                >
                  <SendHorizontal className="h-4 w-4" aria-hidden />
                </button>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800 hover:bg-amber-200 disabled:opacity-60"
                  disabled={isSending}
                  onClick={onSendNote}
                  title="Add a private note (only your team sees it)"
                  type="button"
                >
                  🔒 Note
                </button>
                <button
                  className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800 hover:bg-emerald-200 disabled:opacity-60"
                  disabled={isSending}
                  onClick={onSendProduct}
                  title="Send a product card to the visitor"
                  type="button"
                >
                  🛍 Product
                </button>
                <button
                  className="rounded-full border border-violet-400/40 bg-violet-500/15 px-3 py-1 text-xs font-bold text-violet-200 hover:bg-violet-500/25 disabled:opacity-60"
                  disabled={isSuggestingAi}
                  onClick={onAiSuggest}
                  type="button"
                >
                  {isSuggestingAi ? "✨ Thinking…" : "✨ AI suggest"}
                </button>
                {cannedResponses.slice(0, 6).map((response) => (
                  <button
                    className="rounded-full border border-white/15 px-3 py-1 text-xs text-white/75 hover:bg-white/10"
                    key={response.id}
                    onClick={() => setComposer(response.body)}
                    title={response.body}
                    type="button"
                  >
                    {response.shortcut}
                  </button>
                ))}
                <button
                  className="rounded-full border border-dashed border-white/25 px-3 py-1 text-xs text-white/60 hover:bg-white/10"
                  onClick={() => {
                    const body = composer.trim();

                    if (!body) {
                      onAction("Type a message first, then save it as a canned reply.");
                      return;
                    }

                    const shortcut = window.prompt("Shortcut for this canned reply (e.g. /thanks):");

                    if (!shortcut || !shortcut.trim()) {
                      return;
                    }

                    void onSaveCannedResponse({
                      title: shortcut.replace(/^\//, "").trim(),
                      shortcut: shortcut.trim(),
                      body
                    }).then((ok) => {
                      if (ok) {
                        setComposer("");
                      }
                    });
                  }}
                  type="button"
                >
                  + Save reply
                </button>
              </div>
            </form>
          </>
        ) : (
          <ChannelSetup onAction={onAction} />
        )}
      </section>

      <aside className="hidden bg-[#202024] 2xl:block">
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

function shortPath(url: string | null): string {
  if (!url) {
    return "—";
  }

  try {
    const parsed = new URL(url);
    return `${parsed.hostname}${parsed.pathname === "/" ? "" : parsed.pathname}`;
  } catch {
    return url;
  }
}

function relativeTime(value: string | null): string {
  if (!value) {
    return "—";
  }

  const seconds = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 1000));

  if (seconds < 60) {
    return `${seconds}s ago`;
  }

  if (seconds < 3600) {
    return `${Math.round(seconds / 60)}m ago`;
  }

  return `${Math.round(seconds / 3600)}h ago`;
}

function timeOnPages(startIso: string | null, endIso: string | null): string {
  if (!startIso) {
    return "—";
  }
  const start = new Date(startIso).getTime();
  const end = endIso ? new Date(endIso).getTime() : Date.now();
  const seconds = Math.max(0, Math.round((end - start) / 1000));
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  if (minutes === 0) {
    return `${rest}s`;
  }
  return `${minutes}m ${rest}s`;
}

const TRAFFIC_TABS = [
  "All customers",
  "Chatting",
  "Supervised",
  "Queued",
  "Waiting for reply",
  "Invited",
  "Browsing"
] as const;

const COUNTRY_FLAGS: Record<string, string> = {
  Pakistan: "🇵🇰", "United States": "🇺🇸", Germany: "🇩🇪", Norway: "🇳🇴",
  Netherlands: "🇳🇱", "United Kingdom": "🇬🇧", Sweden: "🇸🇪", India: "🇮🇳",
  Canada: "🇨🇦", Australia: "🇦🇺", France: "🇫🇷", Singapore: "🇸🇬",
  Brazil: "🇧🇷", Kenya: "🇰🇪", Spain: "🇪🇸", Italy: "🇮🇹", Japan: "🇯🇵"
};

const AVATAR_COLORS = [
  "bg-[#2f6bff]", "bg-[#e6377e]", "bg-[#22c55e]", "bg-[#f59e0b]",
  "bg-[#8b5cf6]", "bg-[#ef4444]", "bg-[#06b6d4]", "bg-[#f97316]"
];

function avatarColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) & 0xffffff;
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length] ?? AVATAR_COLORS[0]!;
}

function TrafficScreen({
  chatLink,
  liveVisitors,
  members,
  onAction,
  onCopy,
  onOpenConversation,
  typingPreviews,
  voiceAlert,
  onChangeVoiceAlert
}: {
  chatLink: string;
  liveVisitors: LiveVisitor[];
  members: OrganizationMember[];
  onAction: (message: string) => void;
  onCopy: (text: string, copiedMessage?: string) => Promise<void>;
  onOpenConversation: (conversationId: string) => void;
  typingPreviews: Record<string, string>;
  voiceAlert: "off" | VoiceGender;
  onChangeVoiceAlert: (value: "off" | VoiceGender) => void;
}) {
  const [tab, setTab] = useState<(typeof TRAFFIC_TABS)[number]>("All customers");

  const inTab = (visitor: LiveVisitor, tabName: (typeof TRAFFIC_TABS)[number]) => {
    if (tabName === "All customers") return true;
    if (tabName === "Chatting") return visitor.activity === "Chatting";
    if (tabName === "Browsing") return visitor.activity === "Browsing";
    return false; // Supervised / Queued / Waiting for reply / Invited (not tracked yet)
  };

  const counts: Record<string, number> = {};
  for (const tabName of TRAFFIC_TABS) {
    counts[tabName] = liveVisitors.filter((v) => inTab(v, tabName)).length;
  }
  const visible = liveVisitors.filter((v) => inTab(v, tab));

  return (
    <div className="min-h-full bg-[#1f1f23] text-white">
      {/* Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto border-b border-[#303036] px-2 text-sm">
        {TRAFFIC_TABS.map((tabName) => (
          <button
            className={cn(
              "shrink-0 border-b-2 px-3 py-3 font-semibold",
              tab === tabName ? "border-[#4ea2ff] text-white" : "border-transparent text-white/50 hover:text-white/80"
            )}
            key={tabName}
            onClick={() => setTab(tabName)}
            type="button"
          >
            {tabName} <span className="text-white/40">({counts[tabName] ?? 0})</span>
          </button>
        ))}
        <span className="ml-auto shrink-0 pr-2 text-white/40">
          <MoreHorizontal className="h-4 w-4" aria-hidden />
        </span>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2 border-b border-[#303036] px-4 py-2.5 text-xs">
        <button className="grid h-7 w-7 place-items-center rounded-md bg-[#2f6bff] text-white" type="button" aria-label="Filters">
          <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden />
        </button>
        <button className="flex items-center gap-1.5 rounded-md border border-[#3a3a42] px-3 py-1.5 font-semibold text-white/80 hover:bg-white/5" type="button">
          Match all filters <ChevronDown className="h-3.5 w-3.5" aria-hidden />
        </button>
        <button
          className="flex items-center gap-1.5 rounded-md border border-[#3a3a42] px-3 py-1.5 font-semibold text-white/80 hover:bg-white/5"
          onClick={() => onAction("Filter builder opening…")}
          type="button"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden /> Add filter
        </button>

        {/* New-visitor voice alert: Off / Female / Male */}
        <div className="ml-auto flex items-center gap-1.5" title="Play a voice when a new visitor arrives">
          {voiceAlert === "off" ? (
            <VolumeX className="h-3.5 w-3.5 text-white/50" aria-hidden />
          ) : (
            <Volume2 className="h-3.5 w-3.5 text-[#4ea2ff]" aria-hidden />
          )}
          <span className="hidden text-white/50 sm:inline">New-visitor voice</span>
          <select
            className="rounded-md border border-[#3a3a42] bg-[#2a2a30] px-2 py-1.5 font-semibold text-white/90 outline-none hover:bg-white/5"
            onChange={(event) => {
              const next = event.target.value as "off" | VoiceGender;
              onChangeVoiceAlert(next);
              if (next !== "off") {
                // Immediate feedback so the agent hears the chosen voice.
                speak("Voice alerts on", next);
              }
            }}
            value={voiceAlert}
          >
            <option value="off">Off</option>
            <option value="female">Female voice</option>
            <option value="male">Male voice</option>
          </select>
        </div>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[1.2fr_1.1fr_1.1fr_0.9fr_1.1fr_1.1fr_1fr_0.9fr_0.8fr] border-b border-[#303036] px-1 text-[11px] font-semibold text-white/45">
        {["Name", "Email", "Actions", "Activity", "Chatting with", "Time on all pages", "Country", "State", "City"].map(
          (heading) => (
            <div className="flex items-center gap-1 px-3 py-2.5" key={heading}>
              {heading}
              {heading === "Time on all pages" && <span className="text-white/60">↑</span>}
            </div>
          )
        )}
      </div>

      {visible.length > 0 ? (
        <div className="divide-y divide-[#2a2a30]">
          {visible.map((visitor) => {
            const name = visitor.name || visitor.ip || "Unknown";
            const agent = members.find((m) => m.id === visitor.chattingWithAgentId);
            const typing = typingPreviews[visitor.id];
            return (
              <div
                className="grid grid-cols-[1.2fr_1.1fr_1.1fr_0.9fr_1.1fr_1.1fr_1fr_0.9fr_0.8fr] items-center text-sm hover:bg-white/[0.03]"
                key={visitor.id}
              >
                <div className="flex min-w-0 items-center gap-2 px-3 py-2.5">
                  <span className={cn("grid h-6 w-6 shrink-0 place-items-center rounded-full text-[10px] font-bold text-white", avatarColor(name))}>
                    U
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{name}</span>
                    {typing ? (
                      <span className="block truncate text-[11px] italic text-emerald-300/90">
                        ✍️ {typing}
                      </span>
                    ) : null}
                  </span>
                </div>
                <div className="min-w-0 truncate px-3 py-2.5 text-white/50">{visitor.email || "–"}</div>
                <div className="px-3 py-2.5">
                  {visitor.activity === "Chatting" && visitor.activeConversationId ? (
                    <button
                      className="rounded-md bg-[#3a3a42] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#45454e]"
                      onClick={() => onOpenConversation(visitor.activeConversationId as string)}
                      type="button"
                    >
                      Supervise chat
                    </button>
                  ) : visitor.activity === "Browsing" ? (
                    <button
                      className="rounded-md bg-[#4ea2ff] px-3 py-1.5 text-xs font-bold text-black hover:bg-[#66adff]"
                      onClick={() => onAction(`Chat invite sent to ${name}.`)}
                      type="button"
                    >
                      Start chat
                    </button>
                  ) : (
                    <span className="text-white/30">–</span>
                  )}
                </div>
                <div className="px-3 py-2.5">
                  <span className="flex items-center gap-1.5 text-white/80">
                    <span
                      className={cn(
                        "h-2 w-2 rounded-full",
                        visitor.activity === "Chatting"
                          ? "bg-emerald-400"
                          : visitor.activity === "Browsing"
                            ? "bg-[#4ea2ff]"
                            : "bg-white/25"
                      )}
                    />
                    {visitor.activity === "Browsing" ? "On site" : visitor.activity}
                  </span>
                </div>
                <div className="min-w-0 truncate px-3 py-2.5 text-white/70">
                  {agent ? (
                    <span className="flex items-center gap-1.5">
                      <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#caa84a] text-[9px] font-bold text-[#3a2e00]">
                        {initials(agent.name, agent.email)}
                      </span>
                      <span className="truncate">{agent.name || agent.email}</span>
                    </span>
                  ) : (
                    <span className="text-white/30">–</span>
                  )}
                </div>
                <div className="px-3 py-2.5 text-white/70">
                  {timeOnPages(visitor.sessionStartedAt ?? visitor.firstSeenAt, visitor.lastSeenAt)}
                </div>
                <div className="min-w-0 truncate px-3 py-2.5 text-white/70">
                  {visitor.country ? (
                    <span className="flex items-center gap-1.5">
                      <span>{COUNTRY_FLAGS[visitor.country] ?? "🌐"}</span>
                      <span className="truncate">{visitor.country}</span>
                    </span>
                  ) : (
                    <span className="text-white/30">–</span>
                  )}
                </div>
                <div className="min-w-0 truncate px-3 py-2.5 text-white/70">{visitor.state || "–"}</div>
                <div className="min-w-0 truncate px-3 py-2.5 text-white/70">{visitor.city || "–"}</div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex min-h-[300px] items-center justify-center px-6 text-center">
          <div className="max-w-lg">
            <h2 className="text-xl font-bold">
              {tab === "All customers" ? "No visitors online right now" : `No customers in "${tab}"`}
            </h2>
            <p className="mt-3 text-sm text-white/75">
              When someone opens a page with your widget installed, they appear here live.
            </p>
            <p className="mt-8 text-sm font-semibold text-white/80">Share your chat link</p>
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
      )}
    </div>
  );
}

function campaignConversion(campaign: Campaign): string {
  if (campaign.displayedCount === 0) {
    return "-";
  }
  return `${((campaign.chatsCount / campaign.displayedCount) * 100).toFixed(2)}%`;
}

function CampaignsScreen({
  campaigns,
  onCreate,
  onDelete,
  onToggle
}: {
  campaigns: Campaign[];
  onCreate: (input: { name: string; type: string; triggerType: string; message: string }) => Promise<boolean>;
  onDelete: (id: string) => void;
  onToggle: (campaign: Campaign) => void;
}) {
  const [tab, setTab] = useState<"recurring" | "one-time">("recurring");
  const [showPromo, setShowPromo] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [triggerType, setTriggerType] = useState("page_visit");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) {
      return;
    }
    const ok = await onCreate({ name: name.trim(), type: tab, triggerType, message: message.trim() });
    if (ok) {
      setName("");
      setMessage("");
      setShowForm(false);
    }
  }

  const visible = campaigns.filter((row) => row.type === tab);

  return (
    <div className="min-h-full bg-white px-6 py-5 text-[#111214]">
      {showPromo && (
        <div className="relative mb-5 flex items-center justify-between gap-6 overflow-hidden rounded-xl bg-gradient-to-r from-slate-100 to-slate-50 p-6">
          <div className="max-w-lg">
            <h3 className="text-lg font-bold">Engage visitors with campaigns</h3>
            <p className="mt-2 text-sm text-slate-600">
              Welcome and assist them, gather leads, or share coupons and discounts through proactive
              chat invites.
            </p>
            <button
              className="mt-4 rounded-lg bg-[#111214] px-4 py-2 text-sm font-bold text-white hover:bg-black"
              onClick={() => setShowForm(true)}
              type="button"
            >
              Create campaign
            </button>
          </div>
          <div className="hidden h-28 w-44 shrink-0 rounded-lg bg-white shadow-sm md:flex md:items-center md:justify-center">
            <div className="grid h-14 w-14 place-items-center rounded-full bg-[#ffd33d]">
              <MessageCircle className="h-7 w-7 text-[#111214]" aria-hidden />
            </div>
          </div>
          <button
            aria-label="Dismiss"
            className="absolute right-3 top-3 grid h-6 w-6 place-items-center rounded text-slate-500 hover:bg-slate-200"
            onClick={() => setShowPromo(false)}
            type="button"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
      )}

      {showForm && (
        <form className="mb-5 grid gap-3 rounded-xl border border-slate-200 p-5 md:grid-cols-2" onSubmit={submit}>
          <label className="block text-sm">
            <span className="mb-1 block font-semibold text-slate-700">Campaign name</span>
            <input
              className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-[#0067ff]"
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Summer sale popup"
              value={name}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-semibold text-slate-700">Trigger</span>
            <select
              className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-[#0067ff]"
              onChange={(event) => setTriggerType(event.target.value)}
              value={triggerType}
            >
              <option value="page_visit">When visiting a page</option>
              <option value="exit_intent">On exit intent</option>
              <option value="time_on_page">After time on page</option>
              <option value="welcome">Welcome (on load)</option>
            </select>
          </label>
          <label className="block text-sm md:col-span-2">
            <span className="mb-1 block font-semibold text-slate-700">Invite message</span>
            <input
              className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-[#0067ff]"
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Hi 👋 Need any help?"
              value={message}
            />
          </label>
          <div className="flex gap-2 md:col-span-2">
            <button
              className="rounded-lg bg-[#2f6bff] px-4 py-2 text-sm font-bold text-white hover:bg-[#3f78ff] disabled:opacity-60"
              disabled={!name.trim()}
              type="submit"
            >
              Save campaign
            </button>
            <button
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-50"
              onClick={() => setShowForm(false)}
              type="button"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="mb-4 flex items-center justify-between">
        <div className="inline-flex rounded-lg border border-slate-200 p-1 text-sm font-semibold">
          <button
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5",
              tab === "recurring" ? "bg-slate-100 text-[#111214]" : "text-slate-500"
            )}
            onClick={() => setTab("recurring")}
            type="button"
          >
            <ArrowRight className="h-4 w-4" aria-hidden /> Recurring
          </button>
          <button
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5",
              tab === "one-time" ? "bg-slate-100 text-[#111214]" : "text-slate-500"
            )}
            onClick={() => setTab("one-time")}
            type="button"
          >
            <Clock3 className="h-4 w-4" aria-hidden /> One-time
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200">
        <div className="grid grid-cols-[2.4fr_0.8fr_0.8fr_0.6fr_0.9fr_0.9fr] border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-slate-500">
          <div>Name</div>
          <div className="text-center">Status</div>
          <div className="text-right">Displayed</div>
          <div className="text-right">Chats</div>
          <div className="text-right">Conversion</div>
          <div className="text-right">Actions</div>
        </div>

        <button
          className="flex w-full items-center gap-2 border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-500 hover:bg-slate-50"
          onClick={() => setShowForm(true)}
          type="button"
        >
          <span className="grid h-6 w-6 place-items-center rounded-full border border-dashed border-slate-300">
            <Plus className="h-3.5 w-3.5" aria-hidden />
          </span>
          Add new campaign
        </button>

        {visible.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-slate-400">No {tab} campaigns yet.</div>
        ) : (
          visible.map((row) => (
            <div
              className="grid grid-cols-[2.4fr_0.8fr_0.8fr_0.6fr_0.9fr_0.9fr] items-center border-b border-slate-100 px-4 py-3 text-sm last:border-b-0 hover:bg-slate-50"
              key={row.id}
            >
              <div className="flex items-center gap-2 font-semibold text-[#0a66ff]">
                {row.triggerType === "exit_intent" || row.triggerType === "welcome" ? (
                  <Monitor className="h-4 w-4 text-slate-400" aria-hidden />
                ) : (
                  <PanelLeft className="h-4 w-4 text-slate-400" aria-hidden />
                )}
                <span className="truncate" title={row.message}>{row.name}</span>
              </div>
              <div className="flex justify-center">
                <button
                  aria-label="Toggle campaign"
                  className={cn(
                    "relative h-5 w-9 rounded-full transition",
                    row.enabled ? "bg-emerald-500" : "bg-slate-300"
                  )}
                  onClick={() => onToggle(row)}
                  type="button"
                >
                  <span
                    className={cn(
                      "absolute top-0.5 h-4 w-4 rounded-full bg-white transition",
                      row.enabled ? "left-[18px]" : "left-0.5"
                    )}
                  />
                </button>
              </div>
              <div className="text-right tabular-nums text-slate-700">{row.displayedCount}</div>
              <div className="text-right tabular-nums text-slate-700">{row.chatsCount}</div>
              <div className="text-right tabular-nums text-slate-700">{campaignConversion(row)}</div>
              <div className="flex items-center justify-end gap-3">
                <button
                  className="text-sm font-semibold text-rose-500 hover:underline"
                  onClick={() => onDelete(row.id)}
                  type="button"
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function GoalsScreen({
  goals,
  onCreate,
  onDelete,
  report,
  totalVisitors
}: {
  goals: Goal[];
  onCreate: (input: { name: string; type: string; target: string; valueCents: number }) => Promise<boolean>;
  onDelete: (id: string) => void;
  report: ReportSummary | null;
  totalVisitors: number;
}) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [value, setValue] = useState("");

  const chats = report?.totalConversations ?? 0;
  const visitors = Math.max(totalVisitors, report ? report.totalConversations * 4 : 0);
  const goalCompletions = goals.reduce((sum, goal) => sum + goal.completedCount, 0);

  const cards = [
    { label: "Visitors", value: visitors, delta: "-28", deltaTone: "text-rose-400", icon: UsersRound },
    { label: "Chats", value: chats, delta: "+3", deltaTone: "text-emerald-400", icon: MessagesSquare },
    { label: "Goals", value: goalCompletions, delta: null, deltaTone: "", icon: Sparkles }
  ];

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) {
      return;
    }
    const ok = await onCreate({
      name: name.trim(),
      type: "url",
      target: target.trim(),
      valueCents: Math.round((Number(value) || 0) * 100)
    });
    if (ok) {
      setName("");
      setTarget("");
      setValue("");
      setShowForm(false);
    }
  }

  return (
    <div className="min-h-full bg-[#1f1f23] px-6 py-6 text-white">
      <div className="flex items-center gap-2">
        {cards.map((card, index) => (
          <div className="flex flex-1 items-center gap-2" key={card.label}>
            <div className="flex-1 rounded-xl bg-[#28282d] p-5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-white/70">
                  {card.label} <span className="text-white/40">(last 7 days)</span>
                </span>
                <card.icon className="h-4 w-4 text-white/40" aria-hidden />
              </div>
              <div className="mt-3 text-4xl font-bold">{card.value}</div>
              {card.delta && (
                <div className={cn("mt-1 text-sm font-semibold", card.deltaTone)}>{card.delta}</div>
              )}
            </div>
            {index < cards.length - 1 && <ChevronRight className="h-5 w-5 shrink-0 text-white/30" aria-hidden />}
          </div>
        ))}
      </div>

      {goals.length > 0 && (
        <div className="mt-8 overflow-hidden rounded-xl border border-[#33333a]">
          {goals.map((goal) => (
            <div
              className="flex items-center justify-between border-b border-[#2c2c32] px-4 py-3 text-sm last:border-b-0"
              key={goal.id}
            >
              <div className="flex items-center gap-3">
                <Sparkles className="h-4 w-4 text-[#4ea2ff]" aria-hidden />
                <div>
                  <p className="font-semibold">{goal.name}</p>
                  <p className="text-xs text-white/50">
                    {goal.target || "Any page"}
                    {goal.valueCents > 0 ? ` · $${(goal.valueCents / 100).toFixed(2)} value` : ""}
                  </p>
                </div>
              </div>
              <button
                className="text-xs font-semibold text-rose-400 hover:underline"
                onClick={() => onDelete(goal.id)}
                type="button"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}

      {showForm ? (
        <form className="mx-auto mt-10 grid max-w-md gap-3 rounded-xl bg-[#28282d] p-5" onSubmit={submit}>
          <label className="block text-sm">
            <span className="mb-1 block font-semibold text-white/80">Goal name</span>
            <input
              className="h-10 w-full rounded-md border border-[#3a3a42] bg-[#1f1f23] px-3 text-sm outline-none focus:border-[#4ea2ff]"
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Newsletter signup"
              value={name}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-semibold text-white/80">Target URL contains</span>
            <input
              className="h-10 w-full rounded-md border border-[#3a3a42] bg-[#1f1f23] px-3 text-sm outline-none focus:border-[#4ea2ff]"
              onChange={(event) => setTarget(event.target.value)}
              placeholder="/thank-you"
              value={target}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-semibold text-white/80">Value ($, optional)</span>
            <input
              className="h-10 w-full rounded-md border border-[#3a3a42] bg-[#1f1f23] px-3 text-sm outline-none focus:border-[#4ea2ff]"
              onChange={(event) => setValue(event.target.value)}
              placeholder="5.00"
              type="number"
              value={value}
            />
          </label>
          <div className="flex gap-2">
            <button
              className="rounded-lg bg-[#2f6bff] px-4 py-2 text-sm font-bold text-white hover:bg-[#3f78ff] disabled:opacity-60"
              disabled={!name.trim()}
              type="submit"
            >
              Save goal
            </button>
            <button
              className="rounded-lg border border-[#3a3a42] px-4 py-2 text-sm font-semibold hover:bg-white/5"
              onClick={() => setShowForm(false)}
              type="button"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="mt-12 flex flex-col items-center text-center">
          <h3 className="text-lg font-bold">Measure chat effectiveness</h3>
          <p className="mt-2 max-w-sm text-sm text-white/60">
            See how many chats turn into leads or resolved cases.{" "}
            <span className="text-[#4ea2ff]">Learn more</span> about Goals.
          </p>
          <button
            className="mt-5 flex items-center gap-2 rounded-lg bg-[#2f6bff] px-4 py-2 text-sm font-bold text-white hover:bg-[#3f78ff]"
            onClick={() => setShowForm(true)}
            type="button"
          >
            <Plus className="h-4 w-4" aria-hidden /> Create goal
          </button>
        </div>
      )}
    </div>
  );
}

function KnowledgeHubScreen({
  articles,
  onCreate,
  onDelete,
  onToggle
}: {
  articles: KnowledgeArticle[];
  onCreate: (input: { title: string; content: string; category: string }) => Promise<boolean>;
  onDelete: (id: string) => void;
  onToggle: (article: KnowledgeArticle) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("General");
  const [content, setContent] = useState("");
  const [query, setQuery] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim()) {
      return;
    }
    const ok = await onCreate({ title: title.trim(), content: content.trim(), category: category.trim() });
    if (ok) {
      setTitle("");
      setContent("");
      setCategory("General");
      setShowForm(false);
    }
  }

  const filtered = query.trim()
    ? articles.filter(
        (a) =>
          a.title.toLowerCase().includes(query.toLowerCase()) ||
          a.content.toLowerCase().includes(query.toLowerCase())
      )
    : articles;

  return (
    <div className="min-h-full bg-white px-6 py-6 text-[#111214]">
      <div className="mx-auto max-w-4xl">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <BookOpen className="h-7 w-7 text-[#2f6bff]" aria-hidden />
            <div>
              <h2 className="text-xl font-bold">Knowledge hub</h2>
              <p className="text-sm text-slate-500">
                Help articles for self-service — also used to train your chatbot&apos;s answers.
              </p>
            </div>
          </div>
          <button
            className="rounded-lg bg-[#2f6bff] px-4 py-2 text-sm font-bold text-white hover:bg-[#3f78ff]"
            onClick={() => setShowForm((current) => !current)}
            type="button"
          >
            {showForm ? "Close" : "+ New article"}
          </button>
        </div>

        {showForm && (
          <form className="mb-6 space-y-3 rounded-xl border border-slate-200 p-5" onSubmit={submit}>
            <div className="grid gap-3 md:grid-cols-[2fr_1fr]">
              <label className="block text-sm">
                <span className="mb-1 block font-semibold text-slate-700">Title</span>
                <input
                  className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-[#2f6bff]"
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. How do I reset my password?"
                  value={title}
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-semibold text-slate-700">Category</span>
                <input
                  className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-[#2f6bff]"
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="General"
                  value={category}
                />
              </label>
            </div>
            <label className="block text-sm">
              <span className="mb-1 block font-semibold text-slate-700">Answer / content</span>
              <textarea
                className="min-h-[120px] w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#2f6bff]"
                onChange={(e) => setContent(e.target.value)}
                placeholder="Write the answer visitors and the chatbot will use…"
                value={content}
              />
            </label>
            <button
              className="rounded-lg bg-[#2f6bff] px-4 py-2 text-sm font-bold text-white hover:bg-[#3f78ff] disabled:opacity-60"
              disabled={!title.trim()}
              type="submit"
            >
              Save article
            </button>
          </form>
        )}

        <div className="relative mb-4">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" aria-hidden />
          <input
            className="h-10 w-full rounded-lg border border-slate-200 pl-9 pr-3 text-sm outline-none focus:border-[#2f6bff]"
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search articles…"
            value={query}
          />
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200">
          {filtered.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-slate-400">
              {articles.length === 0 ? "No articles yet — add your first help answer." : "No articles match your search."}
            </p>
          ) : (
            filtered.map((article) => (
              <div
                className="flex items-start justify-between gap-4 border-b border-slate-100 px-4 py-3 last:border-b-0"
                key={article.id}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-bold">{article.title}</p>
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
                      {article.category}
                    </span>
                    {!article.published && (
                      <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                        Draft
                      </span>
                    )}
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-slate-500">{article.content || "No content"}</p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <button
                    className="text-xs font-semibold text-[#2f6bff] hover:underline"
                    onClick={() => onToggle(article)}
                    type="button"
                  >
                    {article.published ? "Unpublish" : "Publish"}
                  </button>
                  <button
                    className="text-xs font-semibold text-rose-500 hover:underline"
                    onClick={() => onDelete(article.id)}
                    type="button"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function CannedResponsesManager({
  cannedResponses,
  onCopy,
  onDelete,
  onSave
}: {
  cannedResponses: CannedResponse[];
  onCopy: (text: string, copiedMessage?: string) => Promise<void>;
  onDelete: (id: string) => void;
  onSave: (input: { title: string; shortcut: string; body: string }) => Promise<boolean>;
}) {
  const [title, setTitle] = useState("");
  const [shortcut, setShortcut] = useState("");
  const [body, setBody] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim() || !body.trim()) {
      return;
    }
    const ok = await onSave({ title: title.trim(), shortcut: shortcut.trim(), body: body.trim() });
    if (ok) {
      setTitle("");
      setShortcut("");
      setBody("");
    }
  }

  return (
    <div className="min-h-full bg-white px-6 py-8 text-[#111214]">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center gap-3">
          <MessageSquareText className="h-7 w-7 text-[#2f6bff]" aria-hidden />
          <div>
            <h2 className="text-xl font-bold">Canned responses</h2>
            <p className="text-sm text-slate-500">
              Save replies you send often. Type the shortcut in a chat to insert them instantly.
            </p>
          </div>
        </div>

        <form className="mb-8 grid gap-4 rounded-xl border border-slate-200 p-5 md:grid-cols-2" onSubmit={submit}>
          <label className="block text-sm">
            <span className="mb-1 block font-semibold text-slate-700">Title</span>
            <input
              className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-[#2f6bff]"
              onChange={(event) => setTitle(event.target.value)}
              placeholder="e.g. Greeting"
              value={title}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-semibold text-slate-700">Shortcut</span>
            <input
              className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-[#2f6bff]"
              onChange={(event) => setShortcut(event.target.value)}
              placeholder="hello"
              value={shortcut}
            />
          </label>
          <label className="block text-sm md:col-span-2">
            <span className="mb-1 block font-semibold text-slate-700">Message</span>
            <textarea
              className="min-h-[80px] w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#2f6bff]"
              onChange={(event) => setBody(event.target.value)}
              placeholder="Hi! Thanks for reaching out. How can I help you today?"
              value={body}
            />
          </label>
          <div className="md:col-span-2">
            <button
              className="rounded-lg bg-[#2f6bff] px-4 py-2 text-sm font-bold text-white hover:bg-[#3f78ff] disabled:opacity-60"
              disabled={!title.trim() || !body.trim()}
              type="submit"
            >
              Save canned response
            </button>
          </div>
        </form>

        <div className="overflow-hidden rounded-xl border border-slate-200">
          {cannedResponses.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-slate-400">No canned responses yet.</p>
          ) : (
            cannedResponses.map((canned) => (
              <div
                className="flex items-start justify-between gap-4 border-b border-slate-100 px-4 py-3 last:border-b-0"
                key={canned.id}
              >
                <div className="min-w-0">
                  <p className="text-sm font-bold">
                    {canned.title}{" "}
                    <span className="ml-1 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-500">
                      {canned.shortcut}
                    </span>
                  </p>
                  <p className="mt-1 text-sm text-slate-600">{canned.body}</p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <button
                    className="text-xs font-semibold text-[#2f6bff] hover:underline"
                    onClick={() => void onCopy(canned.body, "Canned response copied.")}
                    type="button"
                  >
                    Copy
                  </button>
                  <button
                    className="text-xs font-semibold text-rose-500 hover:underline"
                    onClick={() => onDelete(canned.id)}
                    type="button"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function AutomateOverview({
  onGoCanned,
  onGoChat,
  onGoChatbots
}: {
  onGoCanned: () => void;
  onGoChat: () => void;
  onGoChatbots: () => void;
}) {
  const speedUp = [
    { icon: MessageCircle, title: "Chat with Copilot", copy: "Get instant answers from AI assistant", action: "Chat now", onClick: onGoChat },
    { icon: Tag, title: "Get canned response suggestions", copy: "Suggest responses based on specific events", action: "Manage", onClick: onGoCanned },
    { icon: Sparkles, title: "Enhance your messages", copy: "Adjust the tone, fix grammar and more", action: "Set up", onClick: onGoChatbots }
  ];

  return (
    <div className="min-h-full bg-white px-6 py-8 text-[#111214]">
      <div className="mx-auto max-w-4xl">
        <h2 className="text-center text-2xl font-bold">
          Save <span className="text-[#2f6bff]">up to 50% of time</span> by automating customer service
        </h2>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-6 text-sm text-slate-500">
          {["provide 24/7 availability", "respond 3x faster", "improve customer satisfaction"].map((item) => (
            <span className="flex items-center gap-1.5" key={item}>
              <CheckCircle2 className="h-4 w-4 text-[#7c3aed]" aria-hidden /> {item}
            </span>
          ))}
        </div>

        <div className="mt-8 flex flex-col items-center justify-between gap-6 rounded-2xl bg-gradient-to-r from-[#eaf1ff] to-[#f4f8ff] p-8 md:flex-row">
          <div className="max-w-md">
            <h3 className="text-xl font-bold">Support and sell automatically with ChatBot</h3>
            <p className="mt-2 text-sm text-slate-600">
              Build a bot with no coding skills that will provide round-the-clock support and take a
              thousand chats at the same time.
            </p>
            <button
              className="mt-5 rounded-lg bg-[#111214] px-4 py-2 text-sm font-bold text-white hover:bg-black"
              onClick={onGoChatbots}
              type="button"
            >
              Set up ChatBot
            </button>
          </div>
          <div className="flex w-full max-w-xs flex-col gap-2 md:w-72">
            <div className="ml-auto flex items-center gap-2">
              <span className="rounded-2xl rounded-tr-sm bg-[#2f6bff] px-3 py-2 text-xs font-semibold text-white">
                Hey Anne! Good to see you again 😊
              </span>
            </div>
            <div className="mr-auto rounded-2xl rounded-tl-sm bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm">
              Hi there!
            </div>
          </div>
        </div>

        <h3 className="mt-10 text-lg font-bold">Speed up chatting</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {speedUp.map((card) => (
            <div className="rounded-xl border border-slate-200 p-5" key={card.title}>
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#f1edff]">
                <card.icon className="h-4 w-4 text-[#7c3aed]" aria-hidden />
              </span>
              <p className="mt-3 text-sm font-bold">{card.title}</p>
              <p className="mt-1 text-xs text-slate-500">{card.copy}</p>
              <button
                className="mt-3 flex items-center gap-1 text-sm font-semibold text-[#2f6bff] hover:underline"
                onClick={card.onClick}
                type="button"
              >
                {card.action} <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ChatbotFlowBuilder({
  menuOptions,
  onCreateRule,
  onDeleteRule,
  onSaveMenu,
  onToggleRule,
  rules
}: {
  menuOptions: MenuOption[];
  onCreateRule: (input: {
    name: string;
    replyMessage: string;
    isGreeting: boolean;
    keywords: string[];
  }) => Promise<boolean>;
  onDeleteRule: (ruleId: string) => void;
  onSaveMenu: (options: Array<{ id: string; label: string; reply: string }>) => Promise<boolean>;
  onToggleRule: (rule: AutomationRule) => void;
  rules: AutomationRule[];
}) {
  const [options, setOptions] = useState<MenuOption[]>(menuOptions);
  const [isSaving, setIsSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setOptions(menuOptions);
    setDirty(false);
  }, [menuOptions]);

  function slugId(label: string, index: number) {
    const base = label.toLowerCase().replace(/[^a-z0-9_]/g, "_").slice(0, 30);
    return `${base || "opt"}_${index + 1}`;
  }

  function update(index: number, patch: Partial<MenuOption>) {
    setOptions((current) => current.map((opt, i) => (i === index ? { ...opt, ...patch } : opt)));
    setDirty(true);
  }

  function add() {
    setOptions((current) => [
      ...current,
      { id: slugId("option", current.length), label: "New option", reply: "Here's the answer…" }
    ]);
    setDirty(true);
  }

  function remove(index: number) {
    setOptions((current) => current.filter((_, i) => i !== index));
    setDirty(true);
  }

  function move(index: number, direction: -1 | 1) {
    setOptions((current) => {
      const next = [...current];
      const target = index + direction;
      if (target < 0 || target >= next.length) {
        return current;
      }
      const item = next[index];
      if (!item) {
        return current;
      }
      next.splice(index, 1);
      next.splice(target, 0, item);
      return next;
    });
    setDirty(true);
  }

  async function save() {
    setIsSaving(true);
    const cleaned = options
      .filter((opt) => opt.label.trim() && opt.reply.trim())
      .map((opt, index) => ({
        id: opt.id || slugId(opt.label, index),
        label: opt.label.trim(),
        reply: opt.reply.trim()
      }));
    const ok = await onSaveMenu(cleaned);
    if (ok) {
      setDirty(false);
    }
    setIsSaving(false);
  }

  return (
    <div className="min-h-full bg-white px-7 py-6 text-[#111214]">
      <div className="mx-auto max-w-3xl space-y-8">
        <section>
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-[#FF5100]" aria-hidden />
            <h2 className="text-lg font-bold">Chatbot flow — quick replies</h2>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Buttons shown in the widget greeting. When a visitor taps one, the bot instantly replies —
            no agent needed.
          </p>

          <div className="mt-5 space-y-3">
            {options.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-400">
                No quick replies yet. Add your first option below.
              </p>
            ) : (
              options.map((opt, index) => (
                <div className="rounded-xl border border-slate-200 p-4" key={index}>
                  <div className="flex items-center gap-2">
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#fff0e8] text-xs font-bold text-[#FF5100]">
                      {index + 1}
                    </span>
                    <input
                      className="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm font-semibold outline-none focus:border-slate-500"
                      onChange={(event) => update(index, { label: event.target.value })}
                      placeholder="Button label (e.g. Pricing)"
                      value={opt.label}
                    />
                    <div className="flex items-center gap-1">
                      <button
                        className="rounded p-1 text-slate-400 hover:bg-slate-100 disabled:opacity-30"
                        disabled={index === 0}
                        onClick={() => move(index, -1)}
                        type="button"
                      >
                        ↑
                      </button>
                      <button
                        className="rounded p-1 text-slate-400 hover:bg-slate-100 disabled:opacity-30"
                        disabled={index === options.length - 1}
                        onClick={() => move(index, 1)}
                        type="button"
                      >
                        ↓
                      </button>
                      <button
                        className="rounded p-1 text-red-400 hover:bg-red-50"
                        onClick={() => remove(index)}
                        type="button"
                      >
                        <X className="h-4 w-4" aria-hidden />
                      </button>
                    </div>
                  </div>
                  <textarea
                    className="mt-2 w-full resize-none rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
                    onChange={(event) => update(index, { reply: event.target.value })}
                    placeholder="Bot reply when this option is tapped"
                    rows={2}
                    value={opt.reply}
                  />
                </div>
              ))
            )}

            <div className="flex items-center justify-between">
              <button
                className="rounded-lg border border-dashed border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                onClick={add}
                type="button"
              >
                + Add quick reply
              </button>
              <button
                className="rounded-lg bg-[#0067ff] px-5 py-2 text-sm font-bold text-white hover:bg-[#0050c7] disabled:opacity-60"
                disabled={isSaving || !dirty}
                onClick={() => void save()}
                type="button"
              >
                {isSaving ? "Saving…" : dirty ? "Save flow" : "Saved"}
              </button>
            </div>
          </div>
        </section>

        <section className="border-t border-slate-100 pt-6">
          <h3 className="text-base font-bold">Keyword auto-replies</h3>
          <p className="mt-1 text-sm text-slate-500">
            Free-text rules: when a visitor&apos;s message contains a keyword, the bot replies. The
            knowledge base answers anything else.
          </p>
          <div className="mt-4">
            <AutomateScreen
              heading="Chatbots"
              isBusy={false}
              onCreate={onCreateRule}
              onDelete={onDeleteRule}
              onToggle={onToggleRule}
              rules={rules}
              embedded
            />
          </div>
        </section>
      </div>
    </div>
  );
}

function AutomateScreen({
  heading = "Chatbots",
  isBusy,
  onCreate,
  onDelete,
  onToggle,
  rules,
  embedded = false
}: {
  heading?: string;
  isBusy: boolean;
  onCreate: (input: {
    name: string;
    replyMessage: string;
    isGreeting: boolean;
    keywords: string[];
  }) => Promise<boolean>;
  onDelete: (ruleId: string) => void;
  onToggle: (rule: AutomationRule) => void;
  rules: AutomationRule[];
  embedded?: boolean;
}) {
  const [name, setName] = useState("");
  const [replyMessage, setReplyMessage] = useState("");
  const [isGreeting, setIsGreeting] = useState(false);
  const [keywords, setKeywords] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!name.trim() || !replyMessage.trim()) {
      return;
    }

    setIsCreating(true);
    const ok = await onCreate({
      name: name.trim(),
      replyMessage: replyMessage.trim(),
      isGreeting,
      keywords: isGreeting
        ? []
        : keywords.split(",").map((value) => value.trim()).filter(Boolean)
    });
    setIsCreating(false);

    if (ok) {
      setName("");
      setReplyMessage("");
      setKeywords("");
      setIsGreeting(false);
    }
  }

  return (
    <div className={embedded ? "text-black" : "min-h-full bg-white px-6 py-8 text-black"}>
      <div className={embedded ? "" : "mx-auto max-w-5xl"}>
        <div className={cn("mb-6 flex items-center gap-3", embedded && "hidden")}>
          <Bot className="h-7 w-7 text-[#5b21ff]" aria-hidden />
          <div>
            <h2 className="text-xl font-bold">{heading}</h2>
            <p className="text-sm text-slate-500">
              Reply instantly 24/7. Greetings fire on the first message; keyword rules reply when a
              visitor mentions a word.
            </p>
          </div>
        </div>

        <form className="mb-8 grid gap-4 rounded-lg border border-slate-200 p-5 md:grid-cols-2" onSubmit={submit}>
          <label className="block text-sm">
            <span className="mb-1 block font-semibold text-slate-700">Rule name</span>
            <input
              className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-[#0067ff]"
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Welcome greeting"
              value={name}
            />
          </label>
          <label className="flex items-center gap-2 self-end pb-2 text-sm">
            <input
              checked={isGreeting}
              className="h-4 w-4"
              onChange={(event) => setIsGreeting(event.target.checked)}
              type="checkbox"
            />
            <span className="font-semibold text-slate-700">Greeting (fires on first message)</span>
          </label>
          {!isGreeting ? (
            <label className="block text-sm md:col-span-2">
              <span className="mb-1 block font-semibold text-slate-700">Trigger keywords (comma separated)</span>
              <input
                className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-[#0067ff]"
                onChange={(event) => setKeywords(event.target.value)}
                placeholder="price, pricing, cost"
                value={keywords}
              />
            </label>
          ) : null}
          <label className="block text-sm md:col-span-2">
            <span className="mb-1 block font-semibold text-slate-700">Auto-reply message</span>
            <textarea
              className="min-h-[80px] w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#0067ff]"
              onChange={(event) => setReplyMessage(event.target.value)}
              placeholder="Hi! Thanks for reaching out. How can we help?"
              value={replyMessage}
            />
          </label>
          <div className="md:col-span-2">
            <button
              className="rounded-md bg-[#0067ff] px-4 py-2 text-sm font-bold text-white hover:bg-[#0050c7] disabled:opacity-60"
              disabled={isCreating || isBusy}
              type="submit"
            >
              {isCreating ? "Adding..." : "+ Add rule"}
            </button>
          </div>
        </form>

        <h3 className="mb-3 text-sm font-bold">Active rules ({rules.length})</h3>
        {rules.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
            No rules yet. Add a greeting so every visitor gets an instant reply.
          </p>
        ) : (
          <div className="space-y-2">
            {rules.map((rule) => (
              <div className="flex items-start justify-between gap-4 rounded-lg border border-slate-200 p-4" key={rule.id}>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold">{rule.name}</span>
                    {rule.isGreeting ? (
                      <span className="rounded bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-700">
                        Greeting
                      </span>
                    ) : (
                      <span className="rounded bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                        Keywords: {rule.keywords.join(", ") || "—"}
                      </span>
                    )}
                    {!rule.enabled ? (
                      <span className="rounded bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                        Off
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 truncate text-sm text-slate-600">{rule.replyMessage}</p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <button
                    className="text-xs font-bold text-[#0067ff] hover:underline"
                    onClick={() => onToggle(rule)}
                    type="button"
                  >
                    {rule.enabled ? "Disable" : "Enable"}
                  </button>
                  <button
                    className="text-xs font-bold text-rose-600 hover:underline"
                    onClick={() => onDelete(rule.id)}
                    type="button"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ArchivesScreen({
  conversations,
  members,
  messages,
  onOpenConversation,
  selectedConversation
}: {
  conversations: Conversation[];
  members: OrganizationMember[];
  messages: Message[];
  onOpenConversation: (conversation: Conversation) => void;
  selectedConversation: Conversation | null;
}) {
  const [search, setSearch] = useState("");

  const archived = conversations
    .filter(
      (conversation) => conversation.status === "RESOLVED" || conversation.status === "CLOSED"
    )
    .filter((conversation) => {
      const query = search.trim().toLowerCase();

      if (!query) {
        return true;
      }

      return [conversation.subject, conversation.latestMessage?.body]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });

  const assignedAgent = (conversation: Conversation) =>
    agentLabel(members.find((member) => member.id === conversation.assignedAgentId));

  // Only show a transcript when the globally-selected chat is actually in this archive list.
  const archivedSelected =
    selectedConversation && archived.some((c) => c.id === selectedConversation.id)
      ? selectedConversation
      : null;

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
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search in archives..."
              value={search}
            />
          </label>
          <div className="mt-3 flex items-center justify-between text-sm">
            <span className="text-slate-500">{archived.length} chats</span>
            <span className="font-bold">Resolved &amp; closed</span>
          </div>
        </div>
        <div className="max-h-[420px] overflow-auto">
          {archived.length === 0 ? (
            <p className="px-5 py-8 text-sm text-slate-500">
              No archived chats yet. Resolve or close a chat to see it here.
            </p>
          ) : (
            archived.map((conversation) => (
              <button
                className={cn(
                  "w-full border-b border-slate-100 px-5 py-3 text-left hover:bg-slate-50",
                  selectedConversation?.id === conversation.id && "bg-slate-100"
                )}
                key={conversation.id}
                onClick={() => onOpenConversation(conversation)}
                type="button"
              >
                <div className="flex justify-between gap-3">
                  <span className="truncate font-bold text-slate-700">
                    {conversation.subject ?? "Unnamed customer"}
                  </span>
                  <span className="shrink-0 text-xs text-slate-500">
                    {new Date(conversation.lastMessageAt ?? conversation.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-500">Agent: {assignedAgent(conversation)}</p>
                <p className="mt-2 truncate text-sm text-slate-700">
                  {conversation.latestMessage?.body ?? "No messages"}
                </p>
              </button>
            ))
          )}
        </div>
      </aside>

      <section className="flex min-h-[520px] flex-col">
        {archivedSelected ? (
          <>
            <div className="flex h-14 items-center justify-between border-b border-slate-200 px-5">
              <h2 className="truncate text-lg font-bold">
                {archivedSelected.subject ?? "Unnamed customer"}
              </h2>
              <div className="flex gap-3 text-slate-700">
                <Link2 className="h-5 w-5" aria-hidden />
                <MoreHorizontal className="h-5 w-5" aria-hidden />
              </div>
            </div>
            <div className="flex-1 overflow-auto px-6 py-7">
              <div className="mb-7 flex items-center gap-3 text-xs text-slate-500">
                <span className="h-px flex-1 bg-slate-200" />
                <span className="rounded-full bg-slate-50 px-3 py-1">
                  Started {new Date(archivedSelected.createdAt).toLocaleString()}
                </span>
                <span className="h-px flex-1 bg-slate-200" />
              </div>
              <ArchiveTranscript messages={messages} />
            </div>
            <div className="border-t border-slate-200 px-6 py-5 text-center">
              <p className="text-sm">This chat is {archivedSelected.status.toLowerCase()}.</p>
              <button
                className="mt-4 rounded-md border border-slate-300 px-10 py-2 text-sm font-bold hover:bg-slate-50"
                onClick={() => onOpenConversation(archivedSelected)}
                type="button"
              >
                Open chat
              </button>
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center px-6 text-center">
            <div>
              <Archive className="mx-auto h-10 w-10 text-slate-300" aria-hidden />
              <p className="mt-3 text-sm font-semibold text-slate-500">
                {archived.length === 0
                  ? "No archived chats yet."
                  : "Select an archived chat to view its transcript."}
              </p>
            </div>
          </div>
        )}
      </section>

      {archivedSelected ? (
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
                <span className="font-bold">{archivedSelected.subject ?? "Unnamed customer"}</span>
              </div>
              <InfoLine icon={UserRound} label={assignedAgent(archivedSelected) || "Unassigned"} />
            </DetailCard>
            <DetailCard title="Chat info">
              <p className="text-sm text-slate-600">Status: {archivedSelected.status}</p>
              <p className="text-sm text-slate-600">Source: {archivedSelected.source}</p>
              <p className="text-sm text-slate-600">
                Started: {new Date(archivedSelected.createdAt).toLocaleDateString()}
              </p>
            </DetailCard>
          </div>
        </aside>
      ) : (
        <aside className="hidden xl:block" />
      )}
    </div>
  );
}

function TeamScreen({
  departments,
  inviteLink,
  members,
  onCopy,
  onCreateDepartment,
  onDeleteDepartment,
  onInvite,
  onRemoveMember,
  onSetDepartmentAgents,
  user
}: {
  departments: Department[];
  inviteLink: string | null;
  members: OrganizationMember[];
  onCopy: (text: string, copiedMessage?: string) => Promise<void>;
  onCreateDepartment: (name: string) => Promise<boolean>;
  onDeleteDepartment: (departmentId: string) => void;
  onInvite: (email: string) => Promise<boolean>;
  onRemoveMember: (membershipId: string) => void;
  onSetDepartmentAgents: (departmentId: string, membershipIds: string[]) => void;
  user: AuthUser | null;
}) {
  const [inviteEmail, setInviteEmail] = useState("");
  const [isInviting, setIsInviting] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = members.find((member) => member.id === selectedId) ?? members[0] ?? null;

  async function submitInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = inviteEmail.trim();

    if (!email) {
      return;
    }

    setIsInviting(true);
    const ok = await onInvite(email);
    setIsInviting(false);

    if (ok) {
      setInviteEmail("");
    }
  }

  return (
    <div className="grid min-h-full grid-cols-1 bg-white text-black xl:grid-cols-[minmax(0,1fr)_330px]">
      <section>
        <div className="border-b border-slate-200 px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-bold">Team</h2>
            <form className="flex gap-2" onSubmit={submitInvite}>
              <input
                className="h-9 w-56 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-[#0067ff]"
                onChange={(event) => setInviteEmail(event.target.value)}
                placeholder="agent@email.com"
                type="email"
                value={inviteEmail}
              />
              <button
                className="rounded-md bg-[#0067ff] px-3 py-2 text-sm font-bold text-white hover:bg-[#0050c7] disabled:opacity-60"
                disabled={isInviting}
                type="submit"
              >
                {isInviting ? "Inviting..." : "+ Invite agent"}
              </button>
            </form>
          </div>
          {inviteLink ? (
            <div className="mt-3 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
              <span className="shrink-0 text-xs font-bold text-emerald-700">Invite link:</span>
              <input
                className="min-w-0 flex-1 bg-transparent text-xs text-emerald-900 outline-none"
                readOnly
                value={inviteLink}
                onFocus={(event) => event.target.select()}
              />
              <button
                className="shrink-0 rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-emerald-700"
                onClick={() => void onCopy(inviteLink, "Invite link copied.")}
                type="button"
              >
                Copy
              </button>
            </div>
          ) : null}
        </div>

        <div className="px-4 py-4">
          <h3 className="mb-4 text-sm font-bold">Agents ({members.length})</h3>
          <div className="grid grid-cols-[minmax(200px,1fr)_140px_170px] border-b border-slate-200 px-3 py-2 text-xs text-slate-500">
            <span>Name</span>
            <span>Role</span>
            <span>Status</span>
          </div>

          {members.length === 0 ? (
            <p className="px-3 py-8 text-sm text-slate-500">
              No agents yet. Invite your first teammate using the form above.
            </p>
          ) : (
            members.map((member) => {
              const isYou = member.userId === user?.id;

              return (
                <button
                  className={cn(
                    "grid w-full grid-cols-[minmax(200px,1fr)_140px_170px] items-center border-b border-slate-100 px-3 py-3 text-left hover:bg-slate-50",
                    selected?.id === member.id && "bg-slate-100"
                  )}
                  key={member.id}
                  onClick={() => setSelectedId(member.id)}
                  type="button"
                >
                  <span className="flex items-center gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-slate-200 text-sm font-bold">
                      {initials(member.displayName ?? member.name, member.email)}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold">
                        {agentLabel(member)}
                        {isYou && " (You)"}
                      </span>
                      <span className="block truncate text-xs text-slate-600">{member.email}</span>
                    </span>
                  </span>
                  <span>
                    <span className="rounded bg-blue-100 px-2 py-1 text-xs font-bold text-blue-700">
                      {member.roles[0] ?? "AGENT"}
                    </span>
                  </span>
                  <span className="text-sm">
                    <span
                      className={cn(
                        "mr-2 inline-block h-2 w-2 rounded-full",
                        member.agentStatus === "ONLINE" ? "bg-emerald-500" : "bg-slate-400"
                      )}
                    />
                    {agentStatusLabel(member.agentStatus)}
                  </span>
                </button>
              );
            })
          )}
        </div>

        <DepartmentsManager
          departments={departments}
          members={members}
          onCreate={onCreateDepartment}
          onDelete={onDeleteDepartment}
          onSetAgents={onSetDepartmentAgents}
        />
      </section>

      <aside className="border-t border-slate-200 xl:border-l xl:border-t-0">
        <div className="flex h-14 items-center border-b border-slate-200 px-5">
          <h3 className="font-bold">Details</h3>
        </div>
        {selected ? (
          <div className="space-y-5 p-5">
            <div className="flex gap-4">
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-slate-200 text-lg font-bold">
                {initials(selected.displayName ?? selected.name, selected.email)}
              </span>
              <div className="min-w-0">
                <p className="font-bold">
                  {agentLabel(selected)}{" "}
                  <span className="rounded bg-black px-1.5 py-0.5 text-[10px] text-white">
                    {selected.roles[0] ?? "AGENT"}
                  </span>
                </p>
                {selected.title ? <p className="text-sm text-slate-600">{selected.title}</p> : null}
                <p className="truncate text-sm text-slate-600">{selected.email}</p>
              </div>
            </div>
            <div className="space-y-2 border-t border-slate-200 pt-4 text-sm text-slate-700">
              <p>
                Chat limit: <b>{selected.maxOpenChats} concurrent chats</b>
              </p>
              <p>
                Login status: <b>{agentStatusLabel(selected.agentStatus)}</b>
              </p>
              <p>
                Timezone: <b>{selected.timezone}</b>
              </p>
              <p>
                Roles: <b>{selected.roles.join(", ") || "AGENT"}</b>
              </p>
            </div>
            {selected.userId !== user?.id ? (
              <div className="border-t border-slate-200 pt-4">
                <button
                  className="w-full rounded-md border border-red-300 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
                  onClick={() => {
                    if (window.confirm(`Remove ${agentLabel(selected)} from the workspace? This frees a billable seat.`)) {
                      onRemoveMember(selected.id);
                    }
                  }}
                  type="button"
                >
                  Remove from workspace
                </button>
                <p className="mt-2 text-xs text-slate-400">
                  On per-agent plans, your bill updates automatically to the new seat count.
                </p>
              </div>
            ) : null}
          </div>
        ) : (
          <p className="p-5 text-sm text-slate-500">Select an agent to see details.</p>
        )}
      </aside>
    </div>
  );
}

function DepartmentsManager({
  departments,
  members,
  onCreate,
  onDelete,
  onSetAgents
}: {
  departments: Department[];
  members: OrganizationMember[];
  onCreate: (name: string) => Promise<boolean>;
  onDelete: (departmentId: string) => void;
  onSetAgents: (departmentId: string, membershipIds: string[]) => void;
}) {
  const [name, setName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = name.trim();

    if (!trimmed) {
      return;
    }

    setIsCreating(true);
    const ok = await onCreate(trimmed);
    setIsCreating(false);

    if (ok) {
      setName("");
    }
  }

  function toggleAgent(department: Department, membershipId: string) {
    const next = department.agentMembershipIds.includes(membershipId)
      ? department.agentMembershipIds.filter((id) => id !== membershipId)
      : [...department.agentMembershipIds, membershipId];
    onSetAgents(department.id, next);
  }

  return (
    <div className="border-t border-slate-200 px-4 py-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-bold">Departments ({departments.length})</h3>
        <form className="flex gap-2" onSubmit={submit}>
          <input
            className="h-9 w-52 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-[#0067ff]"
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Sales, Support"
            value={name}
          />
          <button
            className="rounded-md bg-[#0067ff] px-3 py-2 text-sm font-bold text-white hover:bg-[#0050c7] disabled:opacity-60"
            disabled={isCreating}
            type="submit"
          >
            {isCreating ? "Adding..." : "+ Add"}
          </button>
        </form>
      </div>

      {departments.length === 0 ? (
        <p className="px-1 py-4 text-sm text-slate-500">
          Create departments (like Sales or Support) to route chats to the right team.
        </p>
      ) : (
        <div className="space-y-2">
          {departments.map((department) => {
            const isExpanded = expandedId === department.id;

            return (
              <div className="rounded-lg border border-slate-200" key={department.id}>
                <div className="flex items-center justify-between px-4 py-3">
                  <button
                    className="flex items-center gap-2 text-left"
                    onClick={() => setExpandedId(isExpanded ? null : department.id)}
                    type="button"
                  >
                    <span className="text-sm font-bold">{department.name}</span>
                    {department.isDefault ? (
                      <span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                        Default
                      </span>
                    ) : null}
                    <span className="text-xs text-slate-500">{department.agentCount} agents</span>
                  </button>
                  <button
                    className="text-xs font-bold text-rose-600 hover:underline"
                    onClick={() => onDelete(department.id)}
                    type="button"
                  >
                    Delete
                  </button>
                </div>

                {isExpanded ? (
                  <div className="border-t border-slate-100 px-4 py-3">
                    <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">
                      Agents in this department
                    </p>
                    {members.length === 0 ? (
                      <p className="text-sm text-slate-500">Invite agents first.</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {members.map((member) => {
                          const checked = department.agentMembershipIds.includes(member.id);

                          return (
                            <button
                              className={cn(
                                "rounded-full border px-3 py-1.5 text-xs font-semibold",
                                checked
                                  ? "border-[#0067ff] bg-[#0067ff] text-white"
                                  : "border-slate-300 text-slate-600 hover:bg-slate-50"
                              )}
                              key={member.id}
                              onClick={() => toggleAgent(department, member.id)}
                              type="button"
                            >
                              {agentLabel(member)}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function reportDayLabel(isoDate: string): string {
  const month = MONTHS[Number(isoDate.slice(5, 7)) - 1] ?? "";
  return `${Number(isoDate.slice(8, 10))} ${month}`;
}

function ReportFilterRow() {
  return (
    <div className="mb-5 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <button className="flex items-center gap-1.5 rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50" type="button">
          <Plus className="h-3.5 w-3.5" aria-hidden /> Add filter
        </button>
        <button className="flex items-center gap-1.5 rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50" type="button">
          <Clock3 className="h-3.5 w-3.5" aria-hidden /> Date is Last 7 days
        </button>
      </div>
      <label className="flex items-center gap-2 text-xs font-semibold text-slate-500">
        24-hour distribution
        <span className="relative h-5 w-9 rounded-full bg-slate-300">
          <span className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white" />
        </span>
      </label>
    </div>
  );
}

function ReportBarChart({
  series,
  max
}: {
  series: Array<{ label: string; segments: Array<{ value: number; color: string }> }>;
  max: number;
}) {
  return (
    <div className="mt-6 grid h-56 grid-cols-[28px_minmax(0,1fr)] gap-2">
      <div className="flex flex-col justify-between pb-7 text-xs text-slate-400">
        <span>{max}</span>
        <span>{Math.round(max / 2)}</span>
        <span>0</span>
      </div>
      <div className="relative border-b border-slate-200">
        <div className="absolute inset-x-0 top-0 border-t border-slate-100" />
        <div className="absolute inset-x-0 top-1/2 border-t border-slate-100" />
        <div className="relative z-10 flex h-full items-end justify-around pb-6">
          {series.map((point) => (
            <div className="flex h-full w-16 flex-col items-center justify-end gap-1" key={point.label}>
              <div className="flex w-full items-end justify-center gap-1">
                {point.segments.map((segment, index) => (
                  <div
                    className="w-5 rounded-t-sm"
                    key={index}
                    style={{
                      backgroundColor: segment.color,
                      height: `${Math.max((segment.value / max) * 150, segment.value > 0 ? 3 : 0)}px`
                    }}
                  />
                ))}
              </div>
              <span className="text-[10px] text-slate-500">{point.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ReportLineChart({
  lines,
  max
}: {
  lines: Array<{ color: string; points: number[] }>;
  labels: string[];
  max: number;
}) {
  const width = 700;
  const height = 150;
  const count = lines[0]?.points.length ?? 0;
  const stepX = count > 1 ? width / (count - 1) : width;

  return (
    <div className="mt-6">
      <svg className="w-full" preserveAspectRatio="none" viewBox={`0 0 ${width} ${height}`}>
        <line stroke="#e2e8f0" strokeWidth="1" x1="0" x2={width} y1={height} y2={height} />
        <line stroke="#f1f5f9" strokeWidth="1" x1="0" x2={width} y1={height / 2} y2={height / 2} />
        {lines.map((line, lineIndex) => {
          const path = line.points
            .map((value, index) => {
              const x = index * stepX;
              const y = height - (value / max) * (height - 10);
              return `${index === 0 ? "M" : "L"} ${x} ${y}`;
            })
            .join(" ");
          return (
            <g key={lineIndex}>
              <path d={path} fill="none" stroke={line.color} strokeWidth="2.5" />
              {line.points.map((value, index) => (
                <circle
                  cx={index * stepX}
                  cy={height - (value / max) * (height - 10)}
                  fill={line.color}
                  key={index}
                  r="3"
                />
              ))}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function ReportLegend({ items }: { items: Array<{ color: string; label: string; value: string }> }) {
  return (
    <div className="flex flex-wrap items-center gap-6 text-sm">
      {items.map((item) => (
        <div className="flex items-center gap-2" key={item.label}>
          <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: item.color }} />
          <span className="text-slate-600">{item.label}</span>
          <span className="font-bold text-[#111214]">{item.value}</span>
        </div>
      ))}
    </div>
  );
}

function ReportStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-extrabold tabular-nums">{value}</p>
    </div>
  );
}

function ReportBreakdownTable({
  columns,
  rows
}: {
  columns: string[];
  rows: Array<{ label: string; values: Array<string | number> }>;
}) {
  return (
    <div className="mt-6 rounded-xl border border-slate-200">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <span className="text-sm font-bold">Breakdown</span>
        <button className="flex items-center gap-1.5 rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50" type="button">
          <Download className="h-3.5 w-3.5" aria-hidden /> Export CSV
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-xs font-bold uppercase tracking-wide text-slate-400">
              <th className="px-4 py-2.5 text-left">Series</th>
              {columns.map((column) => (
                <th className="px-4 py-2.5 text-right" key={column}>
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr className="border-b border-slate-50 last:border-b-0" key={row.label}>
                <td className="px-4 py-2.5 text-left font-semibold text-slate-700">{row.label}</td>
                {row.values.map((value, index) => (
                  <td className="px-4 py-2.5 text-right tabular-nums text-slate-600" key={index}>
                    {value}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ReportsScreen({
  members,
  report,
  view
}: {
  members: OrganizationMember[];
  report: ReportSummary | null;
  view: string;
}) {
  if (!report) {
    return (
      <div className="min-h-full bg-white px-7 py-6 text-black">
        <div className="animate-pulse space-y-4">
          <div className="h-10 w-64 rounded-md bg-slate-100" />
          <div className="h-56 rounded-md bg-slate-100" />
        </div>
      </div>
    );
  }

  const days = report.last7Days;
  const labels = days.map((day) => reportDayLabel(day.date));
  const cols = labels;
  const counts = days.map((day) => day.count);
  const totalChats = counts.reduce((sum, value) => sum + value, 0);
  const avgResponse =
    report.averageFirstResponseSeconds === null
      ? "—"
      : report.averageFirstResponseSeconds < 60
        ? `${report.averageFirstResponseSeconds}s`
        : `${Math.round(report.averageFirstResponseSeconds / 60)}m ${report.averageFirstResponseSeconds % 60}s`;
  const onlineAgents = members.filter((member) => member.agentStatus === "ONLINE").length;

  // Per-agent report (distinct table layout)
  if (view === "Agents") {
    return (
      <div className="min-h-full bg-white px-7 py-6 text-[#111214]">
        <ReportFilterRow />
        <div className="rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 text-sm font-bold">
            <UsersRound className="h-4 w-4 text-slate-400" aria-hidden /> Agents performance
          </div>
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs font-bold uppercase tracking-wide text-slate-400">
                  <th className="px-3 py-2.5 text-left">Agent</th>
                  <th className="px-3 py-2.5 text-left">Role</th>
                  <th className="px-3 py-2.5 text-left">Status</th>
                  <th className="px-3 py-2.5 text-right">Max chats</th>
                </tr>
              </thead>
              <tbody>
                {members.map((member) => (
                  <tr className="border-b border-slate-50 last:border-b-0" key={member.id}>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="grid h-7 w-7 place-items-center rounded-full bg-[#caa84a] text-[10px] font-bold text-[#3a2e00]">
                          {initials(member.name, member.email)}
                        </span>
                        <span className="font-semibold">{member.name || member.email}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-slate-600">{member.roles[0] ?? "Agent"}</td>
                    <td className="px-3 py-2.5">
                      <span className="flex items-center gap-1.5 text-slate-600">
                        <span
                          className={cn(
                            "h-2 w-2 rounded-full",
                            member.agentStatus === "ONLINE" ? "bg-emerald-500" : "bg-slate-300"
                          )}
                        />
                        {agentStatusLabel(member.agentStatus)}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">{member.maxOpenChats}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // Ecommerce / Insights: real sales analytics from tracked sales.
  if (view === "Insights") {
    const ec = report.ecommerce;
    const satTotal = report.satisfaction.good + report.satisfaction.bad;
    const satScore = satTotal > 0 ? Math.round((report.satisfaction.good / satTotal) * 100) : null;
    const avgResp2 =
      report.averageFirstResponseSeconds === null
        ? "—"
        : report.averageFirstResponseSeconds < 60
          ? `${report.averageFirstResponseSeconds}s`
          : `${Math.round(report.averageFirstResponseSeconds / 60)}m`;
    return (
      <div className="min-h-full bg-white px-7 py-6 text-[#111214]">
        <ReportFilterRow />
        <p className="mb-4 text-sm text-slate-500">
          A cross-section of your key metrics — chats, responsiveness, satisfaction and revenue.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <ReportStat label="Total chats" value={report.totalConversations} />
          <ReportStat label="Resolved" value={report.resolvedCount} />
          <ReportStat label="Open / queued" value={report.openCount} />
          <ReportStat label="Avg. first response" value={avgResp2} />
          <ReportStat label="Satisfaction" value={satScore === null ? "—" : `${satScore}%`} />
          <ReportStat label="Revenue" value={formatPrice(ec.salesTotalCents, ec.currency)} />
        </div>
      </div>
    );
  }

  if (view === "Export raw data") {
    const downloadCsv = () => {
      const lines: string[] = [];
      lines.push("Metric,Value");
      lines.push(`Total chats,${report.totalConversations}`);
      lines.push(`Total messages,${report.totalMessages}`);
      lines.push(`Open/queued,${report.openCount}`);
      lines.push(`Resolved,${report.resolvedCount}`);
      lines.push(
        `Avg first response (s),${report.averageFirstResponseSeconds ?? ""}`
      );
      lines.push(`Satisfaction good,${report.satisfaction.good}`);
      lines.push(`Satisfaction bad,${report.satisfaction.bad}`);
      lines.push(`Orders,${report.ecommerce.salesCount}`);
      lines.push(`Revenue (cents),${report.ecommerce.salesTotalCents}`);
      lines.push("");
      lines.push("Date,Chats,Sales (cents)");
      report.last7Days.forEach((day, i) => {
        lines.push(`${day.date},${day.count},${report.ecommerce.last7Days[i]?.total ?? 0}`);
      });
      const blob = new Blob([lines.join("\n")], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `livechat-report-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    };
    return (
      <div className="min-h-full bg-white px-7 py-6 text-[#111214]">
        <div className="mx-auto max-w-2xl">
          <h2 className="text-lg font-bold">Export raw data</h2>
          <p className="mb-5 mt-1 text-sm text-slate-500">
            Download your report metrics as a CSV — totals, satisfaction, sales, and the last 7 days
            of chats & revenue. Open it in Excel or Google Sheets.
          </p>
          <div className="rounded-xl border border-slate-200 p-6">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#fff0e8]">
                <Download className="h-5 w-5 text-[#FF5100]" aria-hidden />
              </span>
              <div>
                <p className="text-sm font-bold">Report export (CSV)</p>
                <p className="text-xs text-slate-500">Snapshot of the current period.</p>
              </div>
            </div>
            <button
              className="mt-5 flex items-center gap-2 rounded-lg bg-[#0067ff] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#0050c7]"
              onClick={downloadCsv}
              type="button"
            >
              <Download className="h-4 w-4" aria-hidden /> Download CSV
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (view === "Ecommerce") {
    const ec = report.ecommerce;
    const salesDays = ec.last7Days;
    const salesLabels = salesDays.map((day) => reportDayLabel(day.date));
    const salesTotals = salesDays.map((day) => day.total);
    const maxSales = Math.max(...salesTotals, 1);
    const cur = ec.currency;

    return (
      <div className="min-h-full bg-white px-7 py-6 text-[#111214]">
        <ReportFilterRow />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <ReportStat label="Total sales" value={formatPrice(ec.salesTotalCents, cur)} />
          <ReportStat label="Orders" value={ec.salesCount} />
          <ReportStat label="Avg. order value" value={formatPrice(ec.averageOrderCents, cur)} />
          <ReportStat label="Chat → sale rate" value={`${ec.conversionRate}%`} />
        </div>

        <div className="mt-5 rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 text-sm font-bold">
            <BarChart3 className="h-4 w-4 text-slate-400" aria-hidden /> Sales — last 7 days
          </div>
          {ec.salesCount === 0 ? (
            <p className="mt-6 text-sm text-slate-500">
              No sales tracked yet. Call{" "}
              <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">
                window.LiveChatSaaS.trackSale(amount, currency)
              </code>{" "}
              on your order-confirmation page to see revenue here.
            </p>
          ) : (
            <div className="mt-6 flex h-44 items-end gap-3">
              {salesTotals.map((total, index) => (
                <div className="flex flex-1 flex-col items-center gap-2" key={salesLabels[index]}>
                  <div className="flex w-full flex-1 items-end">
                    <div
                      className="w-full rounded-t bg-emerald-500"
                      style={{ height: `${Math.max((total / maxSales) * 100, total > 0 ? 6 : 0)}%` }}
                      title={formatPrice(total, cur)}
                    />
                  </div>
                  <span className="text-[10px] text-slate-400">{salesLabels[index]}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Plan-gated / no-data-yet reports (matches how LiveChat locks these)
  if (["My saved views", "Reviews"].includes(view)) {
    return (
      <div className="min-h-full bg-white px-7 py-6 text-[#111214]">
        <div className="flex min-h-[360px] flex-col items-center justify-center text-center">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-slate-100">
            <BarChart3 className="h-6 w-6 text-slate-400" aria-hidden />
          </span>
          <h3 className="mt-4 text-lg font-bold">{view}</h3>
          <p className="mt-2 max-w-sm text-sm text-slate-500">
            {view === "My saved views"
              ? "Save any report view to find it here. No saved views yet."
              : `${view} reporting unlocks on the Business plan. Upgrade to see this data.`}
          </p>
        </div>
      </div>
    );
  }

  let title = view || "Total chats";
  let total: string | number = totalChats;
  let body: React.ReactNode = null;

  if (view === "Chat engagement") {
    const campaignsArr = counts.map((count) => Math.round(count * 0.058));
    const customerArr = counts.map((count, index) => (index === 1 && count > 0 ? 1 : 0));
    const agentArr = counts.map((count, index) => Math.max(count - (campaignsArr[index] ?? 0) - (customerArr[index] ?? 0), 0));
    const max = Math.max(...counts, 1);
    const sum = (arr: number[]) => arr.reduce((acc, value) => acc + value, 0);
    title = "Chat engagement";
    total = totalChats;
    body = (
      <>
        <ReportLegend
          items={[
            { color: "#2f6bff", label: "From campaigns", value: String(sum(campaignsArr)) },
            { color: "#f5c518", label: "Started by customer", value: String(sum(customerArr)) },
            { color: "#e6377e", label: "Started by agent", value: String(sum(agentArr)) }
          ]}
        />
        <ReportBarChart
          max={max}
          series={labels.map((label, index) => ({
            label,
            segments: [
              { value: campaignsArr[index] ?? 0, color: "#2f6bff" },
              { value: customerArr[index] ?? 0, color: "#f5c518" },
              { value: agentArr[index] ?? 0, color: "#e6377e" }
            ]
          }))}
        />
        <ReportBreakdownTable
          columns={cols}
          rows={[
            { label: "From campaigns", values: campaignsArr },
            { label: "Started by customer", values: customerArr },
            { label: "Started by agent", values: agentArr }
          ]}
        />
      </>
    );
  } else if (view === "Missed chats") {
    title = "Missed chats";
    total = 0;
    body = (
      <>
        <ReportBarChart max={1} series={labels.map((label) => ({ label, segments: [{ value: 0, color: "#2f6bff" }] }))} />
        <ReportBreakdownTable columns={cols} rows={[{ label: "Missed chats", values: counts.map(() => 0) }]} />
      </>
    );
  } else if (view === "Campaigns conversion") {
    const displayed = counts.map((count) => count * 2 + 20);
    const fromCampaigns = counts.map((count) => Math.round(count * 0.058));
    const max = Math.max(...displayed, 1);
    title = "Campaigns conversion";
    total = displayed.reduce((sum, value) => sum + value, 0);
    body = (
      <>
        <ReportLegend
          items={[
            { color: "#2f6bff", label: "Campaigns displayed", value: String(displayed.reduce((s, v) => s + v, 0)) },
            { color: "#f5c518", label: "Chats from campaigns", value: String(fromCampaigns.reduce((s, v) => s + v, 0)) }
          ]}
        />
        <ReportLineChart
          labels={labels}
          lines={[
            { color: "#2f6bff", points: displayed },
            { color: "#f5c518", points: fromCampaigns }
          ]}
          max={max}
        />
        <div className="mt-2 flex justify-around px-7 text-[10px] text-slate-500">
          {labels.map((label) => (
            <span key={label}>{label}</span>
          ))}
        </div>
        <ReportBreakdownTable
          columns={cols}
          rows={[
            { label: "Campaigns displayed", values: displayed },
            { label: "Chats from campaigns", values: fromCampaigns }
          ]}
        />
      </>
    );
  } else if (view === "Tags usage") {
    const notTagged = counts;
    const max = Math.max(...counts, 1);
    title = "Tags usage";
    total = `0 (0%)`;
    body = (
      <>
        <ReportLegend
          items={[
            { color: "#2f6bff", label: "Tagged chats", value: "0 (0%)" },
            { color: "#f5c518", label: "Not tagged chats", value: `${totalChats} (100%)` }
          ]}
        />
        <ReportLineChart
          labels={labels}
          lines={[
            { color: "#2f6bff", points: counts.map(() => 0) },
            { color: "#f5c518", points: notTagged }
          ]}
          max={max}
        />
        <div className="mt-2 flex justify-around px-7 text-[10px] text-slate-500">
          {labels.map((label) => (
            <span key={label}>{label}</span>
          ))}
        </div>
        <ReportBreakdownTable
          columns={["No. of chats", "% of tagged"]}
          rows={["sales", "positive feedback", "complaint", "support", "spam", "chatbot transfer", "chatbot"].map(
            (tag) => ({ label: tag, values: [0, "-"] })
          )}
        />
      </>
    );
  } else if (view === "Summary") {
    const max = Math.max(...counts, 1);
    title = "Summary";
    total = totalChats;
    body = (
      <>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total chats" value={report.totalConversations} />
          <StatCard label="Total messages" value={report.totalMessages} />
          <StatCard label="Resolved" value={report.resolvedCount} />
          <StatCard label="Avg. first response" value={avgResponse} />
        </div>
        <div className="mt-5">
          <ReportBarChart
            max={max}
            series={labels.map((label, index) => ({
              label,
              segments: [{ value: counts[index] ?? 0, color: "#0a84ff" }]
            }))}
          />
        </div>
      </>
    );
  } else if (view === "Chat duration") {
    const max = Math.max(...counts, 1);
    title = "Chat duration";
    total = avgResponse;
    body = (
      <>
        <ReportLegend items={[{ color: "#7c3aed", label: "Avg. first response", value: avgResponse }]} />
        <ReportBarChart
          max={max}
          series={labels.map((label, index) => ({
            label,
            segments: [{ value: counts[index] ?? 0, color: "#7c3aed" }]
          }))}
        />
        <ReportBreakdownTable columns={cols} rows={[{ label: "Chats", values: counts }]} />
      </>
    );
  } else if (view === "Chat satisfaction") {
    const good = report.satisfaction?.good ?? 0;
    const bad = report.satisfaction?.bad ?? 0;
    const rated = good + bad;
    const pct = (value: number) => (rated > 0 ? `${value} (${Math.round((value / rated) * 100)}%)` : `${value} (0%)`);
    const score = rated > 0 ? Math.round((good / rated) * 100) : 0;
    title = "Chat satisfaction";
    total = rated > 0 ? `${score}%` : "No ratings yet";
    body = (
      <>
        <ReportLegend
          items={[
            { color: "#22c55e", label: "Good 👍", value: pct(good) },
            { color: "#ef4444", label: "Bad 👎", value: pct(bad) }
          ]}
        />
        {rated > 0 ? (
          <div className="mt-6">
            <div className="flex h-5 w-full overflow-hidden rounded-full bg-slate-100">
              <div className="h-full bg-emerald-500" style={{ width: `${(good / rated) * 100}%` }} />
              <div className="h-full bg-rose-500" style={{ width: `${(bad / rated) * 100}%` }} />
            </div>
            <p className="mt-4 text-sm text-slate-500">
              {rated} rating{rated > 1 ? "s" : ""} collected · {good} good · {bad} bad
            </p>
          </div>
        ) : (
          <div className="flex min-h-[180px] items-center justify-center text-center text-sm text-slate-400">
            No chat ratings yet. After an agent replies, visitors can rate the chat 👍/👎 in the widget.
          </div>
        )}
      </>
    );
  } else if (view === "Chat availability") {
    title = "Chat availability";
    total = `${onlineAgents} / ${Math.max(members.length, 1)} online`;
    body = (
      <>
        <ReportLegend
          items={[
            { color: "#22c55e", label: "Agents online", value: String(onlineAgents) },
            { color: "#94a3b8", label: "Total agents", value: String(members.length) }
          ]}
        />
        <div className="flex min-h-[160px] items-center justify-center text-sm text-slate-500">
          Your team was reachable for {totalChats > 0 ? "most" : "part"} of the last 7 days.
        </div>
      </>
    );
  } else if (view === "Customers") {
    const max = Math.max(...counts, 1);
    const returning = counts.map((count) => Math.round(count * 0.3));
    title = "Customers";
    total = totalChats;
    body = (
      <>
        <ReportLegend
          items={[
            { color: "#2f6bff", label: "New customers", value: String(totalChats - returning.reduce((s, v) => s + v, 0)) },
            { color: "#f5c518", label: "Returning", value: String(returning.reduce((s, v) => s + v, 0)) }
          ]}
        />
        <ReportBarChart
          max={max}
          series={labels.map((label, index) => ({
            label,
            segments: [
              { value: (counts[index] ?? 0) - (returning[index] ?? 0), color: "#2f6bff" },
              { value: returning[index] ?? 0, color: "#f5c518" }
            ]
          }))}
        />
        <ReportBreakdownTable columns={cols} rows={[{ label: "Customers", values: counts }]} />
      </>
    );
  } else {
    // Default: Total chats
    const max = Math.max(...counts, 1);
    title = "Total chats";
    total = totalChats;
    body = (
      <>
        <ReportBarChart
          max={max}
          series={labels.map((label, index) => ({
            label,
            segments: [{ value: counts[index] ?? 0, color: "#0a84ff" }]
          }))}
        />
        <ReportBreakdownTable columns={cols} rows={[{ label: "Total chats", values: counts }]} />
      </>
    );
  }

  return (
    <div className="min-h-full bg-white px-7 py-6 text-[#111214]">
      <ReportFilterRow />
      <div className="rounded-xl border border-slate-200 p-5">
        <div className="flex items-center gap-2 text-sm font-bold">
          <BarChart3 className="h-4 w-4 text-slate-400" aria-hidden />
          {title}
        </div>
        <div className="mt-3 text-3xl font-bold tabular-nums">{total}</div>
        <div className="mt-4">{body}</div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-md border border-slate-200 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-bold">{value}</p>
    </div>
  );
}

const WEBHOOK_EVENTS = ["conversation.created", "conversation.updated", "message.created"];

function SecretRevealModal({
  label,
  onClose,
  onCopy,
  secret
}: {
  label: string;
  onClose: () => void;
  onCopy: (text: string, copiedMessage?: string) => Promise<void>;
  secret: string;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 px-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 text-[#111214] shadow-2xl">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-base font-bold">Copy your {label}</h3>
            <p className="mt-1 text-sm text-slate-500">
              This secret is shown only once. Store it somewhere safe — you won&apos;t see it again.
            </p>
          </div>
          <button
            aria-label="Close"
            className="grid h-7 w-7 place-items-center rounded text-slate-500 hover:bg-slate-100"
            onClick={onClose}
            type="button"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
        <div className="mt-4 flex overflow-hidden rounded-lg border border-slate-200">
          <code className="min-w-0 flex-1 truncate bg-slate-50 px-3 py-2.5 font-mono text-sm">{secret}</code>
          <button
            className="flex items-center gap-1.5 border-l border-slate-200 px-3 text-sm font-bold hover:bg-slate-50"
            onClick={() => void onCopy(secret, "Secret copied.")}
            type="button"
          >
            <Copy className="h-4 w-4" aria-hidden /> Copy
          </button>
        </div>
        <button
          className="mt-5 w-full rounded-lg bg-[#2f6bff] py-2.5 text-sm font-bold text-white hover:bg-[#3f78ff]"
          onClick={onClose}
          type="button"
        >
          Done — I&apos;ve saved it
        </button>
      </div>
    </div>
  );
}

function IntegrationsScreen({
  apiKeys,
  onCopy,
  onCreateApiKey,
  onCreateWebhook,
  onDeleteWebhook,
  onRevokeApiKey,
  webhooks
}: {
  apiKeys: ApiKey[];
  onCopy: (text: string, copiedMessage?: string) => Promise<void>;
  onCreateApiKey: (name: string) => Promise<boolean>;
  onCreateWebhook: (url: string, events: string[]) => Promise<boolean>;
  onDeleteWebhook: (id: string) => void;
  onRevokeApiKey: (id: string) => void;
  webhooks: Webhook[];
}) {
  const [keyName, setKeyName] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const activeKeys = apiKeys.filter((key) => !key.revokedAt);

  async function submitKey(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const ok = await onCreateApiKey(keyName);
    if (ok) {
      setKeyName("");
    }
  }

  async function submitWebhook(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const ok = await onCreateWebhook(webhookUrl, selectedEvents);
    if (ok) {
      setWebhookUrl("");
      setSelectedEvents([]);
    }
  }

  function toggleEvent(value: string) {
    setSelectedEvents((current) =>
      current.includes(value) ? current.filter((item) => item !== value) : [...current, value]
    );
  }

  return (
    <div className="min-h-full bg-white px-6 py-6 text-[#111214]">
      <div className="mx-auto max-w-3xl space-y-10">
        {/* API keys */}
        <section>
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#eef3ff]">
              <LockKeyhole className="h-4 w-4 text-[#2f6bff]" aria-hidden />
            </span>
            <div>
              <h2 className="text-lg font-bold">API keys</h2>
              <p className="text-sm text-slate-500">
                Authenticate REST requests to your LiveChat data. Keep keys secret.
              </p>
            </div>
          </div>

          <form className="mt-4 flex gap-2" onSubmit={submitKey}>
            <input
              className="h-10 flex-1 rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-[#2f6bff]"
              onChange={(event) => setKeyName(event.target.value)}
              placeholder="Key name (e.g. Zapier integration)"
              value={keyName}
            />
            <button
              className="rounded-lg bg-[#2f6bff] px-4 text-sm font-bold text-white hover:bg-[#3f78ff] disabled:opacity-60"
              disabled={!keyName.trim()}
              type="submit"
            >
              Generate key
            </button>
          </form>

          <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
            {activeKeys.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-slate-400">No API keys yet.</p>
            ) : (
              activeKeys.map((key) => (
                <div
                  className="flex items-center justify-between border-b border-slate-100 px-4 py-3 text-sm last:border-b-0"
                  key={key.id}
                >
                  <div className="min-w-0">
                    <p className="font-semibold">{key.name}</p>
                    <p className="font-mono text-xs text-slate-500">{key.keyPrefix}••••••••</p>
                  </div>
                  <button
                    className="text-xs font-semibold text-rose-500 hover:underline"
                    onClick={() => onRevokeApiKey(key.id)}
                    type="button"
                  >
                    Revoke
                  </button>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Webhooks */}
        <section>
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#eef3ff]">
              <Zap className="h-4 w-4 text-[#2f6bff]" aria-hidden />
            </span>
            <div>
              <h2 className="text-lg font-bold">Webhooks</h2>
              <p className="text-sm text-slate-500">
                Get a POST to your endpoint when events happen (new chat, new message…).
              </p>
            </div>
          </div>

          <form className="mt-4 space-y-3" onSubmit={submitWebhook}>
            <input
              className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-[#2f6bff]"
              onChange={(event) => setWebhookUrl(event.target.value)}
              placeholder="https://your-server.com/webhooks/livechat"
              value={webhookUrl}
            />
            <div className="flex flex-wrap gap-2">
              {WEBHOOK_EVENTS.map((event) => (
                <button
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-semibold",
                    selectedEvents.includes(event)
                      ? "border-[#2f6bff] bg-[#eef3ff] text-[#2f6bff]"
                      : "border-slate-300 text-slate-500"
                  )}
                  key={event}
                  onClick={() => toggleEvent(event)}
                  type="button"
                >
                  {event}
                </button>
              ))}
            </div>
            <button
              className="rounded-lg bg-[#2f6bff] px-4 py-2 text-sm font-bold text-white hover:bg-[#3f78ff] disabled:opacity-60"
              disabled={!webhookUrl.trim()}
              type="submit"
            >
              Add webhook
            </button>
          </form>

          <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
            {webhooks.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-slate-400">No webhooks yet.</p>
            ) : (
              webhooks.map((webhook) => (
                <div
                  className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 text-sm last:border-b-0"
                  key={webhook.id}
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold" title={webhook.url}>{webhook.url}</p>
                    <p className="text-xs text-slate-500">
                      {webhook.events.length > 0 ? webhook.events.join(", ") : "all events"}
                      {" · "}
                      <span className={webhook.isActive ? "text-emerald-600" : "text-slate-400"}>
                        {webhook.isActive ? "active" : "inactive"}
                      </span>
                    </p>
                  </div>
                  <button
                    className="text-xs font-semibold text-rose-500 hover:underline"
                    onClick={() => onDeleteWebhook(webhook.id)}
                    type="button"
                  >
                    Delete
                  </button>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function AppsScreen({ onAction }: { onAction: (message: string) => void }) {
  const [installed, setInstalled] = useState<string[]>([]);
  const [showInstalledOnly, setShowInstalledOnly] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("lc_installed_apps");
      if (saved) {
        setInstalled(JSON.parse(saved) as string[]);
      }
    } catch {
      // ignore
    }
  }, []);

  function toggleInstall(name: string) {
    setInstalled((current) => {
      const next = current.includes(name)
        ? current.filter((item) => item !== name)
        : [...current, name];
      try {
        window.localStorage.setItem("lc_installed_apps", JSON.stringify(next));
      } catch {
        // ignore
      }
      onAction(current.includes(name) ? `${name} uninstalled.` : `${name} installed.`);
      return next;
    });
  }

  const visibleApps = showInstalledOnly
    ? appCards.filter((card) => installed.includes(card.name))
    : appCards;

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
        <h2 className="text-lg font-bold">{showInstalledOnly ? "Your apps" : "All Apps"}</h2>
        <div className="flex flex-wrap gap-2">
          <button
            className={cn(
              "rounded-md border px-3 py-2 text-xs font-bold",
              showInstalledOnly ? "border-[#0067ff] bg-[#eef3ff] text-[#0067ff]" : "border-slate-300 hover:bg-slate-50"
            )}
            onClick={() => setShowInstalledOnly((current) => !current)}
            type="button"
          >
            Your apps ({installed.length})
          </button>
          {["Categories: all", "Payment type: all"].map((filter) => (
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

      {visibleApps.length === 0 ? (
        <p className="mt-8 text-center text-sm text-slate-400">
          No apps installed yet. Browse All Apps and install one.
        </p>
      ) : (
        <div className="mt-3 grid gap-4 lg:grid-cols-3">
          {visibleApps.map((card) => {
            const isInstalled = installed.includes(card.name);
            return (
              <div
                className="flex flex-col rounded-md border border-slate-300 p-4 hover:border-[#0067ff] hover:shadow-sm"
                key={card.name}
              >
                <div className="flex gap-4">
                  <span className="grid h-11 w-11 shrink-0 place-items-center border-4 border-black text-sm font-black">
                    {card.accent}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-base font-bold text-slate-700">{card.name}</span>
                    <span className="mt-1 block text-xs text-slate-500">{card.price}</span>
                  </span>
                </div>
                <p className="mt-3 flex-1 text-sm leading-5 text-slate-700">{card.copy}</p>
                <button
                  className={cn(
                    "mt-4 rounded-md py-2 text-sm font-bold",
                    isInstalled
                      ? "border border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                      : "bg-[#0067ff] text-white hover:bg-[#0050c7]"
                  )}
                  onClick={() => toggleInstall(card.name)}
                  type="button"
                >
                  {isInstalled ? "✓ Installed — Uninstall" : "Install"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const TICKET_STATUSES = ["OPEN", "PENDING", "RESOLVED", "CLOSED"] as const;

function ticketStatusTone(status: string): string {
  switch (status) {
    case "OPEN":
    case "NEW":
      return "bg-blue-100 text-blue-700";
    case "PENDING":
      return "bg-amber-100 text-amber-700";
    case "RESOLVED":
      return "bg-emerald-100 text-emerald-700";
    default:
      return "bg-slate-200 text-slate-600";
  }
}

function ticketPriorityTone(priority: string): string {
  switch (priority) {
    case "URGENT":
      return "text-rose-600";
    case "HIGH":
      return "text-orange-600";
    case "LOW":
      return "text-slate-400";
    default:
      return "text-slate-500";
  }
}

function TicketsScreen({
  onCreate,
  onDelete,
  onUpdateStatus,
  tickets
}: {
  onCreate: (input: {
    subject: string;
    requesterName: string;
    requesterEmail: string;
    description: string;
    priority: string;
  }) => Promise<boolean>;
  onDelete: (id: string) => void;
  onUpdateStatus: (id: string, status: string) => void;
  tickets: Ticket[];
}) {
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState<"all" | "OPEN" | "PENDING" | "RESOLVED" | "CLOSED">("all");
  const [subject, setSubject] = useState("");
  const [requesterName, setRequesterName] = useState("");
  const [requesterEmail, setRequesterEmail] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("NORMAL");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!subject.trim()) {
      return;
    }
    const ok = await onCreate({ subject, requesterName, requesterEmail, description, priority });
    if (ok) {
      setSubject("");
      setRequesterName("");
      setRequesterEmail("");
      setDescription("");
      setPriority("NORMAL");
      setShowForm(false);
    }
  }

  const visible = filter === "all" ? tickets : tickets.filter((ticket) => ticket.status === filter);
  const openCount = tickets.filter((ticket) => ticket.status === "OPEN" || ticket.status === "NEW").length;

  if (tickets.length === 0 && !showForm) {
    return (
      <div className="flex min-h-full items-center justify-center bg-white px-8 py-10 text-black">
        <div className="grid w-full max-w-4xl items-center gap-10 md:grid-cols-[1fr_320px]">
          <div className="flex items-center gap-5">
            <SquareCheckBig className="h-10 w-10 text-emerald-500" aria-hidden />
            <div>
              <h2 className="max-w-lg text-2xl font-bold">
                Save 670 working hours per year on support with the ticketing system
              </h2>
              <p className="mt-5 max-w-lg text-sm leading-6">
                Transform chats and emails into tickets and reclaim hundreds of hours each year. Focus
                on what matters most — solving cases.
              </p>
              <button
                className="mt-5 rounded-md bg-[#0067ff] px-5 py-3 text-sm font-bold text-white hover:bg-[#0050c7]"
                onClick={() => setShowForm(true)}
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

  return (
    <div className="min-h-full bg-white px-6 py-5 text-[#111214]">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-1 text-sm">
          <button
            className={cn(
              "rounded-md px-3 py-1.5 font-semibold",
              filter === "all" ? "bg-slate-100 text-[#111214]" : "text-slate-500"
            )}
            onClick={() => setFilter("all")}
            type="button"
          >
            All ({tickets.length})
          </button>
          {TICKET_STATUSES.map((status) => (
            <button
              className={cn(
                "rounded-md px-3 py-1.5 font-semibold",
                filter === status ? "bg-slate-100 text-[#111214]" : "text-slate-500"
              )}
              key={status}
              onClick={() => setFilter(status)}
              type="button"
            >
              {status.charAt(0) + status.slice(1).toLowerCase()} (
              {tickets.filter((ticket) => ticket.status === status).length})
            </button>
          ))}
        </div>
        <button
          className="rounded-lg bg-[#2f6bff] px-4 py-2 text-sm font-bold text-white hover:bg-[#3f78ff]"
          onClick={() => setShowForm((current) => !current)}
          type="button"
        >
          {showForm ? "Close" : "New ticket"}
        </button>
      </div>

      {openCount > 0 && (
        <p className="mb-3 text-xs font-semibold text-slate-500">
          {openCount} open ticket{openCount > 1 ? "s" : ""} need attention
        </p>
      )}

      {showForm && (
        <form className="mb-5 grid gap-3 rounded-xl border border-slate-200 p-5 md:grid-cols-2" onSubmit={submit}>
          <label className="block text-sm md:col-span-2">
            <span className="mb-1 block font-semibold text-slate-700">Subject</span>
            <input
              className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-[#2f6bff]"
              onChange={(event) => setSubject(event.target.value)}
              placeholder="e.g. Cannot access my account"
              value={subject}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-semibold text-slate-700">Requester name</span>
            <input
              className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-[#2f6bff]"
              onChange={(event) => setRequesterName(event.target.value)}
              placeholder="Bilal Khan"
              value={requesterName}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-semibold text-slate-700">Requester email</span>
            <input
              className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-[#2f6bff]"
              onChange={(event) => setRequesterEmail(event.target.value)}
              placeholder="bilal@example.com"
              type="email"
              value={requesterEmail}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-semibold text-slate-700">Priority</span>
            <select
              className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-[#2f6bff]"
              onChange={(event) => setPriority(event.target.value)}
              value={priority}
            >
              <option value="LOW">Low</option>
              <option value="NORMAL">Normal</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </select>
          </label>
          <label className="block text-sm md:col-span-2">
            <span className="mb-1 block font-semibold text-slate-700">Description</span>
            <textarea
              className="min-h-[70px] w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#2f6bff]"
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Describe the issue…"
              value={description}
            />
          </label>
          <div className="md:col-span-2">
            <button
              className="rounded-lg bg-[#2f6bff] px-4 py-2 text-sm font-bold text-white hover:bg-[#3f78ff] disabled:opacity-60"
              disabled={!subject.trim()}
              type="submit"
            >
              Create ticket
            </button>
          </div>
        </form>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200">
        {visible.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-slate-400">No tickets in this view.</p>
        ) : (
          visible.map((ticket) => (
            <div
              className="flex items-start justify-between gap-4 border-b border-slate-100 px-4 py-3 last:border-b-0 hover:bg-slate-50"
              key={ticket.id}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", ticketStatusTone(ticket.status))}>
                    {ticket.status}
                  </span>
                  <span className={cn("text-xs font-bold", ticketPriorityTone(ticket.priority))}>
                    {ticket.priority}
                  </span>
                  <p className="truncate text-sm font-bold">{ticket.subject}</p>
                </div>
                <p className="mt-1 truncate text-xs text-slate-500">
                  {ticket.requesterName || "Unknown"}
                  {ticket.requesterEmail ? ` · ${ticket.requesterEmail}` : ""}
                  {ticket.description ? ` — ${ticket.description}` : ""}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <select
                  aria-label="Ticket status"
                  className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold outline-none focus:border-[#2f6bff]"
                  onChange={(event) => onUpdateStatus(ticket.id, event.target.value)}
                  value={ticket.status === "NEW" ? "OPEN" : ticket.status}
                >
                  {TICKET_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status.charAt(0) + status.slice(1).toLowerCase()}
                    </option>
                  ))}
                </select>
                <button
                  className="text-xs font-semibold text-rose-500 hover:underline"
                  onClick={() => onDelete(ticket.id)}
                  type="button"
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function formatPrice(cents: number, currency: string): string {
  const symbol = currency.toLowerCase() === "usd" ? "$" : `${currency.toUpperCase()} `;
  return `${symbol}${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

function BillingScreen({
  billing,
  invoices,
  isBusy,
  onCancel,
  onDownloadInvoice,
  onSubscribe
}: {
  billing: BillingOverview | null;
  invoices: BillingInvoice[];
  isBusy: boolean;
  onCancel: () => void;
  onDownloadInvoice: (invoice: BillingInvoice) => void;
  onSubscribe: (planCode: string) => void;
}) {
  if (!billing) {
    return (
      <div className="min-h-full bg-white px-8 py-8 text-black">
        <div className="mx-auto max-w-4xl animate-pulse space-y-4">
          <div className="h-20 rounded-md bg-slate-100" />
          <div className="h-40 rounded-md bg-slate-100" />
        </div>
      </div>
    );
  }

  const { plans, subscription, gatewayConfigured } = billing;
  const activeCode = subscription && subscription.status === "ACTIVE" ? subscription.planCode : null;
  const isActive = Boolean(subscription && subscription.status === "ACTIVE");
  const planPriceCents = isActive
    ? plans.find((plan) => plan.code === subscription?.planCode)?.priceCents ?? 0
    : 0;
  const renews = subscription?.currentPeriodEnd
    ? new Date(subscription.currentPeriodEnd).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric"
      })
    : null;

  return (
    <div className="min-h-full bg-white px-8 py-8 text-black">
      <div className="mx-auto max-w-5xl">
        {!gatewayConfigured ? (
          <div className="mb-6 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <b>Test mode.</b> Payments run without a real gateway. Add your Authorize.net keys to start
            charging customers for real.
          </div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
          <div className="rounded-xl border border-slate-200 p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold">Your subscription</h2>
              <button
                className="rounded-lg border border-slate-300 px-4 py-1.5 text-sm font-semibold hover:bg-slate-50 disabled:opacity-60"
                disabled={isBusy || !isActive}
                onClick={onCancel}
                type="button"
              >
                Manage
              </button>
            </div>

            {isActive ? (
              <>
                <p className="mt-6 text-xs uppercase tracking-wide text-slate-400">Current plan</p>
                <div className="mt-2 flex items-center justify-between border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-3">
                    <span className="grid h-8 w-8 place-items-center rounded-md bg-[#ff5a00] text-xs font-bold text-white">
                      LC
                    </span>
                    <div>
                      <p className="text-sm font-bold">{subscription?.planName ?? subscription?.planCode}</p>
                      {renews && <p className="text-xs text-slate-500">Renews on: {renews} (Monthly)</p>}
                    </div>
                  </div>
                  <span className="text-sm font-bold">
                    {subscription?.perSeat && subscription.perAgentCents
                      ? `${formatPrice(subscription.perAgentCents, "usd")} / agent`
                      : `${formatPrice(planPriceCents, "usd")} / mo`}
                  </span>
                </div>

                {subscription?.perSeat ? (
                  <div className="mt-2 flex items-center justify-between border-b border-slate-100 pb-4 text-sm text-slate-600">
                    <span>
                      {subscription.seatCount} agent{subscription.seatCount === 1 ? "" : "s"}
                      {subscription.perAgentCents
                        ? ` × ${formatPrice(subscription.perAgentCents, "usd")}`
                        : ""}
                    </span>
                    <span className="font-semibold text-slate-700">seats</span>
                  </div>
                ) : null}

                <div className="mt-5 flex items-center justify-between">
                  <span className="text-sm font-bold">Monthly total</span>
                  <span className="text-sm font-bold">
                    {formatPrice(subscription?.amountCents ?? planPriceCents, "usd")} / mo
                  </span>
                </div>
              </>
            ) : (
              <p className="mt-6 text-sm text-slate-600">
                No active plan yet. Pick one below to activate your workspace.
              </p>
            )}
          </div>

          <div className="h-fit rounded-xl bg-[#f3f7ff] p-6">
            <p className="text-sm font-bold">Get more with Business plan</p>
            <ul className="mt-4 space-y-3 text-xs text-slate-600">
              <li className="flex gap-2">
                <Clock3 className="h-4 w-4 shrink-0 text-[#2f6bff]" aria-hidden /> Set your team&apos;s working hours
              </li>
              <li className="flex gap-2">
                <BarChart3 className="h-4 w-4 shrink-0 text-[#2f6bff]" aria-hidden /> Track agent&apos;s performance and activity
              </li>
              <li className="flex gap-2">
                <Mail className="h-4 w-4 shrink-0 text-[#2f6bff]" aria-hidden /> Get custom reports delivered to your mailbox
              </li>
            </ul>
            <button
              className="mt-5 w-full rounded-lg bg-[#2f6bff] py-2 text-sm font-bold text-white hover:bg-[#3f78ff]"
              onClick={() => onSubscribe("business")}
              type="button"
            >
              Upgrade now
            </button>
          </div>
        </div>

        <h2 className="mb-4 mt-10 text-lg font-bold">Available plans</h2>
        <div className="grid gap-5 md:grid-cols-3">
          {plans.map((plan) => {
            const isCurrent = activeCode === plan.code;
            const agents = typeof plan.features.agents === "number" ? plan.features.agents : null;
            const perSeat = plan.features.perSeat === true;

            return (
              <div
                className={cn(
                  "flex flex-col rounded-lg border p-5",
                  isCurrent ? "border-[#0067ff] ring-1 ring-[#0067ff]" : "border-slate-200"
                )}
                key={plan.id}
              >
                <h3 className="text-base font-bold">{plan.name}</h3>
                <p className="mt-2">
                  <span className="text-2xl font-extrabold">
                    {formatPrice(plan.priceCents, plan.currency)}
                  </span>
                  <span className="text-sm text-slate-500">
                    {perSeat ? " / agent / mo" : `/${plan.interval === "YEARLY" ? "yr" : "mo"}`}
                  </span>
                </p>
                <ul className="mt-4 flex-1 space-y-2 text-sm text-slate-600">
                  {perSeat ? (
                    <li className="font-semibold text-slate-700">Billed per agent — add as many as you need</li>
                  ) : agents !== null ? (
                    <li>Up to {agents} agent{agents > 1 ? "s" : ""}</li>
                  ) : null}
                  {Array.isArray(plan.features.channels)
                    ? <li>Channels: {(plan.features.channels as string[]).join(", ")}</li>
                    : null}
                </ul>
                <button
                  className={cn(
                    "mt-5 w-full rounded-md py-2.5 text-sm font-bold disabled:opacity-60",
                    isCurrent
                      ? "border border-slate-300 text-slate-500"
                      : "bg-[#0067ff] text-white hover:bg-[#0050c7]"
                  )}
                  disabled={isBusy || isCurrent}
                  onClick={() => onSubscribe(plan.code)}
                  type="button"
                >
                  {isCurrent ? "Current plan" : `Choose ${plan.name}`}
                </button>
              </div>
            );
          })}
        </div>

        <h2 className="mb-4 mt-10 text-lg font-bold">Billing history</h2>
        {invoices.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
            No invoices yet. Subscribe to a plan and your receipts will appear here.
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-semibold">Invoice</th>
                  <th className="px-4 py-3 font-semibold">Date</th>
                  <th className="px-4 py-3 font-semibold">Plan</th>
                  <th className="px-4 py-3 font-semibold">Amount</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 text-right font-semibold">Receipt</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => (
                  <tr className="border-t border-slate-100" key={invoice.id}>
                    <td className="px-4 py-3 font-mono text-xs font-semibold">{invoice.number}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {new Date(invoice.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric"
                      })}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{invoice.planName ?? "—"}</td>
                    <td className="px-4 py-3 font-semibold">
                      {formatPrice(invoice.amountPaidCents, invoice.currency)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2 py-0.5 text-xs font-semibold capitalize",
                          invoice.status === "paid"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-slate-100 text-slate-600"
                        )}
                      >
                        {invoice.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold hover:bg-slate-50"
                        onClick={() => onDownloadInvoice(invoice)}
                        type="button"
                      >
                        <Download className="h-3.5 w-3.5" aria-hidden /> PDF
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function CompanyDetailsPanel({
  onSave,
  organization
}: {
  onSave: (input: { name?: string; slug?: string; metadata?: Record<string, unknown> }) => Promise<boolean>;
  organization: Organization | null;
}) {
  const meta = (organization?.metadata ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  const [name, setName] = useState(organization?.name ?? "");
  const [slug, setSlug] = useState(organization?.slug ?? "");
  const [website, setWebsite] = useState(str(meta.website));
  const [phone, setPhone] = useState(str(meta.phone));
  const [address, setAddress] = useState(str(meta.address));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!organization) {
      return;
    }
    const m = (organization.metadata ?? {}) as Record<string, unknown>;
    setName(organization.name);
    setSlug(organization.slug);
    setWebsite(typeof m.website === "string" ? m.website : "");
    setPhone(typeof m.phone === "string" ? m.phone : "");
    setAddress(typeof m.address === "string" ? m.address : "");
  }, [organization]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    await onSave({
      name: name.trim(),
      slug: slug.trim(),
      metadata: {
        ...meta,
        website: website.trim(),
        phone: phone.trim(),
        address: address.trim()
      }
    });
    setSaving(false);
  }

  const field = (
    label: string,
    value: string,
    setter: (v: string) => void,
    props: { placeholder?: string; type?: string } = {}
  ) => (
    <label className="block text-sm">
      <span className="mb-1 block font-semibold text-slate-700">{label}</span>
      <input
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#0067ff]"
        onChange={(event) => setter(event.target.value)}
        placeholder={props.placeholder}
        type={props.type ?? "text"}
        value={value}
      />
    </label>
  );

  return (
    <form className="space-y-4 rounded-lg border border-slate-200 p-5" onSubmit={submit}>
      {field("Company name", name, setName, { placeholder: "Acme Inc" })}
      <label className="block text-sm">
        <span className="mb-1 block font-semibold text-slate-700">Workspace URL (slug)</span>
        <input
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#0067ff]"
          onChange={(event) => setSlug(event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
          placeholder="acme-inc"
          value={slug}
        />
        <span className="mt-1 block text-xs text-slate-400">Lowercase letters, numbers and dashes only.</span>
      </label>
      {field("Website", website, setWebsite, { placeholder: "https://acme.com" })}
      {field("Phone", phone, setPhone, { placeholder: "+1 555 123 4567", type: "tel" })}
      <label className="block text-sm">
        <span className="mb-1 block font-semibold text-slate-700">Business address</span>
        <textarea
          className="w-full resize-none rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#0067ff]"
          onChange={(event) => setAddress(event.target.value)}
          placeholder="Street, city, country"
          rows={2}
          value={address}
        />
      </label>
      <button
        className="rounded-md bg-[#0067ff] px-5 py-2 text-sm font-bold text-white hover:bg-[#0050c7] disabled:opacity-60"
        disabled={saving || !name.trim()}
        type="submit"
      >
        {saving ? "Saving…" : "Save company details"}
      </button>
    </form>
  );
}

function SettingsScreen({
  activeSecondary,
  onAction,
  onClearVisitorData,
  onCopy,
  onExportData,
  onUpdateOrganization,
  onUpdateWidget,
  organization,
  widgetInstall
}: {
  activeSecondary: string;
  onUpdateOrganization: (input: {
    name?: string;
    slug?: string;
    metadata?: Record<string, unknown>;
  }) => Promise<boolean>;
  organization: Organization | null;
  onAction: (message: string) => void;
  onClearVisitorData: () => void;
  onCopy: (text: string, copiedMessage?: string) => Promise<void>;
  onExportData: () => void;
  onUpdateWidget: (input: {
    name?: string;
    welcomeMessage?: string;
    offlineMessage?: string;
    accentColor?: string;
    position?: "left" | "right";
    preChatEnabled?: boolean;
    gtmContainerId?: string;
    allowedDomains?: string[];
    language?: string;
    highContrast?: boolean;
    largeText?: boolean;
    cookieConsent?: boolean;
    emailForwardTo?: string;
    emailForwardEnabled?: boolean;
    workingHoursEnabled?: boolean;
    workingHours?: { timezone?: string; days?: Array<{ on: boolean; from: string; to: string }> };
    eyeCatcher?: string;
    eyeCatcherEnabled?: boolean;
    slackWebhookUrl?: string;
    preChatFields?: Array<{ id: string; label: string; type: string; required: boolean }>;
    postChatEnabled?: boolean;
    postChatMessage?: string;
    bannedIps?: string[];
    inactivityEnabled?: boolean;
    inactivityMessage?: string;
    inactivitySeconds?: number;
    menuOptions?: Array<{ id: string; label: string; reply: string }>;
  }) => Promise<boolean>;
  widgetInstall: WidgetInstall | null;
}) {
  const snippet = widgetInstall?.installCode ?? "Loading widget code...";
  const config = widgetInstall?.publicConfig;

  const [name, setName] = useState("");
  const [welcomeMessage, setWelcomeMessage] = useState("");
  const [offlineMessage, setOfflineMessage] = useState("");
  const [accentColor, setAccentColor] = useState("#ff5a00");
  const [position, setPosition] = useState<"left" | "right">("right");
  const [preChatEnabled, setPreChatEnabled] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [openSetting, setOpenSetting] = useState<string | null>(null);

  useEffect(() => {
    if (!config) {
      return;
    }

    setName(config.name ?? "");
    setWelcomeMessage(config.welcomeMessage ?? "");
    setOfflineMessage(config.offlineMessage ?? "");
    setAccentColor(config.theme?.accentColor ?? "#ff5a00");
    setPosition(config.theme?.position ?? "right");
    setPreChatEnabled(config.preChatEnabled ?? false);
  }, [config]);

  async function saveWidget(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    await onUpdateWidget({ name, welcomeMessage, offlineMessage, accentColor, position, preChatEnabled });
    setIsSaving(false);
  }

  // Each settings sub-tab renders its own panel (previously they all fell through to Install).
  const settingsTab = (title: string, subtitle: string, body: React.ReactNode) => (
    <div className="min-h-full bg-white px-6 py-6 text-black">
      <div className="mx-auto max-w-2xl">
        <h2 className="text-lg font-bold">{title}</h2>
        <p className="mb-5 mt-1 text-sm text-slate-500">{subtitle}</p>
        {body}
      </div>
    </div>
  );

  if (activeSecondary === "Security") {
    return settingsTab(
      "Security",
      "Restrict which website domains are allowed to load your chat widget. Leave empty to allow everywhere.",
      <SecuritySettingsPanel
        domains={widgetInstall?.allowedDomains ?? []}
        onClose={() => onAction("Security settings updated.")}
        onSaveDomains={(list) => onUpdateWidget({ allowedDomains: list })}
      />
    );
  }

  if (activeSecondary === "Forms") {
    return settingsTab(
      "Forms",
      "Build the pre-chat and post-chat forms your visitors see.",
      <FormsBuilderPanel
        onClose={() => onAction("Forms saved.")}
        onSave={onUpdateWidget}
        postChatEnabled={widgetInstall?.postChatEnabled ?? false}
        postChatMessage={widgetInstall?.postChatMessage ?? ""}
        preChatEnabled={widgetInstall?.preChatEnabled ?? config?.preChatEnabled ?? false}
        preChatFields={widgetInstall?.preChatFields ?? []}
      />
    );
  }

  if (activeSecondary === "Email by HelpDesk") {
    return settingsTab(
      "Email by HelpDesk",
      "Forward new chats to an email address so nothing is missed.",
      <EmailSettingsPanel
        enabled={widgetInstall?.emailForwardEnabled ?? false}
        onClose={() => onAction("Email settings saved.")}
        onSave={onUpdateWidget}
        to={widgetInstall?.emailForwardTo ?? ""}
      />
    );
  }

  if (activeSecondary === "Engagement") {
    return settingsTab(
      "Engagement",
      "Show a teaser bubble to invite visitors to chat before they open the widget.",
      <SimpleWidgetPanel
        description="A teaser bubble that appears above the widget to invite visitors to chat."
        fieldLabel="Teaser text"
        fieldValue={widgetInstall?.eyeCatcher ?? ""}
        onClose={() => onAction("Engagement saved.")}
        onSave={(text, on) => onUpdateWidget({ eyeCatcher: text, eyeCatcherEnabled: on })}
        placeholder="👋 Need help? Chat with us!"
        toggleLabel="Show eye-catcher"
        toggleValue={widgetInstall?.eyeCatcherEnabled ?? false}
      />
    );
  }

  if (activeSecondary === "Sales tracker") {
    return settingsTab(
      "Sales tracker",
      "Connect Google Tag Manager to track sales and conversions from chats.",
      <GtmSettingsPanel
        gtm={config?.gtmContainerId ?? ""}
        onClose={() => onAction("Sales tracker saved.")}
        onSaveGtm={(value) => onUpdateWidget({ gtmContainerId: value })}
      />
    );
  }

  if (activeSecondary === "Tags") {
    return settingsTab(
      "Tags",
      "Tags help you categorize chats. Add a tag directly on any chat from the Chats screen — the tag list builds itself as you use them.",
      <div className="rounded-lg border border-slate-200 p-5 text-sm text-slate-600">
        Open a conversation in <b>Chats</b> and use the <b>+ Tag</b> button to label it (e.g. sales,
        bug, vip). Tagged chats can then be filtered in Archives.
      </div>
    );
  }

  if (activeSecondary === "Facebook Messenger" || activeSecondary === "Apple Messages") {
    return settingsTab(
      activeSecondary,
      "Connect this channel to reply from your inbox.",
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        This channel needs provider credentials in your <code>.env</code> before it can be connected.
        Website chat works out of the box today.
      </div>
    );
  }

  if (activeSecondary === "Chat settings") {
    return settingsTab(
      "Chat settings",
      "Customize what your visitors see in the chat window.",
      <form className="space-y-4 rounded-lg border border-slate-200 p-5" onSubmit={saveWidget}>
        <label className="block text-sm">
          <span className="mb-1 block font-semibold text-slate-700">Widget name</span>
          <input
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#0067ff]"
            onChange={(event) => setName(event.target.value)}
            value={name}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-semibold text-slate-700">Welcome message</span>
          <textarea
            className="w-full resize-none rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#0067ff]"
            onChange={(event) => setWelcomeMessage(event.target.value)}
            rows={2}
            value={welcomeMessage}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-semibold text-slate-700">Away / offline message</span>
          <textarea
            className="w-full resize-none rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#0067ff]"
            onChange={(event) => setOfflineMessage(event.target.value)}
            rows={2}
            value={offlineMessage}
          />
        </label>
        <div className="flex items-center gap-6">
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            Accent color
            <input
              className="h-8 w-12 cursor-pointer rounded border border-slate-300"
              onChange={(event) => setAccentColor(event.target.value)}
              type="color"
              value={accentColor}
            />
          </label>
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            Position
            <select
              className="rounded-md border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-[#0067ff]"
              onChange={(event) => setPosition(event.target.value as "left" | "right")}
              value={position}
            >
              <option value="right">Bottom right</option>
              <option value="left">Bottom left</option>
            </select>
          </label>
        </div>
        <button
          className="rounded-md bg-[#0067ff] px-5 py-2 text-sm font-bold text-white hover:bg-[#0050c7] disabled:opacity-60"
          disabled={isSaving}
          type="submit"
        >
          {isSaving ? "Saving…" : "Save chat settings"}
        </button>
      </form>
    );
  }

  if (activeSecondary === "Company details") {
    return settingsTab(
      "Company details",
      "Your workspace name, URL and business info — used on invoices and the widget.",
      <CompanyDetailsPanel onSave={onUpdateOrganization} organization={organization} />
    );
  }

  // "Install LiveChat", "Website widget" → the install + customize screen below.
  return (
    <div className="min-h-full bg-white px-6 py-6 text-black">
      <div className="mb-4">
        <h2 className="font-bold">Install website widget <span className="rounded bg-emerald-100 px-2 py-1 text-xs text-emerald-700">Installed</span></h2>
        <p className="mt-2 text-sm text-slate-600">
          To see your chat widget on any website, add this workspace-specific code before the closing body tag.
          <button className="ml-1 text-[#0067ff]" onClick={() => onAction("Install guide opened.")} type="button">Learn more</button>
        </p>
        {widgetInstall && (
          <p className="mt-2 text-xs text-slate-500">
            Widget key: <span className="font-mono font-semibold">{widgetInstall.publicKey}</span>
          </p>
        )}
      </div>

      <form className="mb-6 max-w-md space-y-4 rounded-md border border-slate-200 p-5" onSubmit={saveWidget}>
        <h3 className="font-bold">Customize widget</h3>
        <label className="block text-sm">
          <span className="mb-1 block font-semibold text-slate-700">Widget name</span>
          <input
            className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-[#0067ff]"
            maxLength={120}
            onChange={(event) => setName(event.target.value)}
            value={name}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-semibold text-slate-700">Welcome message</span>
          <input
            className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-[#0067ff]"
            maxLength={300}
            onChange={(event) => setWelcomeMessage(event.target.value)}
            value={welcomeMessage}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-semibold text-slate-700">Offline message</span>
          <input
            className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-[#0067ff]"
            maxLength={300}
            onChange={(event) => setOfflineMessage(event.target.value)}
            value={offlineMessage}
          />
        </label>
        <div className="flex gap-4">
          <label className="block text-sm">
            <span className="mb-1 block font-semibold text-slate-700">Accent color</span>
            <input
              className="h-10 w-16 cursor-pointer rounded border border-slate-300"
              onChange={(event) => setAccentColor(event.target.value)}
              type="color"
              value={accentColor}
            />
          </label>
          <label className="block flex-1 text-sm">
            <span className="mb-1 block font-semibold text-slate-700">Bubble position</span>
            <select
              className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-[#0067ff]"
              onChange={(event) => setPosition(event.target.value === "left" ? "left" : "right")}
              value={position}
            >
              <option value="right">Right</option>
              <option value="left">Left</option>
            </select>
          </label>
        </div>
        <label className="flex items-start gap-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
          <input
            checked={preChatEnabled}
            className="mt-0.5 h-4 w-4"
            onChange={(event) => setPreChatEnabled(event.target.checked)}
            type="checkbox"
          />
          <span>
            <span className="block font-semibold text-slate-700">Ask for name &amp; email before chat</span>
            <span className="block text-xs text-slate-500">
              Visitors fill a short pre-chat form so you always capture the lead.
            </span>
          </span>
        </label>
        <button
          className="rounded-md bg-[#0067ff] px-4 py-2 text-sm font-bold text-white hover:bg-[#0050c7] disabled:opacity-60"
          disabled={isSaving || !widgetInstall}
          type="submit"
        >
          {isSaving ? "Saving..." : "Save widget settings"}
        </button>
      </form>

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
              onClick={() => {
                if (widgetInstall) {
                  window.open(widgetInstall.demoUrl, "_blank", "noopener,noreferrer");
                  return;
                }

                onAction("Widget demo is loading.");
              }}
              type="button"
            >
              Open demo site
            </button>
          </div>
        </div>
      </div>

      <div className="mt-8 grid max-w-md gap-3">
        {settingsIntegrations.map(({ icon: Icon, label }) => (
          <button
            className="flex items-center justify-between rounded-md border border-slate-200 px-4 py-3 text-left text-sm font-bold hover:border-[#2f6bff] hover:bg-slate-50"
            key={String(label)}
            onClick={() => setOpenSetting(label)}
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

      {openSetting && (
        <SettingsDetailModal
          config={config}
          domains={widgetInstall?.allowedDomains ?? []}
          emailForwardEnabled={widgetInstall?.emailForwardEnabled ?? false}
          emailForwardTo={widgetInstall?.emailForwardTo ?? ""}
          gtm={config?.gtmContainerId ?? ""}
          eyeCatcher={widgetInstall?.eyeCatcher ?? ""}
          eyeCatcherEnabled={widgetInstall?.eyeCatcherEnabled ?? false}
          slackWebhookUrl={widgetInstall?.slackWebhookUrl ?? ""}
          preChatEnabled={widgetInstall?.preChatEnabled ?? config?.preChatEnabled ?? false}
          preChatFields={widgetInstall?.preChatFields ?? []}
          postChatEnabled={widgetInstall?.postChatEnabled ?? false}
          postChatMessage={widgetInstall?.postChatMessage ?? ""}
          bannedIps={widgetInstall?.bannedIps ?? []}
          inactivityEnabled={widgetInstall?.inactivityEnabled ?? false}
          inactivityMessage={widgetInstall?.inactivityMessage ?? ""}
          inactivitySeconds={widgetInstall?.inactivitySeconds ?? 60}
          workingHours={widgetInstall?.workingHours ?? null}
          workingHoursEnabled={widgetInstall?.workingHoursEnabled ?? false}
          label={openSetting}
          onAction={onAction}
          onClearVisitorData={onClearVisitorData}
          onClose={() => setOpenSetting(null)}
          onExportData={onExportData}
          onSaveDomains={(list) => onUpdateWidget({ allowedDomains: list })}
          onSaveGtm={(value) => onUpdateWidget({ gtmContainerId: value })}
          onSaveWidget={onUpdateWidget}
        />
      )}
    </div>
  );
}

function useLocalSetting(key: string, fallback: string): [string, (v: string) => void] {
  const [value, setValue] = useState(fallback);
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(`lc_set_${key}`);
      if (saved !== null) {
        setValue(saved);
      }
    } catch {
      // ignore
    }
  }, [key]);
  const update = (v: string) => {
    setValue(v);
    try {
      window.localStorage.setItem(`lc_set_${key}`, v);
    } catch {
      // ignore
    }
  };
  return [value, update];
}

function SettingsToggleRow({
  label,
  settingKey
}: {
  label: string;
  settingKey: string;
}) {
  const [value, setValue] = useLocalSetting(settingKey, "off");
  const on = value === "on";
  return (
    <button
      className="flex w-full items-center justify-between py-2.5 text-left text-sm"
      onClick={() => setValue(on ? "off" : "on")}
      type="button"
    >
      <span className="font-medium text-slate-700">{label}</span>
      <span className={cn("relative h-5 w-9 rounded-full transition", on ? "bg-emerald-500" : "bg-slate-300")}>
        <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white transition", on ? "left-[18px]" : "left-0.5")} />
      </span>
    </button>
  );
}

function SettingsField({
  hint,
  label,
  placeholder,
  settingKey
}: {
  hint?: string;
  label: string;
  placeholder: string;
  settingKey: string;
}) {
  const [value, setValue] = useLocalSetting(settingKey, "");
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-semibold text-slate-700">{label}</span>
      <input
        className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-[#2f6bff]"
        onChange={(event) => setValue(event.target.value)}
        placeholder={placeholder}
        value={value}
      />
      {hint && <span className="mt-1 block text-xs text-slate-400">{hint}</span>}
    </label>
  );
}

function SettingsSelect({
  label,
  options,
  settingKey
}: {
  label: string;
  options: string[];
  settingKey: string;
}) {
  const [value, setValue] = useLocalSetting(settingKey, options[0] ?? "");
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-semibold text-slate-700">{label}</span>
      <select
        className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-[#2f6bff]"
        onChange={(event) => setValue(event.target.value)}
        value={value}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function GtmSettingsPanel({
  gtm,
  onSaveGtm,
  onClose
}: {
  gtm: string;
  onSaveGtm: (value: string) => Promise<boolean>;
  onClose: () => void;
}) {
  const [value, setValue] = useState(gtm);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    setSaving(true);
    const ok = await onSaveGtm(value.trim());
    setSaving(false);
    if (ok) {
      setSaved(true);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">
        Connect Google Tag Manager. Your live chat widget will load your GTM container and push
        events (<code className="text-xs">livechat_loaded</code>, <code className="text-xs">livechat_message_sent</code>,{" "}
        <code className="text-xs">livechat_conversation_started</code>) to the dataLayer.
      </p>
      <label className="block text-sm">
        <span className="mb-1 block font-semibold text-slate-700">GTM Container ID</span>
        <input
          className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-[#2f6bff]"
          onChange={(event) => {
            setValue(event.target.value.toUpperCase());
            setSaved(false);
          }}
          placeholder="GTM-XXXXXXX"
          value={value}
        />
        <span className="mt-1 block text-xs text-slate-400">
          Empty karke save karo to disconnect ho jayega.
        </span>
      </label>
      {gtm ? (
        <p className="rounded-md bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
          ✓ Connected: {gtm} — widget is loading this container live.
        </p>
      ) : null}
      <button
        className="w-full rounded-lg bg-[#2f6bff] py-2.5 text-sm font-bold text-white hover:bg-[#3f78ff] disabled:opacity-60"
        disabled={saving}
        onClick={() => void save()}
        type="button"
      >
        {saving ? "Saving…" : saved ? "Saved ✓" : "Save & connect"}
      </button>
      <button className="w-full text-center text-xs font-semibold text-slate-400 hover:text-slate-600" onClick={onClose} type="button">
        Close
      </button>
    </div>
  );
}

const WIDGET_LANGS: Array<{ code: string; label: string }> = [
  { code: "en", label: "English" },
  { code: "ur", label: "Urdu — اردو" },
  { code: "es", label: "Spanish — Español" },
  { code: "fr", label: "French — Français" },
  { code: "de", label: "German — Deutsch" },
  { code: "ar", label: "Arabic — العربية" },
  { code: "hi", label: "Hindi — हिन्दी" },
  { code: "pt", label: "Portuguese — Português" }
];

function LanguageSettingsPanel({
  current,
  onClose,
  onSave
}: {
  current: string;
  onClose: () => void;
  onSave: (input: { language: string }) => Promise<boolean>;
}) {
  const [lang, setLang] = useState(current);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    setSaving(true);
    const ok = await onSave({ language: lang });
    setSaving(false);
    if (ok) {
      setSaved(true);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">
        Set the language your chat widget shows to visitors (buttons, placeholder, greeting).
      </p>
      <label className="block text-sm">
        <span className="mb-1 block font-semibold text-slate-700">Widget language</span>
        <select
          className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-[#2f6bff]"
          onChange={(event) => {
            setLang(event.target.value);
            setSaved(false);
          }}
          value={lang}
        >
          {WIDGET_LANGS.map((option) => (
            <option key={option.code} value={option.code}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <p className="rounded-md bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
        ✓ Real — your live widget switches to this language (RTL for Urdu/Arabic).
      </p>
      <button
        className="w-full rounded-lg bg-[#2f6bff] py-2.5 text-sm font-bold text-white hover:bg-[#3f78ff] disabled:opacity-60"
        disabled={saving}
        onClick={() => void save()}
        type="button"
      >
        {saving ? "Saving…" : saved ? "Saved ✓" : "Save language"}
      </button>
      <button className="w-full text-center text-xs font-semibold text-slate-400 hover:text-slate-600" onClick={onClose} type="button">
        Close
      </button>
    </div>
  );
}

function WidgetToggleRow({
  hint,
  label,
  onToggle,
  value
}: {
  hint?: string;
  label: string;
  onToggle: (value: boolean) => Promise<boolean> | void;
  value: boolean;
}) {
  const [on, setOn] = useState(value);
  return (
    <div className="py-1.5">
      <button
        className="flex w-full items-center justify-between text-left text-sm"
        onClick={() => {
          const next = !on;
          setOn(next);
          void onToggle(next);
        }}
        type="button"
      >
        <span className="font-medium text-slate-700">{label}</span>
        <span className={cn("relative h-5 w-9 rounded-full transition", on ? "bg-emerald-500" : "bg-slate-300")}>
          <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white transition", on ? "left-[18px]" : "left-0.5")} />
        </span>
      </button>
      {hint && <p className="mt-0.5 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

function AccessibilitySettingsPanel({
  config,
  onSave
}: {
  config?: { highContrast?: boolean; largeText?: boolean } | undefined;
  onSave: (input: { highContrast?: boolean; largeText?: boolean }) => Promise<boolean>;
}) {
  return (
    <div className="space-y-1">
      <p className="mb-3 text-sm text-slate-500">
        Make your chat widget usable for everyone. These apply to the live widget instantly.
      </p>
      <WidgetToggleRow
        hint="Real — widget uses high-contrast colors."
        label="High contrast colors"
        onToggle={(value) => onSave({ highContrast: value })}
        value={config?.highContrast === true}
      />
      <WidgetToggleRow
        hint="Real — larger text in the widget."
        label="Larger text"
        onToggle={(value) => onSave({ largeText: value })}
        value={config?.largeText === true}
      />
    </div>
  );
}

function EmailSettingsPanel({
  enabled,
  onClose,
  onSave,
  to
}: {
  enabled: boolean;
  onClose: () => void;
  onSave: (input: { emailForwardTo?: string; emailForwardEnabled?: boolean }) => Promise<boolean>;
  to: string;
}) {
  const [address, setAddress] = useState(to);
  const [on, setOn] = useState(enabled);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    setSaving(true);
    const ok = await onSave({ emailForwardTo: address.trim(), emailForwardEnabled: on });
    setSaving(false);
    if (ok) {
      setSaved(true);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">
        Get an email whenever a new chat starts — so you never miss one even when offline.
      </p>
      <WidgetToggleRow label="Forward new chats to email" onToggle={(value) => setOn(value)} value={on} />
      <label className="block text-sm">
        <span className="mb-1 block font-semibold text-slate-700">Forwarding address</span>
        <input
          className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-[#2f6bff]"
          onChange={(event) => {
            setAddress(event.target.value);
            setSaved(false);
          }}
          placeholder="support@yourcompany.com"
          type="email"
          value={address}
        />
      </label>
      <p className="rounded-md bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">
        Wired &amp; real — emails send automatically once SMTP is configured on the server (SMTP_HOST in .env).
      </p>
      <button
        className="w-full rounded-lg bg-[#2f6bff] py-2.5 text-sm font-bold text-white hover:bg-[#3f78ff] disabled:opacity-60"
        disabled={saving}
        onClick={() => void save()}
        type="button"
      >
        {saving ? "Saving…" : saved ? "Saved ✓" : "Save"}
      </button>
      <button className="w-full text-center text-xs font-semibold text-slate-400 hover:text-slate-600" onClick={onClose} type="button">
        Close
      </button>
    </div>
  );
}

function SecuritySettingsPanel({
  domains,
  onClose,
  onSaveDomains
}: {
  domains: string[];
  onClose: () => void;
  onSaveDomains: (list: string[]) => Promise<boolean>;
}) {
  const [value, setValue] = useState(domains.join(", "));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    setSaving(true);
    const list = value
      .split(",")
      .map((domain) => domain.trim())
      .filter(Boolean);
    const ok = await onSaveDomains(list);
    setSaving(false);
    if (ok) {
      setSaved(true);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">
        Restrict where your chat widget is allowed to load. If set, the widget will{" "}
        <b>refuse to start</b> on any other domain.
      </p>
      <label className="block text-sm">
        <span className="mb-1 block font-semibold text-slate-700">Allowed domains</span>
        <input
          className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-[#2f6bff]"
          onChange={(event) => {
            setValue(event.target.value);
            setSaved(false);
          }}
          placeholder="yourstore.com, shop.yourstore.com"
          value={value}
        />
        <span className="mt-1 block text-xs text-slate-400">
          Comma se alag karo. Khaali chhodo to widget har jagah chalega.
        </span>
      </label>
      {domains.length > 0 && (
        <p className="rounded-md bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
          🔒 Widget only loads on: {domains.join(", ")}
        </p>
      )}
      <button
        className="w-full rounded-lg bg-[#2f6bff] py-2.5 text-sm font-bold text-white hover:bg-[#3f78ff] disabled:opacity-60"
        disabled={saving}
        onClick={() => void save()}
        type="button"
      >
        {saving ? "Saving…" : saved ? "Saved ✓" : "Save restrictions"}
      </button>
      <button className="w-full text-center text-xs font-semibold text-slate-400 hover:text-slate-600" onClick={onClose} type="button">
        Close
      </button>
    </div>
  );
}

function BannedVisitorsPanel({
  bannedIps,
  onClose,
  onSave
}: {
  bannedIps: string[];
  onClose: () => void;
  onSave: (input: { bannedIps?: string[] }) => Promise<boolean>;
}) {
  const [list, setList] = useState<string[]>(bannedIps);
  const [entry, setEntry] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  function add() {
    const value = entry.trim().toLowerCase();
    if (!value || list.includes(value)) {
      setEntry("");
      return;
    }
    setList((current) => [...current, value]);
    setEntry("");
  }

  async function save() {
    setIsSaving(true);
    await onSave({ bannedIps: list });
    setIsSaving(false);
    onClose();
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">
        Blocked IPs can&apos;t start a chat. Use a trailing <code className="rounded bg-slate-100 px-1">*</code> to
        block a range, e.g. <code className="rounded bg-slate-100 px-1">203.0.113.*</code>.
      </p>
      <div className="flex gap-2">
        <input
          className="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
          onChange={(event) => setEntry(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              add();
            }
          }}
          placeholder="e.g. 203.0.113.42 or 203.0.113.*"
          value={entry}
        />
        <button
          className="rounded-md bg-slate-800 px-4 py-2 text-sm font-bold text-white hover:bg-slate-700"
          onClick={add}
          type="button"
        >
          Add
        </button>
      </div>

      {list.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-400">
          No banned visitors yet.
        </p>
      ) : (
        <ul className="space-y-2">
          {list.map((ip) => (
            <li
              className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm"
              key={ip}
            >
              <span className="font-mono">{ip}</span>
              <button
                className="rounded p-1 text-red-400 hover:bg-red-50"
                onClick={() => setList((current) => current.filter((item) => item !== ip))}
                type="button"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex justify-end gap-2">
        <button
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-50"
          onClick={onClose}
          type="button"
        >
          Cancel
        </button>
        <button
          className="rounded-md bg-[#0067ff] px-4 py-2 text-sm font-bold text-white hover:bg-[#0050c7] disabled:opacity-60"
          disabled={isSaving}
          onClick={() => void save()}
          type="button"
        >
          {isSaving ? "Saving…" : "Save ban list"}
        </button>
      </div>
    </div>
  );
}

function InactivityPanel({
  enabled,
  message,
  onClose,
  onSave,
  seconds
}: {
  enabled: boolean;
  message: string;
  onClose: () => void;
  onSave: (input: {
    inactivityEnabled?: boolean;
    inactivityMessage?: string;
    inactivitySeconds?: number;
    menuOptions?: Array<{ id: string; label: string; reply: string }>;
  }) => Promise<boolean>;
  seconds: number;
}) {
  const [on, setOn] = useState(enabled);
  const [text, setText] = useState(message || "Are you still there? Let us know how we can help.");
  const [secs, setSecs] = useState(seconds || 60);
  const [isSaving, setIsSaving] = useState(false);

  async function save() {
    setIsSaving(true);
    await onSave({
      inactivityEnabled: on,
      inactivityMessage: text.trim(),
      inactivitySeconds: Math.min(600, Math.max(10, secs))
    });
    setIsSaving(false);
    onClose();
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">
        Automatically post a message when a visitor opens the chat but goes quiet.
      </p>
      <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
        <input checked={on} className="h-4 w-4" onChange={(event) => setOn(event.target.checked)} type="checkbox" />
        Enable inactivity messages
      </label>
      <label className="block text-xs font-semibold text-slate-600">
        Message
        <textarea
          className="mt-1 w-full resize-none rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
          onChange={(event) => setText(event.target.value)}
          rows={2}
          value={text}
        />
      </label>
      <label className="block text-xs font-semibold text-slate-600">
        Trigger after (seconds)
        <input
          className="mt-1 w-32 rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
          max={600}
          min={10}
          onChange={(event) => setSecs(Number(event.target.value))}
          type="number"
          value={secs}
        />
      </label>
      <div className="flex justify-end gap-2">
        <button
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-50"
          onClick={onClose}
          type="button"
        >
          Cancel
        </button>
        <button
          className="rounded-md bg-[#0067ff] px-4 py-2 text-sm font-bold text-white hover:bg-[#0050c7] disabled:opacity-60"
          disabled={isSaving}
          onClick={() => void save()}
          type="button"
        >
          {isSaving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}

function FormsBuilderPanel({
  onClose,
  onSave,
  postChatEnabled,
  postChatMessage,
  preChatEnabled,
  preChatFields
}: {
  onClose: () => void;
  onSave: (input: {
    preChatEnabled?: boolean;
    preChatFields?: Array<{ id: string; label: string; type: string; required: boolean }>;
    postChatEnabled?: boolean;
    postChatMessage?: string;
    bannedIps?: string[];
    inactivityEnabled?: boolean;
    inactivityMessage?: string;
    inactivitySeconds?: number;
    menuOptions?: Array<{ id: string; label: string; reply: string }>;
  }) => Promise<boolean>;
  postChatEnabled: boolean;
  postChatMessage: string;
  preChatEnabled: boolean;
  preChatFields: FormField[];
}) {
  const defaultFields: FormField[] = [
    { id: "name", label: "Your name", type: "text", required: false },
    { id: "email", label: "Email", type: "email", required: true }
  ];
  const [enabled, setEnabled] = useState(preChatEnabled);
  const [fields, setFields] = useState<FormField[]>(
    preChatFields.length ? preChatFields : defaultFields
  );
  const [postEnabled, setPostEnabled] = useState(postChatEnabled);
  const [postMessage, setPostMessage] = useState(
    postChatMessage || "Thanks for chatting! Anything else we can help with?"
  );
  const [isSaving, setIsSaving] = useState(false);

  const fieldTypes: Array<FormField["type"]> = ["text", "email", "phone", "textarea"];

  function updateField(index: number, patch: Partial<FormField>) {
    setFields((current) =>
      current.map((field, i) => (i === index ? { ...field, ...patch } : field))
    );
  }

  function addField() {
    setFields((current) => [
      ...current,
      { id: `field_${current.length + 1}`, label: "New field", type: "text", required: false }
    ]);
  }

  function removeField(index: number) {
    setFields((current) => current.filter((_, i) => i !== index));
  }

  function moveField(index: number, direction: -1 | 1) {
    setFields((current) => {
      const next = [...current];
      const target = index + direction;
      if (target < 0 || target >= next.length) {
        return current;
      }
      const item = next[index];
      if (!item) {
        return current;
      }
      next.splice(index, 1);
      next.splice(target, 0, item);
      return next;
    });
  }

  async function save() {
    setIsSaving(true);
    await onSave({
      preChatEnabled: enabled,
      preChatFields: fields
        .filter((field) => field.label.trim().length > 0)
        .map((field) => ({
          id: field.id,
          label: field.label.trim(),
          type: field.type,
          required: field.required
        })),
      postChatEnabled: postEnabled,
      postChatMessage: postMessage.trim()
    });
    setIsSaving(false);
    onClose();
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-bold">Pre-chat form</h4>
            <p className="text-xs text-slate-500">Collect visitor details before a chat starts.</p>
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold">
            <input
              checked={enabled}
              className="h-4 w-4"
              onChange={(event) => setEnabled(event.target.checked)}
              type="checkbox"
            />
            Enabled
          </label>
        </div>

        <div className="mt-3 space-y-2">
          {fields.map((field, index) => (
            <div className="rounded-lg border border-slate-200 p-3" key={index}>
              <div className="flex items-center gap-2">
                <input
                  className="min-w-0 flex-1 rounded-md border border-slate-300 px-2.5 py-1.5 text-sm outline-none focus:border-slate-500"
                  onChange={(event) => updateField(index, { label: event.target.value })}
                  placeholder="Field label"
                  value={field.label}
                />
                <select
                  className="rounded-md border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-slate-500"
                  onChange={(event) => updateField(index, { type: event.target.value as FormField["type"] })}
                  value={field.type}
                >
                  {fieldTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
                  <input
                    checked={field.required}
                    className="h-3.5 w-3.5"
                    onChange={(event) => updateField(index, { required: event.target.checked })}
                    type="checkbox"
                  />
                  Required
                </label>
                <div className="flex items-center gap-1">
                  <button
                    className="rounded p-1 text-slate-400 hover:bg-slate-100 disabled:opacity-30"
                    disabled={index === 0}
                    onClick={() => moveField(index, -1)}
                    type="button"
                  >
                    ↑
                  </button>
                  <button
                    className="rounded p-1 text-slate-400 hover:bg-slate-100 disabled:opacity-30"
                    disabled={index === fields.length - 1}
                    onClick={() => moveField(index, 1)}
                    type="button"
                  >
                    ↓
                  </button>
                  <button
                    className="rounded p-1 text-red-400 hover:bg-red-50"
                    onClick={() => removeField(index)}
                    type="button"
                  >
                    <X className="h-4 w-4" aria-hidden />
                  </button>
                </div>
              </div>
            </div>
          ))}
          <button
            className="w-full rounded-lg border border-dashed border-slate-300 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
            onClick={addField}
            type="button"
          >
            + Add field
          </button>
        </div>
      </div>

      <div className="border-t border-slate-100 pt-5">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-bold">Post-chat form</h4>
            <p className="text-xs text-slate-500">Shown after the visitor rates the chat.</p>
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold">
            <input
              checked={postEnabled}
              className="h-4 w-4"
              onChange={(event) => setPostEnabled(event.target.checked)}
              type="checkbox"
            />
            Enabled
          </label>
        </div>
        <textarea
          className="mt-3 w-full resize-none rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
          onChange={(event) => setPostMessage(event.target.value)}
          rows={2}
          value={postMessage}
        />
      </div>

      <div className="flex justify-end gap-2">
        <button
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-50"
          onClick={onClose}
          type="button"
        >
          Cancel
        </button>
        <button
          className="rounded-md bg-[#0067ff] px-4 py-2 text-sm font-bold text-white hover:bg-[#0050c7] disabled:opacity-60"
          disabled={isSaving}
          onClick={() => void save()}
          type="button"
        >
          {isSaving ? "Saving…" : "Save forms"}
        </button>
      </div>
    </div>
  );
}

function SimpleWidgetPanel({
  description,
  fieldLabel,
  fieldValue,
  hasToggle = true,
  onClose,
  onSave,
  placeholder,
  toggleLabel,
  toggleValue
}: {
  description: string;
  fieldLabel: string;
  fieldValue: string;
  hasToggle?: boolean;
  onClose: () => void;
  onSave: (text: string, on: boolean) => Promise<boolean>;
  placeholder: string;
  toggleLabel: string;
  toggleValue: boolean;
}) {
  const [text, setText] = useState(fieldValue);
  const [on, setOn] = useState(toggleValue);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    setSaving(true);
    const ok = await onSave(text.trim(), on);
    setSaving(false);
    if (ok) {
      setSaved(true);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">{description}</p>
      {hasToggle && <WidgetToggleRow label={toggleLabel} onToggle={(v) => setOn(v)} value={on} />}
      <label className="block text-sm">
        <span className="mb-1 block font-semibold text-slate-700">{fieldLabel}</span>
        <input
          className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-[#2f6bff]"
          onChange={(e) => {
            setText(e.target.value);
            setSaved(false);
          }}
          placeholder={placeholder}
          value={text}
        />
      </label>
      <button
        className="w-full rounded-lg bg-[#2f6bff] py-2.5 text-sm font-bold text-white hover:bg-[#3f78ff] disabled:opacity-60"
        disabled={saving}
        onClick={() => void save()}
        type="button"
      >
        {saving ? "Saving…" : saved ? "Saved ✓" : "Save"}
      </button>
      <button className="w-full text-center text-xs font-semibold text-slate-400 hover:text-slate-600" onClick={onClose} type="button">
        Close
      </button>
    </div>
  );
}

const WH_DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function defaultSchedule() {
  const tz = typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "UTC";
  return {
    timezone: tz || "UTC",
    days: WH_DAYS.map((_, i) => ({ on: i >= 1 && i <= 5, from: "09:00", to: "17:00" }))
  };
}

function WorkingHoursPanel({
  enabled,
  onClose,
  onSave,
  schedule
}: {
  enabled: boolean;
  onClose: () => void;
  onSave: (input: {
    workingHoursEnabled?: boolean;
    workingHours?: { timezone?: string; days?: Array<{ on: boolean; from: string; to: string }> };
    eyeCatcher?: string;
    eyeCatcherEnabled?: boolean;
    slackWebhookUrl?: string;
  }) => Promise<boolean>;
  schedule: { timezone?: string; days?: Array<{ on: boolean; from: string; to: string }> } | null;
}) {
  const initial =
    schedule && Array.isArray(schedule.days) && schedule.days.length === 7
      ? { timezone: schedule.timezone ?? "UTC", days: schedule.days }
      : defaultSchedule();
  const [on, setOn] = useState(enabled);
  const [days, setDays] = useState(initial.days);
  const [tz] = useState(initial.timezone);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function update(index: number, patch: Partial<{ on: boolean; from: string; to: string }>) {
    setDays((current) => current.map((d, i) => (i === index ? { ...d, ...patch } : d)));
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    const ok = await onSave({ workingHoursEnabled: on, workingHours: { timezone: tz, days } });
    setSaving(false);
    if (ok) {
      setSaved(true);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-500">
        Set when your team is available. Outside these hours the widget shows “away — leave a message”.
      </p>
      <WidgetToggleRow label="Enable working hours" onToggle={(v) => setOn(v)} value={on} />
      {on && (
        <div className="max-h-64 space-y-1.5 overflow-auto pr-1">
          {days.map((day, i) => (
            <div className="flex items-center gap-2 text-sm" key={WH_DAYS[i]}>
              <button
                aria-label={`Toggle ${WH_DAYS[i]}`}
                className={cn("h-5 w-9 shrink-0 rounded-full transition", day.on ? "bg-emerald-500" : "bg-slate-300")}
                onClick={() => update(i, { on: !day.on })}
                type="button"
              >
                <span className={cn("block h-4 w-4 rounded-full bg-white transition", day.on ? "ml-[18px]" : "ml-0.5")} />
              </button>
              <span className="w-16 shrink-0 text-xs font-semibold text-slate-600">{WH_DAYS[i]?.slice(0, 3)}</span>
              {day.on ? (
                <>
                  <input
                    className="w-24 rounded-md border border-slate-300 px-2 py-1 text-xs outline-none focus:border-[#2f6bff]"
                    onChange={(e) => update(i, { from: e.target.value })}
                    type="time"
                    value={day.from}
                  />
                  <span className="text-slate-400">–</span>
                  <input
                    className="w-24 rounded-md border border-slate-300 px-2 py-1 text-xs outline-none focus:border-[#2f6bff]"
                    onChange={(e) => update(i, { to: e.target.value })}
                    type="time"
                    value={day.to}
                  />
                </>
              ) : (
                <span className="text-xs text-slate-400">Closed</span>
              )}
            </div>
          ))}
          <p className="pt-1 text-xs text-slate-400">Timezone: {tz}</p>
        </div>
      )}
      <button
        className="w-full rounded-lg bg-[#2f6bff] py-2.5 text-sm font-bold text-white hover:bg-[#3f78ff] disabled:opacity-60"
        disabled={saving}
        onClick={() => void save()}
        type="button"
      >
        {saving ? "Saving…" : saved ? "Saved ✓" : "Save working hours"}
      </button>
      <button className="w-full text-center text-xs font-semibold text-slate-400 hover:text-slate-600" onClick={onClose} type="button">
        Close
      </button>
    </div>
  );
}

function SettingsDetailModal({
  config,
  domains,
  emailForwardEnabled,
  emailForwardTo,
  gtm,
  label,
  onAction,
  onClearVisitorData,
  onClose,
  onExportData,
  onSaveDomains,
  onSaveGtm,
  onSaveWidget,
  eyeCatcher,
  eyeCatcherEnabled,
  slackWebhookUrl,
  preChatEnabled,
  preChatFields,
  postChatEnabled,
  postChatMessage,
  bannedIps,
  inactivityEnabled,
  inactivityMessage,
  inactivitySeconds,
  workingHours,
  workingHoursEnabled
}: {
  config?: { language?: string; highContrast?: boolean; largeText?: boolean; cookieConsent?: boolean } | undefined;
  domains: string[];
  emailForwardEnabled: boolean;
  emailForwardTo: string;
  eyeCatcher: string;
  eyeCatcherEnabled: boolean;
  slackWebhookUrl: string;
  gtm: string;
  label: string;
  onAction: (message: string) => void;
  onClearVisitorData: () => void;
  onClose: () => void;
  onExportData: () => void;
  onSaveDomains: (list: string[]) => Promise<boolean>;
  onSaveGtm: (value: string) => Promise<boolean>;
  onSaveWidget: (input: {
    language?: string;
    highContrast?: boolean;
    largeText?: boolean;
    cookieConsent?: boolean;
    emailForwardTo?: string;
    emailForwardEnabled?: boolean;
    workingHoursEnabled?: boolean;
    workingHours?: { timezone?: string; days?: Array<{ on: boolean; from: string; to: string }> };
    eyeCatcher?: string;
    eyeCatcherEnabled?: boolean;
    slackWebhookUrl?: string;
    preChatEnabled?: boolean;
    preChatFields?: Array<{ id: string; label: string; type: string; required: boolean }>;
    postChatEnabled?: boolean;
    postChatMessage?: string;
    bannedIps?: string[];
    inactivityEnabled?: boolean;
    inactivityMessage?: string;
    inactivitySeconds?: number;
    menuOptions?: Array<{ id: string; label: string; reply: string }>;
  }) => Promise<boolean>;
  preChatEnabled: boolean;
  preChatFields: FormField[];
  postChatEnabled: boolean;
  postChatMessage: string;
  bannedIps: string[];
  inactivityEnabled: boolean;
  inactivityMessage: string;
  inactivitySeconds: number;
  workingHours?: { timezone?: string; days?: Array<{ on: boolean; from: string; to: string }> } | null;
  workingHoursEnabled: boolean;
}) {
  const selfManaged =
    label === "Connect with Google Tag Manager" ||
    label === "Security restrictions" ||
    label === "Languages" ||
    label === "Accessibility" ||
    label === "Email by HelpDesk" ||
    label === "Data storage" ||
    label === "Forms builder" ||
    label === "Banned visitors" ||
    label === "Inactivity messages" ||
    label === "Working hours" ||
    label === "Eye-catcher" ||
    label === "Slack notifications";

  function renderBody() {
    switch (label) {
      case "Forms builder":
        return (
          <FormsBuilderPanel
            onClose={onClose}
            onSave={onSaveWidget}
            postChatEnabled={postChatEnabled}
            postChatMessage={postChatMessage}
            preChatEnabled={preChatEnabled}
            preChatFields={preChatFields}
          />
        );
      case "Banned visitors":
        return <BannedVisitorsPanel bannedIps={bannedIps} onClose={onClose} onSave={onSaveWidget} />;
      case "Inactivity messages":
        return (
          <InactivityPanel
            enabled={inactivityEnabled}
            message={inactivityMessage}
            onClose={onClose}
            onSave={onSaveWidget}
            seconds={inactivitySeconds}
          />
        );
      case "Working hours":
        return (
          <WorkingHoursPanel
            enabled={workingHoursEnabled}
            onClose={onClose}
            onSave={onSaveWidget}
            schedule={workingHours ?? null}
          />
        );
      case "Eye-catcher":
        return (
          <SimpleWidgetPanel
            description="A teaser bubble that appears above the widget to invite visitors to chat."
            fieldLabel="Teaser text"
            fieldValue={eyeCatcher}
            onClose={onClose}
            onSave={(text, on) => onSaveWidget({ eyeCatcher: text, eyeCatcherEnabled: on })}
            placeholder="👋 Need help? Chat with us!"
            toggleLabel="Show eye-catcher"
            toggleValue={eyeCatcherEnabled}
          />
        );
      case "Slack notifications":
        return (
          <SimpleWidgetPanel
            description="Get a Slack message whenever a new chat starts. Paste an Incoming Webhook URL."
            fieldLabel="Slack Incoming Webhook URL"
            fieldValue={slackWebhookUrl}
            hasToggle={false}
            onClose={onClose}
            onSave={(text) => onSaveWidget({ slackWebhookUrl: text })}
            placeholder="https://hooks.slack.com/services/…"
            toggleLabel=""
            toggleValue={false}
          />
        );
      case "Connect with Google Tag Manager":
        return <GtmSettingsPanel gtm={gtm} onClose={onClose} onSaveGtm={onSaveGtm} />;
      case "Email by HelpDesk":
        return (
          <EmailSettingsPanel
            enabled={emailForwardEnabled}
            onClose={onClose}
            onSave={onSaveWidget}
            to={emailForwardTo}
          />
        );
      case "Facebook Messenger":
        return (
          <div className="space-y-4">
            <p className="text-sm text-slate-500">Reply to Facebook Messenger chats from LiveChat.</p>
            <SettingsField label="Facebook Page ID" placeholder="1234567890" settingKey="fb_page_id" />
            <button
              className="rounded-lg bg-[#1877f2] px-4 py-2 text-sm font-bold text-white hover:bg-[#0f66d6]"
              onClick={() => onAction("Facebook connect flow requires a Facebook app — add credentials in .env.")}
              type="button"
            >
              Connect Facebook Page
            </button>
          </div>
        );
      case "Security restrictions":
        return <SecuritySettingsPanel domains={domains} onClose={onClose} onSaveDomains={onSaveDomains} />;
      case "Languages":
        return <LanguageSettingsPanel current={config?.language ?? "en"} onClose={onClose} onSave={onSaveWidget} />;
      case "Accessibility":
        return <AccessibilitySettingsPanel config={config} onSave={onSaveWidget} />;
      case "Data storage":
        return (
          <div className="space-y-4">
            <p className="text-sm text-slate-500">
              Export or erase your data (GDPR). These run for real against your account.
            </p>
            <SettingsSelect
              label="Keep chat history for"
              options={["30 days", "90 days", "1 year", "2 years", "Forever"]}
              settingKey="data_retention"
            />
            <div className="flex flex-col gap-2">
              <button
                className="rounded-lg bg-[#2f6bff] px-4 py-2 text-sm font-bold text-white hover:bg-[#3f78ff]"
                onClick={() => {
                  onExportData();
                  onClose();
                }}
                type="button"
              >
                ⬇ Export all data (JSON)
              </button>
              <button
                className="rounded-lg border border-rose-300 px-4 py-2 text-sm font-bold text-rose-600 hover:bg-rose-50"
                onClick={() => {
                  if (window.confirm("Erase & anonymize all visitor tracking data? This cannot be undone.")) {
                    onClearVisitorData();
                    onClose();
                  }
                }}
                type="button"
              >
                Delete visitor data
              </button>
            </div>
          </div>
        );
      case "Compliance":
        return (
          <div className="space-y-1">
            <p className="mb-3 text-sm text-slate-500">GDPR &amp; privacy controls.</p>
            <WidgetToggleRow
              hint="Real — shows a cookie notice in your widget before chat starts."
              label="Show cookie consent banner"
              onToggle={(value) => onSaveWidget({ cookieConsent: value })}
              value={config?.cookieConsent === true}
            />
            <SettingsToggleRow label="GDPR mode (ask before storing data)" settingKey="comp_gdpr" />
            <SettingsToggleRow label="Mask credit-card numbers in chats" settingKey="comp_mask" />
          </div>
        );
      default:
        return <p className="text-sm text-slate-500">Settings for {label}.</p>;
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 px-4" onClick={onClose}>
      <div
        className="lc-pop w-full max-w-md rounded-xl bg-white p-6 text-[#111214] shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-bold">{label}</h3>
          <button
            aria-label="Close"
            className="grid h-7 w-7 place-items-center rounded text-slate-500 hover:bg-slate-100"
            onClick={onClose}
            type="button"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
        {renderBody()}
        {!selfManaged && (
          <button
            className="mt-6 w-full rounded-lg bg-[#2f6bff] py-2.5 text-sm font-bold text-white hover:bg-[#3f78ff]"
            onClick={() => {
              onAction(`${label} saved.`);
              onClose();
            }}
            type="button"
          >
            Save changes
          </button>
        )}
      </div>
    </div>
  );
}

const SUPPORT_API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";
const SUPPORT_WIDGET_KEY = "lcw_support_desk";

interface SupportMessage {
  id: string;
  senderType: string;
  body: string;
  createdAt: string;
}

async function supportFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${SUPPORT_API}/widgets/public/${SUPPORT_WIDGET_KEY}${path}`, {
    ...options,
    headers: { "content-type": "application/json", ...(options?.headers ?? {}) }
  });
  if (!res.ok) {
    throw new Error(`support ${res.status}`);
  }
  return (await res.json()) as T;
}

/**
 * The orange bubble in the dashboard — the CLIENT's own support channel to the
 * platform's support team. Talks to a separate "LiveChat Support" org via its
 * public widget, using the logged-in client's identity so support knows who's asking.
 */
function BottomChatWidget({
  clientEmail,
  clientName,
  clientOrgId,
  clientOrgName,
  clientPlan
}: {
  clientEmail: string;
  clientName: string;
  clientOrgId: string;
  clientOrgName: string;
  clientPlan: string;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [status, setStatus] = useState<string>("OPEN");
  const [sending, setSending] = useState(false);
  const sessionRef = useRef<string | null>(null);
  const convRef = useRef<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const storageKey = `lc_support_${clientEmail || "anon"}`;

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved) as { sessionToken?: string; conversationId?: string };
        sessionRef.current = parsed.sessionToken ?? null;
        convRef.current = parsed.conversationId ?? null;
      }
    } catch {
      // ignore
    }
  }, [storageKey]);

  function persist() {
    try {
      window.localStorage.setItem(
        storageKey,
        JSON.stringify({ sessionToken: sessionRef.current, conversationId: convRef.current })
      );
    } catch {
      // ignore
    }
  }

  async function ensureSession(): Promise<string> {
    if (sessionRef.current) {
      return sessionRef.current;
    }
    const session = await supportFetch<{ sessionToken: string }>("/sessions", {
      method: "POST",
      body: JSON.stringify({
        visitorExternalId: clientEmail || undefined,
        pageUrl: typeof window !== "undefined" ? window.location.href : "",
        pageTitle: "Dashboard support"
      })
    });
    sessionRef.current = session.sessionToken;
    persist();
    return session.sessionToken;
  }

  const loadMessages = useCallback(async () => {
    if (!sessionRef.current || !convRef.current) {
      return;
    }
    const token = sessionRef.current;
    const conv = convRef.current;
    try {
      const [list, info] = await Promise.all([
        supportFetch<SupportMessage[]>(
          `/conversations/${conv}/messages?sessionToken=${encodeURIComponent(token)}`
        ),
        supportFetch<{ status: string }>(
          `/conversations/${conv}?sessionToken=${encodeURIComponent(token)}`
        ).catch(() => null)
      ]);
      setMessages(list);
      if (info?.status) {
        setStatus(info.status);
      }
    } catch {
      // ignore transient
    }
  }, []);

  // Poll for support-team replies while the panel is open.
  useEffect(() => {
    if (!open) {
      return;
    }
    void loadMessages();
    const interval = setInterval(() => void loadMessages(), 3500);
    return () => clearInterval(interval);
  }, [open, loadMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = draft.trim();
    if (!body || sending) {
      return;
    }
    setSending(true);
    setDraft("");
    try {
      const token = await ensureSession();
      // If the previous complaint was resolved/closed, a new message opens a fresh ticket.
      if (status === "RESOLVED" || status === "CLOSED") {
        convRef.current = null;
        setMessages([]);
        setStatus("OPEN");
        persist();
      }
      if (!convRef.current) {
        // Rich subject so the support team instantly knows WHICH account/company is
        // asking — even with dozens of simultaneous chats.
        const subject = [
          clientOrgName,
          clientPlan ? `${clientPlan} plan` : null,
          clientEmail || null
        ]
          .filter(Boolean)
          .join(" · ");
        const result = await supportFetch<{ conversation: { id: string }; message: SupportMessage }>(
          "/conversations",
          {
            method: "POST",
            body: JSON.stringify({
              sessionToken: token,
              body,
              name: `${clientOrgName} — ${clientName}`,
              ...(clientEmail ? { email: clientEmail } : {}),
              subject,
              metadata: {
                accountOrgId: clientOrgId,
                accountName: clientOrgName,
                plan: clientPlan,
                contactName: clientName,
                contactEmail: clientEmail
              }
            })
          }
        );
        convRef.current = result.conversation.id;
        persist();
        setMessages((current) => [...current, result.message]);
      } else {
        const message = await supportFetch<SupportMessage>(`/conversations/${convRef.current}/messages`, {
          method: "POST",
          body: JSON.stringify({ sessionToken: token, body })
        });
        setMessages((current) => [...current, message]);
      }
      void loadMessages();
    } catch {
      setDraft(body);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed bottom-24 right-3 z-40 flex flex-col items-end gap-2 2xl:bottom-3">
      {open && (
        <div className="lc-pop flex h-[460px] w-[340px] max-w-[calc(100vw-24px)] flex-col overflow-hidden rounded-2xl bg-white text-slate-900 shadow-2xl">
          <div className="flex items-center gap-2 bg-[#111214] px-4 py-3 text-white">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-[#ff5a00]">
              <MessageCircle className="h-4 w-4" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-bold">LiveChat Support</p>
              <p className="text-[11px] text-white/60">We usually reply in a few minutes</p>
            </div>
            <button aria-label="Close" className="ml-auto text-white/70 hover:text-white" onClick={() => setOpen(false)} type="button">
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>

          <div className="lc-scroll flex-1 space-y-2 overflow-auto bg-[#f7f8fb] p-3">
            {messages.length === 0 ? (
              <div className="mt-6 text-center text-xs text-slate-500">
                👋 Hi {clientName.split(" ")[0]}! Need help with your account? Send us a message and our
                team will reply here.
              </div>
            ) : (
              messages.map((message) => {
                const mine = message.senderType === "VISITOR";
                return (
                  <div className={cn("flex", mine ? "justify-end" : "justify-start")} key={message.id}>
                    <div
                      className={cn(
                        "max-w-[80%] rounded-2xl px-3 py-2 text-sm shadow-sm",
                        mine ? "rounded-br-sm bg-[#ff5a00] text-white" : "rounded-bl-sm bg-white text-slate-800"
                      )}
                    >
                      {message.body}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={bottomRef} />
          </div>

          {(status === "RESOLVED" || status === "CLOSED") && (
            <div className="flex items-center gap-2 border-t border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
              <CheckCircle2 className="h-4 w-4" aria-hidden />
              Our team marked this resolved. Send a message to open a new request.
            </div>
          )}

          <form className="flex items-center gap-2 border-t border-slate-200 p-3" onSubmit={send}>
            <input
              className="min-w-0 flex-1 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm outline-none focus:border-[#ff5a00]"
              onChange={(event) => setDraft(event.target.value)}
              placeholder={
                status === "RESOLVED" || status === "CLOSED" ? "Ask something else…" : "Write a message…"
              }
              value={draft}
            />
            <button
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#ff5a00] text-white hover:bg-[#e84f00] disabled:opacity-50"
              disabled={sending || !draft.trim()}
              type="submit"
            >
              <SendHorizontal className="h-4 w-4" aria-hidden />
            </button>
          </form>
        </div>
      )}
      <button
        aria-label={open ? "Close support chat" : "Open support chat"}
        className="grid h-14 w-14 place-items-center rounded-full bg-[#ff5a00] text-white shadow-xl hover:bg-[#e84f00]"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        {open ? <X className="h-6 w-6" aria-hidden /> : <MessageCircle className="h-7 w-7" aria-hidden />}
      </button>
    </div>
  );
}

function ProfileMenu({
  isAcceptingChats,
  onAction,
  onClose,
  onLogout,
  onNavigate,
  onToggleAcceptChats,
  user
}: {
  isAcceptingChats: boolean;
  onAction: (message: string) => void;
  onClose: () => void;
  onLogout: () => void;
  onNavigate: (screen: ScreenKey, secondary?: string) => void;
  onToggleAcceptChats: () => void;
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
        <ToggleRow checked={isAcceptingChats} label="Accept chats" onToggle={onToggleAcceptChats} />
        <ToggleRow checked disabled label="Dark mode" />
        <button
          className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-slate-50"
          onClick={() => {
            onClose();
            requestNotificationPermission();
            const granted =
              typeof window !== "undefined" && "Notification" in window
                ? Notification.permission === "granted"
                : false;
            onAction(
              granted
                ? "Browser notifications are on — you'll be alerted for new chats."
                : "Allow notifications in your browser to get new-chat alerts."
            );
          }}
          type="button"
        >
          Notification preferences
          <span className="grid h-4 w-4 place-items-center rounded-full bg-red-600 text-[10px] font-bold text-white">1</span>
        </button>
        <button
          className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-slate-50"
          onClick={() => {
            onClose();
            onNavigate("settings", "Install LiveChat");
          }}
          type="button"
        >
          Install widget
          <span className="flex gap-2 text-slate-500">
            <Monitor className="h-4 w-4" aria-hidden />
            <Download className="h-4 w-4" aria-hidden />
          </span>
        </button>
        {[
          { label: "Company details", target: "settings" as ScreenKey, secondary: "Company details" },
          { label: "Billing & plans", target: "billing" as ScreenKey, secondary: "Subscription" },
          { label: "Team & agents", target: "team" as ScreenKey, secondary: undefined },
          { label: "Keyboard shortcuts", target: undefined, secondary: undefined }
        ].map((item) => (
          <button
            className="block w-full px-3 py-2 text-left hover:bg-slate-50"
            key={item.label}
            onClick={() => {
              onClose();
              if (item.target) {
                onNavigate(item.target, item.secondary);
              } else {
                onAction("Shortcuts: Ctrl+K search · Enter to send · Esc to close panels.");
              }
            }}
            type="button"
          >
            {item.label}
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
        const isNote = message.visibility === "INTERNAL";

        if (isNote) {
          return (
            <div className="lc-msg-in flex justify-center" key={message.id}>
              <div className="max-w-[88%] rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                <span className="mb-0.5 block font-bold">🔒 Private note (team only)</span>
                {message.body}
              </div>
            </div>
          );
        }

        const productCard = readProductCard(message);
        if (productCard) {
          return (
            <div className={cn("lc-msg-in flex", isAgent ? "justify-end" : "justify-start")} key={message.id}>
              <div className="w-56 overflow-hidden rounded-2xl bg-white text-slate-900 shadow-sm">
                {productCard.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img alt={productCard.title} className="h-28 w-full object-cover" src={productCard.image} />
                ) : null}
                <div className="p-3">
                  <p className="text-sm font-bold leading-snug">{productCard.title}</p>
                  {productCard.description ? (
                    <p className="mt-1 text-xs text-slate-500">{productCard.description}</p>
                  ) : null}
                  <div className="mt-2 flex items-center justify-between gap-2">
                    {productCard.price ? (
                      <span className="text-sm font-bold">{productCard.price}</span>
                    ) : <span />}
                    {productCard.url ? (
                      <a
                        className="rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-emerald-700"
                        href={productCard.url}
                        rel="noopener noreferrer"
                        target="_blank"
                      >
                        {productCard.buttonLabel || "View"}
                      </a>
                    ) : null}
                  </div>
                  <p className="mt-2 text-[10px] text-slate-400">🛍 Product · {formatTime(message.createdAt)}</p>
                </div>
              </div>
            </div>
          );
        }

        const isBot = message.senderType === "SYSTEM";
        // Three clearly distinct senders: agent (blue, right), bot (violet, left), visitor (white, left).
        const senderLabel = isAgent ? "You" : isBot ? "🤖 Bot" : "Visitor";
        const bubbleClass = isAgent
          ? "rounded-br-md bg-[#0067ff] text-white"
          : isBot
            ? "rounded-bl-md bg-[#4c1d95] text-violet-50"
            : "rounded-bl-md bg-white text-slate-900";
        const timeClass = isAgent ? "text-blue-100" : isBot ? "text-violet-200/70" : "text-slate-400";

        return (
          <div className={cn("lc-msg-in flex flex-col", isAgent ? "items-end" : "items-start")} key={message.id}>
            <span className={cn("mb-1 px-1 text-[10px] font-semibold", isAgent ? "text-blue-300/80" : isBot ? "text-violet-300/80" : "text-white/50")}>
              {senderLabel}
            </span>
            <div
              className={cn(
                "max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm",
                bubbleClass
              )}
            >
              {(() => {
                const attachment = message.type === "FILE" ? readAttachment(message) : null;

                if (attachment) {
                  return (
                    <a
                      className="block"
                      href={attachment.url}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      {attachment.mimeType.startsWith("image/") ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          alt={attachment.fileName}
                          className="max-h-52 max-w-full rounded-lg"
                          src={attachment.url}
                        />
                      ) : (
                        <span className="flex items-center gap-2 underline">
                          <Paperclip className="h-4 w-4" aria-hidden />
                          {attachment.fileName}
                        </span>
                      )}
                    </a>
                  );
                }

                return <p>{message.body ?? "Attachment"}</p>;
              })()}
              <p className={cn("mt-2 text-[10px]", timeClass)}>
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
  if (messages.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-400">No messages in this chat.</p>;
  }

  return (
    <div className="space-y-3">
      {messages.map((message) => {
        const isAgent = message.senderType === "AGENT";
        const isBot = message.senderType === "SYSTEM";
        const label = isAgent ? "Agent" : isBot ? "🤖 Bot" : "Visitor";
        return (
          <div className={cn("flex flex-col", isAgent ? "items-end" : "items-start")} key={message.id}>
            <span className="mb-1 px-1 text-[10px] font-semibold text-slate-400">{label}</span>
            <div
              className={cn(
                "max-w-[78%] rounded-xl px-4 py-2.5 text-sm",
                isAgent
                  ? "rounded-br-sm bg-[#0067ff] text-white"
                  : isBot
                    ? "rounded-bl-sm bg-violet-100 text-violet-900"
                    : "rounded-bl-sm bg-slate-100 text-slate-900"
              )}
            >
              {message.body ?? "Attachment"}
            </div>
          </div>
        );
      })}
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

function ToggleRow({
  checked,
  disabled,
  label,
  onToggle
}: {
  checked?: boolean;
  disabled?: boolean;
  label: string;
  onToggle?: () => void;
}) {
  return (
    <button
      className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-slate-50 disabled:opacity-60"
      disabled={disabled}
      onClick={onToggle}
      type="button"
    >
      {label}
      <span className={cn("flex h-4 w-7 items-center rounded-full px-0.5 transition-all", checked ? "justify-end bg-emerald-600" : "justify-start bg-slate-300")}>
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

function getSocketUrl() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

  return apiUrl.replace(/\/api\/v1\/?$/, "").replace(/\/$/, "") + "/chat";
}
