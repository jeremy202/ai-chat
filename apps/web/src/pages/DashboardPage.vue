<script setup lang="ts">
import {
  ArrowLeft,
  BookOpen,
  Bot,
  CalendarDays,
  Copy,
  Inbox,
  LoaderCircle,
  LogOut,
  Mail,
  MessageSquare,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from 'lucide-vue-next'
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  adminApi,
  type Booking,
  type Conversation,
  type DashboardOverview,
  type KnowledgeItem,
} from '../services/api'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const auth = useAuthStore()

const loading = ref(true)
const savingKnowledge = ref(false)
const replyingConversationId = ref<string | null>(null)
const error = ref('')
const success = ref('')

const overview = ref<DashboardOverview | null>(null)
const knowledgeItems = ref<KnowledgeItem[]>([])
const conversations = ref<Conversation[]>([])
const bookings = ref<Booking[]>([])
const widgetSnippet = ref('')

const knowledgeForm = reactive({
  title: '',
  sourceType: 'FAQ',
  content: '',
})

const replyDrafts = reactive<Record<string, string>>({})

const business = computed(() => overview.value?.business ?? auth.business)

const cards = computed(() => {
  const metrics = overview.value?.metrics
  if (!metrics) return []

  return [
    {
      label: 'Chats handled',
      value: metrics.totalChats,
      helper: 'Guest conversations answered by AI',
      icon: MessageSquare,
    },
    {
      label: 'Qualified leads',
      value: metrics.qualifiedLeads,
      helper: 'Visitors who shared real booking intent',
      icon: Sparkles,
    },
    {
      label: 'Booking requests',
      value: metrics.bookings,
      helper: 'Captures ready for staff follow-up',
      icon: CalendarDays,
    },
    {
      label: 'Conversion rate',
      value: `${metrics.conversionRate}%`,
      helper: 'Simple ROI signal for operators',
      icon: ShieldCheck,
    },
  ]
})

const sortedConversations = computed(() =>
  [...conversations.value].sort(
    (left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
  ),
)

const recentBookings = computed(() => bookings.value.slice(0, 8))
const openConversations = computed(() =>
  conversations.value.filter((conversation) => conversation.status === 'OPEN').length,
)
const humanHandoffConversations = computed(() =>
  conversations.value.filter((conversation) => conversation.status === 'HUMAN').length,
)
const bookingStatusSummary = computed(() => {
  const summary: Record<string, number> = {}

  for (const booking of bookings.value) {
    summary[booking.status] = (summary[booking.status] ?? 0) + 1
  }

  return Object.entries(summary)
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count)
})
const recentActivity = computed(() => {
  const conversationEvents = sortedConversations.value.slice(0, 5).map((conversation) => ({
    id: conversation.id,
    type: 'Conversation',
    title: conversation.visitorName ?? conversation.visitorEmail ?? 'Anonymous guest',
    subtitle: `${conversation.status} · ${conversation.leadStatus}`,
    timestamp: conversation.updatedAt,
  }))

  const bookingEvents = bookings.value.slice(0, 5).map((booking) => ({
    id: booking.id,
    type: 'Booking',
    title: booking.guestName ?? booking.email ?? 'Guest lead',
    subtitle: booking.status,
    timestamp: booking.createdAt,
  }))

  return [...conversationEvents, ...bookingEvents]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 6)
})

function formatDate(value?: string | null) {
  if (!value) return 'Not provided'

  return new Intl.DateTimeFormat('en-CA', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value))
}

function summarizeConversation(conversation: Conversation) {
  const latest = conversation.messages[conversation.messages.length - 1]
  return latest?.content ?? 'No messages yet.'
}

async function loadData() {
  loading.value = true
  error.value = ''

  try {
    const [overviewResponse, knowledgeResponse, conversationResponse, bookingResponse, widgetResponse] =
      await Promise.all([
        adminApi.getOverview(),
        adminApi.getKnowledge(),
        adminApi.getConversations(),
        adminApi.getBookings(),
        adminApi.getWidgetSettings(),
      ])

    overview.value = overviewResponse.data
    knowledgeItems.value = knowledgeResponse.data.items
    conversations.value = conversationResponse.data.conversations
    bookings.value = bookingResponse.data.bookings
    widgetSnippet.value = widgetResponse.data.widgetSnippet
  } catch (loadError) {
    error.value =
      loadError instanceof Error ? loadError.message : 'Unable to load your hospitality dashboard.'
  } finally {
    loading.value = false
  }
}

