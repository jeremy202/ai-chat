import { computed, reactive, ref } from "vue";
import { type Router } from "vue-router";
import {
  adminApi,
  type Booking,
  type Conversation,
  type DashboardOverview,
  type KnowledgeItem,
} from "../services/api";
import { useAuthStore } from "../stores/auth";
import { useLocaleStore } from "../stores/locale";

export function useDashboardOps() {
  const auth = useAuthStore();
  const locale = useLocaleStore();

  const loading = ref(true);
  const savingKnowledge = ref(false);
  const editingKnowledgeId = ref<string | null>(null);
  const replyingConversationId = ref<string | null>(null);
  const error = ref("");
  const success = ref("");

  const overview = ref<DashboardOverview | null>(null);
  const knowledgeItems = ref<KnowledgeItem[]>([]);
  const conversations = ref<Conversation[]>([]);
  const bookings = ref<Booking[]>([]);
  const widgetSnippet = ref("");

  const knowledgeForm = reactive({
    title: "",
    sourceType: "FAQ",
    content: "",
  });

  const replyDrafts = reactive<Record<string, string>>({});

  const business = computed(() => overview.value?.business ?? auth.business);

  const cards = computed(() => {
    const metrics = overview.value?.metrics;
    if (!metrics) return [];

    return [
      {
        label: locale.t("dashboard.cards.chats"),
        value: metrics.totalChats,
        helper: locale.t("dashboard.cards.chatsHelper"),
      },
      {
        label: locale.t("dashboard.cards.qualified"),
        value: metrics.qualifiedLeads,
        helper: locale.t("dashboard.cards.qualifiedHelper"),
      },
      {
        label: locale.t("dashboard.cards.bookings"),
        value: metrics.bookings,
        helper: locale.t("dashboard.cards.bookingsHelper"),
      },
      {
        label: locale.t("dashboard.cards.conversion"),
        value: `${metrics.conversionRate}%`,
        helper: locale.t("dashboard.cards.conversionHelper"),
      },
    ];
  });

  const sortedConversations = computed(() =>
    [...conversations.value].sort(
      (left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
    ),
  );

  const recentBookings = computed(() => bookings.value.slice(0, 8));
  const openConversations = computed(
    () => conversations.value.filter((conversation) => conversation.status === "OPEN").length,
  );
  const humanHandoffConversations = computed(
    () => conversations.value.filter((conversation) => conversation.status === "HUMAN").length,
  );

  const bookingStatusSummary = computed(() => {
    const summary: Record<string, number> = {};
    for (const booking of bookings.value) {
      summary[booking.status] = (summary[booking.status] ?? 0) + 1;
    }

    return Object.entries(summary)
      .map(([status, count]) => ({ status, count }))
      .sort((a, b) => b.count - a.count);
  });

  const recentActivity = computed(() => {
    const conversationEvents = sortedConversations.value.slice(0, 5).map((conversation) => ({
      id: conversation.id,
      type: "Conversation",
      title: conversation.visitorName ?? conversation.visitorEmail ?? locale.t("dashboard.common.anonymousGuest"),
      subtitle: `${conversation.status} · ${conversation.leadStatus}`,
      timestamp: conversation.updatedAt,
    }));

    const bookingEvents = bookings.value.slice(0, 5).map((booking) => ({
      id: booking.id,
      type: "Booking",
      title: booking.guestName ?? booking.email ?? locale.t("dashboard.common.guestLead"),
      subtitle: booking.status,
      timestamp: booking.createdAt,
    }));

    return [...conversationEvents, ...bookingEvents]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 6);
  });

  function formatDate(value?: string | null) {
    if (!value) return locale.t("dashboard.common.notProvided");

    return new Intl.DateTimeFormat("en-CA", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(value));
  }

  function summarizeConversation(conversation: Conversation) {
    const latest = conversation.messages[conversation.messages.length - 1];
    return latest?.content ?? locale.t("dashboard.common.noMessages");
  }

  async function loadData() {
    loading.value = true;
    error.value = "";

    try {
      const [overviewResponse, knowledgeResponse, conversationResponse, bookingResponse, widgetResponse] =
        await Promise.all([
          adminApi.getOverview(),
          adminApi.getKnowledge(),
          adminApi.getConversations(),
          adminApi.getBookings(),
          adminApi.getWidgetSettings(),
        ]);

      overview.value = overviewResponse.data;
      knowledgeItems.value = knowledgeResponse.data.items;
      conversations.value = conversationResponse.data.conversations;
      bookings.value = bookingResponse.data.bookings;
      widgetSnippet.value = widgetResponse.data.widgetSnippet;
    } catch (loadError) {
      error.value =
        loadError instanceof Error ? loadError.message : "Unable to load your hospitality dashboard.";
    } finally {
      loading.value = false;
    }
  }

  async function uploadKnowledge() {
    if (!knowledgeForm.title.trim() || !knowledgeForm.content.trim()) {
      error.value = "Provide a title and content before indexing knowledge.";
      return;
    }

    savingKnowledge.value = true;
    error.value = "";
    success.value = "";

    try {
      const formData = new FormData();
      formData.append("title", knowledgeForm.title.trim());
      formData.append("sourceType", knowledgeForm.sourceType);
      formData.append("content", knowledgeForm.content.trim());

      await adminApi.createKnowledge(formData);
      knowledgeForm.title = "";
      knowledgeForm.sourceType = "FAQ";
      knowledgeForm.content = "";
      success.value = "Knowledge indexed successfully. AI will now use it in responses.";
      await loadData();
    } catch (uploadError) {
      error.value = uploadError instanceof Error ? uploadError.message : "Could not upload knowledge.";
    } finally {
      savingKnowledge.value = false;
    }
  }

  async function deleteKnowledge(id: string) {
    error.value = "";
    success.value = "";
    try {
      await adminApi.deleteKnowledge(id);
      success.value = "Knowledge item deleted.";
      await loadData();
    } catch (deleteError) {
      error.value = deleteError instanceof Error ? deleteError.message : "Unable to delete knowledge item.";
    }
  }

  function startEditKnowledge(item: KnowledgeItem) {
    editingKnowledgeId.value = item.id;
    knowledgeForm.title = item.title;
    knowledgeForm.sourceType = item.sourceType;
    knowledgeForm.content = item.rawContent;
    success.value = "";
    error.value = "";
  }

  function cancelEditKnowledge() {
    editingKnowledgeId.value = null;
    knowledgeForm.title = "";
    knowledgeForm.sourceType = "FAQ";
    knowledgeForm.content = "";
  }

  async function saveKnowledgeEdit() {
    if (!editingKnowledgeId.value) return;
    if (!knowledgeForm.title.trim() || !knowledgeForm.content.trim()) {
      error.value = "Provide a title and content before saving changes.";
      return;
    }

    savingKnowledge.value = true;
    error.value = "";
    success.value = "";
    try {
      await adminApi.updateKnowledge(editingKnowledgeId.value, {
        title: knowledgeForm.title.trim(),
        sourceType: knowledgeForm.sourceType,
        content: knowledgeForm.content.trim(),
      });
      success.value = "Knowledge updated successfully.";
      cancelEditKnowledge();
      await loadData();
    } catch (editError) {
      error.value = editError instanceof Error ? editError.message : "Unable to update knowledge item.";
    } finally {
      savingKnowledge.value = false;
    }
  }

  async function toggleTakeover(conversation: Conversation) {
    error.value = "";
    success.value = "";
    try {
      await adminApi.toggleTakeover(conversation.id, conversation.status !== "HUMAN");
      success.value =
        conversation.status === "HUMAN"
          ? "Conversation returned to AI mode."
          : "Conversation moved to human handoff.";
      await loadData();
    } catch (toggleError) {
      error.value =
        toggleError instanceof Error ? toggleError.message : "Unable to update handoff state.";
    }
  }

  async function sendReply(conversationId: string) {
    const content = replyDrafts[conversationId]?.trim();
    if (!content) return;

    replyingConversationId.value = conversationId;
    error.value = "";
    success.value = "";

    try {
      await adminApi.sendAdminReply(conversationId, content);
      replyDrafts[conversationId] = "";
      success.value = "Reply sent.";
      await loadData();
    } catch (replyError) {
      error.value = replyError instanceof Error ? replyError.message : "Unable to send admin reply.";
    } finally {
      replyingConversationId.value = null;
    }
  }

  async function copySnippet() {
    try {
      await navigator.clipboard.writeText(widgetSnippet.value);
      success.value = "Embed snippet copied.";
    } catch {
      error.value = "Clipboard copy failed. You can still copy it manually.";
    }
  }

  async function initialize(router: Router) {
    await auth.hydrate();
    if (!auth.isAuthenticated) {
      await router.push("/login");
      return false;
    }
    await loadData();
    return true;
  }

  function logout(router: Router) {
    auth.clearSession();
    router.push("/login");
  }

  return reactive({
    auth,
    loading,
    savingKnowledge,
    editingKnowledgeId,
    replyingConversationId,
    error,
    success,
    overview,
    knowledgeItems,
    conversations,
    bookings,
    widgetSnippet,
    knowledgeForm,
    replyDrafts,
    business,
    cards,
    sortedConversations,
    recentBookings,
    openConversations,
    humanHandoffConversations,
    bookingStatusSummary,
    recentActivity,
    formatDate,
    summarizeConversation,
    loadData,
    uploadKnowledge,
    startEditKnowledge,
    cancelEditKnowledge,
    saveKnowledgeEdit,
    deleteKnowledge,
    toggleTakeover,
    sendReply,
    copySnippet,
    initialize,
    logout,
  });
}
