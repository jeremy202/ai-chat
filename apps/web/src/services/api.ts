import axios from "axios";

function resolveApiBaseUrl() {
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

client.interceptors.request.use((config) => {
  const token = localStorage.getItem("ai-concierge-token");

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
    return client.get<{ business: Business; widgetSnippet: string }>("/api/admin/widget");
  },
  updateSettings(payload: {
    brandColor: string;
    welcomeMessage: string;
    websiteUrl?: string;
  }) {
    return client.put<{ business: Business }>("/api/admin/settings", payload);
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