async function uploadKnowledge() {
  if (!knowledgeForm.title.trim() || !knowledgeForm.content.trim()) {
    error.value = 'Provide a title and content before indexing knowledge.'
    return
  }

  savingKnowledge.value = true
  error.value = ''
  success.value = ''

  try {
    const formData = new FormData()
    formData.append('title', knowledgeForm.title.trim())
    formData.append('sourceType', knowledgeForm.sourceType)
    formData.append('content', knowledgeForm.content.trim())

    await adminApi.createKnowledge(formData)
    knowledgeForm.title = ''
    knowledgeForm.sourceType = 'FAQ'
    knowledgeForm.content = ''
    success.value = 'Knowledge indexed successfully. Your concierge can use it immediately.'
    await loadData()
  } catch (uploadError) {
    error.value = uploadError instanceof Error ? uploadError.message : 'Could not upload knowledge.'
  } finally {
    savingKnowledge.value = false
  }
}

async function toggleTakeover(conversation: Conversation) {
  error.value = ''
  success.value = ''

  try {
    await adminApi.toggleTakeover(conversation.id, conversation.status !== 'HUMAN')
    success.value =
      conversation.status === 'HUMAN'
        ? 'Conversation returned to AI mode.'
        : 'Conversation moved to human handoff.'
    await loadData()
  } catch (toggleError) {
    error.value =
      toggleError instanceof Error ? toggleError.message : 'Unable to update handoff state.'
  }
}

async function sendReply(conversationId: string) {
  const content = replyDrafts[conversationId]?.trim()
  if (!content) return

  replyingConversationId.value = conversationId
  error.value = ''
  success.value = ''

  try {
    await adminApi.sendAdminReply(conversationId, content)
    replyDrafts[conversationId] = ''
    success.value = 'Reply sent. Staff handoff transcript updated.'
    await loadData()
  } catch (replyError) {
    error.value = replyError instanceof Error ? replyError.message : 'Unable to send admin reply.'
  } finally {
    replyingConversationId.value = null
  }
}

async function copySnippet() {
  try {
    await navigator.clipboard.writeText(widgetSnippet.value)
    success.value = 'Embed snippet copied to clipboard.'
  } catch {
    error.value = 'Clipboard copy failed. You can still copy the snippet manually.'
  }
}

function logout() {
  auth.clearSession()
  router.push('/login')
}

onMounted(async () => {
  await auth.hydrate()

  if (!auth.isAuthenticated) {
    await router.push('/login')
    return
  }

  await loadData()
})
</script>

