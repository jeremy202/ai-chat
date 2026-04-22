import axios from "axios";

function resolveApiBaseUrl() {
  if (typeof window !== "undefined") {
    const params = new URLSearchParams(window.location.search);
    const widgetApiBase = params.get("apiBase")?.replace(/\/$/, "");
    if (widgetApiBase) {
      return widgetApiBase;
    }
  }

  const configured = import.meta.env.VITE_API_URL?.replace(/\/$/, "");
  if (configured) {
    return configured;
  }

  if (import.meta.env.DEV) {
    return "http://localhost:4000";
  }

  return "/api";
}

export const apiBaseUrl = resolveApiBaseUrl();

const client = axios.create({
  baseURL: apiBaseUrl,
});

const platformClient = axios.create({
  baseURL: apiBaseUrl,
});

client.interceptors.request.use((config) => {
  const requestUrl = String(config.url ?? "");
  const isWidgetPublicRequest =
    requestUrl.startsWith("/api/widget/") || requestUrl.startsWith("api/widget/");

  if (isWidgetPublicRequest) {
    return config;
  }

  const token = localStorage.getItem("ai-concierge-token");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

platformClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("ai-concierge-superadmin-token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export function setAuthToken(token: string | null) {
  if (token) {
    localStorage.setItem("ai-concierge-token", token);
  } else {
    localStorage.removeItem("ai-concierge-token");
  }
}

export function setSuperadminAuthToken(token: string | null) {
  if (token) {
    localStorage.setItem("ai-concierge-superadmin-token", token);
  } else {
    localStorage.removeItem("ai-concierge-superadmin-token");
  }
}

export type Business = {
  id: string;
  name: string;
  slug: string;
  email: string;
  websiteUrl: string | null;
  brandColor: string;
  welcomeMessage: string;
};

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: string;
};

export type UserRole = "OWNER" | "ADMIN" | "AGENT";

export type AuthResponse = {
  token: string;
  user: AuthUser;
  business: Business;
};

export type DashboardOverview = {
  business: Business;
  metrics: {
    totalChats: number;
    qualifiedLeads: number;
    bookings: number;
    conversionRate: number;
  };
  recentConversations: Conversation[];
  recentBookings: Booking[];
};

export type KnowledgeItem = {
  id: string;
  title: string;
  sourceType: string;
  rawContent: string;
  updatedAt: string;
  _count: {
    chunks: number;
  };
};

export type Message = {
  id: string;
  role: "USER" | "ASSISTANT" | "ADMIN" | "SYSTEM";
  content: string;
  createdAt: string;
};

export type Booking = {
  id: string;
  guestName: string | null;
  email: string | null;
  phone: string | null;
  arrivalDate: string | null;
  departureDate: string | null;
  guests: number | null;
  roomType: string | null;
  notes: string | null;
  estimatedValue: number | null;
  status: string;
  createdAt: string;
  conversation?: {
    id: string;
    visitorName: string | null;
    visitorEmail: string | null;
    status: string;
  } | null;
};

export type Conversation = {
  id: string;
  visitorName: string | null;
  visitorEmail: string | null;
  status: "OPEN" | "HUMAN" | "CLOSED";
  leadStatus: string;
  updatedAt: string;
  createdAt: string;
  messages: Message[];
  bookings: Booking[];
};

export type DashboardPayload = {
  business: Business;
  metrics: DashboardOverview["metrics"];
  recentConversations: Conversation[];
  recentBookings: Booking[];
  conversations: Conversation[];
  bookings: Booking[];
  knowledgeItems: KnowledgeItem[];
  widgetSnippet: string;
};

export type WidgetConfig = {
  business: Pick<Business, "name" | "slug" | "brandColor" | "welcomeMessage">;
  suggestions: string[];
};

export type WidgetConversationResponse = {
  conversation: Conversation;
};

export type ShiftEntry = {
  id: string;
  teamMember: string;
  role: string;
  start: string;
  end: string;
  notes?: string;
};

export type EmployeeEntry = {
  id: string;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  roles: string[];
  availability: string[];
  maxHoursPerWeek?: number | null;
  notes?: string | null;
  active: boolean;
  createdAt: string;
};

export type AutomationEntry = {
  id: string;
  title: string;
  type: "INVOICE_REMINDER" | "INVENTORY_CHECK" | "FOLLOW_UP" | "OTHER";
  schedule: "DAILY" | "WEEKLY" | "MONTHLY" | "MANUAL";
  enabled: boolean;
  lastRunAt?: string;
};

export type RegionalSettings = {
  defaultLanguage: "en-CA" | "fr-CA";
  additionalLanguages: string[];
  province: string;
  timezone: string;
  currency: "CAD";
};

export type SuperadminUser = {
  id: string;
  name: string;
  email: string;
  role: "SUPERADMIN";
  active?: boolean;
  lastLoginAt?: string | null;
};

export type PlatformSession = {
  token: string;
  superadmin: SuperadminUser;
};

export type PlatformManagedUser = {
  id: string;
  name: string;
  email: string;
  role: "OWNER" | "ADMIN" | "AGENT";
  active: boolean;
  businessId: string;
  business: {
    id: string;
    name: string;
    slug: string;
    status: "ACTIVE" | "SUSPENDED";
  };
  createdAt: string;
};

export type PlatformBusiness = {
  id: string;
  name: string;
  slug: string;
  email: string;
  websiteUrl?: string | null;
  status: "ACTIVE" | "SUSPENDED";
  subscriptionPlan: "FREE" | "PRO" | "ENTERPRISE";
  subscriptionStatus: "NONE" | "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELED";
  users: Array<{ id: string; name: string; email: string; active: boolean }>;
  createdAt: string;
};

export type PlatformAnalyticsSummary = {
  businesses: number;
  suspendedBusinesses: number;
  users: number;
  conversations: number;
  bookings: number;
};

export const authApi = {
  signup(payload: {
    businessName: string;
    businessEmail: string;
    websiteUrl?: string;
    name: string;
    email: string;
    password: string;
  }) {
    return client.post<AuthResponse>("/api/auth/signup", payload);
  },
  login(payload: { email: string; password: string }) {
    return client.post<AuthResponse>("/api/auth/login", payload);
  },
  firebaseSignup(payload: {
    idToken: string;
    businessName: string;
    businessEmail: string;
    websiteUrl?: string;
    name: string;
  }) {
    return client.post<AuthResponse>("/api/auth/firebase/signup", payload);
  },
  firebaseLogin(payload: { idToken: string }) {
    return client.post<AuthResponse>("/api/auth/firebase/login", payload);
  },
  me() {
    return client.get<{ user: AuthUser; business: Business }>("/api/auth/me");
  },
};

export const adminApi = {
  getOverview() {
    return client.get<DashboardOverview>("/api/admin/overview");
  },
  getKnowledge() {
    return client.get<{ items: KnowledgeItem[] }>("/api/admin/knowledge");
  },
  createKnowledge(formData: FormData) {
    return client.post<{ item: KnowledgeItem }>("/api/admin/knowledge", formData);
  },
  updateKnowledge(id: string, payload: { title: string; sourceType: string; content: string }) {
    return client.put<{ item: KnowledgeItem }>(`/api/admin/knowledge/${id}`, payload);
  },
  deleteKnowledge(id: string) {
    return client.delete(`/api/admin/knowledge/${id}`);
  },
  getConversations() {
    return client.get<{ conversations: Conversation[] }>("/api/admin/conversations");
  },
  toggleTakeover(id: string, enabled: boolean) {
    return client.post<{ conversation: Conversation }>(`/api/admin/conversations/${id}/takeover`, {
      enabled,
    });
  },
  sendAdminReply(id: string, content: string) {
    return client.post<{ conversation: Conversation }>(`/api/admin/conversations/${id}/messages`, {
      content,
    });
  },
  getBookings() {
    return client.get<{ bookings: Booking[] }>("/api/admin/bookings");
  },
  getWidgetSettings() {
    return client.get<{
      business: Business;
      widgetSnippet: string;
      whatsappWebhookUrl: string;
      whatsappConfigured: boolean;
    }>("/api/admin/widget");
  },
  updateSettings(payload: {
    brandColor: string;
    welcomeMessage: string;
    websiteUrl?: string;
    whatsappVerifyToken?: string;
    whatsappAccessToken?: string;
    whatsappPhoneNumberId?: string;
  }) {
    return client.put<{
      business: Business;
      whatsappConfigured?: boolean;
      whatsappWebhookPath?: string;
    }>("/api/admin/settings", payload);
  },
  getShifts() {
    return client.get<{ shifts: ShiftEntry[] }>("/api/admin/shifts");
  },
  createShift(payload: Omit<ShiftEntry, "id">) {
    return client.post<{ shift: ShiftEntry }>("/api/admin/shifts", payload);
  },
  autoAssignShift(payload: { role: string; start: string; end: string; notes?: string }) {
    return client.post<{
      shift: ShiftEntry;
      assignment: {
        employeeId: string;
        employeeName: string;
        confidence: number;
        reason: string;
      };
    }>("/api/admin/shifts/auto-assign", payload);
  },
  getEmployees() {
    return client.get<{ employees: EmployeeEntry[] }>("/api/admin/employees");
  },
  createEmployee(payload: {
    fullName: string;
    email?: string;
    phone?: string;
    roles: string[];
    availability: string[];
    maxHoursPerWeek?: number;
    notes?: string;
    active?: boolean;
  }) {
    return client.post<{ employee: EmployeeEntry }>("/api/admin/employees", payload);
  },
  getAutomations() {
    return client.get<{ automations: AutomationEntry[] }>("/api/admin/automations");
  },
  createAutomation(payload: Omit<AutomationEntry, "id" | "lastRunAt">) {
    return client.post<{ automation: AutomationEntry }>("/api/admin/automations", payload);
  },
  runAutomation(id: string) {
    return client.post<{ automation: AutomationEntry; result: string }>(`/api/admin/automations/${id}/run`);
  },
  getReportSummary(period: "daily" | "weekly") {
    return client.get<{
      summary: {
        period: string;
        from: string;
        to: string;
        totalConversations: number;
        humanHandoffs: number;
        qualifiedLeads: number;
        bookingsCaptured: number;
        bookingStatuses: Record<string, number>;
      };
    }>(`/api/admin/reports/summary?period=${period}`);
  },
  getRegionalSettings() {
    return client.get<{ settings: RegionalSettings }>("/api/admin/regional-settings");
  },
  updateRegionalSettings(payload: RegionalSettings) {
    return client.put<{ settings: RegionalSettings }>("/api/admin/regional-settings", payload);
  },
  getInternalAssistantAnswer(question: string, context = "INTERNAL") {
    return client.get<{ answer: string; usedKnowledgeSnippets: { id: string; score: number }[] }>(
      `/api/admin/internal-assistant?question=${encodeURIComponent(question)}&context=${encodeURIComponent(context)}`,
    );
  },
  getSupportReply(payload: {
    customerMessage: string;
    channel?: string;
    priority?: "LOW" | "NORMAL" | "HIGH";
  }) {
    return client.post<{
      suggestedReply: string;
      priority: string;
      channel: string;
      groundingSnippetCount: number;
    }>("/api/admin/support/reply", payload);
  },
};

export const widgetApi = {
  getConfig(slug: string) {
    return client.get<WidgetConfig>(`/api/widget/${slug}/config`);
  },
  sendMessage(
    slug: string,
    payload: {
      conversationId?: string;
      message: string;
      visitorName?: string;
      visitorEmail?: string;
    },
  ) {
    return client.post<{
      conversation: Conversation;
      booking: Booking | null;
      assistantMessage: string;
    }>(`/api/widget/${slug}/messages`, payload);
  },
  getConversation(slug: string, conversationId: string) {
    return client.get<WidgetConversationResponse>(`/api/widget/${slug}/conversations/${conversationId}`);
  },
};

export const platformApi = {
  login(payload: { email: string; password: string }) {
    return platformClient.post<PlatformSession>("/api/platform/auth/login", payload);
  },
  me() {
    return platformClient.get<{ superadmin: SuperadminUser }>("/api/platform/auth/me");
  },
  getUsers(query = "") {
    const suffix = query.trim() ? `?q=${encodeURIComponent(query.trim())}` : "";
    return platformClient.get<{ users: PlatformManagedUser[] }>(`/api/platform/users${suffix}`);
  },
  createUser(payload: {
    businessId: string;
    name: string;
    email: string;
    password: string;
    role: "OWNER" | "ADMIN" | "AGENT";
  }) {
    return platformClient.post<{ user: PlatformManagedUser }>("/api/platform/users", payload);
  },
  updateUser(id: string, payload: { name?: string; role?: "OWNER" | "ADMIN" | "AGENT"; active?: boolean }) {
    return platformClient.patch<{ user: PlatformManagedUser }>(`/api/platform/users/${id}`, payload);
  },
  getBusinesses(query = "") {
    const suffix = query.trim() ? `?q=${encodeURIComponent(query.trim())}` : "";
    return platformClient.get<{ businesses: PlatformBusiness[] }>(`/api/platform/businesses${suffix}`);
  },
  updateBusiness(
    id: string,
    payload: {
      status?: "ACTIVE" | "SUSPENDED";
      subscriptionPlan?: "FREE" | "PRO" | "ENTERPRISE";
      subscriptionStatus?: "NONE" | "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELED";
    },
  ) {
    return platformClient.patch<{ business: PlatformBusiness }>(`/api/platform/businesses/${id}`, payload);
  },
  getAnalytics() {
    return platformClient.get<{ summary: PlatformAnalyticsSummary }>("/api/platform/analytics");
  },
  impersonate(userId: string) {
    return platformClient.post<AuthResponse>("/api/platform/impersonate", { userId });
  },
};

export async function getDashboardPayload(): Promise<DashboardPayload> {
  const [{ data: overview }, { data: knowledge }, { data: conversations }, { data: bookings }, { data: widget }] =
    await Promise.all([
      adminApi.getOverview(),
      adminApi.getKnowledge(),
      adminApi.getConversations(),
      adminApi.getBookings(),
      adminApi.getWidgetSettings(),
    ]);

  return {
    business: overview.business,
    metrics: overview.metrics,
    recentConversations: overview.recentConversations,
    recentBookings: overview.recentBookings,
    conversations: conversations.conversations,
    bookings: bookings.bookings,
    knowledgeItems: knowledge.items,
    widgetSnippet: widget.widgetSnippet,
  };
}