<template>
  <div class="min-h-screen bg-linear-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100">
    <div class="mx-auto grid max-w-[1600px] gap-6 px-4 py-6 lg:grid-cols-[270px_1fr] lg:px-6">
      <aside class="rounded-3xl border border-white/10 bg-linear-to-b from-slate-900 to-slate-950 p-4 shadow-[0_30px_80px_-40px_rgba(8,47,73,0.65)] lg:sticky lg:top-6 lg:h-[calc(100vh-3rem)]">
        <div class="flex items-center gap-3 border-b border-white/10 pb-4">
          <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-500/20 text-teal-300">
            <Bot class="h-5 w-5" />
          </div>
          <div>
            <p class="text-xs uppercase tracking-[0.2em] text-slate-400">AI Concierge</p>
            <p class="text-sm font-semibold text-white">{{ business?.name ?? 'Dashboard' }}</p>
          </div>
        </div>

        <nav class="mt-4 space-y-1.5">
          <a href="#overview" class="flex items-center gap-2 rounded-xl bg-teal-500/20 px-3 py-2 text-sm font-medium text-white">
            <MessageSquare class="h-4 w-4" />
            Overview
          </a>
          <a href="#knowledge" class="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-300 hover:bg-white/10 hover:text-white">
            <BookOpen class="h-4 w-4" />
            Knowledge
          </a>
          <a href="#inbox" class="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-300 hover:bg-white/10 hover:text-white">
            <Inbox class="h-4 w-4" />
            Inbox
          </a>
          <a href="#bookings" class="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-300 hover:bg-white/10 hover:text-white">
            <CalendarDays class="h-4 w-4" />
            Bookings
          </a>
          <a href="#widget" class="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-300 hover:bg-white/10 hover:text-white">
            <Sparkles class="h-4 w-4" />
            Widget
          </a>
        </nav>

        <div class="mt-6 space-y-2 border-t border-white/10 pt-4">
          <button
            type="button"
            class="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-slate-300 hover:bg-white/10 hover:text-white"
            @click="loadData"
          >
            <RefreshCw class="h-4 w-4" />
            Refresh data
          </button>
          <button
            type="button"
            class="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-slate-300 hover:bg-white/10 hover:text-white"
            @click="router.push('/')"
          >
            <ArrowLeft class="h-4 w-4" />
            Back to website
          </button>
          <button
            type="button"
            class="flex w-full items-center gap-2 rounded-xl bg-rose-500/15 px-3 py-2 text-left text-sm font-medium text-rose-200 hover:bg-rose-500/25"
            @click="logout"
          >
            <LogOut class="h-4 w-4" />
            Log out
          </button>
        </div>
      </aside>

      <main class="space-y-6">
        <header id="overview" class="rounded-3xl border border-white/10 bg-linear-to-br from-slate-900/90 to-slate-900/60 p-5 shadow-[0_24px_80px_-48px_rgba(45,212,191,0.55)] sm:p-6">
          <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p class="text-xs uppercase tracking-[0.2em] text-slate-400">Operations dashboard</p>
              <h1 class="mt-1 text-2xl font-semibold tracking-tight text-white">Hospitality Command Center</h1>
              <p class="mt-1 text-sm text-slate-300">
                Manage your concierge performance, conversations, and booking pipeline in one place.
              </p>
            </div>
            <div class="flex items-center gap-2">
              <span class="rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-medium text-emerald-300">
                Open: {{ openConversations }}
              </span>
              <span class="rounded-full bg-amber-500/20 px-3 py-1 text-xs font-medium text-amber-300">
                Handoff: {{ humanHandoffConversations }}
              </span>
            </div>
          </div>
        </header>

        <div v-if="error" class="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          {{ error }}
        </div>
        <div v-if="success" class="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
          {{ success }}
        </div>

        <div v-if="loading" class="flex min-h-[340px] items-center justify-center rounded-3xl border border-white/10 bg-slate-900/70">
          <div class="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200">
            <LoaderCircle class="h-4 w-4 animate-spin" />
            Loading concierge operations...
          </div>
        </div>

        <template v-else>
          <section class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <article
              v-for="card in cards"
              :key="card.label"
              class="rounded-2xl border border-white/10 bg-linear-to-b from-slate-900/75 to-slate-900/45 p-5"
            >
              <div class="flex items-start justify-between gap-3">
                <div>
                  <p class="text-sm text-slate-400">{{ card.label }}</p>
                  <p class="mt-2 text-3xl font-semibold tracking-tight text-white">{{ card.value }}</p>
                  <p class="mt-1 text-xs text-slate-500">{{ card.helper }}</p>
                </div>
                <div class="rounded-xl bg-teal-500/20 p-2 text-teal-300">
                  <component :is="card.icon" class="h-4 w-4" />
                </div>
              </div>
            </article>
          </section>

          <section class="grid gap-4 xl:grid-cols-[1.2fr_1fr_1fr]">
            <article class="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
              <p class="text-xs uppercase tracking-[0.2em] text-slate-400">Conversation operations</p>
              <div class="mt-3 grid gap-3 sm:grid-cols-2">
                <div class="rounded-xl border border-white/10 bg-white/5 p-3">
                  <p class="text-sm text-slate-400">Open now</p>
                  <p class="mt-1 text-2xl font-semibold text-white">{{ openConversations }}</p>
                </div>
                <div class="rounded-xl border border-white/10 bg-white/5 p-3">
                  <p class="text-sm text-slate-400">Human handoff</p>
                  <p class="mt-1 text-2xl font-semibold text-white">{{ humanHandoffConversations }}</p>
                </div>
              </div>
            </article>

            <article class="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
              <p class="text-xs uppercase tracking-[0.2em] text-slate-400">Booking pipeline status</p>
              <div class="mt-3 space-y-3">
                <div
                  v-for="status in bookingStatusSummary"
                  :key="status.status"
                  class="rounded-xl border border-white/10 bg-white/5 p-3"
                >
                  <div class="flex items-center justify-between text-sm">
                    <p class="text-slate-300">{{ status.status }}</p>
                    <p class="font-semibold text-white">{{ status.count }}</p>
                  </div>
                  <div class="mt-2 h-2 rounded-full bg-slate-800">
                    <div
                      class="h-2 rounded-full bg-teal-400"
                      :style="{ width: `${Math.max(8, (status.count / Math.max(1, bookings.length)) * 100)}%` }"
                    />
                  </div>
                </div>
                <p v-if="bookingStatusSummary.length === 0" class="text-sm text-slate-400">No booking statuses yet.</p>
              </div>
            </article>

            <article class="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
              <p class="text-xs uppercase tracking-[0.2em] text-slate-400">Recent activity</p>
              <div class="mt-3 space-y-3">
                <div
                  v-for="item in recentActivity"
                  :key="`${item.type}-${item.id}`"
                  class="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5"
                >
                  <div class="flex items-center justify-between text-xs text-slate-400">
                    <p>{{ item.type }}</p>
                    <p>{{ formatDate(item.timestamp) }}</p>
                  </div>
                  <p class="mt-1 text-sm font-medium text-white">{{ item.title }}</p>
                  <p class="text-xs text-slate-400">{{ item.subtitle }}</p>
                </div>
                <p v-if="recentActivity.length === 0" class="text-sm text-slate-400">Activity will appear here.</p>
              </div>
            </article>
          </section>

          <section class="grid gap-6 xl:grid-cols-[1fr_360px]">
            <div class="space-y-6">
              <article id="knowledge" class="rounded-2xl border border-white/10 bg-slate-900/70 p-6">
                <div class="flex items-start justify-between gap-4">
                  <div>
                    <p class="text-sm text-slate-400">Knowledge base</p>
                  <h2 class="mt-1 text-xl font-semibold tracking-tight text-white">Index hospitality knowledge</h2>
                  </div>
                  <BookOpen class="h-5 w-5 text-teal-300" />
                </div>
                <p class="mt-3 text-sm text-slate-300">
                  Upload FAQs, room details, pricing, and policies so responses stay grounded.
                </p>

                <form class="mt-5 grid gap-4" @submit.prevent="uploadKnowledge">
                  <div class="grid gap-4 md:grid-cols-[1fr_220px]">
                    <input
                      v-model="knowledgeForm.title"
                      type="text"
                      placeholder="Dog-friendly suites and winter pricing"
                      class="rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-teal-300"
                    />
                    <select
                      v-model="knowledgeForm.sourceType"
                      class="rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-teal-300"
                    >
                      <option value="FAQ">FAQ</option>
                      <option value="ROOM">ROOM</option>
                      <option value="POLICY">POLICY</option>
                      <option value="PRICING">PRICING</option>
                      <option value="SERVICE">SERVICE</option>
                      <option value="FILE">FILE</option>
                    </select>
                  </div>
                  <textarea
                    v-model="knowledgeForm.content"
                    rows="7"
                    placeholder="Describe room categories, amenities, rates, cancellation rules, breakfast policy, pet policy, and booking notes."
                    class="rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-teal-300"
                  />
                  <div class="flex justify-end">
                    <button
                      type="submit"
                      class="inline-flex items-center gap-2 rounded-full bg-teal-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-teal-400 disabled:cursor-not-allowed disabled:opacity-70"
                      :disabled="savingKnowledge"
                    >
                      <LoaderCircle v-if="savingKnowledge" class="h-4 w-4 animate-spin" />
                      <Sparkles v-else class="h-4 w-4" />
                      Index knowledge
                    </button>
                  </div>
                </form>

                <div class="mt-5 grid gap-3">
                  <article
                    v-for="item in knowledgeItems"
                    :key="item.id"
                    class="rounded-xl border border-white/10 bg-white/5 p-4"
                  >
                    <div class="flex items-start justify-between gap-3">
                      <div>
                        <p class="text-sm font-semibold text-white">{{ item.title }}</p>
                        <p class="mt-1 text-xs uppercase tracking-[0.2em] text-slate-400">{{ item.sourceType }}</p>
                      </div>
                      <span class="rounded-full bg-teal-500/20 px-2.5 py-1 text-xs text-teal-300">{{ item._count.chunks }} chunks</span>
                    </div>
                    <p class="mt-2 text-sm text-slate-300">
                      {{ item.rawContent.slice(0, 220) }}<span v-if="item.rawContent.length > 220">...</span>
                    </p>
                  </article>
                </div>
              </article>

              <article id="inbox" class="rounded-2xl border border-white/10 bg-slate-900/70 p-6">
                <div class="flex items-start justify-between gap-4">
                  <div>
                    <p class="text-sm text-slate-400">Conversation inbox</p>
                  <h2 class="mt-1 text-xl font-semibold tracking-tight text-white">Handoff and transcripts</h2>
                  </div>
                  <Inbox class="h-5 w-5 text-teal-300" />
                </div>

                <div class="mt-5 space-y-4">
                  <article
                    v-for="conversation in sortedConversations"
                    :key="conversation.id"
                    class="rounded-xl border border-white/10 bg-white/4 p-4 hover:bg-white/6"
                  >
                    <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div class="min-w-0 flex-1">
                        <div class="flex flex-wrap items-center gap-2">
                          <p class="text-sm font-semibold text-white">
                            {{ conversation.visitorName ?? conversation.visitorEmail ?? 'Anonymous guest' }}
                          </p>
                          <span class="rounded-full bg-cyan-500/20 px-2.5 py-1 text-xs text-cyan-200">{{ conversation.status }}</span>
                          <span class="rounded-full bg-amber-500/20 px-2.5 py-1 text-xs text-amber-200">{{ conversation.leadStatus }}</span>
                        </div>
                        <p class="mt-2 text-sm text-slate-300">{{ summarizeConversation(conversation) }}</p>
                        <p class="mt-2 text-xs uppercase tracking-[0.2em] text-slate-500">
                          Updated {{ formatDate(conversation.updatedAt) }} · {{ conversation.messages.length }} messages
                        </p>
                      </div>

                      <button
                        type="button"
                        class="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-white/20"
                        @click="toggleTakeover(conversation)"
                      >
                        <Mail class="h-3.5 w-3.5" />
                        {{ conversation.status === 'HUMAN' ? 'Return to AI' : 'Take over chat' }}
                      </button>
                    </div>

                    <div class="mt-3 grid gap-2">
                      <div
                        v-for="message in conversation.messages.slice(-4)"
                        :key="message.id"
                        class="rounded-lg px-3 py-2 text-sm"
                        :class="
                          message.role === 'USER'
                            ? 'bg-slate-800 text-slate-100'
                            : message.role === 'ASSISTANT'
                              ? 'bg-cyan-500/10 text-cyan-100'
                              : 'bg-emerald-500/10 text-emerald-100'
                        "
                      >
                        <span class="mr-2 text-[10px] uppercase tracking-[0.18em] text-slate-400">{{ message.role }}</span>
                        {{ message.content }}
                      </div>
                    </div>

                    <div class="mt-3 flex gap-2">
                      <input
                        v-model="replyDrafts[conversation.id]"
                        type="text"
                        placeholder="Send a human follow-up message..."
                        class="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-teal-300"
                      />
                      <button
                        type="button"
                        class="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-slate-900 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-70"
                        :disabled="replyingConversationId === conversation.id"
                        @click="sendReply(conversation.id)"
                      >
                        <LoaderCircle v-if="replyingConversationId === conversation.id" class="h-3.5 w-3.5 animate-spin" />
                        <Mail v-else class="h-3.5 w-3.5" />
                        Reply
                      </button>
                    </div>
                  </article>
                </div>
              </article>
            </div>

            <aside class="space-y-6">
              <article id="widget" class="rounded-2xl border border-white/10 bg-slate-900/70 p-6">
                <div class="flex items-start justify-between gap-4">
                  <div>
                    <p class="text-sm text-slate-400">Embed widget</p>
                  <h2 class="mt-1 text-xl font-semibold tracking-tight text-white">Install on any website</h2>
                  </div>
                  <Sparkles class="h-5 w-5 text-teal-300" />
                </div>
                <p class="mt-3 text-sm text-slate-300">
                  Paste this script into your footer or tag manager to load your concierge widget.
                </p>
                <div class="mt-4 rounded-xl border border-white/10 bg-slate-950 p-3">
                  <pre class="overflow-x-auto whitespace-pre-wrap text-xs text-cyan-100">{{ widgetSnippet }}</pre>
                </div>
                <button
                  type="button"
                  class="mt-4 inline-flex items-center gap-2 rounded-full bg-teal-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-teal-400"
                  @click="copySnippet"
                >
                  <Copy class="h-4 w-4" />
                  Copy snippet
                </button>
              </article>

              <article id="bookings" class="rounded-2xl border border-white/10 bg-slate-900/70 p-6">
                <div class="flex items-start justify-between gap-4">
                  <div>
                    <p class="text-sm text-slate-400">Booking pipeline</p>
                  <h2 class="mt-1 text-xl font-semibold tracking-tight text-white">Captured leads and requests</h2>
                  </div>
                  <CalendarDays class="h-5 w-5 text-teal-300" />
                </div>

                <div class="mt-4 space-y-3">
                  <article
                    v-for="booking in recentBookings"
                    :key="booking.id"
                    class="rounded-xl border border-white/10 bg-white/5 p-4"
                  >
                    <div class="flex items-start justify-between gap-3">
                      <div>
                        <p class="text-sm font-semibold text-white">
                          {{ booking.guestName ?? booking.conversation?.visitorName ?? 'Guest lead' }}
                        </p>
                        <p class="mt-1 text-xs text-slate-400">
                          {{ booking.email ?? booking.conversation?.visitorEmail ?? 'No email yet' }}
                        </p>
                      </div>
                      <span class="rounded-full bg-emerald-500/20 px-2.5 py-1 text-xs text-emerald-200">{{ booking.status }}</span>
                    </div>
                    <div class="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-400">
                      <p>Arrival: <span class="text-slate-200">{{ formatDate(booking.arrivalDate) }}</span></p>
                      <p>Departure: <span class="text-slate-200">{{ formatDate(booking.departureDate) }}</span></p>
                    </div>
                    <p class="mt-2 text-xs text-slate-400">
                      Guests: {{ booking.guests ?? 'Unknown' }} · Room: {{ booking.roomType ?? 'Flexible' }}
                    </p>
                  </article>
                </div>
              </article>

              <article class="rounded-2xl border border-teal-400/20 bg-linear-to-br from-teal-500/15 via-slate-900 to-indigo-500/20 p-6">
                <div class="flex items-start justify-between gap-4">
                  <div>
                    <p class="text-sm text-teal-300/80">Architecture</p>
                    <h2 class="mt-1 text-xl font-semibold text-white">Production-ready MVP</h2>
                  </div>
                  <ShieldCheck class="h-5 w-5 text-teal-300" />
                </div>
                <ul class="mt-4 space-y-2 text-sm text-slate-300">
                  <li>Vue dashboard and hosted widget UI</li>
                  <li>Express + TypeScript API</li>
                  <li>Prisma + PostgreSQL multi-tenant model</li>
                  <li>RAG retrieval for grounded concierge answers</li>
                  <li>SMTP notifications for new booking leads</li>
                </ul>
              </article>
            </aside>
          </section>
        </template>
      </main>
    </div>
  </div>
</template>
